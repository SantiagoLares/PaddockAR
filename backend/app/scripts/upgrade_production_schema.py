from sqlalchemy import inspect, text

from app.core.database import Base, engine


TABLE_COLUMN_UPGRADES = {
    "events": {
        "data_quality": "ALTER TABLE events ADD COLUMN data_quality VARCHAR(80) NULL",
        "source_note": "ALTER TABLE events ADD COLUMN source_note TEXT NULL",
    },
    "sessions": {
        "is_feature": "ALTER TABLE sessions ADD COLUMN is_feature BOOLEAN NOT NULL DEFAULT FALSE",
        "data_quality": "ALTER TABLE sessions ADD COLUMN data_quality VARCHAR(80) NULL",
        "source_note": "ALTER TABLE sessions ADD COLUMN source_note TEXT NULL",
    },
}

REQUIRED_TABLES = ("results", "standings")


def ensure_all_tables() -> None:
    from app import models  # noqa: F401

    Base.metadata.create_all(bind=engine)


def ensure_columns() -> list[str]:
    inspector = inspect(engine)
    applied: list[str] = []

    with engine.begin() as connection:
        for table_name, upgrades in TABLE_COLUMN_UPGRADES.items():
            existing_columns = {column["name"] for column in inspector.get_columns(table_name)}
            for column_name, statement in upgrades.items():
                if column_name in existing_columns:
                    continue
                connection.execute(text(statement))
                applied.append(f"{table_name}.{column_name}")

    return applied


def verify_required_tables() -> list[str]:
    inspector = inspect(engine)
    existing_tables = set(inspector.get_table_names())
    return [table_name for table_name in REQUIRED_TABLES if table_name in existing_tables]


def main() -> None:
    print("Iniciando upgrade seguro de schema usando DATABASE_URL actual.")
    ensure_all_tables()
    print("Base.metadata.create_all ejecutado.")

    added_columns = ensure_columns()
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
