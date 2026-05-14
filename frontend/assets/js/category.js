const {
  categoryCode,
  eventDisplayName,
  formatDate,
  formatRelative,
  formatTime,
  getArgNow,
  getEventWinner,
  isLiveSession,
  normalizeCategoryParam,
  renderIcon,
  renderIconLabel,
  statusLabels,
  renderCategoryBadge,
  renderWinnerLine,
  toDayjs,
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
const categoryHomeLink = document.querySelector(".category-home-link");

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

function getArgDateKey(date = new Date()) {
  const value = toDayjs(date, { dateOnly: false });
  return value?.isValid?.() ? value.format("YYYY-MM-DD") : "";
}

function getCategoryDisplayName(category) {
  const shortName = String(category?.short_name || "").toUpperCase();
  if (shortName === "TN C2") return "Turismo Nacional Clase 2";
  if (shortName === "TN C3") return "Turismo Nacional Clase 3";
  return category?.name || category?.short_name || "Categoría";
}

function getCategoryLocation(event) {
  if (!event?.circuit) return "Circuito por confirmar";
  return event.circuit.city
    ? `${event.circuit.city}, ${event.circuit.country}`
    : event.circuit.country || event.circuit.name || "Circuito por confirmar";
}

function getExpectedStandingTypes(category) {
  const shortName = String(category?.short_name || "").toUpperCase();
  if (shortName === "F1" || shortName === "F2" || shortName === "F3") {
    return [
      { key: "drivers", label: "Campeonato de Pilotos", entityLabel: "Piloto" },
      { key: "constructors", label: shortName === "F1" ? "Campeonato de Constructores" : "Campeonato de Equipos", entityLabel: "Equipo" },
    ];
  }
  return [{ key: "general", label: "Campeonato", entityLabel: "Competidor" }];
}

function standingsByType(standings) {
  return standings.reduce((acc, standing) => {
    const type = standing.standing_type || "general";
    if (!acc[type]) acc[type] = [];
    acc[type].push(standing);
    return acc;
  }, {});
}

function eventStatusMarkup(status) {
  const normalized = String(status || "").toLowerCase();
  if (!normalized) return "";
  const label = statusLabels[normalized] || normalized.toUpperCase();
  const liveMarkup = normalized === "live" ? `${renderIcon("radio", { size: 12, className: "status-icon" })}<span class="live-dot"></span>` : "";
  return `<span class="status ${normalized} mono">${liveMarkup}${label}</span>`;
}

function hasFutureSession(event) {
  const now = getArgNow()?.valueOf?.() || Date.now();
  return (event.sessions || []).some((session) => {
    const startsAt = session?.starts_at ? new Date(session.starts_at).getTime() : NaN;
    const endsAt = session?.ends_at ? new Date(session.ends_at).getTime() : NaN;
    return Number.isFinite(startsAt) && startsAt >= now
      || Number.isFinite(endsAt) && endsAt >= now
      || String(session?.status || "").toLowerCase() === "live";
  });
}

function isUpcomingEvent(event, todayKey = getArgDateKey()) {
  if (!event) return false;
  const status = String(event.status || "").toLowerCase();
  if (status === "live") return true;
  if (event.start_date >= todayKey) return true;
  return hasFutureSession(event);
}

function getNextEvent(events) {
  const todayKey = getArgDateKey();
  return events.find((event) => isUpcomingEvent(event, todayKey)) || null;
}

function getEventReferenceMoment(event) {
  const now = getArgNow();
  const sessions = [...(event?.sessions || [])]
    .filter((session) => session?.starts_at)
    .sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at));

  const liveSession = sessions.find((session) => isLiveSession(session));
  if (liveSession) {
    return {
      value: liveSession.starts_at,
      status: "live",
    };
  }

  const nextSession = sessions.find((session) => {
    const start = toDayjs(session.starts_at, { dateOnly: false });
    return start?.isValid?.() && now?.isValid?.() && start.valueOf() >= now.valueOf();
  });

  if (nextSession) {
    return {
      value: nextSession.starts_at,
      status: "scheduled",
    };
  }

  if (event?.start_date) {
    return {
      value: event.start_date,
      status: String(event.status || "").toLowerCase() || "scheduled",
      dateOnly: true,
    };
  }

  return null;
}

function formatCountdown(value) {
  const target = toDayjs(value, { dateOnly: false });
  const now = getArgNow();
  if (!target?.isValid?.() || !now?.isValid?.()) return "";

  const diff = target.valueOf() - now.valueOf();
  if (diff <= 0) return "";

  const totalSeconds = Math.max(0, Math.floor(diff / 1000));
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  return `${String(days).padStart(2, "0")}d ${String(hours).padStart(2, "0")}h ${String(minutes).padStart(2, "0")}m`;
}

function getEventTimingText(value, { isLive = false, dateOnly = false } = {}) {
  if (isLive) return "En vivo ahora";
  if (!value || dateOnly) return "";

  const target = toDayjs(value, { dateOnly: false });
  const now = getArgNow();
  if (!target?.isValid?.() || !now?.isValid?.()) return "";

  const diff = target.valueOf() - now.valueOf();
  if (diff <= 0) return "";
  if (diff <= 72 * 60 * 60 * 1000) return formatCountdown(value);

  const relative = formatRelative(value);
  return relative ? `Empieza ${relative}` : "";
}

function renderNextEvent(events) {
  const nextEvent = getNextEvent(events);

  if (!nextEvent) {
    return `
      <section class="category-panel category-next-event category-next-event-empty">
        <div class="section-kicker mono">Próximo evento</div>
        <div class="category-next-empty">No hay un próximo evento cargado por ahora.</div>
      </section>
    `;
  }

  const eventCategory = nextEvent.category || {};
  const referenceMoment = getEventReferenceMoment(nextEvent);
  const isLive = referenceMoment?.status === "live" || String(nextEvent.status || "").toLowerCase() === "live";
  const dateLabel = referenceMoment?.value
    ? formatDate(referenceMoment.value, { withYear: true, weekday: "short", dateOnly: !!referenceMoment.dateOnly })
    : formatDate(nextEvent.start_date, { withYear: true });
  const timeLabel = referenceMoment?.dateOnly ? "Horario a confirmar" : referenceMoment?.value ? `${formatTime(referenceMoment.value)} ARG` : "Horario a confirmar";
  const timingText = getEventTimingText(referenceMoment?.value, { isLive, dateOnly: referenceMoment?.dateOnly });

  return `
    <section class="category-panel category-next-event">
      <a class="next-event-card" href="event.html?id=${nextEvent.id}" data-category-code="${categoryCode(eventCategory)}">
        <div class="next-event-top">
          <div class="section-kicker mono">Próximo evento</div>
          <span class="next-event-date mono">${renderIconLabel("calendar", dateLabel, { iconSize: 12 })}</span>
        </div>
        <div class="next-event-name">${eventDisplayName(nextEvent)}</div>
        <div class="next-event-time mono">${timeLabel}</div>
        <div class="next-event-circuit">${nextEvent.circuit?.name || "Circuito por confirmar"}</div>
        <div class="next-event-location">${renderIconLabel("map-pin", getCategoryLocation(nextEvent), { iconSize: 14 })}</div>
        <div class="next-event-footer">
          <div class="next-event-status-stack">
            ${eventStatusMarkup(isLive ? "live" : nextEvent.status || "scheduled")}
            ${timingText ? `<div class="next-event-timing mono">${timingText}</div>` : ""}
          </div>
          <div class="next-event-link mono">Ver detalle</div>
        </div>
      </a>
    </section>
  `;
}

function renderHero(category, events) {
  setHTML(categoryHero, renderNextEvent(events));
}

function renderCategoryHeader(category) {
  const displayName = getCategoryDisplayName(category);

  setHTML(
    categoryName,
    `
      <span class="category-title-shell">
        ${renderCategoryBadge(category, { tag: "span", size: "large", extraClass: "category-title-badge" })}
        <span class="category-title-text">${displayName}</span>
      </span>
    `,
  );

  if (categoryHomeLink) {
    categoryHomeLink.innerHTML = `${renderIcon("arrow-left", { size: 14 })}<span>Volver a Inicio</span>`;
  }
}

function renderLoadError() {
  setHTML(
    categoryBoard,
    renderError("No pudimos cargar la información", {
      retry: true,
    }),
  );
  setHTML(categoryHero, "");
  setHTML(categoryStandings, "");
  setText(apiState, "Error de API");
}

function renderCategoryEvents(category, events) {
  if (!events.length) {
    setHTML(
      categoryBoard,
      renderEmpty("No encontramos eventos para esta categoría", "Probá más tarde o volvé al inicio para ver otras series."),
    );
    return;
  }

  const todayKey = getArgDateKey();
  setHTML(
    categoryBoard,
    `
      <section class="category-card category-calendar-card">
        <header class="category-head">
          <div class="category-info">
            ${renderCategoryBadge(category)}
            <div>
              <div class="category-label">Calendario</div>
              <div class="category-supporting-text">Fechas ordenadas por cronología.</div>
            </div>
          </div>
          <div class="category-total mono">${events.length} eventos</div>
        </header>
        <div class="category-calendar-list">
          ${events
            .map((event) => {
              const winner = event.end_date < todayKey ? getEventWinner(event) : null;
              return `
                <a class="category-event ${event.status === "live" ? "is-live" : ""}" href="event.html?id=${event.id}" data-category-code="${categoryCode(event.category)}">
                  <div class="category-event-date">
                    <span class="category-event-date-range mono">${renderIconLabel("calendar", `${formatDate(event.start_date)} - ${formatDate(event.end_date)}`, { iconSize: 13 })}</span>
                    ${eventStatusMarkup(event.status)}
                  </div>
                  <div class="event-meta">
                    <div class="event-name">${eventDisplayName(event)}</div>
                    <div class="circuit">${event.circuit?.name || "Circuito por confirmar"}</div>
                    ${winner ? renderWinnerLine(winner, { compact: true }) : ""}
                  </div>
                  <div class="location-block">
                    <div class="location">${getCategoryLocation(event)}</div>
                    <div class="event-link mono">Abrir evento</div>
                  </div>
                </a>
              `;
            })
            .join("")}
        </div>
      </section>
    `,
  );
}

function renderStandingsTable(rows, { label, entityLabel, showTeamColumn }) {
  return `
    <section class="standings-section">
      <div class="standings-section-head">
        <div class="standings-title mono">${label}</div>
        <div class="standings-section-count mono">${rows.length} posiciones</div>
      </div>
      <div class="standings-table-wrap">
        <table class="standings-table">
          <thead>
            <tr>
              <th class="standings-col-pos">POS</th>
              <th>${entityLabel}</th>
              <th>Equipo</th>
              <th class="standings-col-wins">V</th>
              <th class="standings-col-points">PTS</th>
            </tr>
          </thead>
          <tbody>
            ${rows
              .map(
                (standing) => `
                  <tr class="standings-row ${standing.position <= 3 ? `is-top-three is-top-${standing.position}` : ""}">
                    <td class="standings-pos mono"><span class="standings-pos-pill">P${standing.position}</span></td>
                    <td>
                      <div class="standings-name">${standing.name}</div>
                    </td>
                    <td class="standings-team">${showTeamColumn ? standing.team_name || "-" : "-"}</td>
                    <td class="standings-wins mono">${standing.wins ?? 0}</td>
                    <td class="standings-points mono">${standing.points}</td>
                  </tr>
                `,
              )
              .join("")}
          </tbody>
        </table>
      </div>
    </section>
  `;
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
            <div>
              <div class="category-label">${renderIconLabel("trophy", "Campeonato", { iconSize: 12 })}</div>
              <div class="category-supporting-text">Posiciones actualizadas por categoría.</div>
            </div>
          </div>
          <div class="category-total mono">${standings.length ? `${standings.length} filas` : "sin datos"}</div>
        </header>
        <div class="standings-stack ${expectedTypes.length > 1 ? "standings-stack-dual" : ""}">
          ${expectedTypes
            .map(({ key, label, entityLabel }) => {
              const rows = (byType[key] || []).sort((a, b) => a.position - b.position);
              if (!rows.length) {
                return `
                  <section class="standings-section">
                    <div class="standings-title mono">${label}</div>
                    <div class="standings-empty">Campeonato aún no cargado</div>
                  </section>
                `;
              }

              const showTeamColumn = rows.some((standing) => standing.team_name);
              return renderStandingsTable(rows, { label, entityLabel, showTeamColumn });
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
  const displayName = getCategoryDisplayName(category);

  document.title = `PaddockAR | ${displayName}`;
  renderCategoryHeader(category);
  setText(categorySubtitle, "Calendario, próximas carreras y campeonato");
  setText(apiState, `${sorted.length} eventos`);
  renderHero(category, sorted);
  renderCategoryEvents(category, sorted);
  renderStandings(category, standings);
}

async function loadCategory() {
  const slug = getCategorySlug();

  if (!slug) {
    setText(categoryName, "Categoría");
    setText(categorySubtitle, "Falta el slug de la categoría.");
    setHTML(
      categoryBoard,
      renderEmpty("No pudimos abrir esta categoría", "El enlace está incompleto o ya no es válido."),
    );
    setHTML(categoryHero, "");
    setHTML(categoryStandings, "");
    setText(apiState, "Slug faltante");
    return;
  }

  setText(categoryName, humanizeSlug(slug));
  setText(categorySubtitle, "Buscando datos de la categoría.");
  setText(apiState, "Cargando");
  setHTML(categoryBoard, renderSkeleton("category"));
  setHTML(categoryHero, renderSkeleton("category"));
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
      setText(categorySubtitle, "No encontramos esa categoría.");
      setHTML(categoryHero, "");
      setHTML(categoryStandings, "");
      setHTML(
        categoryBoard,
        renderEmpty("No encontramos esta categoría", "Volvé al inicio para navegar por las categorías disponibles."),
      );
      setText(apiState, "Categoría inválida");
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
  if (!event.target.closest("[data-retry]")) return;
  loadCategory();
});

categoryStandings.addEventListener("click", (event) => {
  if (!event.target.closest("[data-retry]")) return;
  loadCategory();
});

loadCategory();
