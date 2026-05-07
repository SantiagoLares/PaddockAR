const {
  categoryCode,
  formatDate,
  formatTime,
  renderIcon,
  renderIconLabel,
  statusLabels,
  renderCategoryBadge,
  isPrimarySession,
  isLiveSession,
  getSessionWinner,
  renderWinnerLine,
  createLogger,
} = window.PaddockARCommon;
const { getJson } = window.PaddockARApi;
const { setHTML, renderEmpty, renderError, renderSkeleton } = window.PaddockARDom;
const logger = createLogger("PaddockAR");

const app = document.querySelector("#app");

function renderLoadError() {
  setHTML(
    app,
    renderError("No pudimos cargar la informacion", {
      retry: true,
    }),
  );
}

function getEventId() {
  return new URLSearchParams(window.location.search).get("id");
}

function formatSessionDate(value) {
  return {
    date: formatDate(value, { weekday: "short", dateOnly: false }),
    time: formatTime(value),
  };
}

function statusMarkup(status) {
  const label = statusLabels[status] || status.toUpperCase();
  const icon = status === "live"
    ? `${renderIcon("radio", { size: 12, className: "status-icon" })}<span class="live-dot"></span>`
    : "";
  return `<span class="status mono ${status}">${icon}${label}</span>`;
}

function getSessionStatus(session) {
  return isLiveSession(session) ? "live" : session.status || "scheduled";
}

function renderResultsTable(session) {
  const results = session?.results || [];
  if (!results.length) return "";

  const rows = [...results]
    .sort((a, b) => a.position - b.position)
    .map(
      (result) => `
        <tr>
          <td class="mono">${result.position}</td>
          <td>${result.driver_name}</td>
          <td>${result.team_name}</td>
          <td class="mono">${result.time_or_gap || "-"}</td>
          <td class="mono">${result.points ?? "-"}</td>
        </tr>
      `,
    )
    .join("");

  return `
    ${renderWinnerLine(getSessionWinner(session))}
    <div class="results-table-wrap">
      <table class="results-table">
        <thead>
          <tr>
            <th class="mono">Pos</th>
            <th>Piloto</th>
            <th>Equipo</th>
            <th class="mono">Tiempo/Dif</th>
            <th class="mono">Pts</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}

function renderEvent(event) {
  const category = event.category;
  const code = categoryCode(category);
  const circuit = event.circuit;
  const sessions = [...event.sessions].sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at));

  const sessionRows = sessions
    .map((session) => {
      const date = formatSessionDate(session.starts_at);
      const isFeature = isPrimarySession(session);
      const status = getSessionStatus(session);
      const isLive = status === "live";

      return `
          <section class="session-block">
            <div class="session-row ${isFeature ? "feature" : ""} ${isLive ? "is-live" : ""}" ${isFeature ? `data-category-code="${code}"` : ""}>
              <div class="date-time mono">
                <span class="date-time-main">${date.time} ARG</span>
                <span>${date.date}</span>
              </div>
              <div class="session-name">
                ${isFeature ? '<span class="session-marker" aria-hidden="true"></span><span class="session-primary-tag mono">CARRERA</span>' : ""}
                <span>${session.name}</span>
              </div>
              ${statusMarkup(status)}
            </div>
            ${renderResultsTable(session)}
          </section>
        `;
    })
    .join("");

  setHTML(app, `
        <section class="hero" data-category-code="${code}">
          <header class="hero-head">
            ${renderCategoryBadge(category)}
            <div>
              <h1>${event.name}</h1>
              <div class="category-name">${category.name}</div>
            </div>
          </header>

          <div class="info-grid">
            <div class="info-item">
              <div class="label mono">${renderIconLabel("flag", "Circuito", { iconSize: 12 })}</div>
              <div class="value">${circuit.name}</div>
            </div>
            <div class="info-item">
              <div class="label mono">${renderIconLabel("map-pin", "Ubicacion", { iconSize: 12 })}</div>
              <div class="value">${circuit.city ? `${circuit.city}, ${circuit.country}` : circuit.country}</div>
            </div>
            <div class="info-item">
              <div class="label mono">${renderIconLabel("clock-3", "Inicio", { iconSize: 12 })}</div>
              <div class="value mono">${formatDate(event.start_date)}</div>
            </div>
            <div class="info-item">
              <div class="label mono">${renderIconLabel("clock-3", "Fin", { iconSize: 12 })}</div>
              <div class="value mono">${formatDate(event.end_date)}</div>
            </div>
          </div>
        </section>

        <div class="section-title mono">Sesiones</div>
        <section class="sessions">
          ${sessionRows || renderEmpty("Todavia no hay sesiones publicadas", "Cuando el evento tenga cronograma lo vas a ver aca.")}
        </section>
      `);
}

async function loadEvent() {
  const id = getEventId();
  logger.info("Loading event detail", id);

  if (!id) {
    setHTML(app, renderEmpty("No pudimos abrir este evento", "El enlace esta incompleto o ya no es valido."));
    return;
  }

  setHTML(app, renderSkeleton("event"));

  try {
    const event = await getJson(`/api/events/${id}`);
    logger.info("Event detail loaded", event.id, event.name);
    renderEvent(event);
  } catch (error) {
    logger.error("Event detail failed", error);
    renderLoadError();
  }
}

app.addEventListener("click", (event) => {
  if (!event.target.closest("[data-retry]")) return;
  loadEvent();
});

loadEvent();
