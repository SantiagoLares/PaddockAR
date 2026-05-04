import argparse
import json
import re
from html.parser import HTMLParser
from pathlib import Path
from urllib.error import URLError
from urllib.request import Request, urlopen

from sqlalchemy import select

from app.core.database import SessionLocal, create_tables
from app.models.category import Category
from app.models.standing import Standing

DRIVERS_URL = "https://www.formula1.com/en/results/2026/drivers"
CONSTRUCTORS_URL = "https://www.formula1.com/en/results/2026/team"
DEFAULT_JSON_PATH = Path(__file__).resolve().parents[1] / "seeds" / "data" / "standings" / "f1_2026.json"
USER_AGENT = "PaddockAR/0.1 manual importer"
DRIVER_LINE_RE = re.compile(r"^(?P<position>\d+)\s*(?P<name>.+?)\s+[A-Z]{3}\s+[A-Z]{3}\s+(?P<team>.+?)\s+(?P<points>\d+)$")
CONSTRUCTOR_LINE_RE = re.compile(r"^(?P<position>\d+)\s*(?P<team>.+?)\s+(?P<points>\d+)$")
F1_CATEGORY_SLUGS = {"f1", "formula-1"}


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
    parser = argparse.ArgumentParser(description="Importa standings de F1 a la base de datos.")
    parser.add_argument(
        "--source",
        choices=("json", "official", "auto"),
        default="json",
        help="Fuente de importacion. json es la ruta manual estable; official intenta parsear Formula1.com; auto prueba official y cae a json.",
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
    text = re.sub(r"[^\d]", "", str(value or "0"))
    return int(text or "0")


def fetch_page(url: str) -> str:
    request = Request(url, headers={"User-Agent": USER_AGENT})
    with urlopen(request, timeout=20) as response:
        return response.read().decode("utf-8", errors="replace")


def extract_lines(html: str) -> list[str]:
    parser = TextExtractor()
    parser.feed(html)
    return parser.as_lines()


def parse_official_driver_lines(lines: list[str]) -> list[dict]:
    rows: list[dict] = []
    in_table = False

    for line in lines:
        if "2026 Drivers' Standings" in line:
            in_table = True
            continue
        if not in_table:
            continue
        if "OUR PARTNERS" in line:
            break

        match = DRIVER_LINE_RE.match(line)
        if not match:
            continue

        rows.append(
            {
                "position": int(match.group("position")),
                "name": normalize_name(match.group("name")),
                "team_name": normalize_name(match.group("team")),
                "points": int(match.group("points")),
                "wins": 0,
            }
        )

    return rows


def parse_official_constructor_lines(lines: list[str]) -> list[dict]:
    rows: list[dict] = []
    in_table = False

    for line in lines:
        if "2026 Teams' Standings" in line:
            in_table = True
            continue
        if not in_table:
            continue
        if "OUR PARTNERS" in line:
            break

        match = CONSTRUCTOR_LINE_RE.match(line)
        if not match:
            continue

        rows.append(
            {
                "position": int(match.group("position")),
                "name": normalize_name(match.group("team")),
                "team_name": normalize_name(match.group("team")),
                "points": int(match.group("points")),
                "wins": 0,
            }
        )

    return rows


def parse_official_payload() -> dict:
    drivers_html = fetch_page(DRIVERS_URL)
    constructors_html = fetch_page(CONSTRUCTORS_URL)
    drivers = parse_official_driver_lines(extract_lines(drivers_html))
    constructors = parse_official_constructor_lines(extract_lines(constructors_html))

    if not drivers or not constructors:
        raise ValueError("No se pudieron parsear standings oficiales de Formula 1.")

    return {
        "category_slug": "f1",
        "season_year": 2026,
        "source": "official_formula1",
        "source_note": "Importado desde Formula1.com con parser best-effort.",
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
    if source == "json":
        return load_json_payload(file_path), f"json:{file_path}"

    if source == "official":
        return parse_official_payload(), "official:formula1.com"

    try:
        payload = parse_official_payload()
        return payload, "official:formula1.com"
    except (URLError, TimeoutError, ValueError):
        return load_json_payload(file_path), f"json-fallback:{file_path}"


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


def resolve_f1_category(db) -> Category:
    category = db.scalars(select(Category).where(Category.slug.in_(F1_CATEGORY_SLUGS))).first()
    if category is None:
        raise ValueError("No se encontro la categoria F1 en la base de datos.")
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


def import_f1_standings(source: str = "json", file_path: Path = DEFAULT_JSON_PATH) -> None:
    create_tables()
    payload, resolved_source = load_payload(source, file_path)
    drivers = validate_rows(payload.get("drivers", []), "drivers")
    constructors = validate_rows(payload.get("constructors", []), "constructors")

    if not drivers or not constructors:
        raise ValueError("El payload debe incluir standings de drivers y constructors.")

    db = SessionLocal()
    try:
        category = resolve_f1_category(db)
        drivers_created, drivers_updated = upsert_rows(db, category, drivers)
        constructors_created, constructors_updated = upsert_rows(db, category, constructors)
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()

    print(
        "F1 standings importados correctamente.",
        f"Fuente={resolved_source}.",
        f"Drivers creados={drivers_created}, actualizados={drivers_updated}.",
        f"Constructors creados={constructors_created}, actualizados={constructors_updated}.",
    )


def main() -> None:
    args = parse_args()
    import_f1_standings(source=args.source, file_path=Path(args.file))


if __name__ == "__main__":
    main()
