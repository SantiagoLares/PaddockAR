const {
  normalizeCategoryParam,
  categoryCode,
  categoryPageSlug,
  eventDisplayName,
  renderCategoryBadge,
  getArgNow,
  repairText,
  eventLocationLabel,
  formatDate,
  formatDateTime,
  createLogger,
} = window.PaddockARCommon;
const { getJson } = window.PaddockARApi;
const { setHTML, setText, renderEmpty, renderError, renderSkeleton } = window.PaddockARDom;

const apiState = document.querySelector("#apiState");
const categoryBoard = document.querySelector("#categoryBoard");
const logger = createLogger("CategoryPage");

function getCategorySlug() {
  const params = new URLSearchParams(window.location.search);
  return normalizeCategoryParam(params.get("cat") || params.get("slug") || "");
}

function groupEventsByCategory(categories, events) {
  const counts = new Map();
  events.forEach((event) => {
    const slug = normalizeCategoryParam(event.category?.slug || event.category?.short_name || event.category?.name || "");
    counts.set(slug, (counts.get(slug) || 0) + 1);
  });

  return categories.map((category) => {
    const slug = categoryPageSlug(category);
    return {
      category,
      slug,
      label: repairText(category.short_name || category.name || category.slug || "Categoría"),
      eventCount: counts.get(slug) || 0,
    };
  });
}

function renderCategoryList(categoryItems) {
  if (!categoryItems.length) {
    return renderEmpty("No encontramos categorías", "Volvé a intentarlo más tarde.");
  }

  return `
    <section class="category-overview">
      <h2 class="category-overview-title">Elige tu categoría</h2>
      <p class="category-overview-copy">Seleccioná una serie para ver sus fechas y próximos eventos.</p>
    </section>
    <section class="category-list">
      <div class="category-list-grid">
        ${categoryItems
          .map(
            (item) => `
              <a class="category-item" href="category.html?cat=${encodeURIComponent(item.slug)}">
                <div class="category-item-head">
                  <div>
                    ${renderCategoryBadge(item.category, { tag: "span", size: "compact" })}
                    <div class="category-item-title">${item.label}</div>
                  </div>
                  <span class="category-item-count">${item.eventCount} evento${item.eventCount === 1 ? "" : "s"}</span>
                </div>
                <div class="category-item-meta">Ver calendario de la categoría</div>
              </a>
            `,
          )
          .join("")}
      </div>
    </section>
  `;
}

function renderCategoryPage(category, categoryEvents, categoryItems) {
  const title = repairText(category.name || category.short_name || category.slug || "Categoría");
  document.title = `${title} | PaddockAR`;
  const eventCount = categoryEvents.length;
  const otherCategories = categoryItems.filter((item) => item.slug !== normalizeCategoryParam(category.slug));

  return `
    <section class="category-card">
      <div class="category-card-header">
        <div>
          ${renderCategoryBadge(category, { tag: "span", size: "compact" })}
          <h2 class="category-card-title">${title}</h2>
        </div>
        <div class="category-card-copy">${eventCount} evento${eventCount === 1 ? "" : "s"}</div>
      </div>
      <div class="category-feature">
        <p class="category-feature-title">Calendario de la categoría</p>
        <p class="category-feature-status">Revisa cada evento en la lista y accede a la ficha de evento para ver horario, circuito y estado.</p>
      </div>
      <div class="category-event-grid">
        ${
          eventCount
            ? categoryEvents
                .sort((a, b) => String(a.start_date).localeCompare(String(b.start_date)))
                .map(
                  (event) => `
                    <a class="category-event" href="event.html?id=${encodeURIComponent(event.id)}">
                      <div class="category-event-heading">
                        <span class="category-event-name">${eventDisplayName(event)}</span>
                        <span class="category-event-count">${formatDate(event.start_date)}${event.end_date ? ` – ${formatDate(event.end_date)}` : ""}</span>
                      </div>
                      <div class="category-event-meta">${repairText(eventLocationLabel(event))}</div>
                      <div class="category-event-location">${String(event.status || "PROXIMO").toUpperCase()}</div>
                    </a>
                  `,
                )
                .join("")
            : `<div class="category-empty">No hay eventos registrados para esta categoría por ahora.</div>`
        }
      </div>
    </section>
    <section class="category-list">
      <h3 class="category-card-title">Otras categorías</h3>
      <div class="category-list-grid">
        ${otherCategories
          .map(
            (item) => `
              <a class="category-item" href="category.html?cat=${encodeURIComponent(item.slug)}">
                <div class="category-item-head">
                  <div>
                    ${renderCategoryBadge(item.category, { tag: "span", size: "compact" })}
                    <div class="category-item-title">${item.label}</div>
                  </div>
                  <span class="category-item-count">${item.eventCount} evento${item.eventCount === 1 ? "" : "s"}</span>
                </div>
              </a>
            `,
          )
          .join("")}
      </div>
    </section>
  `;
}

function renderLoadError() {
  setHTML(categoryBoard, renderError("No pudimos cargar las categorías", { retry: true }));
  setText(apiState, "Error de API");
}

async function loadCategoryPage() {
  const slug = getCategorySlug();
  setHTML(categoryBoard, renderSkeleton("category"));
  setText(apiState, "Cargando");
  logger.info("Loading category page", slug);

  try {
    const [categories, events] = await Promise.all([getJson("/api/categories"), getJson("/api/events")]);
    const categoryItems = groupEventsByCategory(categories, events);

    if (!slug) {
      setHTML(categoryBoard, renderCategoryList(categoryItems));
      setText(apiState, `${events.length} eventos totales`);
      return;
    }

    const selectedCategory = categories.find((category) => categoryPageSlug(category) === slug);
    const categoryEvents = events.filter((event) => normalizeCategoryParam(event.category?.slug || event.category?.short_name || event.category?.name) === slug);

    if (!selectedCategory) {
      setHTML(categoryBoard, renderEmpty("Categoría no encontrada", "El enlace no es válido o la categoría no está disponible."));
      setText(apiState, "Categoría inválida");
      return;
    }

    setHTML(categoryBoard, renderCategoryPage(selectedCategory, categoryEvents, categoryItems));
    setText(apiState, `${categoryEvents.length} eventos en categoría`);
  } catch (error) {
    logger.error("Category fetch failed", error);
    renderLoadError();
  }
}

categoryBoard.addEventListener("click", (event) => {
  if (event.target.closest("[data-retry]")) {
    loadCategoryPage();
  }
});

loadCategoryPage();
