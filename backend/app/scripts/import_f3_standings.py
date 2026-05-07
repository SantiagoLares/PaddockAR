import argparse
import json
from html.parser import HTMLParser
from pathlib import Path
from urllib.error import URLError
from urllib.request import Request, urlopen

from sqlalchemy import select

from app.core.database import SessionLocal, create_tables
from app.models.category import Category
from app.models.standing import Standing

DRIVERS_URL = "https://www.fiaformula3.com/Standings/Driver"
CONSTRUCTORS_URL = "https://www.fiaformula3.com/Standings/Team"
RESULTS_URL = "https://www.fiaformula3.com/Results?raceid={race_id}"
DEFAULT_JSON_PATH = Path(__file__).resolve().parents[1] / "seeds" / "data" / "standings" / "f3_2026.json"
CATEGORY_FILE = Path(__file__).resolve().parents[1] / "seeds" / "data" / "categories.json"
USER_AGENT = "PaddockAR/0.1 manual importer"
F3_CATEGORY_SLUGS = {"f3", "formula-3"}


class TextExtractor(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.parts: list[str] = []

    def handle_data(self, data: str) -> None:
        text = " ".join(data.split())
        if text:
            self.parts.append(text)

    def as_lines(self) -> list[str]:
        return self.parts


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Importa standings de F3 a la base de datos.")
    parser.add_argument(
        "--source",
        choices=("fallback", "official", "auto"),
        default="fallback",
        help="Fuente de importacion. fallback es la ruta manual estable; official intenta parsear FIA Formula 3; auto prueba official y cae a fallback.",
    )
    parser.add_argument(
        "--file",
        default=str(DEFAULT_JSON_PATH),
        help="Archivo JSON de fallback/manual.",
    )
    return parser.parse_args()


def normalize_name(value: str) -> str:
    return " ".join(str(value or "").strip().split())


def normalize_points(value) -> int:
    if isinstance(value, int):
        return value
    text = "".join(character for character in str(value or "0") if character.isdigit())
    return int(text or "0")


def fetch_page(url: str) -> str:
    request = Request(url, headers={"User-Agent": USER_AGENT})
    with urlopen(request, timeout=20) as response:
        return response.read().decode("utf-8", errors="replace")


def extract_embedded_page_data(html: str) -> dict:
    parser = TextExtractor()
    parser.feed(html)
    json_blob = next((part for part in reversed(parser.as_lines()) if part.startswith('{"props":')), None)
    if not json_blob:
        raise ValueError("No se encontro el JSON embebido de standings.")
    return json.loads(json_blob)["props"]["pageProps"]["pageData"]


def fetch_embedded_page_data(url: str) -> dict:
    return extract_embedded_page_data(fetch_page(url))


def build_completed_race_ids(page_data: dict) -> list[int]:
    standings = page_data.get("Standings", [])
    season_races = page_data.get("SeasonRaces", [])
    if not standings or not season_races:
        return []

    completed: list[int] = []
    for index, race in enumerate(season_races):
        race_has_points = any(
            index < len(row.get("RacePoints", []))
            and any(value is not None for value in row.get("RacePoints", [])[index])
            for row in standings
        )
        if race_has_points:
            completed.append(race["RaceId"])
    return completed


def collect_wins_from_results(race_ids: list[int]) -> tuple[dict[str, int], dict[str, int]]:
    driver_wins: dict[str, int] = {}
    team_wins: dict[str, int] = {}

    for race_id in race_ids:
        page_data = fetch_embedded_page_data(RESULTS_URL.format(race_id=race_id))
        for session in page_data.get("SessionResults", []):
            session_name = normalize_name(session.get("SessionName"))
            if session_name not in {"Sprint Race", "Feature Race"}:
                continue

            winner_name = normalize_name(session.get("WinnerFullName") or session.get("WinnerName"))
            results = session.get("Results") or []
            winner_team = normalize_name(results[0].get("TeamName")) if results else ""

            if winner_name:
                driver_wins[winner_name] = driver_wins.get(winner_name, 0) + 1
            if winner_team:
                team_wins[winner_team] = team_wins.get(winner_team, 0) + 1

    return driver_wins, team_wins


def derive_team_wins_from_drivers(drivers: list[dict], constructors: list[dict]) -> None:
    wins_by_team: dict[str, int] = {}
    for row in drivers:
        team_name = normalize_name(row.get("team_name"))
        if not team_name:
            continue
        wins_by_team[team_name] = wins_by_team.get(team_name, 0) + normalize_points(row.get("wins", 0))

    for row in constructors:
        team_name = normalize_name(row.get("team_name") or row.get("name"))
        row["wins"] = wins_by_team.get(team_name, normalize_points(row.get("wins", 0)))


def parse_official_payload() -> dict:
    drivers_page_data = fetch_embedded_page_data(DRIVERS_URL)
    constructors_page_data = fetch_embedded_page_data(CONSTRUCTORS_URL)
    completed_race_ids = build_completed_race_ids(drivers_page_data)
    driver_wins, team_wins = collect_wins_from_results(completed_race_ids)

    drivers = [
        {
            "position": row["Position"],
            "name": normalize_name(row.get("FullName") or row.get("DisplayName")),
            "team_name": normalize_name(row.get("TeamName") or row.get("FullName") or row.get("DisplayName")),
            "points": normalize_points(row.get("TotalPoints")),
            "wins": driver_wins.get(normalize_name(row.get("FullName") or row.get("DisplayName")), 0),
        }
        for row in drivers_page_data.get("Standings", [])
    ]
    constructors = [
        {
            "position": row["Position"],
            "name": normalize_name(row.get("FullName") or row.get("DisplayName")),
            "team_name": normalize_name(row.get("FullName") or row.get("DisplayName")),
            "points": normalize_points(row.get("TotalPoints")),
            "wins": team_wins.get(normalize_name(row.get("FullName") or row.get("DisplayName")), 0),
        }
        for row in constructors_page_data.get("Standings", [])
    ]

    if not drivers or not constructors:
        raise ValueError("No se pudieron parsear standings oficiales de Formula 3.")

    return {
        "category_slug": "f3",
        "season_year": 2026,
        "source": "official_fia_formula3",
        "source_note": "Importado desde FIA Formula 3 con parser best-effort sobre el JSON embebido. Las victorias se calculan desde las paginas oficiales de resultados Sprint Race y Feature Race para las rondas completadas.",
        "source_urls": {
            "drivers": DRIVERS_URL,
            "constructors": CONSTRUCTORS_URL,
        },
        "drivers": drivers,
        "constructors": constructors,
    }


def load_json_payload(path: Path) -> dict:
    with path.open("r", encoding="utf-8") as file:
        return json.load(file)


def load_payload(source: str, file_path: Path) -> tuple[dict, str]:
    if source == "fallback":
        return load_json_payload(file_path), f"fallback:{file_path}"

    if source == "official":
        return parse_official_payload(), "official:fiaformula3.com"

    try:
        payload = parse_official_payload()
        return payload, "official:fiaformula3.com"
    except (URLError, TimeoutError, ValueError, json.JSONDecodeError):
        return load_json_payload(file_path), f"fallback-auto:{file_path}"


def validate_rows(rows: list[dict], standing_type: str) -> list[dict]:
    normalized: list[dict] = []

    for row in rows:
        position = int(row["position"])
        name = normalize_name(row["name"])
        team_name = normalize_name(row.get("team_name"))
        points = normalize_points(row.get("points"))
        wins = normalize_points(row.get("wins", 0))

        if position < 1:
            raise ValueError(f"Invalid position for {standing_type}: {position}")
        if not name:
            raise ValueError(f"Missing name for {standing_type} position {position}")

        normalized.append(
            {
                "standing_type": standing_type,
                "position": position,
                "name": name,
                "team_name": team_name or None,
                "points": points,
                "wins": wins,
            }
        )

    normalized.sort(key=lambda item: item["position"])
    return normalized


def load_f3_category_payload() -> dict:
    with CATEGORY_FILE.open("r", encoding="utf-8") as file:
        categories = json.load(file)

    payload = next((item for item in categories if item.get("short_name") == "F3" or item.get("slug") in F3_CATEGORY_SLUGS), None)
    if payload is None:
        raise ValueError("No se encontro la definicion de F3 en categories.json.")
    return payload


def resolve_f3_category(db) -> Category:
    category = db.scalars(select(Category).where(Category.slug.in_(F3_CATEGORY_SLUGS))).first()
    if category is not None:
        return category

    payload = load_f3_category_payload()
    category = Category(
        name=payload["name"],
        short_name=payload["short_name"],
        slug=payload["slug"],
        color=payload.get("color"),
    )
    db.add(category)
    db.flush()
    return category


def upsert_rows(db, category: Category, rows: list[dict]) -> tuple[int, int]:
    created = 0
    updated = 0

    for row in rows:
        standing = db.scalars(
            select(Standing).where(
                Standing.category_id == category.id,
                Standing.standing_type == row["standing_type"],
                Standing.position == row["position"],
            )
        ).one_or_none()

        if standing is None:
            standing = Standing(
                category_id=category.id,
                standing_type=row["standing_type"],
                position=row["position"],
            )
            db.add(standing)
            created += 1
        else:
            updated += 1

        standing.name = row["name"]
        standing.team_name = row["team_name"]
        standing.points = row["points"]
        standing.wins = row["wins"]

    return created, updated


def import_f3_standings(source: str = "fallback", file_path: Path = DEFAULT_JSON_PATH) -> None:
    create_tables()
    payload, resolved_source = load_payload(source, file_path)
    derive_team_wins_from_drivers(payload.get("drivers", []), payload.get("constructors", []))
    drivers = validate_rows(payload.get("drivers", []), "drivers")
    constructors = validate_rows(payload.get("constructors", []), "constructors")

    if not drivers or not constructors:
        raise ValueError("El payload debe incluir standings de drivers y constructors.")

    db = SessionLocal()
    try:
        category = resolve_f3_category(db)
        drivers_created, drivers_updated = upsert_rows(db, category, drivers)
        constructors_created, constructors_updated = upsert_rows(db, category, constructors)
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()

    print(
        "F3 standings importados correctamente.",
        f"Fuente={resolved_source}.",
        f"Drivers creados={drivers_created}, actualizados={drivers_updated}.",
        f"Constructors creados={constructors_created}, actualizados={constructors_updated}.",
    )


def main() -> None:
    args = parse_args()
    import_f3_standings(source=args.source, file_path=Path(args.file))


if __name__ == "__main__":
    main()
