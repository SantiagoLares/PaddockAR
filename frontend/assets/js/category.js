const {
  ARG_TIMEZONE,
  categoryCode,
  eventDisplayName,
  getCategoryLogo,
  normalizeCategoryParam,
  statusLabels,
  renderCategoryBadge,
  createLogger,
} = window.PaddockARCommon;
const { getJson } = window.PaddockARApi;
const { setHTML, setText, renderEmpty, renderError, renderSkeleton } = window.PaddockARDom;
const logger = createLogger("PaddockAR");

const categoryName = document.querySelector("#categoryName");
const categorySubtitle = document.querySelector("#categorySubtitle");
const apiState = document.querySelector("#apiState");
const categoryHero = document.querySelector("#categoryHero");
const categoryBoard = document.querySelector("#categoryCalendar");
const categoryStandings = document.querySelector("#categoryStandings");

function getCategorySlug() {
  const params = new URLSearchParams(window.location.search);
  return normalizeCategoryParam(params.get("cat") || params.get("slug"));
}

function humanizeSlug(slug) {
  return (slug || "categoria")
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatDate(value) {
  return new Intl.DateTimeFormat("es-AR", {
    timeZone: ARG_TIMEZONE,
    day: "2-digit",
    month: "2-digit",
  }).format(new Date(`${value}T00:00:00-03:00`));
}

function getArgDateKey(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: ARG_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function getExpectedStandingTypes(category) {
  const shortName = String(category?.short_name || "").toUpperCase();
  if (shortName === "F1" || shortName === "F2" || shortName === "F3") {
    return [
      { key: "drivers", label: "Campeonato de Pilotos" },
      { key: "constructors", label: shortName === "F1" ? "Campeonato de Constructores" : "Campeonato de Equipos" },
    ];
  }
  return [{ key: "general", label: "Campeonato" }];
}

function standingsByType(standings) {
  return standings.reduce((acc, standing) => {
    const type = standing.standing_type || "general";
    if (!acc[type]) acc[type] = [];
    acc[type].push(standing);
    return acc;
  }, {});
}

function renderNextEvent(category, events) {
  const todayKey = getArgDateKey();
  const nextEvent = events.find((event) => event.end_date >= todayKey) || null;

  if (!nextEvent) {
    return `
      <section class="category-hero-card">
        <div class="category-hero-label mono">Proximo evento</div>
        <div class="category-hero-empty">No hay un proximo evento cargado por ahora.</div>
      </section>
    `;
  }

  const location = nextEvent.circuit.city
    ? `${nextEvent.circuit.city}, ${nextEvent.circuit.country}`
    : nextEvent.circuit.country;

  return `
    <section class="category-hero-card">
      <div class="category-hero-label mono">Proximo evento</div>
      <a class="category-hero-event" href="event.html?id=${nextEvent.id}">
        <div class="category-hero-event-name">${eventDisplayName(nextEvent)}</div>
        <div class="category-hero-event-meta">${formatDate(nextEvent.start_date)} - ${formatDate(nextEvent.end_date)} | ${nextEvent.circuit.name}</div>
        <div class="category-hero-event-location">${location}</div>
      </a>
    </section>
  `;
}

function renderHero(category, events) {
  const logo = getCategoryLogo(category.slug) || getCategoryLogo(normalizeCategoryParam(category.slug));
  setHTML(
    categoryHero,
    `
      <section class="category-hero-shell">
        <div class="category-hero-brand">
          <div class="category-hero-logo-wrap">
            ${logo
              ? `<img class="category-hero-logo" src="${logo}" alt="${category.name}" onerror="this.hidden=true; this.nextElementSibling.hidden=false;" /><div hidden>${renderCategoryBadge(category)}</div>`
              : renderCategoryBadge(category)}
          </div>
          <div class="category-hero-copy">
            <div class="category-hero-kicker mono">Categoria</div>
            <h2>${category.name}</h2>
            <div class="category-hero-link"><a href="calendar.html">Ver calendario completo</a></div>
          </div>
        </div>
        ${renderNextEvent(category, events)}
      </section>
    `,
  );
}

function renderLoadError() {
  setHTML(
    categoryBoard,
    renderError("No pudimos cargar la informacion", {
      retry: true,
    }),
  );
  setHTML(categoryHero, "");
  setHTML(categoryStandings, "");
  setText(apiState, "Error de API");
}

function eventStatusMarkup(status) {
  if (status !== "live") return "";
  const label = statusLabels[status] || String(status).toUpperCase();
  return `<span class="status mono live"><span class="live-dot"></span>${label}</span>`;
}

function renderCategoryEvents(category, events) {
  if (!events.length) {
    setHTML(
      categoryBoard,
      renderEmpty("No encontramos eventos para esta categoria", "Proba mas tarde o volve al inicio para ver otras series."),
    );
    return;
  }

  setHTML(
    categoryBoard,
    `
      <section class="category-card category-card-collapsible is-collapsed">
        <button class="category-head category-head-button" type="button" data-calendar-toggle aria-expanded="false">
          <div class="category-info">
            ${renderCategoryBadge(category)}
            <div class="category-label">Calendario</div>
          </div>
          <div class="category-head-actions">
            <div class="category-total mono">${events.length} eventos</div>
            <div class="category-collapse-indicator mono">+</div>
          </div>
        </button>
        <div class="category-card-body" hidden>
          ${events
            .map(
              (event) => `
                <a class="category-event ${event.status === "live" ? "is-live" : ""}" href="event.html?id=${event.id}" data-category-code="${categoryCode(event.category)}">
                  <div class="date-range mono">${formatDate(event.start_date)} - ${formatDate(event.end_date)}</div>
                  <div class="event-meta">
                    <div class="event-name">${eventDisplayName(event)}</div>
                    <div class="circuit">${event.circuit.name}</div>
                  </div>
                  <div class="location-block">
                    ${eventStatusMarkup(event.status)}
                    <div class="location">${event.circuit.city ? `${event.circuit.city}, ${event.circuit.country}` : event.circuit.country}</div>
                  </div>
                </a>
              `,
            )
            .join("")}
        </div>
      </section>
    `,
  );
}

function renderStandings(category, standings) {
  const byType = standingsByType(standings);
  const expectedTypes = getExpectedStandingTypes(category);

  setHTML(
    categoryStandings,
    `
      <section class="category-card standings-card">
        <header class="category-head">
          <div class="category-info">
            ${renderCategoryBadge(category)}
            <div class="category-label">Campeonato</div>
          </div>
          <div class="category-total mono">${standings.length ? `${standings.length} filas` : "sin datos"}</div>
        </header>
        <div class="standings-stack ${expectedTypes.length > 1 ? "standings-stack-dual" : ""}">
          ${expectedTypes
            .map(({ key, label }) => {
              const rows = (byType[key] || []).sort((a, b) => a.position - b.position);
              if (!rows.length) {
                return `
                  <section class="standings-section">
                    <div class="standings-title mono">${label}</div>
                    <div class="standings-empty">Campeonato aun no cargado</div>
                  </section>
                `;
              }

              return `
                <section class="standings-section">
                  <div class="standings-title mono">${label}</div>
                  <div class="standings-table-wrap">
                    <table class="standings-table">
                      <thead>
                        <tr>
                          <th>Pos</th>
                          <th>Nombre</th>
                          <th>Equipo</th>
                          <th>Pts</th>
                          <th>V</th>
                        </tr>
                      </thead>
                      <tbody>
                        ${rows
                          .map(
                            (standing) => `
                              <tr>
                                <td class="mono">P${standing.position}</td>
                                <td>${standing.name}</td>
                                <td>${standing.team_name || "-"}</td>
                                <td class="mono">${standing.points}</td>
                                <td class="mono">${standing.wins}</td>
                              </tr>
                            `,
                          )
                          .join("")}
                      </tbody>
                    </table>
                  </div>
                </section>
              `;
            })
            .join("")}
        </div>
      </section>
    `,
  );
}

async function loadStandingsSafe(slug) {
  try {
    return await getJson(`/api/standings/category/${encodeURIComponent(slug)}`);
  } catch (error) {
    logger.error("Category standings failed", slug, error);
    return [];
  }
}

function renderCategory(category, events, standings) {
  const sorted = [...events].sort((a, b) => new Date(a.start_date) - new Date(b.start_date));

  document.title = `PaddockAR | ${category.name}`;
  setText(categoryName, category.name);
  setText(
    categorySubtitle,
    sorted.length ? `Proximo evento, calendario y campeonato de ${category.short_name}.` : "No hay fechas publicadas para esta categoria.",
  );
  setText(apiState, `${sorted.length} eventos`);
  renderHero(category, sorted);
  renderCategoryEvents(category, sorted);
  renderStandings(category, standings);
}

async function loadCategory() {
  const slug = getCategorySlug();

  if (!slug) {
    setText(categoryName, "Categoria");
    setText(categorySubtitle, "Falta el slug de la categoria.");
    setHTML(
      categoryBoard,
      renderEmpty("No pudimos abrir esta categoria", "El enlace esta incompleto o ya no es valido."),
    );
    setHTML(categoryHero, "");
    setHTML(categoryStandings, "");
    setText(apiState, "Slug faltante");
    return;
  }

  setText(categoryName, humanizeSlug(slug));
  setText(categorySubtitle, "Buscando eventos de la categoria.");
  setText(apiState, "Cargando");
  setHTML(categoryBoard, renderSkeleton("category"));
  setHTML(categoryHero, "");
  setHTML(categoryStandings, renderSkeleton("category"));
  logger.info("Loading category events", slug);

  try {
    const [categories, events] = await Promise.all([
      getJson("/api/categories"),
      getJson("/api/events"),
    ]);
    const category = categories.find((item) => normalizeCategoryParam(item.slug) === slug);
    const filtered = events
      .filter((event) => normalizeCategoryParam(event.category?.slug) === slug)
      .sort((a, b) => new Date(a.start_date) - new Date(b.start_date));

    if (!category) {
      document.title = `PaddockAR | ${humanizeSlug(slug)}`;
      setText(categoryName, humanizeSlug(slug));
      setText(categorySubtitle, "No encontramos esa categoria.");
      setHTML(categoryHero, "");
      setHTML(categoryStandings, "");
      setHTML(
        categoryBoard,
        renderEmpty("No encontramos esta categoria", "Volve al inicio para navegar por las categorias disponibles."),
      );
      setText(apiState, "Categoria invalida");
      return;
    }

    const standings = await loadStandingsSafe(slug);
    logger.info("Category data loaded", slug, filtered.length, standings.length);
    renderCategory(category, filtered, standings);
  } catch (error) {
    logger.error("Category events failed", slug, error);
    renderLoadError();
  }
}

categoryBoard.addEventListener("click", (event) => {
  const toggle = event.target.closest("[data-calendar-toggle]");
  if (toggle) {
    const card = toggle.closest(".category-card-collapsible");
    const body = card?.querySelector(".category-card-body");
    const isExpanded = toggle.getAttribute("aria-expanded") === "true";
    toggle.setAttribute("aria-expanded", String(!isExpanded));
    card?.classList.toggle("is-collapsed", isExpanded);
    card?.classList.toggle("is-expanded", !isExpanded);
    if (body) body.hidden = isExpanded;
    const indicator = toggle.querySelector(".category-collapse-indicator");
    if (indicator) indicator.textContent = isExpanded ? "+" : "-";
    return;
  }

  if (event.target.closest("[data-retry]")) {
    loadCategory();
  }
});

categoryStandings.addEventListener("click", (event) => {
  if (!event.target.closest("[data-retry]")) return;
  loadCategory();
});

loadCategory();
