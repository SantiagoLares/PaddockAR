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

DRIVERS_URL = "https://www.fiaformula2.com/Standings/Driver?seasonid=183"
CONSTRUCTORS_URL = "https://www.fiaformula2.com/Standings/Team?seasonid=183"
DEFAULT_JSON_PATH = Path(__file__).resolve().parents[1] / "seeds" / "data" / "standings" / "f2_2026.json"
USER_AGENT = "PaddockAR/0.1 manual importer"
F2_CATEGORY_SLUGS = {"f2", "formula-2"}


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
    parser = argparse.ArgumentParser(description="Importa standings de F2 a la base de datos.")
    parser.add_argument(
        "--source",
        choices=("fallback", "official", "auto"),
        default="fallback",
        help="Fuente de importacion. fallback es la ruta manual estable; official intenta parsear FIA Formula 2; auto prueba official y cae a fallback.",
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


def parse_official_payload() -> dict:
    drivers_page_data = extract_embedded_page_data(fetch_page(DRIVERS_URL))
    constructors_page_data = extract_embedded_page_data(fetch_page(CONSTRUCTORS_URL))

    drivers = [
        {
            "position": row["Position"],
            "name": normalize_name(row.get("FullName") or row.get("DisplayName")),
            "team_name": normalize_name(row.get("TeamName")),
            "points": normalize_points(row.get("TotalPoints")),
            "wins": 0,
        }
        for row in drivers_page_data.get("Standings", [])
    ]
    constructors = [
        {
            "position": row["Position"],
            "name": normalize_name(row.get("FullName") or row.get("DisplayName")),
            "team_name": normalize_name(row.get("FullName") or row.get("DisplayName")),
            "points": normalize_points(row.get("TotalPoints")),
            "wins": 0,
        }
        for row in constructors_page_data.get("Standings", [])
    ]

    if not drivers or not constructors:
        raise ValueError("No se pudieron parsear standings oficiales de Formula 2.")

    return {
        "category_slug": "f2",
        "season_year": 2026,
        "source": "official_fia_formula2",
        "source_note": "Importado desde FIA Formula 2 con parser best-effort sobre el JSON embebido.",
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
        return parse_official_payload(), "official:fiaformula2.com"

    try:
        payload = parse_official_payload()
        return payload, "official:fiaformula2.com"
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


def resolve_f2_category(db) -> Category:
    category = db.scalars(select(Category).where(Category.slug.in_(F2_CATEGORY_SLUGS))).first()
    if category is None:
        raise ValueError("No se encontro la categoria F2 en la base de datos.")
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


def import_f2_standings(source: str = "fallback", file_path: Path = DEFAULT_JSON_PATH) -> None:
    create_tables()
    payload, resolved_source = load_payload(source, file_path)
    drivers = validate_rows(payload.get("drivers", []), "drivers")
    constructors = validate_rows(payload.get("constructors", []), "constructors")

    if not drivers or not constructors:
        raise ValueError("El payload debe incluir standings de drivers y constructors.")

    db = SessionLocal()
    try:
        category = resolve_f2_category(db)
        drivers_created, drivers_updated = upsert_rows(db, category, drivers)
        constructors_created, constructors_updated = upsert_rows(db, category, constructors)
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()

    print(
        "F2 standings importados correctamente.",
        f"Fuente={resolved_source}.",
        f"Drivers creados={drivers_created}, actualizados={drivers_updated}.",
        f"Constructors creados={constructors_created}, actualizados={constructors_updated}.",
    )


def main() -> None:
    args = parse_args()
    import_f2_standings(source=args.source, file_path=Path(args.file))


if __name__ == "__main__":
    main()
