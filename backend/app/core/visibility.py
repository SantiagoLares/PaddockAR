from collections.abc import Iterable

PUBLIC_DATA_QUALITY_MARKERS = ("official", "verified")
DEFAULT_VISIBLE_CATEGORY_SLUGS = {
    "formula-1",
    "formula-2",
    "f3",
    "motogp",
    "wec",
    "turismo-carretera",
    "turismo-nacional-clase-3",
}
DEFAULT_HIDDEN_CATEGORY_SLUGS = {
    "turismo-nacional-clase-2",
    "tc2000",
    "top-race",
    "turismo-pista-c1",
    "turismo-pista-c2",
    "turismo-pista-c3",
    "tc-pick-up",
    "tc-pista",
    "tc-mouras",
    "tc-pista-mouras",
    "tc-pista-pick-up",
    "copa-bora",
    "turismo-4000-argentino",
}


def normalize_quality(value: str | None) -> str:
    return str(value or "").strip().lower()


def has_reliable_quality(value: str | None) -> bool:
    quality = normalize_quality(value)
    if not quality:
        return False
    return any(marker in quality for marker in PUBLIC_DATA_QUALITY_MARKERS)


def has_valid_source_url(value: str | None) -> bool:
    source = str(value or "").strip().lower()
    return source.startswith("http://") or source.startswith("https://")


def should_be_public_by_quality(*, data_quality: str | None, source_url: str | None) -> bool:
    return has_reliable_quality(data_quality) and has_valid_source_url(source_url)


def category_should_default_public(slug: str | None) -> bool:
    normalized = str(slug or "").strip().lower()
    if normalized in DEFAULT_HIDDEN_CATEGORY_SLUGS:
        return False
    if normalized in DEFAULT_VISIBLE_CATEGORY_SLUGS:
        return True
    return True


def obsolete_category_slugs() -> Iterable[str]:
    return tuple(sorted(DEFAULT_HIDDEN_CATEGORY_SLUGS))
