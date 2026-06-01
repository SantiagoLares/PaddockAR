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
  formatRelative,
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

const apiState = document.querySelector("#apiState");
const calendarBoard = document.querySelector("#calendarBoard");
const logger = createLogger("CalendarPage");
const TODAY = getArgNow() || new Date();
const WEEKDAY_LABELS = ["L", "M", "M", "J", "V", "S", "D"];

function toDayKey(date) {
  return date.format("YYYY-MM-DD");
}

function buildMonthRange() {
  const current = window.PaddockARCommon.toDayjs(TODAY, { timezone: ARG_TIMEZONE, dateOnly: true });
  return {
    monthStart: current.startOf("month"),
    monthEnd: current.endOf("month"),
  };
}

function getDayIndex(date) {
  return (date.day() + 6) % 7;
}

function resolveEventDates(event) {
  const start = window.PaddockARCommon.toDayjs(event.start_date, { timezone: ARG_TIMEZONE, dateOnly: true });
  const end = window.PaddockARCommon.toDayjs(event.end_date || event.start_date, { timezone: ARG_TIMEZONE, dateOnly: true });
  if (!start?.isValid?.() || !end?.isValid?.()) return null;
  return { start, end: end.isBefore(start) ? start : end };
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
    const badges = [...new Set(dayEvents.map((event) => categoryCode(event.category)))]
      .filter(Boolean)
      .map((code) => `<span class="month-dot month-dot--${code}"></span>`)
      .join("");

    cells.push(`
      <button type="button" class="month-cell" data-day="${key}" aria-label="${dayEvents.length} evento${dayEvents.length === 1 ? "" : "s"} el ${date.format("D [de] MMM")}">
        <span class="month-cell-number">${date.date()}</span>
        ${badges ? `<span class="month-cell-dots">${badges}</span>` : ""}
      </button>
    `);
  }

  return { dayMap, cells: cells.join("") };
}

function getWeekendBounds() {
  const reference = window.PaddockARCommon.toDayjs(TODAY, { timezone: ARG_TIMEZONE, dateOnly: true });
  let friday = reference.day(5);
  if (friday.isBefore(reference, "day")) {
    friday = friday.add(7, "day");
  }
  const sunday = friday.add(2, "day");
  return { friday, sunday };
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
    .sort((a, b) => a.start_date.localeCompare(b.start_date))
    .reduce((list, event) => {
      const code = categoryCode(event.category) || event.category?.slug || event.category?.short_name;
      if (!code || seen.has(code)) return list;
      seen.set(code, true);
      list.push(event);
      return list;
    }, []);
}

function renderEventStatus(event) {
  const live = isLiveSession(event.primary_session || event.primarySession);
  const key = live ? "live" : String(event.status || "scheduled").toLowerCase();
  const label = live ? "En vivo" : (statusLabels[key] || String(event.status || "PROXIMO")).toUpperCase();
  const variant = live ? "live" : key === "finished" ? "finished" : key === "cancelled" ? "confirm" : "upcoming";
  return `<span class="calendar-tag calendar-tag--${variant}">${label}</span>`;
}

function renderWeekendSection(events) {
  const weekendEvents = filterWeekendEvents(events);
  const { friday, sunday } = getWeekendBounds();
  const rangeLabel = `${formatDate(friday, { weekday: false, withYear: false })} – ${formatDate(sunday, { weekday: false, withYear: false })}`;

  if (!weekendEvents.length) {
    return `
      <section class="weekend-section">
        <div class="weekend-header">
          <p class="weekend-label">Este fin de semana</p>
          <h2 class="weekend-heading">Sin actividad programada</h2>
        </div>
        <p class="weekend-subtitle">No hay eventos confirmados en la ventana actual. Revisá el calendario mensual para ver todas las fechas.</p>
      </section>
    `;
  }

  return `
    <section class="weekend-section">
      <div class="weekend-header">
        <p class="weekend-label">Este fin de semana</p>
        <h2 class="weekend-heading">${rangeLabel}</h2>
      </div>
      <div class="weekend-cards">
        ${weekendEvents
          .map((event) => {
            return `
              <a class="weekend-card" href="event.html?id=${encodeURIComponent(event.id)}">
                <div class="weekend-card-head">
                  ${renderCategoryBadge(event.category, { tag: "span", size: "compact" })}
                  ${renderEventStatus(event)}
                </div>
                <div class="weekend-card-event">${eventDisplayName(event)}</div>
                <div class="weekend-card-location">${repairText(eventLocationLabel(event))}</div>
                <div class="weekend-card-footer">${formatDateTime(event.start_date, { withYear: false, weekday: false })}</div>
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
    const code = categoryCode(event.category) || "other";
    const label = repairText(event.category?.short_name || event.category?.name || categoryFamilyLabel(event.category) || code.toUpperCase());
    if (!groups.has(code)) {
      groups.set(code, { code, label, events: [] });
    }
    groups.get(code).events.push(event);
  });

  return Array.from(groups.values()).sort((a, b) => a.label.localeCompare(b.label, "es", { sensitivity: "base" }));
}

function buildCategoryLegend(events) {
  const categories = new Map();

  events.forEach((event) => {
    const category = event.category;
    const code = categoryCode(category) || String(category?.slug || category?.short_name || "").trim().toLowerCase();
    if (!code) return;
    if (!categories.has(code)) {
      categories.set(code, category);
    }
  });

  return Array.from(categories.values()).sort((a, b) => {
    const nameA = repairText(a?.short_name || a?.name || "");
    const nameB = repairText(b?.short_name || b?.name || "");
    return nameA.localeCompare(nameB, "es", { sensitivity: "base" });
  });
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

function renderCategoryPanels(events) {
  const groups = buildCategoryGroups(events);
  if (!groups.length) {
    return `<div class="calendar-empty-list">${renderEmpty("No hay eventos para mostrar", "Verifica tu conexión o vuelve a cargar la página.")}</div>`;
  }

  return groups
    .map((group) => {
      const eventCount = group.events.length;
      const sortedEvents = [...group.events].sort((a, b) => a.start_date.localeCompare(b.start_date));

      return `
        <details class="category-panel">
          <summary>
            <div>
              ${renderCategoryBadge({ slug: group.code, short_name: group.label, name: group.label }, { tag: "span", size: "compact" })}
              <div class="category-panel-title">${repairText(group.label)}</div>
            </div>
            <span class="category-panel-count">${eventCount} evento${eventCount === 1 ? "" : "s"}</span>
          </summary>
          <div class="category-panel-body">
            ${sortedEvents
              .map((event) => `
                <a class="category-event-card" href="event.html?id=${encodeURIComponent(event.id)}">
                  <div class="category-event-line">
                    <span class="category-event-name">${eventDisplayName(event)}</span>
                    <span class="category-event-date">${formatDate(event.start_date, { withYear: false, weekday: false })}</span>
                  </div>
                  <div class="category-event-meta">${repairText(eventLocationLabel(event))}</div>
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
  const selectedDate = window.PaddockARCommon.toDayjs(dayKey, { timezone: ARG_TIMEZONE, dateOnly: true });
  const dateLabel = selectedDate?.isValid?.() ? formatDate(selectedDate, { weekday: true, withYear: true }) : "Día seleccionado";

  if (!events.length) {
    return `
      <div class="month-detail">
        <div class="month-detail-title">${dateLabel}</div>
        <div class="month-detail-empty">No hay actividad programada para este día.</div>
      </div>
    `;
  }

  return `
    <div class="month-detail">
      <div class="month-detail-title">${dateLabel}</div>
      <div class="month-detail-subtitle">${events.length} evento${events.length === 1 ? "" : "s"} programado${events.length === 1 ? "" : "s"}</div>
      <div class="month-detail-list">
        ${events
          .sort((a, b) => a.start_date.localeCompare(b.start_date))
          .map((event) => {
            const winner = getEventWinner(event);
            return `
              <a class="month-detail-event" href="event.html?id=${encodeURIComponent(event.id)}">
                <div class="month-detail-event-header">
                  <div class="month-detail-event-badge">
                    ${renderCategoryBadge(event.category, { tag: "span", size: "compact" })}
                    <span class="month-detail-event-name">${eventDisplayName(event)}</span>
                  </div>
                  ${renderEventStatus(event)}
                </div>
                <div class="month-detail-event-meta">
                  <span>${formatDateTime(event.start_date, { withYear: false, weekday: true })}</span>
                  <span>${repairText(eventLocationLabel(event))}</span>
                </div>
                ${winner ? renderWinnerLine(winner, { compact: true }) : ""}
              </a>
            `;
          })
          .join("")}
      </div>
    </div>
  `;
}

function renderCalendar(events) {
  if (!events.length) {
    setHTML(calendarBoard, renderEmpty("No se encontraron eventos", "Esperá unos instantes mientras se actualiza el calendario."));
    return;
  }

  const sortedEvents = [...events].sort((a, b) => a.start_date.localeCompare(b.start_date));
  const { dayMap, cells } = buildMonthGrid(sortedEvents);
  const activeDay = toDayKey(window.PaddockARCommon.toDayjs(TODAY, { timezone: ARG_TIMEZONE, dateOnly: true }));

  setHTML(
    calendarBoard,
    `
      ${renderWeekendSection(sortedEvents)}
      <section class="month-panel">
        <div class="month-header">
          <div>
            <p class="month-label">Calendario mensual</p>
            <h2 class="month-title">${formatDate(window.PaddockARCommon.toDayjs(TODAY, { timezone: ARG_TIMEZONE, dateOnly: true }), { withYear: true, weekday: false })}</h2>
            <p class="month-copy">Haz clic en un día para ver los eventos del mes, el panel del día seleccionado y el detalle por categoría.</p>
          </div>
          <span class="calendar-summary-badge">${sortedEvents.length} eventos</span>
        </div>
        ${renderCategoryLegend(sortedEvents)}
        <div class="month-panel-body">
          <div>
            <div class="month-grid-head">${WEEKDAY_LABELS.map((label) => `<span>${label}</span>`).join("")}</div>
            <div class="month-grid" role="grid">${cells}</div>
          </div>
          <div class="month-detail" data-active-day="${activeDay}">${renderDayDetails(activeDay, dayMap.get(activeDay) || [])}</div>
        </div>
      </section>
      <section class="category-panel-list">
        <div class="category-panel-summary">
          <p class="category-label">Categorias</p>
          <h2 class="category-panel-title">Eventos por campeonato</h2>
          <p class="category-panel-detail">Amplía cada categoría para ver los eventos más importantes del mes.</p>
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
    calendarBoard.querySelectorAll(".month-cell").forEach((cell) => cell.classList.remove("month-cell--selected"));
    button.classList.add("month-cell--selected");
    detail.innerHTML = renderDayDetails(dayKey, dayMap.get(dayKey) || []);
  });

  const activeButton = calendarBoard.querySelector(`[data-day="${activeDay}"]`);
  if (activeButton) {
    activeButton.classList.add("month-cell--selected");
  }
}

function renderLoadError() {
  setHTML(calendarBoard, renderError("No pudimos cargar el calendario", { retry: true }));
  setText(apiState, "Error de API");
}

async function loadCalendar() {
  setText(apiState, "Cargando");
  setHTML(calendarBoard, renderSkeleton("calendar"));
  logger.info("Loading calendar events", "/api/events");

  try {
    const events = await getJson("/api/events");
    renderCalendar(events);
    setText(apiState, `${events.length} eventos`);
  } catch (error) {
    logger.error("Calendar fetch failed", error);
    renderLoadError();
  }
}

calendarBoard.addEventListener("click", (event) => {
  if (event.target.closest("[data-retry]")) {
    loadCalendar();
  }
});

loadCalendar().then(() => {
  try {
    window.PaddockARAnalytics?.trackPageView?.('view_calendar');
  } catch (e) {}
}).catch(() => {});
