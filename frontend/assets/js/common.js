(function () {
  const LOCAL_API_BASE_URL = "http://127.0.0.1:8000";
  const PROD_API_BASE_URL = "https://paddockar.onrender.com";
  const IS_LOCAL = location.protocol !== "file:" && ["localhost", "127.0.0.1"].includes(location.hostname);
  const API_BASE_URL = IS_LOCAL ? LOCAL_API_BASE_URL : PROD_API_BASE_URL;
  const LOG_ENABLED = IS_LOCAL || localStorage.getItem("paddockar_debug") === "1";
  const ARG_TIMEZONE = "America/Argentina/Buenos_Aires";
  const ASSET_BASE_URL = location.pathname.includes("/admin/") ? "../assets" : "assets";

  const categoryColors = {
    F1: "var(--f1)",
    MotoGP: "var(--motogp)",
    F2: "var(--f2)",
    F3: "var(--f3)",
    WEC: "var(--wec)",
    TC: "var(--tc)",
    "TN C2": "var(--tn-c2)",
    "TN C3": "var(--tn)",
    TN: "var(--tn)",
  };

  const statusLabels = {
    scheduled: "PROXIMO",
    live: "EN VIVO",
    finished: "FINALIZADO",
    cancelled: "CANCELADO",
  };

  const categoryPageSlugAliases = {
    "formula-1": "f1",
    f1: "f1",
    "formula-2": "f2",
    f2: "f2",
    "formula-3": "f3",
    f3: "f3",
    motogp: "motogp",
    wec: "wec",
    "turismo-carretera": "tc",
    tc: "tc",
    "turismo-nacional-clase-2": "tn-c2",
    tnc2: "tn-c2",
    "tn-c2": "tn-c2",
    "turismo-nacional-clase-3": "tn-c3",
    tnc3: "tn-c3",
    "tn-c3": "tn-c3",
  };

  function categoryCode(category) {
    return String(category?.short_name || category?.slug || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "");
  }

  function getCategoryLogo(slug) {
    const map = {
      f1: `${ASSET_BASE_URL}/img/categories/f1.png`,
      f2: `${ASSET_BASE_URL}/img/categories/f2.png`,
      f3: `${ASSET_BASE_URL}/img/categories/f3.png`,
      motogp: `${ASSET_BASE_URL}/img/categories/motogp.png`,
      wec: `${ASSET_BASE_URL}/img/categories/wec.png`,
      tc: `${ASSET_BASE_URL}/img/categories/tc.png`,
      tn: `${ASSET_BASE_URL}/img/categories/tn.png`,
    };
    return map[slug] || null;
  }

  function categoryLogoSlug(category) {
    const code = categoryCode(category);
    const slug = String(category?.slug || "").toLowerCase();
    const shortName = String(category?.short_name || "").toUpperCase();

    if (code === "tn" || code === "tnc2" || code === "tnc3" || shortName.startsWith("TN")) return "tn";
    if (code === "formula1" || slug === "formula-1") return "f1";
    if (code === "formula2" || slug === "formula-2") return "f2";
    if (code === "formula3" || slug === "formula-3" || slug === "f3") return "f3";
    return code;
  }

  function categoryFamilyKey(category) {
    const shortName = String(category?.short_name || "").toUpperCase();
    if (shortName === "TN" || shortName.startsWith("TN C")) return "TN";
    return String(category?.short_name || "");
  }

  function categoryFamilyLabel(category) {
    return categoryFamilyKey(category) === "TN" ? "Turismo Nacional" : category?.name || category?.short_name || "";
  }

  function categoryPageSlug(category) {
    const slug = String(category?.slug || "").toLowerCase();
    const code = categoryCode(category);
    return categoryPageSlugAliases[slug] || categoryPageSlugAliases[code] || slug || code;
  }

  function categoryHref(category) {
    return `category.html?cat=${encodeURIComponent(categoryPageSlug(category))}`;
  }

  function normalizeCategoryParam(value) {
    const slug = String(value || "").trim().toLowerCase();
    return categoryPageSlugAliases[slug] || slug;
  }

  function eventDisplayName(event) {
    const categorySlug = normalizeCategoryParam(event?.category?.slug || event?.category?.short_name || "");
    const city = String(event?.circuit?.city || "").trim();
    const country = String(event?.circuit?.country || "").trim();
    const circuitName = String(event?.circuit?.name || "").trim();
    const fallbackName = String(event?.name || "").trim();

    if (categorySlug === "f1" || categorySlug === "f2") {
      return city || country || circuitName || fallbackName;
    }

    return fallbackName || city || country || circuitName;
  }

  function matchesCategoryFilter(category, filterValue) {
    if (filterValue === "all") return true;
    if (filterValue === "TN") return categoryFamilyKey(category) === "TN";
    return String(category?.short_name || "") === filterValue;
  }

  function renderCategoryBadge(category, { tag = "div", extraClass = "", attrs = "" } = {}) {
    const code = categoryCode(category);
    const classes = ["cat-badge", "has-wordmark", extraClass].filter(Boolean).join(" ");
    const attributes = attrs ? ` ${attrs}` : "";
    const label = category?.short_name || category?.name || "";
    const ariaLabel = attrs.includes("aria-label") ? "" : ` aria-label="${label}"`;
    const baseLabel = code === "tnc2" || code === "tnc3" ? "TN" : label;
    const classText = code === "tnc2" ? '<span class="category-class-text">Clase 2</span>' : code === "tnc3" ? '<span class="category-class-text">Clase 3</span>' : "";

    return `<${tag} class="${classes}" data-category-code="${code}"${ariaLabel}${attributes}><span class="category-wordmark">${baseLabel}</span>${classText}</${tag}>`;
  }

  function renderCategoryLogo(category, { tag = "span", extraClass = "", attrs = "" } = {}) {
    return renderCategoryBadge(category, { tag, extraClass: ["calendar-category-logo", extraClass].filter(Boolean).join(" "), attrs });
  }

  function isPrimarySession(session) {
    const type = String(session?.session_type || "").toLowerCase();
    return session?.is_feature === true || ["race", "final", "feature"].includes(type);
  }

  function getPrimaryEventSession(event) {
    const sessions = [...(event?.sessions || [])].filter(isPrimarySession);
    if (!sessions.length) return null;

    const withResults = sessions.find((session) => session.results?.length);
    return withResults || sessions.sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at))[0];
  }

  function getSessionWinner(session) {
    return session?.results?.find((result) => Number(result.position) === 1) || null;
  }

  function getEventWinner(event) {
    return getSessionWinner(getPrimaryEventSession(event));
  }

  function renderWinnerLine(winner, { compact = false } = {}) {
    if (!winner?.driver_name) return "";
    const label = compact ? "Ganador:" : "Ganador";
    return `<div class="winner-line"><span class="winner-icon" aria-hidden="true">🏆</span><span class="winner-label mono">${label}</span><span class="winner-name">${winner.driver_name}</span></div>`;
  }

  function isHighlightedRaceSession(session) {
    return isPrimarySession(session);
  }

  function isLiveSession(session) {
    if (!session) return false;
    if (String(session.status || "").toLowerCase() === "live") return true;

    const startsAt = session.starts_at ? new Date(session.starts_at).getTime() : NaN;
    const endsAt = session.ends_at ? new Date(session.ends_at).getTime() : NaN;
    const now = Date.now();

    return Number.isFinite(startsAt) && Number.isFinite(endsAt) && now >= startsAt && now < endsAt;
  }

  function createLogger(scope) {
    const prefix = scope ? `[${scope}]` : "[PaddockAR]";
    return {
      info: (...args) => LOG_ENABLED && console.info(prefix, ...args),
      error: (...args) => console.error(prefix, ...args),
    };
  }

  window.PaddockARCommon = {
    API_BASE_URL,
    ARG_TIMEZONE,
    categoryColors,
    categoryCode,
    getCategoryLogo,
    categoryFamilyKey,
    categoryFamilyLabel,
    categoryPageSlug,
    categoryHref,
    normalizeCategoryParam,
    eventDisplayName,
    matchesCategoryFilter,
    statusLabels,
    renderCategoryBadge,
    renderCategoryLogo,
    renderCategoryInsignia: renderCategoryBadge,
    isPrimarySession,
    getPrimaryEventSession,
    getSessionWinner,
    getEventWinner,
    renderWinnerLine,
    isHighlightedRaceSession,
    isLiveSession,
    createLogger,
  };
})();
