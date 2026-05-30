const {
  ARG_TIMEZONE,
  categoryCode,
  categoryFamilyLabel,
  eventDisplayName,
  renderCategoryBadge,
  getPrimaryEventSession,
  getSessionWinner,
  renderWinnerLine,
  createLogger,
} = window.PaddockARCommon;
const { getJson } = window.PaddockARApi;
const { setHTML, setText, renderEmpty, renderError, renderSkeleton } = window.PaddockARDom;
const logger = createLogger("PaddockAR");

const apiState = document.querySelector("#apiState");
const calendarBoard = document.querySelector("#calendarBoard");

function renderLoadError() {
  setHTML(
    calendarBoard,
    renderError("No pudimos cargar la información", {
      retry: true,
    }),
  );
  setText(apiState, "Error de API");
}

function renderEventWinner(event) {
  const primarySession = getPrimaryEventSession(event);
  if (primarySession?.status !== "finished") return "";
  return renderWinnerLine(getSessionWinner(primarySession), { compact: true });
}

function getDatePartsInArgentina(dateStr) {
  const date = new Date(`${dateStr}T12:00:00`);
  const parts = new Intl.DateTimeFormat("es-AR", {
    timeZone: ARG_TIMEZONE,
    day: "numeric",
    month: "short",
    year: "numeric",
  }).formatToParts(date);

  const pick = (type) => parts.find((part) => part.type === type)?.value || "";
  return {
    day: Number(pick("day")),
    month: pick("month").replace(/\.$/, "").toUpperCase(),
    year: Number(pick("year")),
  };
}

function formatCompactDateRange(startDate, endDate) {
  const start = getDatePartsInArgentina(startDate);
  const end = getDatePartsInArgentina(endDate);

  if (start.month === end.month && start.year === end.year) {
    if (start.day === end.day) return `${start.day} ${start.month}`;
    return `${start.day}-${end.day} ${start.month}`;
  }

  return `${start.day} ${start.month} – ${end.day} ${end.month}`;
}

function formatMonthHeading(monthKey) {
  const [year, month] = monthKey.split("-").map(Number);
  const label = new Intl.DateTimeFormat("es-AR", {
    month: "long",
    year: "numeric",
    timeZone: ARG_TIMEZONE,
  }).format(new Date(Date.UTC(year, month - 1, 1)));

  return label.toUpperCase();
}

function groupEventsByMonth(events) {
  const months = new Map();

  events.forEach((event) => {
    const key = event.start_date.slice(0, 7);
    if (!months.has(key)) months.set(key, []);
    months.get(key).push(event);
  });

  return Array.from(months.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, monthEvents]) => ({
      key,
      label: formatMonthHeading(key),
      events: monthEvents.sort((a, b) => new Date(a.start_date) - new Date(b.start_date)),
    }));
}

function normalizeText(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function simplifySessionLabel(session) {
  const name = normalizeText(session?.name);
  const type = normalizeText(session?.session_type);

  if (type === "sprint" || name.includes("sprint")) return "Sprint";
  if (session?.is_feature || type === "race" || type === "final" || type === "feature" || name === "carrera" || name === "race") {
    return "Carrera";
  }
  if (type.includes("qual") || name.includes("qualy") || name.includes("clasific")) return "Qualy";
  if (type.includes("practice") || type.includes("fp") || name.includes("practica") || name.includes("entren")) {
    return "Practica";
  }

  return session?.name?.trim() || "Sesion";
}

function getSessionKind(session) {
  const label = simplifySessionLabel(session);
  if (label === "Carrera") return "race";
  if (label === "Sprint") return "sprint";
  if (label === "Qualy") return "qualifying";
  if (label === "Practica") return "practice";
  return "session";
}

function renderTimelineSessions(event) {
  const sessions = [...(event.sessions || [])].sort((a, b) => {
    if (a.order_index !== b.order_index) return a.order_index - b.order_index;
    return new Date(a.starts_at) - new Date(b.starts_at);
  });

  if (!sessions.length) return "";

  const items = sessions
    .map((session) => {
      const kind = getSessionKind(session);
      return `<li class="timeline-session timeline-session--${kind}">${simplifySessionLabel(session)}</li>`;
    })
    .join("");

  return `<ul class="timeline-sessions" aria-label="Sesiones del evento">${items}</ul>`;
}

function renderTimelineEvent(event) {
  const code = categoryCode(event.category);
  const city = event.circuit?.city || event.circuit?.country || "";
  const categoryLabel = categoryFamilyLabel(event.category);
  const meta = [categoryLabel, city].filter(Boolean).join(" · ");

  return `
    <article class="timeline-event" data-category-code="${code}">
      <div class="timeline-event-dates mono">${formatCompactDateRange(event.start_date, event.end_date)}</div>
      <a class="timeline-event-link" href="event.html?id=${event.id}">
        <div class="timeline-event-head">
          <h3 class="timeline-event-name">${eventDisplayName(event)}</h3>
          ${renderEventWinner(event)}
        </div>
        <p class="timeline-event-meta">
          ${renderCategoryBadge(event.category, { tag: "span", size: "compact" })}
          ${meta ? `<span class="timeline-event-meta-text">${meta}</span>` : ""}
        </p>
        ${renderTimelineSessions(event)}
      </a>
    </article>
  `;
}

function renderCalendar(events) {
  if (!events.length) {
    setHTML(
      calendarBoard,
      renderEmpty("Todavía no hay eventos publicados", "Apenas haya fechas disponibles las vas a ver acá."),
    );
    return;
  }

  const sorted = [...events].sort((a, b) => new Date(a.start_date) - new Date(b.start_date));
  const months = groupEventsByMonth(sorted);

  const timelineHtml = months
    .map(
      (month) => `
      <section class="timeline-month">
        <h2 class="timeline-month-title">${month.label}</h2>
        <div class="timeline-month-body">
          ${month.events
            .map(
              (event, index) => `
            ${index > 0 ? '<div class="timeline-gap" aria-hidden="true"></div>' : ""}
            ${renderTimelineEvent(event)}
          `,
            )
            .join("")}
        </div>
      </section>
    `,
    )
    .join("");

  setHTML(calendarBoard, `<div class="calendar-timeline">${timelineHtml}</div>`);
}

async function loadCalendar() {
  setText(apiState, "Cargando");
  setHTML(calendarBoard, renderSkeleton("calendar"));
  logger.info("Loading calendar events", "/api/events");

  try {
    const events = await getJson("/api/events");
    logger.info("Calendar events loaded", events.length);
    renderCalendar(events);
    setText(apiState, `${events.length} eventos`);
  } catch (error) {
    logger.error("Calendar events failed", error);
    renderLoadError();
  }
}

calendarBoard.addEventListener("click", (event) => {
  if (event.target.closest("[data-retry]")) {
    loadCalendar();
  }
});

loadCalendar();
