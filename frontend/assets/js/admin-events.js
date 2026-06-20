(function () {
  const { getJson } = window.PaddockARApi;
  const common = window.PaddockARCommon || {};

  const stateText = document.querySelector("#adminEventsState");
  const tableContainer = document.querySelector("#adminEventsTable");
  const searchInput = document.querySelector("#adminEventSearch");
  const categoryFilter = document.querySelector("#adminCategoryFilter");
  const statusFilter = document.querySelector("#adminStatusFilter");

  const state = {
    events: [],
    filtered: [],
  };

  function text(value, fallback = "") {
    return common.repairText ? common.repairText(value || fallback) : value || fallback;
  }

  function setState(message) {
    if (stateText) stateText.textContent = message;
  }

  function eventName(event) {
    if (common.eventDisplayName) return common.eventDisplayName(event);
    return text(event.name || event.title || `Evento #${event.id}`);
  }

  function categoryCode(event) {
    const category = event.category || {};
    return text(category.short_name || category.slug || category.name || "CAT").toUpperCase();
  }

  function categoryName(event) {
    const category = event.category || {};
    return text(category.name || category.short_name || category.slug || "Sin categoría");
  }

  function circuitName(event) {
    const circuit = event.circuit || {};
    return text(circuit.name || event.circuit_name || "Circuito no cargado");
  }

  function locationText(event) {
    const circuit = event.circuit || {};
    const city = circuit.city || event.city;
    const country = circuit.country || event.country;

    return [city, country].filter(Boolean).map((item) => text(item)).join(", ");
  }

  function eventDate(event) {
    const start = event.start_date || event.starts_at;
    const end = event.end_date;

    if (!start) return "Sin fecha";

    try {
      if (common.formatDate) {
        const first = common.formatDate(start, { weekday: false, withYear: true });
        const second = end && end !== start ? common.formatDate(end, { weekday: false, withYear: true }) : "";
        return second ? `${first} – ${second}` : first;
      }

      return new Date(start).toLocaleDateString("es-AR");
    } catch {
      return start;
    }
  }

  function statusLabel(status) {
    const value = String(status || "scheduled").toLowerCase();

    const labels = {
      scheduled: "Próximo",
      live: "En vivo",
      finished: "Finalizado",
      cancelled: "Cancelado",
      postponed: "Postergado",
      tbc: "A confirmar",
    };

    return labels[value] || value;
  }

  function statusClass(status) {
    const value = String(status || "scheduled").toLowerCase();

    if (value === "finished") return "state-ok";
    if (value === "live") return "state-live";
    if (value === "cancelled" || value === "postponed") return "state-danger";
    return "state-draft";
  }

  function normalize(value) {
    return String(value || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
  }

  function uniqueCategories(events) {
    const map = new Map();

    events.forEach((event) => {
      const category = event.category || {};
      const slug = category.slug || category.short_name || category.name;

      if (!slug) return;

      map.set(slug, {
        slug,
        label: category.name || category.short_name || slug,
      });
    });

    return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label));
  }

  function renderCategoryOptions() {
    const categories = uniqueCategories(state.events);

    categoryFilter.innerHTML = `
      <option value="all">Todas las categorías</option>
      ${categories
        .map((category) => `<option value="${category.slug}">${text(category.label)}</option>`)
        .join("")}
    `;
  }

  function applyFilters() {
    const query = normalize(searchInput.value);
    const categoryValue = categoryFilter.value;
    const statusValue = statusFilter.value;

    state.filtered = state.events.filter((event) => {
      const category = event.category || {};
      const haystack = normalize([
        eventName(event),
        categoryName(event),
        category.short_name,
        category.slug,
        circuitName(event),
        locationText(event),
      ].join(" "));

      const matchesSearch = !query || haystack.includes(query);

      const matchesCategory =
        categoryValue === "all" ||
        category.slug === categoryValue ||
        category.short_name === categoryValue ||
        category.name === categoryValue;

      const matchesStatus =
        statusValue === "all" ||
        String(event.status || "scheduled").toLowerCase() === statusValue;

      return matchesSearch && matchesCategory && matchesStatus;
    });

    renderTable();
  }

  function renderTable() {
    if (!state.filtered.length) {
      tableContainer.innerHTML = `
        <div class="admin-v2-empty">
          No hay eventos que coincidan con los filtros.
        </div>
      `;
      return;
    }

    tableContainer.innerHTML = `
      <table class="admin-v2-table">
        <thead>
          <tr>
            <th>Categoría</th>
            <th>Evento</th>
            <th>Fecha</th>
            <th>Estado</th>
            <th>Acciones</th>
          </tr>
        </thead>

        <tbody>
          ${state.filtered.map(renderRow).join("")}
        </tbody>
      </table>
    `;
  }

  function renderRow(event) {
    const status = event.status || "scheduled";

    return `
      <tr>
        <td>
          <span class="admin-v2-badge badge-${normalize(categoryCode(event))}">
            ${categoryCode(event)}
          </span>
        </td>

        <td>
          <strong>${eventName(event)}</strong>
          <small>${circuitName(event)}${locationText(event) ? ` · ${locationText(event)}` : ""}</small>
        </td>

        <td>${eventDate(event)}</td>

        <td>
          <span class="admin-v2-state ${statusClass(status)}">
            ${statusLabel(status)}
          </span>
        </td>

        <td>
          <button type="button" data-action="view" data-id="${event.id}">Ver</button>
          <button type="button" data-action="edit" data-id="${event.id}">Editar</button>
        </td>
      </tr>
    `;
  }

  function handleTableClick(event) {
    const button = event.target.closest("button[data-action]");
    if (!button) return;

    const id = button.dataset.id;
    const action = button.dataset.action;

    if (action === "view") {
      window.location.href = `../event.html?id=${encodeURIComponent(id)}`;
      return;
    }

    if (action === "edit") {
      window.location.href = `index.html#events`;
    }
  }

  async function loadEvents() {
    try {
      setState("Cargando eventos desde la API...");
      tableContainer.innerHTML = `<div class="admin-v2-empty">Cargando eventos...</div>`;

      const events = await getJson("/api/events");

      state.events = Array.isArray(events)
        ? events.slice().sort((a, b) => String(a.start_date || "").localeCompare(String(b.start_date || "")))
        : [];

      state.filtered = state.events;

      renderCategoryOptions();
      renderTable();

      setState(`${state.events.length} eventos cargados`);
    } catch (error) {
      console.error("[PaddockAR Admin Events]", error);

      tableContainer.innerHTML = `
        <div class="admin-v2-empty">
          No se pudieron cargar los eventos. Revisá la API o la sesión admin.
        </div>
      `;

      setState("Error cargando eventos");
    }
  }

  searchInput?.addEventListener("input", applyFilters);
  categoryFilter?.addEventListener("change", applyFilters);
  statusFilter?.addEventListener("change", applyFilters);
  tableContainer?.addEventListener("click", handleTableClick);

  loadEvents();
})();