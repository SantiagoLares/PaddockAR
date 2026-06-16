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

const apiState = document.querySelector("#apiState");
const calendarBoard = document.querySelector("#calendarBoard");
const logger = createLogger("CalendarPage");

const TODAY = getArgNow() || new Date();

const CALENDAR_CATEGORY_ORDER = [
  "f1",
  "f2",
  "f3",
  "motogp",
  "wec",
  "tc",
  "tcp",
  "tcm",
  "tcpm",
  "tcpk",
  "tcppk",
  "tc2000",
  "tr",
  "t4000",
  "bora",
  "tp",
  "tn",
];

function safeText(value, fallback = "") {
  return repairText(String(value || fallback || "").trim());
}

function toDateOnly(value) {
  if (!value) return null;

  const date = window.PaddockARCommon.toDayjs(value, {
    timezone: ARG_TIMEZONE,
    dateOnly: true,
  });

  return date?.isValid?.() ? date : null;
}

function resolveEventDates(event) {
  const start = toDateOnly(event.start_date);
  const end = toDateOnly(event.end_date || event.start_date);

  if (!start || !end) return null;

  return {
    start,
    end: end.isBefore(start, "day") ? start : end,
  };
}

function calendarCategoryOrderIndex(code) {
  const index = CALENDAR_CATEGORY_ORDER.indexOf(String(code || "").toLowerCase());
  return index === -1 ? 999 : index;
}

function getCategoryCode(category) {
  return (
    categoryCode(category) ||
    String(category?.slug || category?.short_name || category?.name || "other")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "-")
  );
}

function getCategoryLabel(category, fallbackCode = "") {
  return safeText(
    category?.name ||
      category?.short_name ||
      categoryFamilyLabel(category) ||
      fallbackCode.toUpperCase(),
  );
}

function sortEventsByDate(events) {
  return [...events].sort((a, b) => {
    const dateA = String(a.start_date || "");
    const dateB = String(b.start_date || "");

    if (dateA !== dateB) return dateA.localeCompare(dateB);

    return eventDisplayName(a).localeCompare(eventDisplayName(b), "es", {
      sensitivity: "base",
    });
  });
}

function formatEventRange(event) {
  const range = resolveEventDates(event);

  if (!range) return "Fecha a confirmar";

  if (range.start.isSame(range.end, "day")) {
    return formatDate(range.start, {
      withYear: false,
      weekday: false,
    });
  }

  const sameMonth = range.start.isSame(range.end, "month");

  if (sameMonth) {
    return `${range.start.format("DD")} – ${formatDate(range.end, {
      withYear: false,
      weekday: false,
    })}`;
  }

  return `${formatDate(range.start, {
    withYear: false,
    weekday: false,
  })} – ${formatDate(range.end, {
    withYear: false,
    weekday: false,
  })}`;
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

  const sunday = friday.add(2, "day");

  return { friday, sunday };
}

function filterWeekendEvents(events) {
  const { friday, sunday } = getWeekendBounds();
  const seen = new Map();

  return sortEventsByDate(events)
    .filter((event) => {
      const range = resolveEventDates(event);
      if (!range) return false;

      return !range.end.isBefore(friday, "day") && !range.start.isAfter(sunday, "day");
    })
    .reduce((list, event) => {
      const code = getCategoryCode(event.category);

      if (!code || seen.has(code)) return list;

      seen.set(code, true);
      list.push(event);

      return list;
    }, []);
}

function renderEventStatus(event) {
  const live = isLiveSession(event.primary_session || event.primarySession);
  const key = live ? "live" : String(event.status || "scheduled").toLowerCase();

  const label = live
    ? "En vivo"
    : statusLabels[key] || String(event.status || "Próximo").toUpperCase();

  const variant =
    live
      ? "live"
      : key === "finished"
        ? "finished"
        : key === "cancelled"
          ? "confirm"
          : "upcoming";

  return `<span class="calendar-tag calendar-tag--${variant}">${safeText(label)}</span>`;
}

function renderWeekendSection(events) {
  const weekendEvents = filterWeekendEvents(events);
  const { friday, sunday } = getWeekendBounds();

  const rangeLabel = `${formatDate(friday, {
    weekday: false,
    withYear: false,
  })} – ${formatDate(sunday, {
    weekday: false,
    withYear: false,
  })}`;

  if (!weekendEvents.length) {
    return `
      <section class="weekend-section">
        <div class="weekend-header">
          <p class="weekend-label">Este fin de semana</p>
          <h2 class="weekend-heading">Sin actividad programada</h2>
        </div>
        <p class="weekend-subtitle">
          No hay eventos confirmados en la ventana actual. Revisá el calendario completo para ver todas las fechas.
        </p>
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
          .map((event) => `
            <a class="weekend-card" href="event.html?id=${encodeURIComponent(event.id)}">
              <div class="weekend-card-head">
                ${renderCategoryBadge(event.category, { tag: "span", size: "compact" })}
                ${renderEventStatus(event)}
              </div>

              <div class="weekend-card-event">${safeText(eventDisplayName(event))}</div>
              <div class="weekend-card-location">${safeText(eventLocationLabel(event))}</div>
              <div class="weekend-card-footer">
                ${formatEventRange(event)}
              </div>
            </a>
          `)
          .join("")}
      </div>
    </section>
  `;
}

function buildCategoryGroups(events) {
  const groups = new Map();

  events.forEach((event) => {
    const category = event.category || {};
    const code = getCategoryCode(category);
    const label = getCategoryLabel(category, code);

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
    const ai = calendarCategoryOrderIndex(a.code);
    const bi = calendarCategoryOrderIndex(b.code);

    if (ai !== bi) return ai - bi;

    return a.label.localeCompare(b.label, "es", {
      sensitivity: "base",
    });
  });
}

function renderCalendarTableCategoryPanels(events) {
  const groups = buildCategoryGroups(events);

  if (!groups.length) {
    return `
      <div class="calendar-empty-list">
        ${renderEmpty("No hay eventos para mostrar", "Verificá tu conexión o volvé a cargar la página.")}
      </div>
    `;
  }

  return groups
    .map((group, index) => {
      const sortedEvents = sortEventsByDate(group.events);
      const panelId = `calendar-panel-${group.code}`;
      const isOpen = index === 0;

      const categoryBadgeCategory =
        group.category || {
          slug: group.code,
          short_name: group.label,
          name: group.label,
        };

      return `
        <article class="calendar-category-block${isOpen ? " is-open" : ""}">
          <button
            class="calendar-category-title"
            type="button"
            aria-expanded="${isOpen ? "true" : "false"}"
            aria-controls="${panelId}"
            data-calendar-toggle
          >
            <span class="calendar-category-left">
              ${renderCategoryBadge(categoryBadgeCategory, { tag: "span", size: "compact" })}
              <span class="calendar-category-name">${safeText(group.label)}</span>
              <span class="calendar-category-count">
                ${sortedEvents.length} evento${sortedEvents.length === 1 ? "" : "s"}
              </span>
            </span>

            <span class="calendar-category-chevron" aria-hidden="true">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                   stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="6 9 12 15 18 9"></polyline>
              </svg>
            </span>
          </button>

          <div class="calendar-category-panel" id="${panelId}" ${isOpen ? "" : "hidden"}>
            <div class="calendar-table-wrapper">
              <table class="calendar-table">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Categoría</th>
                    <th>Evento</th>
                    <th>Circuito / País</th>
                    <th>Estado</th>
                  </tr>
                </thead>

                <tbody>
                  ${sortedEvents
                    .map((event) => {
                      const winner = getEventWinner(event);
                      const href = `event.html?id=${encodeURIComponent(event.id)}`;

                      return `
                        <tr
                          class="calendar-table-row"
                          tabindex="0"
                          role="link"
                          data-event-href="${href}"
                        >
                          <td class="calendar-table-date">${formatEventRange(event)}</td>

                          <td class="calendar-table-category">
                            ${renderCategoryBadge(event.category, { tag: "span", size: "compact" })}
                          </td>

                          <td class="calendar-table-event">
                            <span>${safeText(eventDisplayName(event))}</span>
                            ${winner ? renderWinnerLine(winner, { compact: true }) : ""}
                          </td>

                          <td class="calendar-table-location">
                            ${safeText(eventLocationLabel(event))}
                          </td>

                          <td class="calendar-table-status">
                            ${renderEventStatus(event)}
                          </td>
                        </tr>
                      `;
                    })
                    .join("")}
                </tbody>
              </table>
            </div>
          </div>
        </article>
      `;
    })
    .join("");
}

function renderCalendar(events) {
  if (!Array.isArray(events) || !events.length) {
    setHTML(
      calendarBoard,
      renderEmpty(
        "No se encontraron eventos",
        "Esperá unos instantes mientras se actualiza el calendario.",
      ),
    );

    setText(apiState, "0 eventos");
    return;
  }

  const sortedEvents = sortEventsByDate(events);

  setHTML(
    calendarBoard,
    `
      ${renderWeekendSection(sortedEvents)}

      <section class="calendar-table-section">
        <div class="calendar-table-header">
          <div>
            <p class="calendar-table-label">Calendario completo</p>
            <h2 class="calendar-table-title">Eventos por categoría</h2>
            <p class="calendar-table-copy">
              Abrí cada campeonato para ver sus fechas, circuitos y estado de publicación.
            </p>
          </div>

          <span class="calendar-summary-badge">
            ${sortedEvents.length} evento${sortedEvents.length === 1 ? "" : "s"}
          </span>
        </div>

        ${renderCalendarTableCategoryPanels(sortedEvents)}
      </section>
    `,
  );

  setText(apiState, `${sortedEvents.length} eventos`);

  calendarBoard.querySelectorAll("[data-calendar-toggle]").forEach((button) => {
    button.addEventListener("click", () => {
      const block = button.closest(".calendar-category-block");
      const panel = document.getElementById(button.getAttribute("aria-controls"));

      if (!block || !panel) return;

      const isOpen = block.classList.toggle("is-open");

      button.setAttribute("aria-expanded", isOpen ? "true" : "false");

      if (isOpen) {
        panel.removeAttribute("hidden");
      } else {
        panel.setAttribute("hidden", "");
      }
    });
  });

  calendarBoard.querySelectorAll("[data-event-href]").forEach((row) => {
    const goToEvent = () => {
      const href = row.dataset.eventHref;
      if (href) window.location.href = href;
    };

    row.addEventListener("click", goToEvent);

    row.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        goToEvent();
      }
    });
  });
}

function renderLoadError() {
  setText(apiState, "Error");

  setHTML(
    calendarBoard,
    renderError("No pudimos cargar la información", {
      retry: true,
    }),
  );
}

async function loadCalendar() {
  try {
    setText(apiState, "Cargando");

    if (renderSkeleton) {
      setHTML(calendarBoard, renderSkeleton(3));
    }

    const events = await getJson("/api/events");

    renderCalendar(Array.isArray(events) ? events : []);
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
    } catch (error) {
      logger.warn?.("Analytics track failed", error);
    }
  })
  .catch(() => {});