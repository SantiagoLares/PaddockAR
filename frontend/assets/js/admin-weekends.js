(function () {
  const { renderCategoryBadge, createLogger } = window.PaddockARCommon;
  const { request, sendJson } = window.PaddockARApi;
  const { setHTML, setText, renderEmpty, renderError, showMessage } = window.PaddockARDom;

  const logger = createLogger("PaddockAR Admin Unified");
  const TOKEN_KEY = "paddockar_admin_token";
  const CATEGORY_ALIASES = {
    "formula-1": "f1",
    "formula-2": "f2",
    motogp: "motogp",
    wec: "wec",
    "turismo-carretera": "tc",
    "turismo-nacional-clase-3": "tn",
    "turismo-nacional-clase-2": "tn",
  };

  const SESSION_TEMPLATES = {
    f1: {
      normal: [
        { name: "FP1", session_type: "practice", day_offset: 0, time_arg: "10:30", duration_minutes: 60 },
        { name: "FP2", session_type: "practice", day_offset: 0, time_arg: "14:00", duration_minutes: 60 },
        { name: "FP3", session_type: "practice", day_offset: 1, time_arg: "11:30", duration_minutes: 60 },
        { name: "Clasificación", session_type: "qualy", day_offset: 1, time_arg: "15:00", duration_minutes: 60 },
        { name: "Carrera", session_type: "race", day_offset: 2, time_arg: "14:00", duration_minutes: 120, is_feature: true },
      ],
      sprint: [
        { name: "FP1", session_type: "practice", day_offset: 0, time_arg: "10:30", duration_minutes: 60 },
        { name: "Sprint Qualifying", session_type: "sprint_qualy", day_offset: 0, time_arg: "14:30", duration_minutes: 60 },
        { name: "Sprint", session_type: "sprint", day_offset: 1, time_arg: "11:30", duration_minutes: 60 },
        { name: "Clasificación", session_type: "qualy", day_offset: 1, time_arg: "15:00", duration_minutes: 60 },
        { name: "Carrera", session_type: "race", day_offset: 2, time_arg: "14:00", duration_minutes: 120, is_feature: true },
      ],
    },
    f2: {
      normal: [
        { name: "Práctica", session_type: "practice", day_offset: 0, time_arg: "09:30", duration_minutes: 45 },
        { name: "Clasificación", session_type: "qualy", day_offset: 0, time_arg: "13:00", duration_minutes: 30 },
        { name: "Sprint Race", session_type: "sprint", day_offset: 1, time_arg: "10:15", duration_minutes: 60 },
        { name: "Feature Race", session_type: "race", day_offset: 2, time_arg: "09:00", duration_minutes: 75, is_feature: true },
      ],
    },
    motogp: {
      normal: [
        { name: "FP1", session_type: "practice", day_offset: 0, time_arg: "06:45", duration_minutes: 45 },
        { name: "Practice", session_type: "practice", day_offset: 0, time_arg: "10:00", duration_minutes: 60 },
        { name: "FP2", session_type: "practice", day_offset: 1, time_arg: "06:10", duration_minutes: 30 },
        { name: "Qualy 1", session_type: "qualy", day_offset: 1, time_arg: "06:50", duration_minutes: 15 },
        { name: "Qualy 2", session_type: "qualy", day_offset: 1, time_arg: "07:15", duration_minutes: 15 },
        { name: "Sprint", session_type: "sprint", day_offset: 1, time_arg: "10:00", duration_minutes: 45 },
        { name: "Carrera", session_type: "race", day_offset: 2, time_arg: "09:00", duration_minutes: 60, is_feature: true },
      ],
    },
    wec: {
      normal: [
        { name: "FP1", session_type: "practice", day_offset: 0, time_arg: "08:00", duration_minutes: 90 },
        { name: "FP2", session_type: "practice", day_offset: 0, time_arg: "12:00", duration_minutes: 90 },
        { name: "FP3", session_type: "practice", day_offset: 1, time_arg: "07:00", duration_minutes: 60 },
        { name: "Clasificación", session_type: "qualy", day_offset: 1, time_arg: "11:00", duration_minutes: 45 },
        { name: "Carrera", session_type: "race", day_offset: 2, time_arg: "08:00", duration_minutes: 360, is_feature: true },
      ],
    },
    tc: {
      normal: [
        { name: "Entrenamiento", session_type: "practice", day_offset: 0, time_arg: "13:30", duration_minutes: 40 },
        { name: "Clasificación", session_type: "qualy", day_offset: 1, time_arg: "11:00", duration_minutes: 20 },
        { name: "Serie 1", session_type: "heat", day_offset: 1, time_arg: "15:00", duration_minutes: 20 },
        { name: "Serie 2", session_type: "heat", day_offset: 1, time_arg: "15:35", duration_minutes: 20 },
        { name: "Serie 3", session_type: "heat", day_offset: 1, time_arg: "16:10", duration_minutes: 20 },
        { name: "Final", session_type: "race", day_offset: 2, time_arg: "13:30", duration_minutes: 50, is_feature: true },
      ],
    },
    tn: {
      normal: [
        { name: "Entrenamiento", session_type: "practice", day_offset: 0, time_arg: "12:00", duration_minutes: 40 },
        { name: "Clasificación", session_type: "qualy", day_offset: 1, time_arg: "10:30", duration_minutes: 25 },
        { name: "Serie", session_type: "heat", day_offset: 1, time_arg: "15:00", duration_minutes: 20 },
        { name: "Final", session_type: "race", day_offset: 2, time_arg: "12:30", duration_minutes: 45, is_feature: true },
      ],
    },
  };

  const loginPanel = document.querySelector("#loginPanel");
  const adminPanel = document.querySelector("#adminPanel");
  const usernameInput = document.querySelector("#username");
  const passwordInput = document.querySelector("#password");
  const loginButton = document.querySelector("#loginButton");
  const logoutButton = document.querySelector("#logoutButton");
  const state = document.querySelector("#state");
  const messageBox = document.querySelector("#message");
  const navButtons = Array.from(document.querySelectorAll(".admin-nav-button[data-view-target]"));
  const views = Array.from(document.querySelectorAll(".admin-view"));

  const weekendCategory = document.querySelector("#weekendCategory");
  const weekendFormat = document.querySelector("#weekendFormat");
  const existingCircuit = document.querySelector("#existingCircuit");
  const circuitName = document.querySelector("#circuitName");
  const circuitCity = document.querySelector("#circuitCity");
  const circuitCountry = document.querySelector("#circuitCountry");
  const circuitTimezone = document.querySelector("#circuitTimezone");
  const eventName = document.querySelector("#eventName");
  const eventSlug = document.querySelector("#eventSlug");
  const eventRound = document.querySelector("#eventRound");
  const eventStartDate = document.querySelector("#eventStartDate");
  const eventEndDate = document.querySelector("#eventEndDate");
  const eventStatus = document.querySelector("#eventStatus");
  const eventSourceUrl = document.querySelector("#eventSourceUrl");
  const eventDataQuality = document.querySelector("#eventDataQuality");
  const eventSourceNote = document.querySelector("#eventSourceNote");
  const qualityWarning = document.querySelector("#qualityWarning");
  const sessionEditor = document.querySelector("#sessionEditor");
  const generateTemplateButton = document.querySelector("#generateTemplateButton");
  const addSessionButton = document.querySelector("#addSessionButton");
  const saveWeekendButton = document.querySelector("#saveWeekendButton");

  const eventsSummary = document.querySelector("#eventsSummary");
  const eventsList = document.querySelector("#eventsList");
  const refreshEventsButton = document.querySelector("#refreshEventsButton");
  const sessionsList = document.querySelector("#sessionsList");
  const sessionCategoryFilter = document.querySelector("#sessionCategoryFilter");
  const sessionVisibilityFilter = document.querySelector("#sessionVisibilityFilter");
  const refreshSessionsButton = document.querySelector("#refreshSessionsButton");
  const categoriesList = document.querySelector("#categoriesList");
  const refreshCategoriesButton = document.querySelector("#refreshCategoriesButton");
  const auditSummary = document.querySelector("#auditSummary");
  const auditButton = document.querySelector("#auditButton");
  const cleanupButton = document.querySelector("#cleanupButton");

  const stateStore = {
    categories: [],
    circuits: [],
    events: [],
    sessions: [],
    weekendSessions: [],
    currentView: "create",
    autoSlug: true,
    audit: null,
  };

  function getToken() {
    return localStorage.getItem(TOKEN_KEY);
  }

  function setToken(token) {
    localStorage.setItem(TOKEN_KEY, token);
  }

  function clearToken() {
    localStorage.removeItem(TOKEN_KEY);
  }

  function authHeaders() {
    return { Authorization: `Bearer ${getToken()}` };
  }

  function showLogin() {
    loginPanel.hidden = false;
    adminPanel.hidden = true;
    logoutButton.hidden = true;
    setText(state, "Login requerido");
  }

  function showAdmin() {
    loginPanel.hidden = true;
    adminPanel.hidden = false;
    logoutButton.hidden = false;
  }

  function setView(viewKey) {
    stateStore.currentView = viewKey;
    navButtons.forEach((button) => {
      button.classList.toggle("active", button.dataset.viewTarget === viewKey);
    });
    views.forEach((view) => {
      view.classList.toggle("active", view.dataset.view === viewKey);
    });
  }

  async function adminJson(path, options = {}) {
    const response = await request(path, {
      ...options,
      headers: {
        ...(options.headers || {}),
        ...authHeaders(),
      },
    });

    if (response.status === 401) {
      clearToken();
      showLogin();
      throw new Error("UNAUTHORIZED");
    }

    if (!response.ok) {
      throw new Error(`API ${response.status}`);
    }

    return response.json();
  }

  function normalizeCategoryKey(value) {
    const raw = String(value || "").trim().toLowerCase();
    return CATEGORY_ALIASES[raw] || raw;
  }

  function getSelectedCategory() {
    return stateStore.categories.find((category) => String(category.id) === weekendCategory.value) || null;
  }

  function slugify(value) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  function autoGenerateSlug() {
    if (!stateStore.autoSlug) return;
    const category = getSelectedCategory();
    const baseCategory = normalizeCategoryKey(category?.slug || category?.short_name || "evento");
    const year = (eventStartDate.value || "").slice(0, 4) || String(new Date().getFullYear());
    const eventBase = slugify(eventName.value || "evento");
    eventSlug.value = [baseCategory, eventBase, year].filter(Boolean).join("-");
  }

  function defaultEndDate(startDate) {
    if (!startDate) return "";
    const date = new Date(`${startDate}T12:00:00`);
    date.setDate(date.getDate() + 2);
    return date.toISOString().slice(0, 10);
  }

  function templateFor(categoryKey, formatKey) {
    const bundle = SESSION_TEMPLATES[categoryKey] || {};
    return bundle[formatKey] || bundle.normal || [];
  }

  function dateFromOffset(startDateValue, offset) {
    if (!startDateValue) return "";
    const date = new Date(`${startDateValue}T12:00:00`);
    date.setDate(date.getDate() + offset);
    return date.toISOString().slice(0, 10);
  }

  function createSessionFromTemplate(template, index) {
    return {
      id: `draft-${Date.now()}-${index}`,
      name: template.name,
      session_type: template.session_type,
      date: dateFromOffset(eventStartDate.value, template.day_offset || 0),
      time_arg: template.time_arg,
      duration_minutes: template.duration_minutes,
      status: "scheduled",
      source_url: eventSourceUrl.value.trim(),
      data_quality: eventDataQuality.value.trim(),
      source_note: "",
      is_feature: Boolean(template.is_feature),
      order_index: index + 1,
    };
  }

  function generateSessions(force = true) {
    const category = getSelectedCategory();
    const categoryKey = normalizeCategoryKey(category?.slug || category?.short_name);
    if (!categoryKey || weekendFormat.value === "custom") {
      if (force && !stateStore.weekendSessions.length) {
        stateStore.weekendSessions = [createEmptySession(1)];
      }
      renderWeekendSessions();
      return;
    }

    const template = templateFor(categoryKey, weekendFormat.value);
    stateStore.weekendSessions = template.map((item, index) => createSessionFromTemplate(item, index));
    renderWeekendSessions();
  }

  function createEmptySession(orderIndex) {
    return {
      id: `draft-${Date.now()}-${orderIndex}`,
      name: "",
      session_type: "practice",
      date: eventStartDate.value || "",
      time_arg: "12:00",
      duration_minutes: 60,
      status: "scheduled",
      source_url: eventSourceUrl.value.trim(),
      data_quality: eventDataQuality.value.trim(),
      source_note: "",
      is_feature: false,
      order_index: orderIndex,
    };
  }

  function fillCategoryOptions() {
    weekendCategory.innerHTML = stateStore.categories
      .map((category) => `<option value="${category.id}">${category.short_name} | ${category.name}</option>`)
      .join("");

    sessionCategoryFilter.innerHTML = [
      '<option value="all">Todas</option>',
      ...stateStore.categories.map((category) => `<option value="${category.id}">${category.short_name}</option>`),
    ].join("");
  }

  function fillCircuitOptions() {
    existingCircuit.innerHTML = [
      '<option value="">Crear o editar manual</option>',
      ...stateStore.circuits.map((circuit) => `<option value="${circuit.id}">${circuit.name} | ${circuit.city || "Sin ciudad"} | ${circuit.country}</option>`),
    ].join("");
  }

  function applyCircuitSelection() {
    const circuit = stateStore.circuits.find((item) => String(item.id) === existingCircuit.value);
    if (!circuit) return;
    circuitName.value = circuit.name || "";
    circuitCity.value = circuit.city || "";
    circuitCountry.value = circuit.country || "";
    circuitTimezone.value = circuit.timezone || "America/Argentina/Buenos_Aires";
  }

  function renderWeekendSessions() {
    if (!stateStore.weekendSessions.length) {
      setHTML(sessionEditor, renderEmpty("Todavia no hay sesiones", "Genera una plantilla o agrega una sesion manual."));
      return;
    }

    setHTML(
      sessionEditor,
      stateStore.weekendSessions.map((session, index) => `
        <article class="session-editor__row" data-session-row="${index}">
          <label class="field">
            <span class="mono">Nombre</span>
            <input data-field="name" value="${session.name || ""}" />
          </label>
          <label class="field">
            <span class="mono">Tipo</span>
            <input data-field="session_type" value="${session.session_type || ""}" />
          </label>
          <label class="field">
            <span class="mono">Fecha</span>
            <input data-field="date" type="date" value="${session.date || ""}" />
          </label>
          <label class="field">
            <span class="mono">Hora ARG</span>
            <input data-field="time_arg" type="time" value="${session.time_arg || ""}" />
          </label>
          <label class="field">
            <span class="mono">Duracion</span>
            <input data-field="duration_minutes" type="number" min="1" value="${session.duration_minutes || 60}" />
          </label>
          <label class="field">
            <span class="mono">Estado</span>
            <select data-field="status">
              <option value="scheduled" ${session.status === "scheduled" ? "selected" : ""}>scheduled</option>
              <option value="live" ${session.status === "live" ? "selected" : ""}>live</option>
              <option value="finished" ${session.status === "finished" ? "selected" : ""}>finished</option>
              <option value="cancelled" ${session.status === "cancelled" ? "selected" : ""}>cancelled</option>
            </select>
          </label>
          <div class="session-editor__actions">
            <button class="session-editor__remove mono" type="button" data-remove-session="${index}">Eliminar</button>
          </div>
          <label class="field">
            <span class="mono">source_url</span>
            <input data-field="source_url" value="${session.source_url || ""}" placeholder="https://..." />
          </label>
          <label class="field">
            <span class="mono">data_quality</span>
            <input data-field="data_quality" value="${session.data_quality || ""}" />
          </label>
          <label class="field field--full">
            <span class="mono">source_note</span>
            <input data-field="source_note" value="${session.source_note || ""}" />
          </label>
          <label class="session-editor__feature">
            <input data-field="is_feature" type="checkbox" ${session.is_feature ? "checked" : ""} />
            <span class="session-editor__meta mono">Sesion destacada</span>
          </label>
        </article>
      `).join(""),
    );
  }

  function updateQualityWarning() {
    const quality = String(eventDataQuality.value || "").trim().toLowerCase();
    const trusted = quality.includes("official") || quality.includes("verified");
    qualityWarning.hidden = trusted;
    if (!trusted) {
      qualityWarning.textContent = "Este evento no se mostrara publicamente hasta marcarlo como official o verified y cargar una source_url valida.";
    }
  }

  function collectWeekendPayload() {
    const errors = [];
    const category = getSelectedCategory();

    if (!category) errors.push("Categoria requerida.");
    if (!eventName.value.trim()) errors.push("Evento requerido.");
    if (!circuitName.value.trim()) errors.push("Circuito requerido.");
    if (!circuitCountry.value.trim()) errors.push("Pais requerido.");
    if (!eventStartDate.value) errors.push("Fecha inicio requerida.");
    if (!eventEndDate.value) errors.push("Fecha fin requerida.");

    const sessions = stateStore.weekendSessions.map((session, index) => {
      const name = String(session.name || "").trim();
      const sessionType = String(session.session_type || "").trim();
      const sessionDate = String(session.date || "").trim();
      const timeArg = String(session.time_arg || "").trim();
      const duration = Number(session.duration_minutes || 0);

      if (!name) errors.push(`Sesion ${index + 1}: falta nombre.`);
      if (!sessionType) errors.push(`Sesion ${index + 1}: falta tipo.`);
      if (!sessionDate) errors.push(`Sesion ${index + 1}: falta fecha.`);
      if (!timeArg) errors.push(`Sesion ${index + 1}: falta hora.`);
      if (!duration) errors.push(`Sesion ${index + 1}: falta duracion.`);

      return {
        name,
        session_type: sessionType,
        date: sessionDate,
        time_arg: timeArg,
        duration_minutes: duration,
        status: session.status,
        source_url: String(session.source_url || "").trim() || null,
        data_quality: String(session.data_quality || "").trim() || null,
        source_note: String(session.source_note || "").trim() || null,
        is_feature: Boolean(session.is_feature),
        order_index: index + 1,
      };
    });

    if (!sessions.length) errors.push("Debes cargar al menos una sesion.");

    return {
      errors,
      payload: {
        category_id: category?.id,
        category_slug: category?.slug,
        circuit: {
          name: circuitName.value.trim(),
          city: circuitCity.value.trim() || null,
          country: circuitCountry.value.trim(),
          timezone: circuitTimezone.value.trim() || "America/Argentina/Buenos_Aires",
        },
        event: {
          name: eventName.value.trim(),
          slug: eventSlug.value.trim() || null,
          start_date: eventStartDate.value,
          end_date: eventEndDate.value,
          round: eventRound.value ? Number(eventRound.value) : null,
          source_url: eventSourceUrl.value.trim() || null,
          data_quality: eventDataQuality.value.trim() || null,
          source_note: eventSourceNote.value.trim() || null,
          status: eventStatus.value,
        },
        sessions,
      },
    };
  }

  function categoryNameById(categoryId) {
    const category = stateStore.categories.find((item) => item.id === Number(categoryId));
    return category?.short_name || "CAT";
  }

  function renderEventsView() {
    const publicCount = stateStore.events.filter((event) => event.is_public && event.is_active).length;
    const hiddenCount = stateStore.events.length - publicCount;
    setHTML(
      eventsSummary,
      [
        `<span class="admin-pill">${stateStore.events.length} eventos</span>`,
        `<span class="admin-pill">${publicCount} publicos</span>`,
        `<span class="admin-pill">${hiddenCount} ocultos</span>`,
      ].join(""),
    );

    if (!stateStore.events.length) {
      setHTML(eventsList, renderEmpty("No hay eventos cargados.", "Crea un fin de semana para empezar."));
      return;
    }

    setHTML(
      eventsList,
      `
        <table class="admin-table">
          <thead>
            <tr>
              <th>Evento</th>
              <th>Categoria</th>
              <th>Fechas</th>
              <th>Fuente</th>
              <th>Quality</th>
              <th>Visibilidad</th>
            </tr>
          </thead>
          <tbody>
            ${stateStore.events.map((event) => `
              <tr>
                <td>
                  <div class="admin-table__title">${event.name}</div>
                  <div class="admin-muted">${event.slug}</div>
                </td>
                <td>${renderCategoryBadge(event.category, { tag: "span", size: "compact", active: true })}</td>
                <td>${event.start_date} → ${event.end_date}</td>
                <td>${event.source_url ? `<a href="${event.source_url}" target="_blank" rel="noreferrer">ver fuente</a>` : "<span class=\"admin-muted\">sin fuente</span>"}</td>
                <td>${event.data_quality || "<span class=\"admin-muted\">sin quality</span>"}</td>
                <td>${event.is_public && event.is_active ? "publico" : "oculto"}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      `,
    );
  }

  function renderSessionsView() {
    let sessions = [...stateStore.sessions];
    if (sessionCategoryFilter.value !== "all") {
      sessions = sessions.filter((session) => String(session.event.category_id) === sessionCategoryFilter.value);
    }
    if (sessionVisibilityFilter.value === "public") {
      sessions = sessions.filter((session) => session.is_public && session.is_active);
    }
    if (sessionVisibilityFilter.value === "hidden") {
      sessions = sessions.filter((session) => !session.is_public || !session.is_active);
    }

    if (!sessions.length) {
      setHTML(sessionsList, renderEmpty("No hay sesiones para esos filtros."));
      return;
    }

    setHTML(
      sessionsList,
      `
        <table class="admin-table">
          <thead>
            <tr>
              <th>Sesion</th>
              <th>Evento</th>
              <th>Inicio UTC</th>
              <th>Estado</th>
              <th>Visibilidad</th>
            </tr>
          </thead>
          <tbody>
            ${sessions.map((session) => `
              <tr>
                <td>
                  <div class="admin-table__title">${session.name}</div>
                  <div class="admin-muted">${session.session_type}</div>
                </td>
                <td>${session.event.name}<br /><span class="admin-muted">${categoryNameById(session.event.category_id)}</span></td>
                <td>${session.starts_at}</td>
                <td>${session.status}</td>
                <td>${session.is_public && session.is_active ? "publica" : "oculta"}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      `,
    );
  }

  function renderCategoriesView() {
    if (!stateStore.categories.length) {
      setHTML(categoriesList, renderEmpty("No hay categorias disponibles."));
      return;
    }

    setHTML(
      categoriesList,
      stateStore.categories.map((category) => `
        <article class="admin-category-card" data-category-id="${category.id}">
          <div class="admin-category-card__meta">
            <div class="admin-category-card__title">${category.short_name}</div>
            <div class="admin-category-card__copy">${category.name}<br /><span class="admin-muted">${category.slug}</span></div>
          </div>
          <div class="admin-toggle-group">
            <label class="admin-toggle">
              <input type="checkbox" data-category-field="is_public" ${category.is_public ? "checked" : ""} />
              <span class="admin-toggle__label">Publica</span>
            </label>
            <label class="admin-toggle">
              <input type="checkbox" data-category-field="is_active" ${category.is_active ? "checked" : ""} />
              <span class="admin-toggle__label">Activa</span>
            </label>
            <button class="admin-secondary mono" type="button" data-save-category="${category.id}">Guardar</button>
          </div>
        </article>
      `).join(""),
    );
  }

  function renderAuditView() {
    if (!stateStore.audit) {
      setHTML(auditSummary, renderEmpty("Todavia no corriste la auditoria.", "Usa el boton para revisar calidad, fuentes y visibilidad."));
      return;
    }

    const cards = [
      {
        title: "Eventos oficiales",
        items: stateStore.audit.official_events,
      },
      {
        title: "Eventos sin fuente",
        items: stateStore.audit.events_without_source,
      },
      {
        title: "Sesiones sin horario",
        items: stateStore.audit.sessions_without_schedule,
      },
      {
        title: "Sesiones sin fuente",
        items: stateStore.audit.sessions_without_source,
      },
    ];

    setHTML(
      auditSummary,
      cards.map((card) => `
        <article class="admin-audit-card">
          <div class="admin-audit-card__title">${card.title}</div>
          <div class="admin-audit-card__list">
            ${card.items.length
              ? card.items.slice(0, 8).map((item) => `<div>${item.name}${item.category ? ` <span class="admin-muted">(${item.category})</span>` : ""}</div>`).join("")
              : '<div class="admin-muted">Sin resultados.</div>'}
          </div>
        </article>
      `).join(""),
    );
  }

  async function loadLookups() {
    const [categories, circuits] = await Promise.all([
      adminJson("/api/admin/categories"),
      adminJson("/api/admin/circuits"),
    ]);

    stateStore.categories = categories;
    stateStore.circuits = circuits;
    fillCategoryOptions();
    fillCircuitOptions();

    if (!weekendCategory.value && categories[0]) {
      weekendCategory.value = String(categories[0].id);
    }
  }

  async function loadEvents() {
    stateStore.events = await adminJson("/api/admin/events");
    renderEventsView();
  }

  async function loadSessions() {
    stateStore.sessions = await adminJson("/api/admin/sessions");
    renderSessionsView();
  }

  async function loadCategories() {
    stateStore.categories = await adminJson("/api/admin/categories");
    fillCategoryOptions();
    renderCategoriesView();
  }

  async function loadAdmin() {
    setText(state, "Sincronizando panel");
    try {
      await loadLookups();
      await Promise.all([loadEvents(), loadSessions(), loadCategories()]);
      renderAuditView();
      showAdmin();
      setText(state, "Panel listo");
      if (!stateStore.weekendSessions.length) {
        eventStartDate.value = eventStartDate.value || new Date().toISOString().slice(0, 10);
        eventEndDate.value = eventEndDate.value || defaultEndDate(eventStartDate.value);
        generateSessions(true);
      }
    } catch (error) {
      logger.error("Admin unified load failed", error);
      if (error.message !== "UNAUTHORIZED") {
        showAdmin();
        showMessage(messageBox, "No se pudo cargar el panel admin.", "error");
      }
    }
  }

  async function login() {
    showMessage(messageBox, "");
    setText(state, "Validando credenciales");

    try {
      const response = await sendJson("/api/auth/login", {
        method: "POST",
        body: {
          username: usernameInput.value,
          password: passwordInput.value,
        },
      });

      if (!response.ok) throw new Error(`API ${response.status}`);

      const data = await response.json();
      setToken(data.access_token);
      passwordInput.value = "";
      showMessage(messageBox, "Login correcto.", "ok");
      await loadAdmin();
    } catch (error) {
      logger.error("Admin login failed", error);
      showLogin();
      showMessage(messageBox, "No se pudo iniciar sesion. Revisa usuario, password o conexion con la API.", "error");
    }
  }

  async function saveWeekend() {
    const { errors, payload } = collectWeekendPayload();
    updateQualityWarning();

    if (errors.length) {
      showMessage(messageBox, errors.join("<br />"), "error");
      return;
    }

    try {
      setText(state, "Guardando fin de semana");
      const response = await sendJson("/api/admin/weekends", {
        method: "POST",
        headers: authHeaders(),
        body: payload,
      });

      if (response.status === 401) {
        clearToken();
        showLogin();
        return;
      }

      if (!response.ok) throw new Error(`API ${response.status}`);

      const result = await response.json();
      showMessage(
        messageBox,
        `Fin de semana guardado. Evento ${result.event_created ? "creado" : "actualizado"}; sesiones creadas: ${result.sessions_created}; actualizadas: ${result.sessions_updated}; omitidas: ${result.skipped}.`,
        "ok",
      );
      setText(state, "Fin de semana guardado");
      await Promise.all([loadEvents(), loadSessions(), loadCategories()]);
    } catch (error) {
      logger.error("Save weekend failed", error);
      showMessage(messageBox, "No se pudo guardar el fin de semana.", "error");
      setText(state, "Error al guardar");
    }
  }

  async function runAudit() {
    try {
      setText(state, "Corriendo auditoria");
      stateStore.audit = await adminJson("/api/admin/calendar-audit");
      renderAuditView();
      setText(state, "Auditoria lista");
    } catch (error) {
      logger.error("Audit failed", error);
      showMessage(messageBox, "No se pudo correr la auditoria.", "error");
    }
  }

  async function runCleanup() {
    try {
      setText(state, "Aplicando cleanup");
      const response = await sendJson("/api/admin/calendar-cleanup", {
        method: "POST",
        headers: authHeaders(),
        body: {},
      });

      if (response.status === 401) {
        clearToken();
        showLogin();
        return;
      }

      if (!response.ok) throw new Error(`API ${response.status}`);

      const result = await response.json();
      showMessage(
        messageBox,
        `Cleanup aplicado. Categorias ocultas: ${result.categories_hidden}; eventos ocultos: ${result.events_hidden}; sesiones ocultas: ${result.sessions_hidden}.`,
        "ok",
      );
      await Promise.all([loadEvents(), loadSessions(), loadCategories(), runAudit()]);
    } catch (error) {
      logger.error("Cleanup failed", error);
      showMessage(messageBox, "No se pudo aplicar el cleanup.", "error");
    }
  }

  async function saveCategoryVisibility(categoryId) {
    const card = categoriesList.querySelector(`[data-category-id="${categoryId}"]`);
    if (!card) return;

    const payload = {
      is_public: card.querySelector('[data-category-field="is_public"]').checked,
      is_active: card.querySelector('[data-category-field="is_active"]').checked,
    };

    try {
      const response = await sendJson(`/api/admin/categories/${categoryId}`, {
        method: "PUT",
        headers: authHeaders(),
        body: payload,
      });

      if (response.status === 401) {
        clearToken();
        showLogin();
        return;
      }

      if (!response.ok) throw new Error(`API ${response.status}`);

      const updated = await response.json();
      stateStore.categories = stateStore.categories.map((category) => (
        category.id === updated.id ? updated : category
      ));
      renderCategoriesView();
      showMessage(messageBox, `Categoria ${updated.short_name} actualizada.`, "ok");
    } catch (error) {
      logger.error("Category visibility save failed", error);
      showMessage(messageBox, "No se pudo actualizar la categoria.", "error");
    }
  }

  function syncSessionField(index, field, value) {
    const nextSessions = [...stateStore.weekendSessions];
    nextSessions[index] = {
      ...nextSessions[index],
      [field]: value,
    };
    stateStore.weekendSessions = nextSessions;
  }

  sessionEditor.addEventListener("input", (event) => {
    const row = event.target.closest("[data-session-row]");
    if (!row) return;
    const index = Number(row.dataset.sessionRow);
    const field = event.target.dataset.field;
    if (!field) return;
    const value = event.target.type === "checkbox"
      ? event.target.checked
      : event.target.type === "number"
        ? Number(event.target.value)
        : event.target.value;
    syncSessionField(index, field, value);
  });

  sessionEditor.addEventListener("click", (event) => {
    const removeButton = event.target.closest("[data-remove-session]");
    if (!removeButton) return;
    const index = Number(removeButton.dataset.removeSession);
    stateStore.weekendSessions = stateStore.weekendSessions.filter((_, sessionIndex) => sessionIndex !== index)
      .map((session, sessionIndex) => ({ ...session, order_index: sessionIndex + 1 }));
    renderWeekendSessions();
  });

  weekendCategory.addEventListener("change", () => {
    autoGenerateSlug();
    if (weekendFormat.value !== "custom") generateSessions();
  });

  weekendFormat.addEventListener("change", () => {
    generateSessions();
  });

  existingCircuit.addEventListener("change", applyCircuitSelection);
  eventName.addEventListener("input", autoGenerateSlug);
  eventStartDate.addEventListener("change", () => {
    if (!eventEndDate.value) eventEndDate.value = defaultEndDate(eventStartDate.value);
    autoGenerateSlug();
    if (weekendFormat.value !== "custom") generateSessions();
  });
  eventEndDate.addEventListener("change", autoGenerateSlug);
  eventSlug.addEventListener("input", () => {
    stateStore.autoSlug = !eventSlug.value.trim();
  });
  eventSourceUrl.addEventListener("input", updateQualityWarning);
  eventDataQuality.addEventListener("input", updateQualityWarning);

  generateTemplateButton.addEventListener("click", () => generateSessions(true));
  addSessionButton.addEventListener("click", () => {
    stateStore.weekendSessions = [...stateStore.weekendSessions, createEmptySession(stateStore.weekendSessions.length + 1)];
    renderWeekendSessions();
  });
  saveWeekendButton.addEventListener("click", saveWeekend);

  navButtons.forEach((button) => {
    button.addEventListener("click", () => setView(button.dataset.viewTarget));
  });

  document.querySelector('[data-action="logout"]').addEventListener("click", () => {
    clearToken();
    showLogin();
    showMessage(messageBox, "Sesion cerrada.", "ok");
  });

  refreshEventsButton.addEventListener("click", loadEvents);
  refreshSessionsButton.addEventListener("click", loadSessions);
  refreshCategoriesButton.addEventListener("click", loadCategories);
  sessionCategoryFilter.addEventListener("change", renderSessionsView);
  sessionVisibilityFilter.addEventListener("change", renderSessionsView);
  auditButton.addEventListener("click", runAudit);
  cleanupButton.addEventListener("click", runCleanup);

  categoriesList.addEventListener("click", (event) => {
    const button = event.target.closest("[data-save-category]");
    if (!button) return;
    saveCategoryVisibility(Number(button.dataset.saveCategory));
  });

  loginButton.addEventListener("click", login);
  passwordInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") login();
  });
  logoutButton.addEventListener("click", () => {
    clearToken();
    showLogin();
    showMessage(messageBox, "Sesion cerrada.", "ok");
  });

  if (getToken()) {
    loadAdmin();
  } else {
    showLogin();
  }
})();
