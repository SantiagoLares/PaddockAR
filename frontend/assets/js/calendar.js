const {
  ARG_TIMEZONE,
  categoryCode,
  categoryFamilyLabel,
  categoryHref,
  eventDisplayName,
  eventLocationLabel,
  getArgNow,
  formatDate,
  formatDateTime,
  getEventWinner,
  isLiveSession,
  renderCategoryBadge,
  renderWinnerLine,
  repairText,
  statusLabels,
  createLogger,
} = window.PaddockARCommon;

const { getJson } = window.PaddockARApi;
const { setHTML, setText, renderEmpty, renderError, renderSkeleton } = window.PaddockARDom;

const apiState = document.querySelector("#apiState") || document.querySelector("#apiText");
const calendarBoard = document.querySelector("#calendarBoard") || document.querySelector(".calendar-board");
const logger = createLogger("CalendarPage");

const TODAY = getArgNow() || new Date();
const WEEKDAY_LABELS = ["L", "M", "M", "J", "V", "S", "D"];

const CATEGORY_PRIORITY = [
  "f1",
  "motogp",
  "wec",
  "f2",
  "f3",
  "tc",
  "tcp",
  "tn-c3",
  "tn",
  "tn-c2",
  "tc2000",
  "tr",
  "top-race",
  "tp",
  "turismo-pista",
];

function safeSetText(node, value) {
  if (node) setText(node, value);
}

function safeSetHTML(node, value) {
  if (node) setHTML(node, value);
}

function toDayKey(date) {
  return date.format("YYYY-MM-DD");
}

function normalizeCode(value) {
  return String(value || "")
    .toLowerCase()
    .trim()
    .replace(/_/g, "-");
}

function eventCategoryCode(event) {
  const category = event?.category || {};
  return normalizeCode(
    categoryCode(category) ||
      category.slug ||
      category.short_name ||
      category.name ||
      "other",
  );
}

function categoryPriority(code) {
  const normalized = normalizeCode(code);
  const index = CATEGORY_PRIORITY.indexOf(normalized);
  return index === -1 ? 99 : index;
}

function buildMonthRange() {
  const current = window.PaddockARCommon.toDayjs(TODAY, {
    timezone: ARG_TIMEZONE,
    dateOnly: true,
  });

  return {
    monthStart: current.startOf("month"),
    monthEnd: current.endOf("month"),
  };
}

function getDayIndex(date) {
  return (date.day() + 6) % 7;
}

function resolveEventDates(event) {
  const start = window.PaddockARCommon.toDayjs(event.start_date, {
    timezone: ARG_TIMEZONE,
    dateOnly: true,
  });

  const end = window.PaddockARCommon.toDayjs(event.end_date || event.start_date, {
    timezone: ARG_TIMEZONE,
    dateOnly: true,
  });

  if (!start?.isValid?.() || !end?.isValid?.()) return null;

  return {
    start,
    end: end.isBefore(start) ? start : end,
  };
}

function formatEventRange(event) {
  const range = resolveEventDates(event);
  if (!range) return "";

  if (range.start.isSame(range.end, "day")) {
    return formatDate(range.start, { withYear: false, weekday: false });
  }

  return `${formatDate(range.start, { withYear: false, weekday: false })} – ${formatDate(range.end, { withYear: false, weekday: false })}`;
}

function getPrimarySession(event) {
  return event.primary_session || event.primarySession || event.sessions?.[0] || null;
}

function eventHasLiveSession(event) {
  return Boolean(event.sessions?.some((session) => isLiveSession(session)) || isLiveSession(getPrimarySession(event)));
}

function isEventFinished(event) {
  const status = String(event.status || "").toLowerCase();
  return status === "finished" || status === "finalized" || status === "completed";
}

function renderEventStatus(event, { compact = false } = {}) {
  const live = eventHasLiveSession(event);
  const rawStatus = String(event.status || "scheduled").toLowerCase();

  if (live) {
    return `<span class="calendar-tag calendar-tag--live">${compact ? "LIVE" : "En vivo"}</span>`;
  }

  if (isEventFinished(event)) {
    return `<span class="calendar-tag calendar-tag--finished">${compact ? "FIN" : "Finalizada"}</span>`;
  }

  if (rawStatus === "cancelled" || rawStatus === "postponed" || rawStatus === "tbc" || rawStatus === "to_confirm") {
    return `<span class="calendar-tag calendar-tag--confirm">${compact ? "TBC" : "A confirmar"}</span>`;
  }

  const label = statusLabels?.[rawStatus] || "Próxima";
  return `<span class="calendar-tag calendar-tag--upcoming">${compact ? "PROX" : repairText(label)}</span>`;
}

function buildMonthGrid(events) {
  const { monthStart, monthEnd } = buildMonthRange();
  const dayMap = new Map();

  events.forEach((event) => {
    const range = resolveEventDates(event);
    if (!range) return;

    for (let day = range.start.clone(); !day.isAfter(range.end, "day"); day = day.add(1, "day")) {
      if (!day.isSame(monthStart, "month")) continue;

      const key = toDayKey(day);
      const list = dayMap.get(key) || [];
      list.push(event);
      dayMap.set(key, list);
    }
  });

  const cells = [];

  for (let index = 0; index < getDayIndex(monthStart); index += 1) {
    cells.push('<div class="month-cell month-cell--empty" aria-hidden="true"></div>');
  }

  for (let day = 1; day <= monthEnd.date(); day += 1) {
    const date = monthStart.date(day);
    const key = toDayKey(date);
    const dayEvents = dayMap.get(key) || [];

    const codes = [...new Set(dayEvents.map((event) => eventCategoryCode(event)))]
      .filter(Boolean)
      .sort((a, b) => categoryPriority(a) - categoryPriority(b));

    const visibleCodes = codes.slice(0, 3);
    const extraCount = Math.max(0, codes.length - visibleCodes.length);

    const chips = visibleCodes
      .map((code) => `<span class="month-chip month-chip--${code}">${code.toUpperCase()}</span>`)
      .join("");

    cells.push(`
      <button
        type="button"
        class="month-cell"
        data-day="${key}"
        aria-label="${dayEvents.length} evento${dayEvents.length === 1 ? "" : "s"} el ${date.format("D [de] MMMM")}"
      >
        <span class="month-cell-number">${date.date()}</span>
        ${
          chips || extraCount
            ? `<span class="month-cell-dots">${chips}${extraCount ? `<span class="month-chip month-chip--more">+${extraCount}</span>` : ""}</span>`
            : ""
        }
      </button>
    `);
  }

  return {
    dayMap,
    cells: cells.join(""),
  };
}

function getWeekendBounds() {
  const reference = window.PaddockARCommon.toDayjs(TODAY, {
    timezone: ARG_TIMEZONE,
    dateOnly: true,
  });

  let friday = reference.day(5);

  if (friday.isBefore(reference, "day")) {
    friday = friday.add(7, "day");
  }

  return {
    friday,
    sunday: friday.add(2, "day"),
  };
}

function filterWeekendEvents(events) {
  const { friday, sunday } = getWeekendBounds();
  const seen = new Map();

  return events
    .filter((event) => {
      const range = resolveEventDates(event);
      if (!range) return false;
      return !range.end.isBefore(friday, "day") && !range.start.isAfter(sunday, "day");
    })
    .sort(compareEventsByPriority)
    .reduce((list, event) => {
      const code = eventCategoryCode(event);
      if (!code || seen.has(code)) return list;
      seen.set(code, true);
      list.push(event);
      return list;
    }, []);
}

function compareEventsByPriority(a, b) {
  const liveDelta = Number(eventHasLiveSession(b)) - Number(eventHasLiveSession(a));
  if (liveDelta) return liveDelta;

  const priorityDelta = categoryPriority(eventCategoryCode(a)) - categoryPriority(eventCategoryCode(b));
  if (priorityDelta) return priorityDelta;

  return String(a.start_date || "").localeCompare(String(b.start_date || ""));
}

function renderWeekendSection(events) {
  const weekendEvents = filterWeekendEvents(events);
  const { friday, sunday } = getWeekendBounds();

  const rangeLabel = `${formatDate(friday, { weekday: false, withYear: false })} – ${formatDate(sunday, {
    weekday: false,
    withYear: false,
  })}`;

  if (!weekendEvents.length) {
    return `
      <section class="weekend-section">
        <div class="weekend-header">
          <p class="weekend-label">Este fin de semana</p>
          <h2 class="weekend-heading">Sin actividad programada</h2>
          <p class="weekend-subtitle">No hay eventos confirmados en la ventana actual. Revisá el calendario mensual para ver todas las fechas.</p>
        </div>
      </section>
    `;
  }

  return `
    <section class="weekend-section">
      <div class="weekend-header">
        <p class="weekend-label">Este fin de semana</p>
        <h2 class="weekend-heading">${rangeLabel}</h2>
        <p class="weekend-subtitle">Lo más importante del finde, ordenado por relevancia deportiva.</p>
      </div>

      <div class="weekend-cards">
        ${weekendEvents
          .map((event) => {
            const primary = getPrimarySession(event);
            const sessionLine = primary
              ? `${repairText(primary.name || "Sesión")} · ${formatDateTime(primary.starts_at || primary.start_time || event.start_date, {
                  withYear: false,
                  weekday: true,
                })}`
              : formatEventRange(event);

            return `
              <a class="weekend-card weekend-card--${eventCategoryCode(event)}" href="event.html?id=${encodeURIComponent(event.id)}">
                <div class="weekend-card-head">
                  ${renderCategoryBadge(event.category, { tag: "span", size: "compact" })}
                  ${renderEventStatus(event)}
                </div>

                <div class="weekend-card-event">${eventDisplayName(event)}</div>
                <div class="weekend-card-location">${repairText(eventLocationLabel(event))}</div>
                <div class="weekend-card-footer">${sessionLine}</div>
              </a>
            `;
          })
          .join("")}
      </div>
    </section>
  `;
}

function buildCategoryGroups(events) {
  const groups = new Map();

  events.forEach((event) => {
    const code = eventCategoryCode(event);
    const category = event.category || {};
    const label = repairText(category.short_name || category.name || categoryFamilyLabel(category) || code.toUpperCase());

    if (!groups.has(code)) {
      groups.set(code, {
        code,
        label,
        category,
        events: [],
      });
    }

    groups.get(code).events.push(event);
  });

  return Array.from(groups.values()).sort((a, b) => {
    const priorityDelta = categoryPriority(a.code) - categoryPriority(b.code);
    if (priorityDelta) return priorityDelta;
    return a.label.localeCompare(b.label, "es", { sensitivity: "base" });
  });
}

function buildCategoryLegend(events) {
  const categories = new Map();

  events.forEach((event) => {
    const category = event.category;
    const code = eventCategoryCode(event);

    if (!category || !code) return;

    if (!categories.has(code)) {
      categories.set(code, category);
    }
  });

  return Array.from(categories.entries())
    .sort(([a], [b]) => categoryPriority(a) - categoryPriority(b))
    .map(([, category]) => category);
}

function renderCategoryLegend(events) {
  const categories = buildCategoryLegend(events);

  if (!categories.length) return "";

  return `
    <div class="calendar-legend">
      ${categories
        .map((category) => `
          <a class="calendar-legend-item" href="${categoryHref(category)}">
            ${renderCategoryBadge(category, { tag: "span", size: "compact" })}
            <span class="calendar-legend-name">${repairText(category.short_name || category.name || "")}</span>
          </a>
        `)
        .join("")}
    </div>
  `;
}

function renderWinner(event) {
  const winner = getEventWinner(event);

  if (winner) {
    return renderWinnerLine(winner, { compact: true });
  }

  if (isEventFinished(event)) {
    return `<div class="winner-line winner-line--pending">Resultado pendiente</div>`;
  }

  return "";
}

function renderCategoryPanels(events) {
  const groups = buildCategoryGroups(events);

  if (!groups.length) {
    return `<div class="calendar-empty-list">${renderEmpty("No hay eventos para mostrar", "Verificá tu conexión o volvé a cargar la página.")}</div>`;
  }

  return groups
    .map((group) => {
      const sortedEvents = [...group.events].sort((a, b) => String(a.start_date || "").localeCompare(String(b.start_date || "")));
      const nextEvent = sortedEvents.find((event) => !isEventFinished(event));
      const lastFinished = [...sortedEvents].reverse().find((event) => isEventFinished(event));
      const lastWinner = lastFinished ? getEventWinner(lastFinished) : null;

      return `
        <details class="category-panel">
          <summary>
            <div class="category-summary-main">
              ${renderCategoryBadge(group.category || { slug: group.code, short_name: group.label, name: group.label }, { tag: "span", size: "compact" })}
              <div>
                <h3 class="category-panel-title">${repairText(group.label)}</h3>
                <p class="category-panel-detail">
                  ${sortedEvents.length} fecha${sortedEvents.length === 1 ? "" : "s"}
                  ${nextEvent ? ` · Próxima: ${eventDisplayName(nextEvent)}` : ""}
                  ${lastWinner ? ` · Último ganador: ${repairText(lastWinner.name || lastWinner.driver || lastWinner.team || lastWinner)}` : ""}
                </p>
              </div>
            </div>

            <span class="category-panel-count">${sortedEvents.length}</span>
          </summary>

          <div class="category-panel-body">
            ${sortedEvents
              .map((event) => `
                <a class="category-event-card category-event-card--${eventCategoryCode(event)}" href="event.html?id=${encodeURIComponent(event.id)}">
                  <div class="category-event-card-head">
                    ${renderEventStatus(event)}
                    <span class="category-event-date">${formatEventRange(event)}</span>
                  </div>

                  <div class="category-event-line">
                    <span class="category-event-name">${eventDisplayName(event)}</span>
                  </div>

                  <div class="category-event-meta">${repairText(eventLocationLabel(event))}</div>
                  ${renderWinner(event)}
                </a>
              `)
              .join("")}
          </div>
        </details>
      `;
    })
    .join("");
}

function renderDayDetails(dayKey, events) {
  const selectedDate = window.PaddockARCommon.toDayjs(dayKey, {
    timezone: ARG_TIMEZONE,
    dateOnly: true,
  });

  const dateLabel = selectedDate?.isValid?.()
    ? formatDate(selectedDate, { weekday: true, withYear: true })
    : "Día seleccionado";

  if (!events.length) {
    return `
      <h3 class="month-detail-title">${dateLabel}</h3>
      <div class="month-detail-empty">No hay actividad programada para este día.</div>
    `;
  }

  return `
    <h3 class="month-detail-title">${dateLabel}</h3>
    <div class="month-detail-subtitle">
      ${events.length} evento${events.length === 1 ? "" : "s"} programado${events.length === 1 ? "" : "s"}
    </div>

    <div class="month-detail-list">
      ${events
        .sort(compareEventsByPriority)
        .map((event) => {
          const primary = getPrimarySession(event);
          const sessionTime = primary?.starts_at || primary?.start_time || event.start_date;

          return `
            <a class="month-detail-event month-detail-event--${eventCategoryCode(event)}" href="event.html?id=${encodeURIComponent(event.id)}">
              <div class="month-detail-event-header">
                <div class="month-detail-event-badge">
                  ${renderCategoryBadge(event.category, { tag: "span", size: "compact" })}
                  <span class="month-detail-event-name">${eventDisplayName(event)}</span>
                </div>
                ${renderEventStatus(event)}
              </div>

              <div class="month-detail-event-meta">
                <span>${primary ? repairText(primary.name || "Sesión") : "Evento"}</span>
                <span>${formatDateTime(sessionTime, { withYear: false, weekday: true })}</span>
              </div>

              <div class="month-detail-event-location">${repairText(eventLocationLabel(event))}</div>
              ${renderWinner(event)}
            </a>
          `;
        })
        .join("")}
    </div>
  `;
}

function renderCalendar(events) {
  if (!events.length) {
    safeSetHTML(calendarBoard, renderEmpty("No se encontraron eventos", "Esperá unos instantes mientras se actualiza el calendario."));
    return;
  }

  const sortedEvents = [...events].sort(compareEventsByPriority);
  const { dayMap, cells } = buildMonthGrid(sortedEvents);

  const currentDay = window.PaddockARCommon.toDayjs(TODAY, {
    timezone: ARG_TIMEZONE,
    dateOnly: true,
  });

  const activeDay = toDayKey(currentDay);

  safeSetHTML(
    calendarBoard,
    `
      ${renderWeekendSection(sortedEvents)}

      <section class="month-panel">
        <div class="month-header">
          <div>
            <p class="month-label">Calendario mensual</p>
            <h2 class="month-title">${currentDay.format("MMMM YYYY")}</h2>
            <p class="month-copy">Tocá un día para ver eventos, sesiones y carreras del mes actual.</p>
          </div>

          <span class="calendar-summary-badge">${sortedEvents.length} eventos</span>
        </div>

        ${renderCategoryLegend(sortedEvents)}

        <div class="month-panel-body">
          <div class="month-calendar">
            <div class="month-grid-head">${WEEKDAY_LABELS.map((label) => `<span>${label}</span>`).join("")}</div>
            <div class="month-grid" role="grid">${cells}</div>
          </div>

          <aside class="month-detail" data-active-day="${activeDay}">
            ${renderDayDetails(activeDay, dayMap.get(activeDay) || [])}
          </aside>
        </div>
      </section>

      <section class="category-panel-list">
        <div class="category-panel-summary">
          <p class="category-label">Por categoría</p>
          <h2 class="category-panel-title">Calendarios completos</h2>
          <p class="category-panel-detail">Abrí cada campeonato para ver todas sus fechas y ganadores disponibles.</p>
        </div>

        ${renderCategoryPanels(sortedEvents)}
      </section>
    `,
  );

  const grid = calendarBoard.querySelector(".month-grid");
  const detail = calendarBoard.querySelector(".month-detail");

  grid?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-day]");
    if (!button) return;

    const dayKey = button.dataset.day;

    calendarBoard.querySelectorAll(".month-cell").forEach((cell) => {
      cell.classList.remove("month-cell--selected");
    });

    button.classList.add("month-cell--selected");
    detail.innerHTML = renderDayDetails(dayKey, dayMap.get(dayKey) || []);
  });

  const activeButton = calendarBoard.querySelector(`[data-day="${activeDay}"]`);

  if (activeButton) {
    activeButton.classList.add("month-cell--selected");
  }
}

function renderLoadError() {
  safeSetHTML(calendarBoard, renderError("No pudimos cargar el calendario", { retry: true }));
  safeSetText(apiState, "Error de API");
}

async function loadCalendar() {
  safeSetText(apiState, "Cargando");
  safeSetHTML(calendarBoard, renderSkeleton("calendar"));

  logger.info("Loading calendar events", "/api/events");

  try {
    const events = await getJson("/api/events");
    renderCalendar(Array.isArray(events) ? events : []);
    safeSetText(apiState, `${Array.isArray(events) ? events.length : 0} eventos`);
  } catch (error) {
    logger.error("Calendar fetch failed", error);
    renderLoadError();
  }
}

calendarBoard?.addEventListener("click", (event) => {
  if (event.target.closest("[data-retry]")) {
    loadCalendar();
  }
});

loadCalendar()
  .then(() => {
    try {
      window.PaddockARAnalytics?.trackPageView?.("view_calendar");
    } catch (error) {}
  })
  .catch(() => {});