(function () {
  function setHTML(element, html) {
    element.innerHTML = html;
  }

  function setText(element, text) {
    element.textContent = text;
  }

  function renderStateCard(kind, title, description = "", action = "", eyebrow = "Estado") {
    const detail = description ? `<div class="state-description">${description}</div>` : "";
    const actionMarkup = action ? `<div class="state-action">${action}</div>` : "";
    return `
      <section class="state-card state-card--${kind}">
        <div class="state-eyebrow mono">${eyebrow}</div>
        <div class="state-title">${title}</div>
        ${detail}
        ${actionMarkup}
      </section>
    `;
  }

  function renderEmpty(title, description = "") {
    return renderStateCard("empty", title, description, "", "Sin actividad");
  }

  function renderLoading(title = "Sincronizando agenda", description = "Estamos buscando la informacion mas reciente.") {
    return renderStateCard("loading", title, description, "", "Cargando");
  }

  function renderError(
    title,
    {
      description = "Proba nuevamente en unos segundos.",
      retry = false,
      retryLabel = "Reintentar",
    } = {},
  ) {
    const action = retry
      ? `<button class="retry-button mono" type="button" data-retry>${retryLabel}</button>`
      : "";
    return renderStateCard("error", title, description, action, "Sin conexion");
  }

  function skeletonLine(width = "100%", extraClass = "") {
    return `<span class="skeleton skeleton-line ${extraClass}" style="--skeleton-width:${width}"></span>`;
  }

  function skeletonRow(columns = ["72px", "1fr", "110px"]) {
    return `
      <div class="skeleton-row" style="--skeleton-columns:${columns.join(" ")}">
        ${columns.map((_, index) => skeletonLine(index === 1 ? "82%" : "70%")).join("")}
      </div>
    `;
  }

  function renderHomeSkeleton() {
    return `
      <section class="skeleton-stack">
        <div class="skeleton-card skeleton-card-lg">
          <div class="skeleton-card-head">
            ${skeletonLine("120px")}
            ${skeletonLine("82px")}
          </div>
          ${skeletonLine("44%", "skeleton-line-sm")}
          ${skeletonLine("72%", "skeleton-line-xl")}
          ${skeletonLine("180px")}
        </div>
        <div class="skeleton-filter-row">
          ${Array.from({ length: 6 }, (_, index) => skeletonLine(index < 2 ? "74px" : "56px")).join("")}
        </div>
        ${Array.from({ length: 3 }, () => `
          <div class="skeleton-card">
            <div class="skeleton-card-head">
              ${skeletonLine("150px")}
              ${skeletonLine("92px")}
            </div>
            ${skeletonRow()}
            ${skeletonRow()}
            ${skeletonRow()}
          </div>
        `).join("")}
      </section>
    `;
  }

  function renderCalendarSkeleton() {
    return `
      <section class="skeleton-stack">
        ${Array.from({ length: 3 }, () => `
          <div class="skeleton-card">
            <div class="skeleton-card-head">
              ${skeletonLine("170px")}
              ${skeletonLine("86px")}
            </div>
            ${skeletonRow(["120px", "1fr", "140px"])}
            ${skeletonRow(["120px", "1fr", "140px"])}
          </div>
        `).join("")}
      </section>
    `;
  }

  function renderCategorySkeleton() {
    return `
      <section class="skeleton-stack">
        <div class="skeleton-card">
          <div class="skeleton-card-head">
            <div>
              ${skeletonLine("150px")}
              ${skeletonLine("240px")}
            </div>
            ${skeletonLine("78px")}
          </div>
          ${skeletonRow(["130px", "1fr", "150px"])}
          ${skeletonRow(["130px", "1fr", "150px"])}
          ${skeletonRow(["130px", "1fr", "150px"])}
        </div>
      </section>
    `;
  }

  function renderEventSkeleton() {
    return `
      <section class="skeleton-stack">
        <div class="skeleton-card skeleton-card-lg">
          <div class="skeleton-card-head">
            ${skeletonLine("72px")}
            ${skeletonLine("48%")}
          </div>
          <div class="skeleton-info-grid">
            ${Array.from({ length: 4 }, () => skeletonLine("78%")).join("")}
          </div>
        </div>
        <div class="skeleton-card">
          ${skeletonRow(["100px", "1fr", "110px"])}
          ${skeletonRow(["100px", "1fr", "110px"])}
          ${skeletonRow(["100px", "1fr", "110px"])}
          ${skeletonRow(["100px", "1fr", "110px"])}
        </div>
      </section>
    `;
  }

  function renderSkeleton(kind = "default") {
    if (kind === "home") return renderHomeSkeleton();
    if (kind === "calendar") return renderCalendarSkeleton();
    if (kind === "category") return renderCategorySkeleton();
    if (kind === "event") return renderEventSkeleton();
    return `<div class="skeleton-card">${skeletonRow()}${skeletonRow()}</div>`;
  }

  function setActiveButton(group, selector) {
    group.querySelectorAll(".filter-button").forEach((button) => {
      button.classList.toggle("active", button.matches(selector));
    });
  }

  function showMessage(element, text, type = "") {
    element.innerHTML = text ? `<div class="message ${type}">${text}</div>` : "";
  }

  window.PaddockARDom = {
    setHTML,
    setText,
    renderEmpty,
    renderLoading,
    renderError,
    renderSkeleton,
    setActiveButton,
    showMessage,
  };
})();
