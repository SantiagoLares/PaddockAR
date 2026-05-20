const {
  categoryHref,
  categoryFamilyKey,
  categoryFamilyLabel,
  eventDisplayName,
  formatDate,
  renderIcon,
  renderIconLabel,
  renderCategoryBadge,
  getPrimaryEventSession,
  getSessionWinner,
  renderWinnerLine,
  createLogger,
} = window.PaddockARCommon;
const { getJson } = window.PaddockARApi;
const { setHTML, setText, renderEmpty, renderError, renderSkeleton } = window.PaddockARDom;
const logger = createLogger("PaddockAR");

const categoryOrder = ["F1", "F2", "F3", "MotoGP", "WEC", "TC", "TCP", "TCM", "TCPM", "TCPK", "TCPPK", "TC2000", "TR", "T4000", "BORA", "TP", "TN"];
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

function categoryPanelId(category) {
  return `category-panel-${String(category.slug || category.short_name || "cat").replace(/[^a-z0-9_-]+/gi, "-").toLowerCase()}`;
}

function renderEventWinner(event) {
  const primarySession = getPrimaryEventSession(event);
  if (primarySession?.status !== "finished") return "";
  return renderWinnerLine(getSessionWinner(primarySession), { compact: true });
}

function getGroupHeaderCategory(group) {
  if (group.key === "TN" && group.categories.size > 1) {
    return {
      ...group.events[0].category,
      name: "Turismo Nacional",
      short_name: "TN",
      slug: "turismo-nacional",
    };
  }
  if (group.key === "TP" && group.categories.size > 1) {
    return {
      ...group.events[0].category,
      name: "Turismo Pista",
      short_name: "TP",
      slug: "turismo-pista",
    };
  }
  if (group.categories.size === 1) return group.events[0].category;
  return group.events.find((event) => categoryFamilyKey(event.category) === "TN")?.category || group.events[0].category;
}

function groupByCategory(events) {
  const groups = new Map();

  events.forEach((event) => {
    const familyKey = categoryFamilyKey(event.category);
    if (!groups.has(familyKey)) {
      groups.set(familyKey, {
        key: familyKey,
        label: categoryFamilyLabel(event.category),
        categories: new Map(),
        events: [],
      });
    }
    const group = groups.get(familyKey);
    group.events.push(event);
    group.categories.set(event.category.slug, event.category);
  });

  return Array.from(groups.values()).sort((a, b) => {
    const aIndex = categoryOrder.indexOf(a.key);
    const bIndex = categoryOrder.indexOf(b.key);
    return (aIndex === -1 ? 99 : aIndex) - (bIndex === -1 ? 99 : bIndex);
  });
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
  const groups = groupByCategory(sorted);

  setHTML(calendarBoard, groups
    .map((group) => {
      const primaryCategory = getGroupHeaderCategory(group);
      const panelId = categoryPanelId(primaryCategory);
      const rows = group.events
        .map(
          (event) => `
          <a class="event-row" href="event.html?id=${event.id}">
            <div class="date-range mono">${formatDate(event.start_date)} - ${formatDate(event.end_date)}</div>
            <div class="event-main">
              <div class="event-line">
                ${renderCategoryBadge(event.category, { tag: "span", extraClass: "event-category-logo", size: "compact" })}
                <div class="event-name">${eventDisplayName(event)}</div>
              </div>
              ${renderEventWinner(event)}
              <div class="circuit">${event.circuit.name}</div>
            </div>
            <div class="country mono">${event.circuit.city ? `${event.circuit.city}, ${event.circuit.country}` : event.circuit.country}</div>
          </a>
        `,
        )
        .join("");

      return `
          <section class="category-block">
            <div class="category-title" data-accordion-toggle aria-expanded="false" aria-controls="${panelId}" role="button" tabindex="0">
              <div class="category-left">
                ${group.categories.size === 1
            ? `
                    <a class="category-link" href="${categoryHref(primaryCategory)}" aria-label="Ver categoría ${primaryCategory.name}">
                      ${renderCategoryBadge(primaryCategory, {
                tag: "span",
                extraClass: "category-header-logo",
                size: "compact",
              })}
                    </a>
                  `
            : renderCategoryBadge(primaryCategory, { tag: "span", extraClass: "category-header-logo", size: "compact" })}
                <div class="category-name">${group.label}</div>
                <div class="category-count mono">${group.events.length} eventos</div>
              </div>
              <div class="category-right">
                <span class="category-chevron mono" aria-hidden="true">${renderIcon("chevron-down", { size: 16, className: "category-chevron-icon" })}</span>
              </div>
            </div>
            <div id="${panelId}" class="category-panel" aria-hidden="true">
              ${rows}
            </div>
          </section>
        `;
    })
    .join(""));
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
    return;
  }

  if (event.target.closest(".category-link")) {
    event.stopPropagation();
    return;
  }

  const toggle = event.target.closest("[data-accordion-toggle]");
  if (!toggle) return;

  const panel = document.getElementById(toggle.getAttribute("aria-controls"));
  if (!panel) return;

  const expanded = toggle.getAttribute("aria-expanded") === "true";
  toggle.setAttribute("aria-expanded", String(!expanded));
  toggle.closest(".category-block")?.classList.toggle("is-open", !expanded);
  panel.setAttribute("aria-hidden", String(expanded));
  const chevron = toggle.querySelector(".category-chevron");
  if (chevron) chevron.innerHTML = renderIcon(expanded ? "chevron-down" : "chevron-up", { size: 16, className: "category-chevron-icon" });
});

calendarBoard.addEventListener("keydown", (event) => {
  const toggle = event.target.closest("[data-accordion-toggle]");
  if (!toggle) return;
  if (event.key !== "Enter" && event.key !== " ") return;
  event.preventDefault();
  toggle.click();
});

loadCalendar().then(() => {
  try {
    window.PaddockARAnalytics?.trackPageView?.('view_calendar');
  } catch (e) {}
}).catch(() => {});
