const {
  categoryCode,
  cleanEventName,
  formatDate,
  formatTime,
  renderIcon,
  renderIconLabel,
  statusLabels,
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
    renderError("No pudimos cargar la información", {
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

function statusMarkup(status, { isFeature = false } = {}) {
  if (status === "scheduled") {
    return isFeature ? '<span class="session-accent-dot" aria-hidden="true"></span>' : "";
  }

  const label = statusLabels[status] || status.toUpperCase();
  const icon = status === "live"
    ? `${renderIcon("radio", { size: 12, className: "status-icon" })}<span class="live-dot"></span>`
    : "";
  return `<span class="status mono ${status}">${icon}${label}</span>`;
}

function getSessionStatus(session) {
  return isLiveSession(session) ? "live" : session.status || "scheduled";
}

function getSessionContextLine(session, status) {
  if (status === "live") return "En pista ahora";
  if (status === "finished") return "Sesion completada";
  if (status === "cancelled") return "Sesion cancelada";
  if (isPrimarySession(session)) return "Evento principal del fin de semana";
  return "";
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
      const contextLine = getSessionContextLine(session, status);

      return `
        <section class="session-block ${isFeature ? "feature" : ""} ${isLive ? "is-live" : ""}" ${isFeature ? `data-category-code="${code}"` : ""}>
          <div class="session-row">
            <div class="session-timing mono">
              <span class="session-day">${date.date}</span>
              <span class="session-time">${date.time} ARG</span>
            </div>
            <div class="session-copy">
              <div class="session-title-row">
                <h2 class="session-name">${session.name}</h2>
                ${statusMarkup(status, { isFeature })}
              </div>
              ${contextLine ? `<p class="session-context">${contextLine}</p>` : ""}
            </div>
          </div>
          ${renderResultsTable(session)}
        </section>
      `;
    })
    .join("");

  setHTML(app, `
    <section class="hero" data-category-code="${code}">
      <header class="hero-head">
        <div class="hero-copy">
          <div class="hero-kicker mono">${category.name}</div>
          <h1>${cleanEventName(event.name)}</h1>
          <div class="hero-meta">
            <span>${circuit.name}</span>
            <span>${circuit.city ? `${circuit.city}, ${circuit.country}` : circuit.country}</span>
            <span class="mono">${formatDate(event.start_date)} - ${formatDate(event.end_date)}</span>
          </div>
        </div>
      </header>

      <div class="hero-facts" aria-label="Detalles del evento">
        <div class="hero-fact">
          <div class="hero-fact-label mono">${renderIconLabel("flag", "Circuito", { iconSize: 12 })}</div>
          <div class="hero-fact-value">${circuit.name}</div>
        </div>
        <div class="hero-fact">
          <div class="hero-fact-label mono">${renderIconLabel("map-pin", "Ubicacion", { iconSize: 12 })}</div>
          <div class="hero-fact-value">${circuit.city ? `${circuit.city}, ${circuit.country}` : circuit.country}</div>
        </div>
        <div class="hero-fact">
          <div class="hero-fact-label mono">${renderIconLabel("clock-3", "Inicio", { iconSize: 12 })}</div>
          <div class="hero-fact-value mono">${formatDate(event.start_date)}</div>
        </div>
        <div class="hero-fact">
          <div class="hero-fact-label mono">${renderIconLabel("clock-3", "Fin", { iconSize: 12 })}</div>
          <div class="hero-fact-value mono">${formatDate(event.end_date)}</div>
        </div>
      </div>
    </section>

    <section class="sessions">
      ${sessionRows || renderEmpty("Todavía no hay sesiones publicadas", "Cuando el evento tenga cronograma lo vas a ver acá.")}
    </section>
  `);
}

async function loadEvent() {
  const id = getEventId();
  logger.info("Loading event detail", id);

  if (!id) {
    setHTML(app, renderEmpty("No pudimos abrir este evento", "El enlace está incompleto o ya no es válido."));
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
