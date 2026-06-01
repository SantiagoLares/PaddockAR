import argparse
import json
import re
import unicodedata
from datetime import date, timedelta
from html.parser import HTMLParser
from pathlib import Path
from urllib.error import URLError
from urllib.request import Request, urlopen

DEFAULT_JSON_PATH = Path(__file__).resolve().parents[1] / "seeds" / "data" / "calendars" / "toprace_2026.json"
SOURCE_URL = "https://toprace.com.ar/toprace/calendario.html"
USER_AGENT = "PaddockAR/0.1 manual importer"
MONTH_MAP = {
    "ene": 1,
    "feb": 2,
    "mar": 3,
    "abr": 4,
    "may": 5,
    "jun": 6,
    "jul": 7,
    "ago": 8,
    "sep": 9,
    "set": 9,
    "oct": 10,
    "nov": 11,
    "dic": 12,
}
DATE_RE = re.compile(r"^(?P<day>\d{1,2})\s+(?P<month>[A-Za-záéíóúñÁÉÍÓÚÑ]+)$")
FECHA_RE = re.compile(r"^FECHA\s+\d+", re.IGNORECASE)


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


def slugify(value: str) -> str:
    text = unicodedata.normalize("NFKD", str(value))
    text = "".join(ch for ch in text if unicodedata.category(ch) != "Mn")
    text = text.lower()
    text = re.sub(r"[^\w\s-]", "", text)
    text = re.sub(r"[\s_]+", "-", text).strip("-")
    return text


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Importa el calendario oficial de Top Race y genera el JSON de semilla.")
    parser.add_argument(
        "--source",
        choices=("json", "official", "auto"),
        default="json",
        help="Fuente de importación. json carga el archivo local; official intenta parsear la web oficial; auto prueba official y cae a json.",
    )
    parser.add_argument(
        "--file",
        default=str(DEFAULT_JSON_PATH),
        help="Ruta de salida del archivo JSON de calendario Top Race.",
    )
    parser.add_argument(
        "--year",
        type=int,
        default=2026,
        help="Año del calendario a generar.",
    )
    return parser.parse_args()


def fetch_page(url: str) -> str:
    request = Request(url, headers={"User-Agent": USER_AGENT})
    with urlopen(request, timeout=20) as response:
        return response.read().decode("utf-8", errors="replace")


def extract_text_lines(html: str) -> list[str]:
    parser = TextExtractor()
    parser.feed(html)
    return parser.as_lines()


def normalize_event_name(label: str) -> str:
    label = label.strip()
    if not label or label.lower().startswith("a confirmar"):
        return "Top Race A Confirmar"
    if "-" in label:
        label = label.split("-")[0].strip()
    if "," in label:
        label = label.split(",")[0].strip()
    return f"Top Race {label}"


def infer_city_from_label(label: str) -> str | None:
    label = label.strip()
    lookup = {
        "buenos aires": "Buenos Aires",
        "san juan": "San Juan",
        "concordia": "Concordia",
        "toay": "Toay",
        "san nicolas": "San Nicolás",
        "san nicol\u00e1s": "San Nicolás",
    }
    normalized = unicodedata.normalize("NFKD", label).casefold()
    for key, city in lookup.items():
        if key in normalized:
            return city
    return None


def infer_timezone(city: str | None) -> str:
    if city == "San Juan":
        return "America/Argentina/San_Juan"
    return "America/Argentina/Buenos_Aires"


def parse_official_calendar(lines: list[str], year: int) -> dict:
    events: list[dict] = []
    index = 0
    while index < len(lines):
        line = lines[index]
        date_match = DATE_RE.match(line)
        if not date_match:
            index += 1
            continue

        day = int(date_match.group("day"))
        month_key = date_match.group("month").strip().lower()
        month = MONTH_MAP.get(month_key)
        if not month:
            index += 1
            continue

        next_line = lines[index + 1] if index + 1 < len(lines) else ""
        following = lines[index + 2] if index + 2 < len(lines) else ""
        circuit_line = next_line
        if FECHA_RE.match(following):
            extra = lines[index + 3] if index + 3 < len(lines) else ""
            if extra and extra.lower() != next_line.lower():
                circuit_line = extra

        start_date = date(year, month, day) - timedelta(days=2)
        event_name = normalize_event_name(next_line)
        city = infer_city_from_label(next_line)
        circuit_name = circuit_line if "a confirmar" not in circuit_line.lower() else "Circuito a Confirmar"
        data_quality = (
            "official_calendar_tentative_venue"
            if "a confirmar" in circuit_line.lower()
            else "confirmed_calendar"
        )

        if event_name == "Top Race A Confirmar":
            ordinal = len([item for item in events if item["name"] == event_name]) + 1
            event_slug = f"top-race-a-confirmar-{ordinal}-{year}"
            circuit_slug = f"top-race-a-confirmar-{ordinal}"
        else:
            event_slug = slugify(f"{event_name} {year}")
            circuit_slug = slugify(circuit_name if circuit_name else f"{event_name} {year}")

        event = {
            "round_number": len(events) + 1,
            "name": event_name,
            "slug": event_slug,
            "status": "scheduled",
            "data_quality": data_quality,
            "start_date": start_date.isoformat(),
            "end_date": date(year, month, day).isoformat(),
            "session_template": "arg_touring_standard",
            "circuit": {
                "name": circuit_name,
                "slug": circuit_slug,
                "country": "Argentina",
                "city": city,
                "timezone": infer_timezone(city),
            },
        }
        events.append(event)
        index += 1

    return {
        "category_slug": "top-race",
        "season_year": year,
        "source_note": "Calendario 2026 de Top Race verificado contra el calendario oficial de Top Race. Las primeras cinco fechas y sedes aparecen confirmadas; las fechas 6 a 10 se muestran con sede a confirmar.",
        "source_urls": {
            "official": SOURCE_URL,
        },
        "events": events,
    }


def load_json_payload(path: Path) -> dict:
    with path.open("r", encoding="utf-8") as file:
        return json.load(file)


def load_payload(source: str, file_path: Path, year: int) -> tuple[dict, str]:
    if source == "json":
        return load_json_payload(file_path), f"json:{file_path}"

    if source == "official":
        html = fetch_page(SOURCE_URL)
        return parse_official_calendar(extract_text_lines(html), year), f"official:{SOURCE_URL}"

    try:
        html = fetch_page(SOURCE_URL)
        return parse_official_calendar(extract_text_lines(html), year), f"official:{SOURCE_URL}"
    except (URLError, TimeoutError, ValueError):
        return load_json_payload(file_path), f"json-fallback:{file_path}"


def save_payload(path: Path, payload: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as file:
        json.dump(payload, file, indent=2, ensure_ascii=False)
        file.write("\n")


def main() -> None:
    args = parse_args()
    file_path = Path(args.file)
    payload, source_id = load_payload(args.source, file_path, args.year)
    save_payload(file_path, payload)
    print(f"Wrote {file_path} from {source_id}")


if __name__ == "__main__":
    main()
