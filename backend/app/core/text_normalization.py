def normalize_display_text(value: str | None) -> str | None:
    if value is None:
        return None

    text = str(value)

    # Repair common UTF-8 mojibake that may still exist in legacy seeded rows.
    for _ in range(3):
        updated = text
        try:
            if "Ã" in updated or "Â" in updated:
                updated = updated.encode("latin1").decode("utf-8")
        except (UnicodeEncodeError, UnicodeDecodeError):
            pass

        if updated == text:
            break
        text = updated

    replacements = {
        "?rabes": "Árabes",
    }
    for old, new in replacements.items():
        text = text.replace(old, new)

    return text


def normalize_category(category) -> None:
    if not category:
        return
    category.name = normalize_display_text(category.name)
    category.short_name = normalize_display_text(category.short_name)


def normalize_circuit(circuit) -> None:
    if not circuit:
        return
    circuit.name = normalize_display_text(circuit.name)
    circuit.country = normalize_display_text(circuit.country)
    circuit.city = normalize_display_text(circuit.city)


def normalize_event(event) -> None:
    if not event:
        return
    event.name = normalize_display_text(event.name)
    normalize_category(getattr(event, "category", None))
    normalize_circuit(getattr(event, "circuit", None))

    for session in getattr(event, "sessions", []) or []:
        if session:
            session.name = normalize_display_text(session.name)


def normalize_session(session) -> None:
    if not session:
        return
    session.name = normalize_display_text(session.name)
    normalize_event(getattr(session, "event", None))
