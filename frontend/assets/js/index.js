const {
  ARG_TIMEZONE,
  categoryCode,
  categoryFamilyLabel,
  categoryHref,
  formatDate,
  formatRelative,
  formatTime,
  matchesCategoryFilter,
  renderIcon,
  renderIconLabel,
  statusLabels,
  renderCategoryBadge,
  isPrimarySession,
  getSessionWinner,
  renderWinnerLine,
  isHighlightedRaceSession,
  isLiveSession,
  createLogger,
} = window.PaddockARCommon;
const { getJson } = window.PaddockARApi;
const { setHTML, setText, renderEmpty, renderError, renderSkeleton, setActiveButton } = window.PaddockARDom;
const logger = createLogger("PaddockAR");

const clock = document.querySelector("#clock");
const apiState = document.querySelector("#apiState");
const raceSpotlight = document.querySelector("#raceSpotlight");
const nextRaces = document.querySelector("#nextRaces");
const sessionList = document.querySelector("#sessionList");
const categoryFilters = document.querySelector("#categoryFilters");
const statusFilters = document.querySelector("#statusFilters");
const lastUpdated = document.querySelector("#lastUpdated");
const sideNav = document.querySelector("#sideNav");
const sideNavToggle = document.querySelector("#sideNavToggle");
const sideNavBackdrop = document.querySelector("#sideNavBackdrop");

const AUTO_REFRESH_MS = 30000;
const CATEGORY_TO_QUERY = {
  all: "",
  F1: "f1",
  F2: "f2",
  F3: "f3",
  MotoGP: "motogp",
  WEC: "wec",
  TC: "tc",
  TCP: "tc-pista",
  TCM: "tc-mouras",
  TCPM: "tc-pista-mouras",
  TCPK: "tc-pick-up",
  TCPPK: "tc-pista-pick-up",
  TC2000: "tc2000",
  TR: "top-race",
  T4000: "turismo-4000-argentino",
  BORA: "copa-bora",
  "TP C3": "turismo-pista-c3",
  "TP C2": "turismo-pista-c2",
  "TP C1": "turismo-pista-c1",
  TN: "tn",
  "TN C2": "tn-c2",
  "TN C3": "tn-c3",
};
const QUERY_TO_CATEGORY = Object.entries(CATEGORY_TO_QUERY).reduce((acc, [category, query]) => {
  if (query) acc[query] = category;
  return acc;
}, {});
let allSessions = [];
let allLoadedSessions = [];
let activeCategory = "all";
let activeStatus = "all";
let lastUpdatedAt = null;
let refreshIntervalId = null;
let refreshInFlight = false;

function renderLoadError() {
  setHTML(
    sessionList,
    renderError("No pudimos cargar la informacion", {
      retry: true,
    }),
  );
  setText(apiState, "Error de API");
}

function renderDateTimeMeta(value, { dateOnly = false, className = "" } = {}) {
  const dateLabel = formatDate(value, { weekday: "short", dateOnly: false });
  const timeLabel = dateOnly ? "" : formatTime(value);

  return `
    <span class="ui-meta-row ${className}">
      ${renderIconLabel("calendar", dateLabel, { iconSize: 13 })}
      ${timeLabel ? renderIconLabel("clock-3", `${timeLabel} ARG`, { iconSize: 13 }) : ""}
    </span>
  `;
}

function updateLastUpdatedLabel(state = "ok") {
  if (!lastUpdated) return;

  lastUpdated.classList.toggle("is-error", state === "error");

  if (state === "loading") {
    lastUpdated.textContent = lastUpdatedAt ? "Actualizando..." : "Esperando datos";
    return;
  }

  if (state === "error") {
    lastUpdated.textContent = lastUpdatedAt
      ? `Sin conexion. Actualizado ${formatRelative(lastUpdatedAt)}`
      : "No se pudo actualizar";
    return;
  }

  if (!lastUpdatedAt) {
    lastUpdated.textContent = "Esperando datos";
    return;
  }

  lastUpdated.textContent = `Actualizado ${formatRelative(lastUpdatedAt)}`;
}

function updateClock() {
  clock.textContent = formatTime(new Date(), { withSeconds: true });
}

function dateParts(value) {
  const date = new Date(value);
  const dateKeyParts = new Intl.DateTimeFormat("en-US", {
    timeZone: ARG_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const year = dateKeyParts.find((part) => part.type === "year")?.value || "0000";
  const month = dateKeyParts.find((part) => part.type === "month")?.value || "00";
  const day = dateKeyParts.find((part) => part.type === "day")?.value || "00";
  const label = new Intl.DateTimeFormat("es-AR", {
    timeZone: ARG_TIMEZONE,
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
  }).format(date);
  const weekdayKey = new Intl.DateTimeFormat("es-AR", {
    timeZone: ARG_TIMEZONE,
    weekday: "long",
  })
    .format(date)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  const time = new Intl.DateTimeFormat("es-AR", {
    timeZone: ARG_TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
  const dateKey = `${year}-${month}-${day}`;

  return { label, time, dateKey, weekdayKey };
}

function getArgCalendarParts(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  const parts = dateParts(date);
  return {
    ...parts,
    weekdayIndex: getWeekdayIndexFromDateKey(parts.dateKey),
  };
}

function getWeekdayIndexFromDateKey(dateKey) {
  const day = new Date(`${dateKey}T12:00:00Z`).getUTCDay();
  return day === 0 ? 7 : day;
}

function shiftDateKey(dateKey, days) {
  const date = new Date(`${dateKey}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function getWeekendRangeForDateKey(dateKey) {
  const day = getArgCalendarParts(`${dateKey}T12:00:00Z`);
  const fridayOffset = 5 - day.weekdayIndex;
  const fridayKey = shiftDateKey(dateKey, fridayOffset);

  return {
    fridayKey,
    sundayKey: shiftDateKey(fridayKey, 2),
  };
}

function sessionBelongsToWeekend(session, weekendRange) {
  const sessionDay = dateParts(session.starts_at).dateKey;
  return sessionDay >= weekendRange.fridayKey && sessionDay <= weekendRange.sundayKey;
}

function sortSessionsByStart(sessions) {
  return [...sessions].sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at));
}

function getCurrentOrNextWeekend(events, now = new Date()) {
  const today = getArgCalendarParts(now);
  const weekends = new Map();

  events.forEach((session) => {
    if (!session?.starts_at) return;

    const sessionParts = getArgCalendarParts(session.starts_at);
    if (sessionParts.weekdayIndex < 5 || sessionParts.weekdayIndex > 7) return;

    const weekendRange = getWeekendRangeForDateKey(sessionParts.dateKey);
    if (!sessionBelongsToWeekend(session, weekendRange)) return;

    if (!weekends.has(weekendRange.fridayKey)) {
      weekends.set(weekendRange.fridayKey, {
        ...weekendRange,
        sessions: [],
      });
    }

    weekends.get(weekendRange.fridayKey).sessions.push(session);
  });

  const sortedWeekends = Array.from(weekends.values())
    .filter((weekend) => weekend.sessions.length > 0)
    .sort((a, b) => a.fridayKey.localeCompare(b.fridayKey));

  const currentWeekendRange = getWeekendRangeForDateKey(today.dateKey);
  const isTodayInsideCurrentWeekend =
    today.dateKey >= currentWeekendRange.fridayKey && today.dateKey <= currentWeekendRange.sundayKey;

  if (isTodayInsideCurrentWeekend) {
    const currentWeekend = sortedWeekends.find((weekend) => weekend.fridayKey === currentWeekendRange.fridayKey);
    if (currentWeekend) {
      return {
        ...currentWeekend,
        sessions: sortSessionsByStart(currentWeekend.sessions),
      };
    }
  }

  const nextWeekend = sortedWeekends.find((weekend) => weekend.sundayKey >= today.dateKey);
  if (!nextWeekend) return null;

  return {
    ...nextWeekend,
    sessions: sortSessionsByStart(nextWeekend.sessions),
  };
}

function groupByDayAndEvent(sessions) {
  const days = new Map();

  sessions.forEach((session) => {
    const parts = dateParts(session.starts_at);
    const event = session.event;
    const dayKey = parts.dateKey;
    const eventKey = `${event.category.short_name}-${event.slug}-${event.id}`;

    if (!days.has(dayKey)) {
      days.set(dayKey, {
        key: dayKey,
        label: parts.label,
        sortDate: parts.dateKey,
        weekdayKey: parts.weekdayKey,
        isSunday: parts.weekdayKey === "domingo",
        sessions: 0,
        events: new Map(),
      });
    }

    const day = days.get(dayKey);
    day.sessions += 1;

    if (!day.events.has(eventKey)) {
      day.events.set(eventKey, {
        event,
        sessions: [],
      });
    }

    day.events.get(eventKey).sessions.push({
      ...session,
      displayTime: parts.time,
    });
  });

  return Array.from(days.values()).sort((a, b) => {
    return a.sortDate.localeCompare(b.sortDate);
  });
}

function compareSessionsByLivePriority(a, b) {
  const aStatus = getSessionStatus(a);
  const bStatus = getSessionStatus(b);
  const aIsLive = aStatus === "live";
  const bIsLive = bStatus === "live";

  if (aIsLive !== bIsLive) return aIsLive ? -1 : 1;
  return new Date(a.starts_at) - new Date(b.starts_at);
}

function getSortedEventSessions(sessions) {
  return [...sessions].sort(compareSessionsByLivePriority);
}

function getSortedEventGroups(events) {
  return Array.from(events.values()).sort((a, b) => {
    const aSessions = getSortedEventSessions(a.sessions);
    const bSessions = getSortedEventSessions(b.sessions);
    const aHasLive = aSessions.some((session) => getSessionStatus(session) === "live");
    const bHasLive = bSessions.some((session) => getSessionStatus(session) === "live");

    if (aHasLive !== bHasLive) return aHasLive ? -1 : 1;
    return new Date(aSessions[0]?.starts_at || 0) - new Date(bSessions[0]?.starts_at || 0);
  });
}

function statusMarkup(status) {
  const label = statusLabels[status] || status.toUpperCase();
  const dot = status === "live" ? `${renderIcon("radio", { size: 12, className: "status-icon" })}<span class="live-dot"></span>` : "";
  return `<span class="status mono ${status}">${dot}${label}</span>`;
}

function getSessionStatus(session) {
  if (!session) return "scheduled";
  const rawStatus = String(session.status || "").toLowerCase();
  if (rawStatus === "cancelled") return "cancelled";

  const now = Date.now();
  const startsAt = session.starts_at ? new Date(session.starts_at).getTime() : NaN;
  const endsAt = session.ends_at ? new Date(session.ends_at).getTime() : NaN;

  if (Number.isFinite(endsAt) && now > endsAt) return "finished";
  if (isLiveSession(session)) return "live";
  if (Number.isFinite(startsAt) && now < startsAt) return "scheduled";

  return rawStatus || "scheduled";
}

function renderFinishedSessionWinner(session) {
  if (!isPrimarySession(session) || getSessionStatus(session) !== "finished") return "";
  return renderWinnerLine(getSessionWinner(session), { compact: true });
}

function formatCountdown(value) {
  const totalSeconds = Math.max(0, Math.floor(value / 1000));
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${String(days).padStart(2, "0")}d ${String(hours).padStart(2, "0")}h ${String(minutes).padStart(2, "0")}m ${String(seconds).padStart(2, "0")}s`;
}

function getCountdownMeta(value) {
  const startsAt = new Date(value).getTime();
  if (!Number.isFinite(startsAt)) return null;

  const diff = startsAt - Date.now();
  const relative = formatRelative(value);

  if (diff <= 0) {
    return {
      relative: "Ahora",
      countdown: "En vivo o por comenzar",
    };
  }

  return {
    relative: relative ? `Empieza ${relative}` : "Proxima sesion",
    countdown: formatCountdown(diff),
    diff,
  };
}

function getSpotlightTimingText(value) {
  const meta = getCountdownMeta(value);
  if (!meta) return "";
  if (meta.relative === "Ahora") return "En vivo o por comenzar";
  return meta.diff <= 48 * 60 * 60 * 1000 ? meta.countdown : meta.relative;
}

function getPrimarySessions(sessions) {
  return sessions.filter((session) => isPrimarySession(session) && session.status !== "cancelled");
}

function getHighlightedRaceSessions(sessions) {
  return sessions.filter((session) => isHighlightedRaceSession(session) && session.status !== "cancelled");
}

function getFeaturedTagLabel(session) {
  const type = String(session?.session_type || "").toLowerCase();
  const name = String(session?.name || "").toLowerCase();
  return type === "sprint" || name.includes("sprint") ? "SPRINT" : "CARRERA";
}

function normalizeSessionName(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function shouldHideSessionName(session) {
  const normalized = normalizeSessionName(session?.name);
  return normalized === "carrera" || normalized === "race";
}

function getSessionSecondaryLabel(session) {
  return shouldHideSessionName(session) ? "" : String(session?.name || "").trim();
}

function formatEventSessionTitle(eventName, session) {
  const secondary = getSessionSecondaryLabel(session);
  return secondary ? `${eventName} - ${secondary}` : eventName;
}

function getSpotlightSession(sessions) {
  const primary = getPrimarySessions(sessions).sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at));
  const live = primary.find((session) => isLiveSession(session));
  if (live) return live;

  const now = Date.now();
  return primary.find((session) => new Date(session.starts_at).getTime() > now) || null;
}

function getCategoryLabel(categoryCode) {
  if (categoryCode === "TN") return "Turismo Nacional";
  const session = allLoadedSessions.find((item) => matchesCategoryFilter(item.event.category, categoryCode));
  return session ? categoryFamilyLabel(session.event.category) : categoryCode;
}

function getNextCategoryReference(categoryCode) {
  const now = Date.now();
  const categorySessions = allLoadedSessions
    .filter((session) => matchesCategoryFilter(session.event.category, categoryCode))
    .sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at));

  const nextPrimary = categorySessions.find((session) => {
    if (!isPrimarySession(session)) return false;
    if (String(session.status || "").toLowerCase() === "cancelled") return false;
    return isLiveSession(session) || new Date(session.starts_at).getTime() > now;
  });

  if (nextPrimary) {
    return {
      eventName: nextPrimary.event.name,
      startsAt: nextPrimary.starts_at,
    };
  }

  const nextEventSession = categorySessions.find((session) => {
    return String(session.status || "").toLowerCase() !== "cancelled" && new Date(session.starts_at).getTime() > now;
  });

  if (!nextEventSession) return null;

  return {
    eventName: nextEventSession.event.name,
    startsAt: nextEventSession.starts_at,
  };
}

function renderRaceSpotlight(sessions) {
  if (!raceSpotlight) return;

  const session = getSpotlightSession(sessions);
  if (!session) {
    setHTML(
      raceSpotlight,
      renderEmpty("No hay una proxima carrera confirmada", "Cuando aparezca la siguiente sesion principal la vas a ver aca."),
    );
    return;
  }

  const category = session.event.category;
  const status = getSessionStatus(session);
  const timingText = status === "live" ? "En vivo ahora" : getSpotlightTimingText(session.starts_at);

  setHTML(
    raceSpotlight,
    `
      <a class="race-spotlight-card ${status === "live" ? "is-live" : ""}" href="event.html?id=${session.event.id}" data-category-code="${categoryCode(category)}">
        <div class="race-spotlight-head">
          <div class="race-spotlight-label mono">Proxima carrera</div>
          ${statusMarkup(status)}
        </div>
        <div class="race-spotlight-main">
          <div class="race-spotlight-meta">
            ${renderCategoryBadge(category, { tag: "span", size: "compact" })}
            ${renderDateTimeMeta(session.starts_at, { className: "race-spotlight-time mono" })}
          </div>
          <div class="race-spotlight-event">${formatEventSessionTitle(session.event.name, session)}</div>
          ${timingText ? `<div class="race-spotlight-timing mono">${timingText}</div>` : ""}
        </div>
      </a>
    `,
  );
}

function sameSession(a, b) {
  if (!a || !b) return false;
  return a.id === b.id;
}

function renderNextRaces(sessions, spotlightSession = null) {
  if (activeCategory !== "all") {
    setHTML(nextRaces, "");
    nextRaces.hidden = true;
    return;
  }

  const primaryUpcoming = getHighlightedRaceSessions(sessions)
    .filter((session) => getSessionStatus(session) !== "finished")
    .filter((session) => !sameSession(session, spotlightSession))
    .sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at))
    .slice(0, 3);

  if (!primaryUpcoming.length) {
    setHTML(nextRaces, "");
    nextRaces.hidden = true;
    return;
  }

  nextRaces.hidden = false;
  setHTML(
    nextRaces,
    `
      <header class="next-races-head">
        <div class="section-title mono">Carreras destacadas</div>
      </header>
      <div class="next-races-list">
        ${primaryUpcoming
          .map((session) => {
            const code = categoryCode(session.event.category);
            const status = getSessionStatus(session);
            return `
              <a class="next-race-item ${status === "live" ? "is-live" : ""}" href="event.html?id=${session.event.id}" data-category-code="${code}">
                <div class="next-race-time mono">
                  ${renderDateTimeMeta(session.starts_at, { className: "next-race-time-stack" })}
                </div>
                <div class="next-race-main">
                  <div class="next-race-event">${session.event.name}</div>
                  ${getSessionSecondaryLabel(session) ? `<div class="next-race-session">${getSessionSecondaryLabel(session)}</div>` : ""}
                </div>
                ${status === "live" ? statusMarkup("live") : `<span class="session-primary-tag mono">${getFeaturedTagLabel(session)}</span>`}
              </a>
            `;
          })
          .join("")}
      </div>
    `,
  );
}

function renderLiveNowBlock(sessions) {
  if (activeStatus === "live") return "";

  const liveSessions = sessions
    .filter((session) => getSessionStatus(session) === "live")
    .sort(compareSessionsByLivePriority);

  if (!liveSessions.length) return "";

  return `
    <section class="live-now-block" aria-label="Sesiones en vivo ahora">
      <header class="live-now-head">
        <span class="live-dot" aria-hidden="true"></span>
        <span class="mono">AHORA</span>
      </header>
      <div class="live-now-list">
        ${liveSessions
          .map((session) => {
            const category = session.event.category;
            const code = categoryCode(category);
            return `
              <a class="live-now-item" href="event.html?id=${session.event.id}" data-category-code="${code}">
                <div class="live-now-time mono">${renderIconLabel("clock-3", `${formatTime(session.starts_at)} ARG`, { iconSize: 12 })}</div>
                <div class="live-now-main">
                  ${renderCategoryBadge(category, { tag: "span", size: "compact" })}
                  <span class="live-now-event">${formatEventSessionTitle(session.event.name, session)}</span>
                </div>
                ${statusMarkup("live")}
              </a>
            `;
          })
          .join("")}
      </div>
    </section>
  `;
}

function renderSessions(sessions) {
  if (!sessions.length) {
    setHTML(nextRaces, "");
    nextRaces.hidden = true;
    const weekendCategorySessions = allSessions.filter((session) => matchesCategoryFilter(session.event.category, activeCategory));
    const hasSessionsForCategory = weekendCategorySessions.length > 0;
    const description = hasSessionsForCategory
      ? "Proba con otro estado dentro de esta vista."
      : "Revisa el calendario completo para ver las proximas fechas cargadas.";

    setHTML(sessionList, renderEmpty("No hay actividad para esta vista", description));
    return;
  }

  renderNextRaces(sessions, getSpotlightSession(sessions));
  const days = groupByDayAndEvent(sessions);
  const dayBlocks = days
    .map((day) => {
      const eventCards = getSortedEventGroups(day.events)
        .map(({ event, sessions: eventSessions }) => {
          const sortedEventSessions = getSortedEventSessions(eventSessions);

          const category = event.category;
          const code = categoryCode(category);
          const circuit = event.circuit;
          const rows = sortedEventSessions
            .map((session) => {
              const isFeature = isPrimarySession(session);
              const isSundayFeature = day.isSunday && isFeature;
              const status = getSessionStatus(session);
              const isLive = status === "live";

              return `
            <div class="session-row ${isFeature ? "feature" : ""} ${isSundayFeature ? "sunday-feature" : ""} ${isLive ? "is-live" : ""}" ${isFeature ? `data-category-code="${code}"` : ""}>
              <div class="time mono">${session.displayTime}</div>
              <div class="session-name">
                ${isFeature ? '<span class="session-marker" aria-hidden="true"></span><span class="session-primary-tag mono">CARRERA</span>' : ""}
                ${getSessionSecondaryLabel(session) ? `<span>${getSessionSecondaryLabel(session)}</span>` : ""}
              </div>
              ${statusMarkup(status)}
            </div>
            ${renderFinishedSessionWinner(session)}
          `;
            })
            .join("");

          return `
            <a class="event-card" href="event.html?id=${event.id}" aria-label="Ver detalle de ${event.name}" data-category-code="${code}">
              <header class="event-head">
                ${renderCategoryBadge(category, {
                  tag: "span",
                  size: "compact",
                  extraClass: "category-badge-link",
                  attrs: `data-category-link data-category-href="${categoryHref(category)}" role="link" tabindex="0" aria-label="Ver categoria ${category.name}"`,
                })}
                <div class="event-meta">
                <div class="event-name">${event.name}</div>
                <div class="circuit">${circuit.name} - ${circuit.city || circuit.country}</div>
              </div>
                <div class="event-total mono">${sortedEventSessions.length} sesiones</div>
              </header>
              ${rows}
            </a>
          `;
        })
        .join("");

      return `
          <section class="day-block ${day.isSunday ? "sunday-block" : ""}">
            <header class="day-title ${day.isSunday ? "sunday-title" : ""}">
              <span>${day.label}</span>
              <span class="day-title-meta">
                ${day.isSunday ? '<span class="race-day-tag mono">DIA DE CARRERA</span>' : ""}
                <span class="day-count mono">${day.sessions} sesiones</span>
              </span>
            </header>
            ${eventCards}
          </section>
        `;
    })
    .join("");

  setHTML(sessionList, `${renderLiveNowBlock(sessions)}${dayBlocks}`);
}

function applyFilters() {
  const filtered = allSessions.filter((session) => {
    const category = session.event.category;
    const status = getSessionStatus(session);
    const matchesCategory = matchesCategoryFilter(category, activeCategory);
    const matchesStatus = activeStatus === "all" ? true : activeStatus === "upcoming" ? status === "scheduled" : status === activeStatus;

    return matchesCategory && matchesStatus;
  });

  renderSessions(filtered);
  apiState.textContent = `${filtered.length}/${allSessions.length} sesiones`;
}

function getCategoryFromUrl() {
  const cat = new URLSearchParams(window.location.search).get("cat");
  if (!cat || cat === "todos" || cat === "all") return "all";
  return QUERY_TO_CATEGORY[cat.toLowerCase()] || "all";
}

function updateCategoryUrl(category, { replace = false } = {}) {
  const url = new URL(window.location.href);
  const queryValue = CATEGORY_TO_QUERY[category] || "";

  if (queryValue) {
    url.searchParams.set("cat", queryValue);
  } else {
    url.searchParams.delete("cat");
  }

  const nextUrl = `${url.pathname}${url.search}${url.hash}`;
  const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  if (nextUrl === currentUrl) return;

  const method = replace ? "replaceState" : "pushState";
  window.history[method]({ category }, "", nextUrl);
}

function syncCategoryNavigation() {
  setActiveButton(categoryFilters, `[data-category="${activeCategory}"]`);
  sideNav?.querySelectorAll("[data-side-category]").forEach((button) => {
    button.classList.toggle("active", button.dataset.sideCategory === activeCategory);
  });
}

function updateSidebarIndicators() {
  sideNav?.querySelectorAll("[data-side-category]").forEach((button) => {
    const category = button.dataset.sideCategory;
    const indicator = button.querySelector("[data-side-indicator]");
    if (!indicator) return;

    const liveCount = allSessions.filter((session) => {
      return matchesCategoryFilter(session.event.category, category) && getSessionStatus(session) === "live";
    }).length;

    indicator.textContent = liveCount > 1 ? String(liveCount) : "";
    indicator.classList.toggle("has-live", liveCount > 0);
    indicator.classList.toggle("has-count", liveCount > 1);
    button.classList.toggle("has-live", liveCount > 0);
  });
}

function setCategoryFilter(category, { updateUrl = true, replaceUrl = false } = {}) {
  activeCategory = category;
  syncCategoryNavigation();
  if (updateUrl) updateCategoryUrl(category, { replace: replaceUrl });
  applyFilters();
}

function setSidebarOpen(isOpen) {
  sideNav?.classList.toggle("is-open", isOpen);
  sideNav?.classList.toggle("sidebar--open", isOpen);
  sideNavBackdrop?.classList.toggle("is-open", isOpen);
  sideNavBackdrop?.classList.toggle("overlay--visible", isOpen);
  sideNavToggle?.setAttribute("aria-expanded", String(isOpen));
  sideNavToggle?.setAttribute("aria-label", isOpen ? "Cerrar categorias" : "Abrir categorias");
  document.body.classList.toggle("sidebar-lock", isOpen);
}

function setSidebarSectionCollapsed(section, isCollapsed) {
  if (!section) return;

  section.classList.toggle("is-collapsed", isCollapsed);
  section.querySelector(".side-nav-section-toggle")?.setAttribute("aria-expanded", String(!isCollapsed));
}

function renderWeekendEmptyState() {
  if (raceSpotlight) {
    setHTML(
      raceSpotlight,
      renderEmpty(
        "No hay actividad programada para este fin de semana",
        "Cuando haya sesiones en la ventana objetivo las vas a ver aca.",
      ),
    );
  }

  setHTML(nextRaces, "");
  nextRaces.hidden = true;
  setHTML(
    sessionList,
    renderEmpty(
      "No hay actividad programada para este fin de semana",
      "Revisa el calendario completo para ver las proximas fechas cargadas.",
    ),
  );
  setText(apiState, "Sin actividad");
  updateSidebarIndicators();
}

categoryFilters.addEventListener("click", (event) => {
  const button = event.target.closest("[data-category]");
  if (!button) return;

  setCategoryFilter(button.dataset.category);
});

sideNav?.addEventListener("click", (event) => {
  const sectionToggle = event.target.closest(".side-nav-section-toggle");
  if (sectionToggle) {
    const section = sectionToggle.closest(".side-nav-section");
    setSidebarSectionCollapsed(section, !section?.classList.contains("is-collapsed"));
    return;
  }

  const categoryButton = event.target.closest("[data-side-category]");
  if (!categoryButton) return;

  const category = categoryButton.dataset.sideCategory;
  window.location.href = category === "all"
    ? "index.html"
    : `category.html?cat=${encodeURIComponent(CATEGORY_TO_QUERY[category] || "")}`;
  setSidebarOpen(false);
});

sideNavToggle?.addEventListener("click", () => {
  setSidebarOpen(!sideNav?.classList.contains("is-open"));
});

document.querySelectorAll("[data-sidebar-close]").forEach((button) => {
  button.addEventListener("click", () => setSidebarOpen(false));
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") setSidebarOpen(false);
});

window.addEventListener("popstate", () => {
  setCategoryFilter(getCategoryFromUrl(), { updateUrl: false });
});

statusFilters.addEventListener("click", (event) => {
  const button = event.target.closest("[data-status]");
  if (!button) return;

  activeStatus = button.dataset.status;
  setActiveButton(statusFilters, `[data-status="${activeStatus}"]`);
  applyFilters();
});

async function loadWeekend({ silent = false } = {}) {
  if (refreshInFlight) return;
  refreshInFlight = true;

  if (!silent) {
    setText(apiState, "Cargando");
    if (raceSpotlight) {
      setHTML(raceSpotlight, "");
    }
    setHTML(nextRaces, "");
    nextRaces.hidden = true;
    setHTML(sessionList, renderSkeleton("home"));
  }
  updateLastUpdatedLabel("loading");
  logger.info("Loading home sessions", "/api/sessions");

  try {
    const sessions = await getJson("/api/sessions");
    allLoadedSessions = sessions;
    const targetWeekend = getCurrentOrNextWeekend(sessions);
    allSessions = targetWeekend?.sessions || [];
    logger.info("Home sessions loaded", sessions.length, allSessions.length, targetWeekend?.fridayKey, targetWeekend?.sundayKey);
    if (!allSessions.length) {
      renderWeekendEmptyState();
      lastUpdatedAt = new Date();
      updateLastUpdatedLabel();
      return;
    }
    syncCategoryNavigation();
    updateSidebarIndicators();
    setActiveButton(statusFilters, `[data-status="${activeStatus}"]`);
    renderRaceSpotlight(allSessions);
    applyFilters();
    lastUpdatedAt = new Date();
    updateLastUpdatedLabel();
  } catch (error) {
    logger.error("Weekend sessions failed", error);
    updateLastUpdatedLabel("error");
    if (allSessions.length) {
      updateSidebarIndicators();
      applyFilters();
    } else {
      if (raceSpotlight) setHTML(raceSpotlight, "");
      renderLoadError();
    }
  } finally {
    refreshInFlight = false;
  }
}

function startAutoRefresh() {
  if (refreshIntervalId) clearInterval(refreshIntervalId);
  refreshIntervalId = setInterval(() => {
    loadWeekend({ silent: true });
  }, AUTO_REFRESH_MS);
}

sessionList.addEventListener("click", (event) => {
  const categoryLink = event.target.closest("[data-category-link]");
  if (categoryLink) {
    event.preventDefault();
    event.stopPropagation();
    window.location.href = categoryLink.dataset.categoryHref;
    return;
  }

  if (event.target.closest("[data-retry]")) {
    loadWeekend();
  }
});

sessionList.addEventListener("keydown", (event) => {
  const categoryLink = event.target.closest("[data-category-link]");
  if (!categoryLink) return;

  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    window.location.href = categoryLink.dataset.categoryHref;
  }
});

activeCategory = getCategoryFromUrl();
syncCategoryNavigation();
updateCategoryUrl(activeCategory, { replace: true });
updateClock();
setInterval(() => {
  updateClock();
  updateLastUpdatedLabel();
  if (allSessions.length) {
    updateSidebarIndicators();
    renderRaceSpotlight(allSessions);
    if (activeStatus !== "all") applyFilters();
  }
}, 1000);
loadWeekend();
startAutoRefresh();
