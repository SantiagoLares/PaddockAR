const {
  categoryHref,
  createLogger,
  escapeHTML,
  formatDate,
  formatRelative,
  formatTime,
  getArgNow,
  isLiveSession,
  normalizeCategoryParam,
  repairEntityText,
  repairText,
  toDayjs,
} = window.PaddockARCommon;
const { getJson } = window.PaddockARApi;
const { setHTML, setText } = window.PaddockARDom;

const logger = createLogger("PaddockAR");

const clockDisplay = document.querySelector("#clockDisplay");
const weekendEyebrow = document.querySelector("#weekendEyebrow");
const statusFilters = document.querySelector("#statusFilters");
const categoryFilters = document.querySelector("#categoryFilters");
const mainStats = document.querySelector("#mainStats");
const apiDot = document.querySelector("#apiDot");
const apiText = document.querySelector("#apiText");
const spotlight = document.querySelector("#spotlight");
const eventFeed = document.querySelector("#eventFeed");

const SEP = "\u00b7";

const FAMILY_META = {
  all: { label: "Todas", color: "rgba(255,255,255,0.45)" },
  F1: { label: "Formula 1", color: "var(--f1)" },
  F2: { label: "Formula 2", color: "var(--f2)" },
  F3: { label: "Formula 3", color: "var(--f3)" },
  MotoGP: { label: "MotoGP", color: "var(--moto)" },
  WEC: { label: "WEC", color: "var(--wec)" },
  TC: { label: "Turismo Carretera", color: "var(--tc)" },
  TN: { label: "Turismo Nacional", color: "var(--tn)" },
  TR: { label: "Top Race", color: "var(--tr)" },
  TC2000: { label: "TC2000", color: "var(--tc2)" },
  TCP: { label: "TC Pista", color: "var(--tcp)" },
  TP: { label: "Turismo Pista", color: "var(--tp)" },
  OTHER: { label: "Otras", color: "var(--generic)" },
};

const STATUS_META = {
  upcoming: { label: "Pr\u00f3ximas", dot: "#93c5fd" },
  live: { label: "En vivo", dot: "var(--f1)" },
  finished: { label: "Finalizadas", dot: "rgba(255,255,255,0.45)" },
  all: { label: "Todas", dot: "rgba(255,255,255,0.38)" },
};

const STATUS_ORDER = {
  live: 0,
  upcoming: 1,
  finished: 2,
  cancelled: 3,
};

let allEvents = [];
let allSessions = [];
let weekendGroups = [];
let currentWeekendRange = null;
let activeCategory = "all";
let activeStatus = "upcoming";
const eventExpansionState = new Map();

function updateClock() {
  if (!clockDisplay) return;
  clockDisplay.textContent = new Date().toLocaleTimeString("es-AR", {
    timeZone: "America/Argentina/Buenos_Aires",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

function renderStateCard(kind, title, description, eyebrow = "Estado", retry = false) {
  const action = retry
    ? '<div class="state-action"><button class="retry-button" type="button" data-retry>Reintentar</button></div>'
    : "";

  return `
    <div class="state-panel">
      <section class="state-card state-card--${kind}">
        <div class="state-eyebrow">${escapeHTML(eyebrow)}</div>
        <div class="state-title">${escapeHTML(title)}</div>
        <div class="state-description">${escapeHTML(description)}</div>
        ${action}
      </section>
    </div>
  `;
}

function getSessionDateSource(session) {
  return session?.starts_at_arg || session?.starts_at || null;
}

function getEventDateSource(event) {
  return event?.start_date || null;
}

function getEventDateDayjs(event) {
  return toDayjs(getEventDateSource(event), { dateOnly: true });
}

function getFamilyKey(category) {
  const slug = normalizeCategoryParam(category?.slug || category?.short_name || "");
  const shortName = repairText(String(category?.short_name || "").trim().toUpperCase());

  if (slug === "f1" || slug === "formula-1" || shortName === "F1") return "F1";
  if (slug === "f2" || slug === "formula-2" || shortName === "F2") return "F2";
  if (slug === "f3" || shortName === "F3") return "F3";
  if (slug === "motogp" || shortName === "MOTOGP") return "MotoGP";
  if (slug === "wec" || shortName === "WEC") return "WEC";
  if (slug === "turismo-carretera" || shortName === "TC") return "TC";
  if (
    slug === "turismo-nacional-clase-2"
    || slug === "turismo-nacional-clase-3"
    || shortName === "TN"
    || shortName.startsWith("TN C")
  ) return "TN";
  if (slug === "top-race" || shortName === "TR") return "TR";
  if (slug === "tc2000" || shortName === "TC2000") return "TC2000";
  if (slug === "tc-pista" || shortName === "TCP") return "TCP";
  if (
    slug === "turismo-pista-c1"
    || slug === "turismo-pista-c2"
    || slug === "turismo-pista-c3"
    || shortName === "TP"
    || shortName.startsWith("TP C")
  ) return "TP";
  return "OTHER";
}

function getFamilyMeta(categoryOrKey) {
  const key = typeof categoryOrKey === "string" ? categoryOrKey : getFamilyKey(categoryOrKey);
  return FAMILY_META[key] || FAMILY_META.OTHER;
}

function getCategoryLabel(category) {
  return repairText(String(category?.name || category?.short_name || "Categoria"));
}

function getEventName(event) {
  return repairText(String(event?.name || "Evento"));
}

function getLocationLabel(event) {
  const circuit = event?.circuit;
  if (!circuit) return "Circuito por confirmar";

  const parts = [
    repairText(circuit.name),
    repairText(circuit.city),
    repairText(circuit.country),
  ].filter(Boolean);

  return parts.join(` ${SEP} `);
}

function getSessionStatus(session) {
  const raw = String(session?.computed_status || session?.status || "").toLowerCase();
  if (raw === "live" || isLiveSession(session)) return "live";
  if (raw === "finished" || raw === "completed") return "finished";
  if (raw === "cancelled" || raw === "canceled") return "cancelled";
  if (raw === "scheduled" || raw === "upcoming") return "upcoming";

  const startsAt = toDayjs(getSessionDateSource(session), { dateOnly: false });
  const endsAt = toDayjs(session?.ends_at, { dateOnly: false });
  const now = getArgNow();

  if (now?.isValid?.() && endsAt?.isValid?.() && now.isAfter(endsAt)) return "finished";
  if (
    now?.isValid?.()
    && startsAt?.isValid?.()
    && (now.isAfter(startsAt) || now.isSame(startsAt))
    && (!endsAt?.isValid?.() || now.isBefore(endsAt))
  ) return "live";
  return "upcoming";
}

function getEventStatus(event, sessions) {
  const statuses = sessions.map(getSessionStatus);
  if (statuses.includes("live")) return "live";
  if (statuses.includes("upcoming")) return "upcoming";
  if (statuses.includes("finished")) return "finished";

  const raw = String(event?.computed_status || event?.status || "").toLowerCase();
  if (raw === "finished") return "finished";
  if (raw === "cancelled") return "cancelled";
  return "upcoming";
}

function getBadgeMarkup(status, { liveDot = false, session = false } = {}) {
  const labels = {
    live: "En pista",
    upcoming: "Pr\u00f3xima",
    finished: session ? "Finalizado" : "Finalizada",
    cancelled: "Cancelada",
  };

  const className = status === "live"
    ? (session ? "session-badge sb-live" : "badge badge-live")
    : status === "finished"
      ? (session ? "session-badge sb-done" : "badge badge-done")
      : status === "cancelled"
        ? (session ? "session-badge sb-done" : "badge badge-done")
        : (session ? "session-badge sb-next" : "badge badge-next");

  const dot = liveDot && status === "live" ? '<span class="live-dot"></span>' : "";
  return `<span class="${className}">${dot}${escapeHTML(labels[status] || labels.upcoming)}</span>`;
}

function getMonthShort(value) {
  const date = toDayjs(value, { dateOnly: false });
  if (!date?.isValid?.()) return "---";
  return repairText(date.format("MMM")).replace(".", "").toUpperCase();
}

function getDayNumber(value) {
  const date = toDayjs(value, { dateOnly: false });
  if (!date?.isValid?.()) return "--";
  return date.format("DD");
}

function getSessionDetail(session) {
  const dateLabel = repairText(formatDate(getSessionDateSource(session), {
    weekday: "short",
    withYear: false,
    dateOnly: false,
  }));
  const event = session?.event || {};
  const circuitName = repairText(event?.circuit?.name || event?.circuit?.city || "Circuito por confirmar");
  return `${dateLabel} ${SEP} ${circuitName}`;
}

function sortSessions(items) {
  return [...items].sort((a, b) => {
    const aDate = toDayjs(getSessionDateSource(a), { dateOnly: false });
    const bDate = toDayjs(getSessionDateSource(b), { dateOnly: false });
    return aDate.valueOf() - bDate.valueOf();
  });
}

function getWeekendRangeFor(dateArg) {
  const base = dateArg.startOf("day");
  const weekdayMondayZero = (base.day() + 6) % 7;
  const friday = base.add(4 - weekdayMondayZero, "day").startOf("day");
  const sunday = friday.add(2, "day").endOf("day");
  return { friday, sunday };
}

function getWeekendKey(range) {
  return range.friday.format("YYYY-MM-DD");
}

function findActiveWeekendRange(events) {
  const nowArg = getArgNow();
  const currentRange = getWeekendRangeFor(nowArg);

  const groupsByWeekend = new Map();
  events.forEach((event) => {
    const eventDate = getEventDateDayjs(event);
    if (!eventDate?.isValid?.()) return;
    const range = getWeekendRangeFor(eventDate);
    const key = getWeekendKey(range);
    if (!groupsByWeekend.has(key)) {
      groupsByWeekend.set(key, { ...range, events: [] });
    }
    groupsByWeekend.get(key).events.push(event);
  });

  const currentKey = getWeekendKey(currentRange);
  if (groupsByWeekend.has(currentKey)) {
    return groupsByWeekend.get(currentKey);
  }

  const futureWeekends = [...groupsByWeekend.values()]
    .filter((entry) => entry.friday.isAfter(currentRange.sunday))
    .sort((a, b) => a.friday.valueOf() - b.friday.valueOf());

  if (futureWeekends.length) {
    return futureWeekends[0];
  }

  const pastWeekends = [...groupsByWeekend.values()]
    .sort((a, b) => b.friday.valueOf() - a.friday.valueOf());

  return pastWeekends[0] || { ...currentRange, events: [] };
}

function buildWeekendGroups(events, sessions) {
  const sessionsByEvent = new Map();
  sessions.forEach((session) => {
    const eventId = session?.event_id || session?.event?.id;
    if (!eventId) return;
    if (!sessionsByEvent.has(eventId)) {
      sessionsByEvent.set(eventId, []);
    }
    sessionsByEvent.get(eventId).push(session);
  });

  currentWeekendRange = findActiveWeekendRange(events);
  const weekendEvents = currentWeekendRange.events || [];

  return weekendEvents
    .map((event) => {
      const groupSessions = sortSessions(sessionsByEvent.get(event.id) || event.sessions || []);
      const upcomingSession = groupSessions.find((session) => getSessionStatus(session) === "upcoming");
      const liveSession = groupSessions.find((session) => getSessionStatus(session) === "live");
      const lastSession = groupSessions[groupSessions.length - 1] || null;
      const anchorSource = getSessionDateSource(liveSession || upcomingSession || lastSession) || getEventDateSource(event);

      return {
        key: String(event.id),
        event,
        sessions: groupSessions,
        familyKey: getFamilyKey(event.category),
        status: getEventStatus(event, groupSessions),
        anchorDate: toDayjs(anchorSource, { dateOnly: false }),
      };
    })
    .sort((a, b) => {
      if (STATUS_ORDER[a.status] !== STATUS_ORDER[b.status]) {
        return STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
      }
      return a.anchorDate.valueOf() - b.anchorDate.valueOf();
    });
}

function getVisibleGroups() {
  return weekendGroups.filter((group) => {
    const statusMatch = activeStatus === "all" || group.status === activeStatus;
    const categoryMatch = activeCategory === "all" || group.familyKey === activeCategory;
    return statusMatch && categoryMatch;
  });
}

function countVisibleByStatus(status) {
  return weekendGroups.filter((group) => {
    const categoryMatch = activeCategory === "all" || group.familyKey === activeCategory;
    const statusMatch = status === "all" || group.status === status;
    return categoryMatch && statusMatch;
  }).length;
}

function countVisibleByCategory(category) {
  return weekendGroups.filter((group) => {
    const statusMatch = activeStatus === "all" || group.status === activeStatus;
    const categoryMatch = category === "all" || group.familyKey === category;
    return statusMatch && categoryMatch;
  }).length;
}

function renderWeekendEyebrow() {
  if (!weekendEyebrow || !currentWeekendRange?.friday?.isValid?.()) return;

  const fromDay = currentWeekendRange.friday.format("DD");
  const toDay = currentWeekendRange.sunday.format("DD");
  const month = repairText(currentWeekendRange.friday.format("MMM")).replace(".", "");
  setText(weekendEyebrow, `Fin de semana ${SEP} ${fromDay}\u2013${toDay} ${month}`);
}

function renderStatusFilters() {
  setHTML(
    statusFilters,
    Object.entries(STATUS_META).map(([key, meta]) => `
      <button class="status-btn ${activeStatus === key ? "active" : ""}" type="button" data-status="${key}">
        <span class="status-dot" style="background:${meta.dot}${key === "live" ? ";animation:blink 1s infinite" : ""}"></span>
        ${escapeHTML(meta.label)}
      </button>
    `).join(""),
  );
}

function renderCategoryFilters() {
  const categoryItems = Object.keys(FAMILY_META)
    .filter((key) => key !== "all" && key !== "OTHER")
    .map((key) => ({
      key,
      label: FAMILY_META[key].label,
      color: FAMILY_META[key].color,
      count: countVisibleByCategory(key),
    }))
    .sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return a.label.localeCompare(b.label, "es");
    });

  const items = [
    {
      key: "all",
      label: "Todas",
      color: FAMILY_META.all.color,
      count: countVisibleByCategory("all"),
    },
    ...categoryItems,
  ];

  setHTML(
    categoryFilters,
    items.map((item) => `
      <button class="cat-btn ${activeCategory === item.key ? "active" : ""}" type="button" data-category="${item.key}">
        <span class="cat-pip" style="background:${item.color}"></span>
        <span class="cat-label">${escapeHTML(item.label)}</span>
        <span class="cat-count-pill">${item.count}</span>
      </button>
    `).join(""),
  );
}

function renderStats(groups) {
  const sessionsCount = groups.reduce((total, group) => total + group.sessions.length, 0);
  const liveCount = groups.filter((group) => group.status === "live").length;
  setHTML(
    mainStats,
    `
      <div class="stat-chip">
        <div class="num">${groups.length}</div>
        <div class="lbl">Eventos</div>
      </div>
      <div class="stat-divider"></div>
      <div class="stat-chip">
        <div class="num">${sessionsCount}</div>
        <div class="lbl">Sesiones</div>
      </div>
      <div class="stat-divider"></div>
      <div class="stat-chip">
        <div class="num">${liveCount}</div>
        <div class="lbl">En vivo</div>
      </div>
    `,
  );
}

function findNextScheduledSession() {
  return weekendGroups
    .flatMap((group) => group.sessions.map((session) => ({ group, session })))
    .filter(({ session }) => getSessionStatus(session) === "upcoming")
    .sort((a, b) => {
      const aDate = toDayjs(getSessionDateSource(a.session), { dateOnly: false });
      const bDate = toDayjs(getSessionDateSource(b.session), { dateOnly: false });
      return aDate.valueOf() - bDate.valueOf();
    })[0] || null;
}

function renderSpotlight() {
  const nextItem = findNextScheduledSession();
  if (!nextItem) {
    setHTML(
      spotlight,
      renderStateCard(
        "empty",
        "Sin pr\u00f3ximas sesiones",
        "Cuando aparezca una salida a pista programada para este fin de semana, la vas a ver destacada ac\u00e1.",
        "Pr\u00f3xima sesi\u00f3n",
      ),
    );
    return;
  }

  const { group, session } = nextItem;
  const categoryColor = getFamilyMeta(group.familyKey).color;
  const sessionTimeArg = formatTime(getSessionDateSource(session));
  const eventName = getEventName(group.event);
  const categoryName = getCategoryLabel(group.event.category);
  const circuitName = getLocationLabel(group.event);
  const sessionName = repairText(session.name);

  setHTML(
    spotlight,
    `
      <div class="spotlight-card" data-ghost="${escapeHTML(group.familyKey)}" style="border-left-color:${categoryColor}">
        <div>
          <div class="spotlight-live-badge">
            <span class="status-dot" style="background:#93c5fd"></span>
            Pr\u00f3xima sesi\u00f3n
          </div>
          <div class="spotlight-name">${escapeHTML(eventName)}</div>
          <div class="spotlight-meta">${escapeHTML(categoryName)} ${SEP} ${escapeHTML(circuitName)}</div>
        </div>
        <div class="spotlight-session">
          <div class="spotlight-session-name">${escapeHTML(sessionName)}</div>
          <div class="spotlight-session-time">${escapeHTML(sessionTimeArg)}</div>
          <div class="spotlight-session-tz">ARG ${SEP} GMT-3</div>
        </div>
      </div>
    `,
  );
}

function renderEventFeed(groups) {
  if (!groups.length) {
    setHTML(
      eventFeed,
      '<div class="empty-state">No hay eventos para esos filtros.</div>',
    );
    return;
  }

  setHTML(
    eventFeed,
    groups.map((group, index) => {
      const key = group.key;
      if (!eventExpansionState.has(key)) {
        eventExpansionState.set(key, group.status === "live" || index === 0);
      }

      const isOpen = eventExpansionState.get(key);
      const categoryColor = getFamilyMeta(group.familyKey).color;
      const sessionCountLabel = `${group.sessions.length} ${group.sessions.length === 1 ? "sesion" : "sesiones"}`;
      const categoryLabel = getCategoryLabel(group.event.category).toUpperCase();

      return `
        <article class="event-group ${isOpen ? "open" : ""}" data-event-group="${escapeHTML(key)}" data-cat="${escapeHTML(group.familyKey)}" data-status="${escapeHTML(group.status)}">
          <div class="event-row" data-event-toggle="${escapeHTML(key)}">
            <div class="event-accent" style="background:${categoryColor}"></div>
            <div class="event-date-col">
              <div class="event-date-dd">${escapeHTML(getDayNumber(group.anchorDate))}</div>
              <div class="event-date-mon">${escapeHTML(getMonthShort(group.anchorDate))}</div>
            </div>
            <div class="event-info-col">
              <div class="event-cat-label" style="color:${categoryColor}">
                <a class="event-cat-link" href="${categoryHref(group.event.category)}">${escapeHTML(categoryLabel)}</a>
              </div>
              <div class="event-name">${escapeHTML(getEventName(group.event))}</div>
              <div class="event-loc">${escapeHTML(getLocationLabel(group.event))}</div>
            </div>
            <div class="event-sessions-col"><div class="event-sessions-count">${escapeHTML(sessionCountLabel)}</div></div>
            <div class="event-status-col">${getBadgeMarkup(group.status, { liveDot: true })}</div>
            <div class="chevron-col" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>
            </div>
          </div>
          <div class="sessions-panel">
            <div class="sessions-inner">
              ${group.sessions.length ? group.sessions.map((session) => {
                const status = getSessionStatus(session);
                return `
                  <div class="session-row ${status === "live" ? "is-live" : ""}">
                    <div class="session-time">${escapeHTML(formatTime(getSessionDateSource(session)))}<span class="tz">ARG</span></div>
                    <div>
                      <div class="session-name">${escapeHTML(repairText(session.name))}</div>
                      <div class="session-detail">${escapeHTML(getSessionDetail(session))}</div>
                    </div>
                    ${getBadgeMarkup(status, { session: true })}
                  </div>
                `;
              }).join("") : '<div class="session-row"><div class="session-detail">Todavia no hay sesiones publicadas para este evento.</div></div>'}
              <div class="panel-footer"><a class="panel-link" href="event.html?id=${encodeURIComponent(group.event.id)}">Abrir evento \u2192</a></div>
            </div>
          </div>
        </article>
      `;
    }).join(""),
  );
}

function renderAll() {
  renderWeekendEyebrow();
  renderStatusFilters();
  renderCategoryFilters();
  const visibleGroups = getVisibleGroups();
  renderStats(visibleGroups);
  renderSpotlight();
  renderEventFeed(visibleGroups);
}

function setApiState(kind, text) {
  apiDot.className = `api-dot ${kind}`;
  setText(apiText, text);
}

async function loadHome() {
  setApiState("", "Conectando API");
  setHTML(
    spotlight,
    renderStateCard("loading", "Cargando agenda", "Estamos sincronizando eventos y sesiones reales.", "Pr\u00f3xima sesi\u00f3n"),
  );
  setHTML(
    eventFeed,
    renderStateCard("loading", "Armando listado", "Estamos agrupando la actividad por evento y categoria.", "Feed"),
  );

  try {
    const [eventsPayload, sessionsPayload] = await Promise.all([
      getJson("/api/events"),
      getJson("/api/sessions"),
    ]);

    allEvents = repairEntityText(Array.isArray(eventsPayload) ? eventsPayload : []);
    allSessions = repairEntityText(Array.isArray(sessionsPayload) ? sessionsPayload : []);
    weekendGroups = buildWeekendGroups(allEvents, allSessions);

    renderAll();
    setApiState("ok", `API conectada ${SEP} ${weekendGroups.length} eventos del fin de semana ${SEP} Actualizado ${formatRelative(new Date())}`);
    logger.info("Home loaded", {
      events: allEvents.length,
      sessions: allSessions.length,
      weekendGroups: weekendGroups.length,
      weekendKey: currentWeekendRange ? getWeekendKey(currentWeekendRange) : null,
    });
  } catch (error) {
    logger.error("Home failed", error);
    setApiState("err", "API sin respuesta");
    setHTML(
      spotlight,
      renderStateCard("error", "No pudimos cargar la proxima sesion", "La API no respondio como esperabamos.", "Pr\u00f3xima sesi\u00f3n", true),
    );
    setHTML(
      eventFeed,
      renderStateCard("error", "No pudimos cargar los eventos", "No llego la actividad desde la API.", "Feed", true),
    );
  }
}

statusFilters.addEventListener("click", (event) => {
  const button = event.target.closest("[data-status]");
  if (!button) return;
  activeStatus = button.dataset.status;
  renderAll();
});

categoryFilters.addEventListener("click", (event) => {
  const button = event.target.closest("[data-category]");
  if (!button) return;
  activeCategory = button.dataset.category;
  renderAll();
});

eventFeed.addEventListener("click", (event) => {
  const row = event.target.closest("[data-event-toggle]");
  if (!row || event.target.closest("a")) return;
  const key = row.dataset.eventToggle;
  eventExpansionState.set(key, !eventExpansionState.get(key));
  renderEventFeed(getVisibleGroups());
});

document.addEventListener("click", (event) => {
  if (!event.target.closest("[data-retry]")) return;
  loadHome();
});

updateClock();
window.setInterval(updateClock, 1000);
loadHome();
