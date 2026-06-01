(function () {
  const PUBLIC_SITE_URL = "https://paddockar.com.ar";
  const PROD_API_BASE_URL = "https://paddockar.onrender.com";
  const apiMode = new URLSearchParams(window.location.search).get("api");
  const PRIVATE_NETWORK_HOST_PATTERN = /^(localhost|127(?:\.\d{1,3}){3}|10(?:\.\d{1,3}){3}|192\.168(?:\.\d{1,3}){2}|172\.(?:1[6-9]|2\d|3[0-1])(?:\.\d{1,3}){2})$/;

  function isPrivateNetworkHost(hostname) {
    return PRIVATE_NETWORK_HOST_PATTERN.test(String(hostname || "").trim());
  }

  function resolveLocalApiBaseUrl() {
    if (location.protocol === "file:") {
      return "http://127.0.0.1:8000";
    }

    const protocol = location.protocol === "https:" ? "https:" : "http:";
    const hostname = isPrivateNetworkHost(location.hostname) ? location.hostname : "127.0.0.1";
    return `${protocol}//${hostname}:8000`;
  }

  const LOCAL_API_BASE_URL = resolveLocalApiBaseUrl();
  const IS_LOCAL_FRONTEND = location.protocol === "file:" || isPrivateNetworkHost(location.hostname);
  const USE_LOCAL_API = apiMode === "local" || (!apiMode && IS_LOCAL_FRONTEND);
  const API_BASE_URL = USE_LOCAL_API ? LOCAL_API_BASE_URL : PROD_API_BASE_URL;
  const API_HEALTH_URL = `${API_BASE_URL}/api/health`;
  const LOG_ENABLED = USE_LOCAL_API || IS_LOCAL_FRONTEND || localStorage.getItem("paddockar_debug") === "1";
  const ARG_TIMEZONE = "America/Argentina/Buenos_Aires";
  const ASSET_BASE_URL = location.pathname.includes("/admin/") ? "../assets" : "assets";
  const dayjsLib = window.dayjs;
  const lucideLib = window.lucide;

  if (dayjsLib && window.dayjs_plugin_utc) dayjsLib.extend(window.dayjs_plugin_utc);
  if (dayjsLib && window.dayjs_plugin_timezone) dayjsLib.extend(window.dayjs_plugin_timezone);
  if (dayjsLib && window.dayjs_plugin_relativeTime) dayjsLib.extend(window.dayjs_plugin_relativeTime);
  if (dayjsLib && window.dayjs_plugin_localizedFormat) dayjsLib.extend(window.dayjs_plugin_localizedFormat);
  if (dayjsLib) dayjsLib.locale("es");

  const categoryColors = {
    F1: "var(--f1)",
    MotoGP: "var(--motogp)",
    F2: "var(--f2)",
    F3: "var(--f3)",
    WEC: "var(--wec)",
    TC: "var(--tc)",
    TCP: "var(--tcp)",
    TCM: "var(--tcm)",
    TCPM: "var(--tcpm)",
    TCPK: "var(--tcpu)",
    TCPPK: "var(--tcppu)",
    TC2000: "var(--tc2000)",
    TR: "var(--tr)",
    T4000: "var(--t4000)",
    BORA: "var(--bora)",
    "TP C1": "var(--tp-c1)",
    "TP C2": "var(--tp-c2)",
    "TP C3": "var(--tp-c3)",
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
    "tc-pista": "tc-pista",
    tcp: "tc-pista",
    "tc-mouras": "tc-mouras",
    tcm: "tc-mouras",
    "tc-pista-mouras": "tc-pista-mouras",
    tcpm: "tc-pista-mouras",
    "tc-pick-up": "tc-pick-up",
    tcpk: "tc-pick-up",
    tcpu: "tc-pick-up",
    "tc-pista-pick-up": "tc-pista-pick-up",
    tcppk: "tc-pista-pick-up",
    tcppu: "tc-pista-pick-up",
    tc2000: "tc2000",
    "top-race": "top-race",
    tr: "top-race",
    "turismo-4000-argentino": "turismo-4000-argentino",
    t4000: "turismo-4000-argentino",
    "copa-bora": "copa-bora",
    bora: "copa-bora",
    "turismo-pista-c1": "turismo-pista-c1",
    tpc1: "turismo-pista-c1",
    "turismo-pista-c2": "turismo-pista-c2",
    tpc2: "turismo-pista-c2",
    "turismo-pista-c3": "turismo-pista-c3",
    tpc3: "turismo-pista-c3",
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

  const categoriesWithPrimaryLogos = new Set([
    "f1",
    "f2",
    "motogp",
    "wec",
    "tc",
    "tn",
  ]);

  function getCategoryLogo(slug) {
    if (!categoriesWithPrimaryLogos.has(slug)) return null;

    const map = {
      f1: `${ASSET_BASE_URL}/img/categories/f1.png`,
      f2: `${ASSET_BASE_URL}/img/categories/f2.png`,
      motogp: `${ASSET_BASE_URL}/img/categories/motogp.png`,
      wec: `${ASSET_BASE_URL}/img/categories/wec.png`,
      tc: `${ASSET_BASE_URL}/img/categories/tc.png`,
      tn: `${ASSET_BASE_URL}/img/categories/tn.png`,
    };
    return map[slug] || null;
  }

  function categoryFamilyKey(category) {
    const shortName = String(category?.short_name || "").toUpperCase();
    if (shortName === "TN" || shortName.startsWith("TN C")) return "TN";
    if (shortName === "TP" || shortName.startsWith("TP C")) return "TP";
    return String(category?.short_name || "");
  }

  function categoryFamilyLabel(category) {
    const familyKey = categoryFamilyKey(category);
    if (familyKey === "TN") return "Turismo Nacional";
    if (familyKey === "TP") return "Turismo Pista";
    return category?.name || category?.short_name || "";
  }

  function categoryPageSlug(category) {
    const slug = String(category?.slug || "").toLowerCase();
    const code = categoryCode(category);
    return categoryPageSlugAliases[slug] || categoryPageSlugAliases[code] || slug || code;
  }

  function categoryHref(category) {
    // Category detail pages always use `?cat=`; the generic "Categorias"
    // navigation goes to `index.html#categories` because that is a home section.
    return `category.html?cat=${encodeURIComponent(categoryPageSlug(category))}`;
  }

  function normalizeCategoryParam(value) {
    const slug = String(value || "").trim().toLowerCase();
    return categoryPageSlugAliases[slug] || slug;
  }

  function looksLikeMojibake(value) {
    return /(?:Ã.|Â.|â.|�)/.test(String(value || ""));
  }

  function repairMojibake(value) {
    if (typeof value !== "string" || !looksLikeMojibake(value) || !window.TextDecoder) {
      return value;
    }

    try {
      const bytes = Uint8Array.from(value, (char) => char.charCodeAt(0));
      const decoded = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
      return decoded && !decoded.includes("\uFFFD") ? decoded : value;
    } catch (_error) {
      return value;
    }
  }

  function repairText(value) {
    return typeof value === "string" ? repairMojibake(value) : value;
  }

  function repairEntityText(entity) {
    if (!entity || typeof entity !== "object") return entity;

    if (Array.isArray(entity)) {
      return entity.map((item) => repairEntityText(item));
    }

    return Object.fromEntries(
      Object.entries(entity).map(([key, value]) => {
        if (typeof value === "string") return [key, repairText(value)];
        if (value && typeof value === "object") return [key, repairEntityText(value)];
        return [key, value];
      }),
    );
  }

  function escapeHTML(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function stripRomanRoundSuffix(value) {
    return String(value || "")
      .trim()
      .replace(/\s+(?:I|II|III|IV|V|VI|VII|VIII|IX|X)$/i, "")
      .trim();
  }

  function cleanEventName(value) {
    return repairText(stripRomanRoundSuffix(value));
  }

  function formatGrandPrixName(name) {
    if (!name) return name;
    return String(name)
      .replace(/^GP\b/i, "Gran Premio")
      .replace(/\bGP\b/i, "Gran Premio")
      .trim();
  }

  function eventDisplayName(event) {
    const categorySlug = normalizeCategoryParam(event?.category?.slug || event?.category?.short_name || "");
    const city = repairText(String(event?.circuit?.city || "").trim());
    const country = repairText(String(event?.circuit?.country || "").trim());
    const circuitName = repairText(String(event?.circuit?.name || "").trim());
    const fallbackName = cleanEventName(event?.name);
    const eventName = formatGrandPrixName(fallbackName);

    if (categorySlug === "f1" || categorySlug === "f2") {
      return eventName || city || country || circuitName;
    }

    return fallbackName || city || country || circuitName;
  }

  function eventLocationLabel(event) {
    const circuit = event?.circuit;
    if (!circuit || (!circuit.city && !circuit.country && !circuit.name)) {
      return "Circuito por confirmar";
    }

    const city = repairText(String(circuit.city || "").trim());
    const country = repairText(String(circuit.country || "").trim());
    const name = repairText(String(circuit.name || "").trim());

    if (city && country) return `${city}, ${country}`;
    if (city) return city;
    if (country) return country;
    return name;
  }

  function matchesCategoryFilter(category, filterValue) {
    if (filterValue === "all") return true;
    if (filterValue === "TN") return categoryFamilyKey(category) === "TN";
    return String(category?.short_name || "") === filterValue;
  }

  function getCategoryVisualSlug(category) {
    const slug = normalizeCategoryParam(category?.slug || category?.short_name || "");
    if (slug === "turismo-nacional") return "tn";
    return slug;
  }

  function getCategoryBadgeText(category) {
    return repairText(String(category?.short_name || category?.name || "CAT").trim());
  }

  function renderCategoryBadge(category, {
    tag = "div",
    extraClass = "",
    attrs = "",
    size = "normal",
    active = false,
  } = {}) {
    const code = categoryCode(category);
    const label = getCategoryBadgeText(category);
    const classes = [
      "category-badge",
      size === "compact" ? "category-badge--compact" : "",
      size === "large" ? "category-badge--large" : "",
      active ? "category-badge--active" : "",
      extraClass,
    ].filter(Boolean).join(" ");
    const attributes = attrs ? ` ${attrs}` : "";
    const ariaLabel = attrs.includes("aria-label") ? "" : ` aria-label="${category?.name || label}"`;

    return `<${tag} class="${classes}" data-category-code="${code}"${ariaLabel}${attributes}><span class="category-badge__text">${label}</span></${tag}>`;
  }

  function renderCategoryLogo(category, { tag = "span", extraClass = "", attrs = "", size = "normal", active = false } = {}) {
    return renderCategoryBadge(category, {
      tag,
      extraClass,
      attrs,
      size,
      active,
    });
  }

  function toDayjs(value, { timezone = ARG_TIMEZONE, dateOnly = false } = {}) {
    if (!dayjsLib || value == null || value === "") return null;
    if (dayjsLib.isDayjs?.(value)) return value.tz ? value.tz(timezone) : value;

    if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
      const hourSeed = dateOnly ? "12:00:00" : "00:00:00";
      return dayjsLib.tz(`${value}T${hourSeed}`, timezone);
    }

    const instance = dayjsLib(value);
    return instance.tz ? instance.tz(timezone) : instance;
  }

  function getArgNow() {
    return dayjsLib?.tz ? dayjsLib.tz(new Date(), ARG_TIMEZONE) : dayjsLib ? dayjsLib() : null;
  }

  function formatDate(value, {
    withYear = false,
    weekday = false,
    dateOnly = true,
    timezone = ARG_TIMEZONE,
    fallback = "",
  } = {}) {
    const date = toDayjs(value, { timezone, dateOnly });
    if (!date?.isValid?.()) return fallback;

    const format = [
      weekday ? (weekday === "short" ? "ddd" : "dddd") : "",
      withYear ? "DD/MM/YYYY" : "DD/MM",
    ].filter(Boolean).join(" ");

    return date.format(format);
  }

  function formatTime(value, {
    withSeconds = false,
    timezone = ARG_TIMEZONE,
    fallback = "",
  } = {}) {
    const date = toDayjs(value, { timezone, dateOnly: false });
    if (!date?.isValid?.()) return fallback;
    return date.format(withSeconds ? "HH:mm:ss" : "HH:mm");
  }

  function formatDateTime(value, {
    withYear = false,
    weekday = "short",
    withSeconds = false,
    timezone = ARG_TIMEZONE,
    fallback = "",
  } = {}) {
    const date = toDayjs(value, { timezone, dateOnly: false });
    if (!date?.isValid?.()) return fallback;

    const datePart = formatDate(value, { withYear, weekday, dateOnly: false, timezone });
    const timePart = formatTime(value, { withSeconds, timezone });
    return `${datePart} ${timePart}`.trim();
  }

  function formatRelative(value, {
    baseValue = null,
    timezone = ARG_TIMEZONE,
    withoutSuffix = false,
    fallback = "",
  } = {}) {
    const target = toDayjs(value, { timezone, dateOnly: false });
    if (!target?.isValid?.()) return fallback;

    const base = baseValue ? toDayjs(baseValue, { timezone, dateOnly: false }) : getArgNow();
    if (!base?.isValid?.()) return fallback;

    return target.from(base, withoutSuffix);
  }

  function toLucideExportName(name) {
    return String(name || "")
      .split(/[^a-zA-Z0-9]+/)
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join("");
  }

  function renderIcon(name, {
    size = 16,
    className = "",
    absoluteStrokeWidth = true,
    attrs = {},
  } = {}) {
    if (!lucideLib?.createElement) return "";

    const exportName = toLucideExportName(name);
    const iconNode = lucideLib.icons?.[exportName] || lucideLib[exportName];
    if (!iconNode) return "";

    const icon = lucideLib.createElement(iconNode, {
      width: size,
      height: size,
      class: ["ui-inline-icon", className].filter(Boolean).join(" "),
      "aria-hidden": "true",
      focusable: "false",
      ...attrs,
      ...(absoluteStrokeWidth ? { "absolute-stroke-width": "true" } : {}),
    });
    const wrapper = document.createElement("div");
    wrapper.appendChild(icon);
    return wrapper.innerHTML;
  }

  function renderIconLabel(icon, text, {
    iconSize = 14,
    className = "",
    textClassName = "",
  } = {}) {
    return `
      <span class="ui-icon-label ${className}">
        ${renderIcon(icon, { size: iconSize })}
        <span class="${textClassName}">${text}</span>
      </span>
    `;
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
    return `<div class="winner-line">${renderIcon("trophy", { size: 14, className: "winner-icon" })}<span class="winner-label mono">${label}</span><span class="winner-name">${winner.driver_name}</span></div>`;
  }

  function isHighlightedRaceSession(session) {
    return isPrimarySession(session);
  }

  function isLiveSession(session) {
    if (!session) return false;
    if (String(session.status || "").toLowerCase() === "live") return true;

    const now = getArgNow();
    const startsAt = toDayjs(session.starts_at, { dateOnly: false });
    const endsAt = toDayjs(session.ends_at, { dateOnly: false });

    return !!(now?.isValid?.() && startsAt?.isValid?.() && endsAt?.isValid?.()
      && (now.isAfter(startsAt) || now.isSame(startsAt))
      && now.isBefore(endsAt));
  }

  function createLogger(scope) {
    const prefix = scope ? `[${scope}]` : "[PaddockAR]";
    return {
      info: (...args) => LOG_ENABLED && console.info(prefix, ...args),
      error: (...args) => console.error(prefix, ...args),
    };
  }

  function buildPublicPageUrl() {
    const path = location.pathname || "/";
    let publicPath = "/";

    if (path === "/" || path.endsWith("/")) {
      publicPath = "/";
    } else {
      const pathMatch = path.match(/\/(admin\/[^/]+\.html|[^/]+\.html)$/);
      if (pathMatch?.[1]) {
        publicPath = `/${pathMatch[1]}`;
      }
    }

    if (publicPath === "/index.html") {
      publicPath = "/";
    }

    return `${PUBLIC_SITE_URL}${publicPath}${location.search || ""}`;
  }

  function syncPublicMetadata() {
    const publicUrl = buildPublicPageUrl();
    const canonical = document.querySelector('link[rel="canonical"]');
    const ogUrl = document.querySelector('meta[property="og:url"]');

    if (canonical) canonical.href = publicUrl;
    if (ogUrl) ogUrl.content = publicUrl;
  }

  function syncApiHealthLinks() {
    document.querySelectorAll("[data-api-health-link]").forEach((link) => {
      link.setAttribute("href", API_HEALTH_URL);
    });
  }

  function renderTopbarNavLinks(activePage = "") {
    // Main nav convention:
    // - generic "Categorias" => home anchor `index.html#categories`
    // - specific category links => `category.html?cat=...`
    const links = [
      { key: "home", href: "index.html", label: "Inicio" },
      { key: "calendar", href: "calendar.html", label: "Calendario" },
      { key: "categories", href: "index.html#categories", label: "Categorias" },
      { key: "admin", href: "admin/events.html", label: "Admin" },
    ];

    return links
      .map((link) => {
        const activeClass = link.key === activePage ? " class=\"active\"" : "";
        return `<a${activeClass} href="${link.href}">${link.label}</a>`;
      })
      .join("");
  }

  function renderTopbarExtra(extra = "") {
    if (extra === "clock") {
      return `
        <div class="clock mono">
          <span class="pulse"></span>
          <span id="clock">--:--:--</span>
          <span>ARG</span>
        </div>
      `;
    }

    if (extra === "back") {
      return `<a class="back-link mono" href="calendar.html">Volver</a>`;
    }

    return "";
  }

  function renderTopbar({ activePage = "", extra = "" } = {}) {
    return `
      <nav class="topbar">
        <div class="topbar-inner">
          <div class="brand">
            <a class="logo-link" href="index.html" aria-label="Ir a inicio">
              <div class="logo">PADDOCK<span>AR</span></div>
            </a>
            <div class="tagline">agenda motor</div>
          </div>
          <div class="nav-links mono" aria-label="Navegacion">
            ${renderTopbarNavLinks(activePage)}
          </div>
          ${renderTopbarExtra(extra)}
        </div>
      </nav>
    `;
  }

  function mountSharedTopbar() {
    const mountPoint = document.querySelector("#siteTopbar");
    if (!mountPoint) return;

    const activePage = mountPoint.dataset.navPage || "";
    const extra = mountPoint.dataset.navExtra || "";
    mountPoint.outerHTML = renderTopbar({ activePage, extra });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      mountSharedTopbar();
      syncPublicMetadata();
      syncApiHealthLinks();
    });
  } else {
    mountSharedTopbar();
    syncPublicMetadata();
    syncApiHealthLinks();
  }

  window.PaddockARCommon = {
    PUBLIC_SITE_URL,
    API_BASE_URL,
    LOCAL_API_BASE_URL,
    PROD_API_BASE_URL,
    API_HEALTH_URL,
    USE_LOCAL_API,
    IS_LOCAL_FRONTEND,
    ARG_TIMEZONE,
    ASSET_BASE_URL,
    categoryColors,
    categoryCode,
    getCategoryLogo,
    categoryFamilyKey,
    categoryFamilyLabel,
    categoryPageSlug,
    categoryHref,
    normalizeCategoryParam,
    repairText,
    repairEntityText,
    escapeHTML,
    cleanEventName,
    eventDisplayName,
    eventLocationLabel,
    matchesCategoryFilter,
    statusLabels,
    renderCategoryBadge,
    renderCategoryLogo,
    renderCategoryInsignia: renderCategoryBadge,
    toDayjs,
    getArgNow,
    formatDate,
    formatTime,
    formatDateTime,
    formatRelative,
    renderIcon,
    renderIconLabel,
    isPrimarySession,
    getPrimaryEventSession,
    getSessionWinner,
    getEventWinner,
    renderWinnerLine,
    isHighlightedRaceSession,
    isLiveSession,
    createLogger,
    renderTopbar,
  };
})();
