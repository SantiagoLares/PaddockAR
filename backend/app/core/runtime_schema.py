from sqlalchemy import inspect, text

from app.core.visibility import DEFAULT_HIDDEN_CATEGORY_SLUGS, DEFAULT_VISIBLE_CATEGORY_SLUGS

TABLE_COLUMN_UPGRADES = {
    "categories": {
        "is_public": "ALTER TABLE categories ADD COLUMN is_public BOOLEAN NOT NULL DEFAULT TRUE",
        "is_active": "ALTER TABLE categories ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT TRUE",
    },
    "events": {
        "source_url": "ALTER TABLE events ADD COLUMN source_url TEXT NULL",
        "data_quality": "ALTER TABLE events ADD COLUMN data_quality VARCHAR(80) NULL",
        "source_note": "ALTER TABLE events ADD COLUMN source_note TEXT NULL",
        "is_public": "ALTER TABLE events ADD COLUMN is_public BOOLEAN NOT NULL DEFAULT TRUE",
        "is_active": "ALTER TABLE events ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT TRUE",
    },
    "sessions": {
        "is_feature": "ALTER TABLE sessions ADD COLUMN is_feature BOOLEAN NOT NULL DEFAULT FALSE",
        "source_url": "ALTER TABLE sessions ADD COLUMN source_url TEXT NULL",
        "data_quality": "ALTER TABLE sessions ADD COLUMN data_quality VARCHAR(80) NULL",
        "source_note": "ALTER TABLE sessions ADD COLUMN source_note TEXT NULL",
        "is_public": "ALTER TABLE sessions ADD COLUMN is_public BOOLEAN NOT NULL DEFAULT TRUE",
        "is_active": "ALTER TABLE sessions ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT TRUE",
    },
}


def ensure_runtime_schema(engine) -> list[str]:
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

        hidden = "', '".join(sorted(DEFAULT_HIDDEN_CATEGORY_SLUGS))
        visible = "', '".join(sorted(DEFAULT_VISIBLE_CATEGORY_SLUGS))
        if hidden:
            connection.execute(
                text(
                    f"""
                    UPDATE categories
                    SET is_public = FALSE,
                        is_active = FALSE
                    WHERE slug IN ('{hidden}')
                    """,
                ),
            )
        if visible:
            connection.execute(
                text(
                    f"""
                    UPDATE categories
                    SET is_public = TRUE,
                        is_active = TRUE
                    WHERE slug IN ('{visible}')
                    """,
                ),
            )

    return applied
