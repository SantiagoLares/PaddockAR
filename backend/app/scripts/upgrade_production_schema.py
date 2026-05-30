from sqlalchemy import inspect

from app.core.database import Base, engine
from app.core.runtime_schema import ensure_runtime_schema

REQUIRED_TABLES = ("results", "standings")


def ensure_all_tables() -> None:
    from app import models  # noqa: F401

    Base.metadata.create_all(bind=engine)


def verify_required_tables() -> list[str]:
    inspector = inspect(engine)
    existing_tables = set(inspector.get_table_names())
    return [table_name for table_name in REQUIRED_TABLES if table_name in existing_tables]


def main() -> None:
    print("Iniciando upgrade seguro de schema usando DATABASE_URL actual.")
    ensure_all_tables()
    print("Base.metadata.create_all ejecutado.")

    added_columns = ensure_runtime_schema(engine)
    if added_columns:
        print(f"Columnas agregadas: {', '.join(added_columns)}")
    else:
        print("No hizo falta agregar columnas nuevas.")

    available_tables = verify_required_tables()
    missing_tables = [table_name for table_name in REQUIRED_TABLES if table_name not in available_tables]

    if available_tables:
        print(f"Tablas verificadas: {', '.join(available_tables)}")
    if missing_tables:
        raise RuntimeError(f"Faltan tablas requeridas despues del upgrade: {', '.join(missing_tables)}")

    print("Upgrade de schema completado sin borrar datos.")


if __name__ == "__main__":
    main()
