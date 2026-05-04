const { renderCategoryBadge, createLogger } = window.PaddockARCommon;
const { getJson, request, sendJson } = window.PaddockARApi;
const { setHTML, setText, renderEmpty, renderError, showMessage } = window.PaddockARDom;
const logger = createLogger("PaddockAR Admin");
const TOKEN_KEY = "paddockar_admin_token";

const loginPanel = document.querySelector("#loginPanel");
const adminPanel = document.querySelector("#adminPanel");
const usernameInput = document.querySelector("#username");
const passwordInput = document.querySelector("#password");
const loginButton = document.querySelector("#loginButton");
const logoutButton = document.querySelector("#logoutButton");
const eventsContainer = document.querySelector("#events");
const state = document.querySelector("#state");
const messageBox = document.querySelector("#message");
const categoryFilter = document.querySelector("#categoryFilter");
const statusFilter = document.querySelector("#statusFilter");
const createButton = document.querySelector("#createButton");

const newNameInput = document.querySelector("#newName");
const newCategorySelect = document.querySelector("#newCategoryId");
const newCircuitSelect = document.querySelector("#newCircuitId");
const newSeasonYearInput = document.querySelector("#newSeasonYear");
const newRoundNumberInput = document.querySelector("#newRoundNumber");
const newStartDateInput = document.querySelector("#newStartDate");
const newEndDateInput = document.querySelector("#newEndDate");
const newStatusSelect = document.querySelector("#newStatus");

let allEvents = [];
let categories = [];
let circuits = [];

function renderAdminLoadError() {
  setHTML(
    eventsContainer,
    renderError("No se pudo cargar el panel de eventos. Revisa la conexion con la API y volve a intentar.", {
      retry: true,
    }),
  );
  setText(state, "Error de API");
}

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

function circuitLabel(circuitId) {
  const circuit = circuits.find((item) => item.id === Number(circuitId));
  if (!circuit) return "Circuito";
  return circuit.city ? `${circuit.name} - ${circuit.city}, ${circuit.country}` : `${circuit.name} - ${circuit.country}`;
}

function selectOptions(items, selectedValue, labelKey = "name", emptyLabel = "") {
  const emptyOption = emptyLabel ? `<option value="">${emptyLabel}</option>` : "";
  return (
    emptyOption +
    items
      .map((item) => `<option value="${item.id}" ${Number(selectedValue) === item.id ? "selected" : ""}>${item[labelKey]}</option>`)
      .join("")
  );
}

function fillLookups() {
  categoryFilter.innerHTML =
    '<option value="all">Todas las categorias</option>' +
    categories.map((category) => `<option value="${category.id}">${category.short_name}</option>`).join("");

  newCategorySelect.innerHTML = selectOptions(categories, categories[0]?.id, "name");
  newCircuitSelect.innerHTML = selectOptions(circuits, circuits[0]?.id, "name");
}

function filteredEvents() {
  return allEvents.filter((event) => {
    const matchesCategory = categoryFilter.value === "all" || String(event.category_id) === categoryFilter.value;
    const matchesStatus = statusFilter.value === "all" || event.status === statusFilter.value;
    return matchesCategory && matchesStatus;
  });
}

function renderEvents() {
  const events = filteredEvents();
  setText(state, `${events.length}/${allEvents.length} eventos`);

  if (!events.length) {
    setHTML(eventsContainer, renderEmpty("No hay eventos para los filtros seleccionados."));
    return;
  }

  setHTML(
    eventsContainer,
    events
      .map(
        (event) => `
          <article class="event-card" data-event-id="${event.id}">
            <header class="event-head">
              ${renderCategoryBadge(event.category, { extraClass: "admin-cat" })}
              <div class="event-name">${event.name}</div>
              <div class="event-meta mono">${circuitLabel(event.circuit_id)}</div>
              <div class="event-id mono">ID ${event.id}</div>
            </header>
            <div class="edit-grid">
              <div class="field">
                <label class="mono">Nombre</label>
                <input data-field="name" value="${event.name}" />
              </div>
              <div class="field">
                <label class="mono">Categoria</label>
                <select data-field="category_id">${selectOptions(categories, event.category_id, "name")}</select>
              </div>
              <div class="field">
                <label class="mono">Circuito</label>
                <select data-field="circuit_id">${selectOptions(circuits, event.circuit_id, "name")}</select>
              </div>
              <div class="field">
                <label class="mono">Temporada</label>
                <input data-field="season_year" type="number" min="2000" max="2100" value="${event.season_year}" />
              </div>
              <div class="field">
                <label class="mono">Ronda</label>
                <input data-field="round_number" type="number" min="1" value="${event.round_number || ""}" />
              </div>
              <div class="field">
                <label class="mono">Inicio</label>
                <input data-field="start_date" type="date" value="${event.start_date}" />
              </div>
              <div class="field">
                <label class="mono">Fin</label>
                <input data-field="end_date" type="date" value="${event.end_date}" />
              </div>
              <div class="field">
                <label class="mono">Estado</label>
                <select data-field="status">
                  <option value="scheduled" ${event.status === "scheduled" ? "selected" : ""}>scheduled</option>
                  <option value="live" ${event.status === "live" ? "selected" : ""}>live</option>
                  <option value="finished" ${event.status === "finished" ? "selected" : ""}>finished</option>
                  <option value="cancelled" ${event.status === "cancelled" ? "selected" : ""}>cancelled</option>
                </select>
              </div>
              <button class="save-button mono" type="button" data-save>Guardar</button>
            </div>
          </article>
        `,
      )
      .join(""),
  );
}

function normalizePayload(source) {
  const roundNumber = source.round_number === "" ? null : Number(source.round_number);
  return {
    name: source.name.trim(),
    category_id: Number(source.category_id),
    circuit_id: Number(source.circuit_id),
    season_year: Number(source.season_year),
    round_number: roundNumber,
    start_date: source.start_date,
    end_date: source.end_date,
    status: source.status,
  };
}

function createPayloadFromCard(card) {
  const raw = {};
  card.querySelectorAll("[data-field]").forEach((field) => {
    raw[field.dataset.field] = field.value;
  });
  return normalizePayload(raw);
}

function createPayloadFromForm() {
  return normalizePayload({
    name: newNameInput.value,
    category_id: newCategorySelect.value,
    circuit_id: newCircuitSelect.value,
    season_year: newSeasonYearInput.value,
    round_number: newRoundNumberInput.value,
    start_date: newStartDateInput.value,
    end_date: newEndDateInput.value,
    status: newStatusSelect.value,
  });
}

function resetCreateForm() {
  newNameInput.value = "";
  newSeasonYearInput.value = String(new Date().getFullYear());
  newRoundNumberInput.value = "";
  newStartDateInput.value = "";
  newEndDateInput.value = "";
  newStatusSelect.value = "scheduled";
  if (categories[0]) newCategorySelect.value = String(categories[0].id);
  if (circuits[0]) newCircuitSelect.value = String(circuits[0].id);
}

async function loadReferenceData() {
  const [categoriesData, circuitsData] = await Promise.all([
    getJson("/api/categories"),
    getJson("/api/circuits"),
  ]);
  categories = categoriesData;
  circuits = circuitsData;
  fillLookups();
  resetCreateForm();
}

async function loadEvents() {
  setText(state, "Cargando");
  showMessage(messageBox, "");
  logger.info("Loading admin events", "/api/admin/events");

  try {
    const response = await request("/api/admin/events", { headers: authHeaders() });

    if (response.status === 401) {
      logger.info("Admin events rejected with 401");
      clearToken();
      showLogin();
      showMessage(messageBox, "Sesion vencida o invalida.", "error");
      return;
    }

    if (!response.ok) throw new Error(`API ${response.status}`);

    allEvents = await response.json();
    logger.info("Admin events loaded", allEvents.length);
    showAdmin();
    renderEvents();
  } catch (error) {
    logger.error("Admin events failed", error);
    showAdmin();
    renderAdminLoadError();
  }
}

async function loadAdmin() {
  setText(state, "Cargando");
  try {
    await loadReferenceData();
    await loadEvents();
  } catch (error) {
    logger.error("Admin reference data failed", error);
    showAdmin();
    renderAdminLoadError();
  }
}

async function createEvent() {
  const payload = createPayloadFromForm();

  try {
    logger.info("Creating event", payload.name);
    const response = await sendJson("/api/admin/events", {
      method: "POST",
      headers: authHeaders(),
      body: payload,
    });

    if (response.status === 401) {
      clearToken();
      showLogin();
      showMessage(messageBox, "Sesion vencida o invalida.", "error");
      return;
    }

    if (!response.ok) throw new Error(`API ${response.status}`);

    const created = await response.json();
    allEvents = [...allEvents, created].sort((a, b) => new Date(a.start_date) - new Date(b.start_date));
    showMessage(messageBox, `Evento ${created.id} creado correctamente.`, "ok");
    resetCreateForm();
    renderEvents();
  } catch (error) {
    logger.error("Create event failed", error);
    showMessage(messageBox, "No se pudo crear el evento. Revisa los datos y volve a intentar.", "error");
  }
}

async function saveEvent(card) {
  const id = card.dataset.eventId;
  const payload = createPayloadFromCard(card);

  try {
    logger.info("Saving event", id, Object.keys(payload));
    const response = await sendJson(`/api/admin/events/${id}`, {
      method: "PUT",
      headers: authHeaders(),
      body: payload,
    });

    if (response.status === 401) {
      clearToken();
      showLogin();
      showMessage(messageBox, "Sesion vencida o invalida.", "error");
      return;
    }

    if (!response.ok) throw new Error(`API ${response.status}`);

    const updated = await response.json();
    allEvents = allEvents
      .map((event) => (event.id === updated.id ? updated : event))
      .sort((a, b) => new Date(a.start_date) - new Date(b.start_date));
    showMessage(messageBox, `Evento ${id} guardado correctamente.`, "ok");
    renderEvents();
  } catch (error) {
    logger.error("Save event failed", id, error);
    showMessage(messageBox, `No se pudo guardar el evento ${id}.`, "error");
  }
}

async function login() {
  showMessage(messageBox, "");
  setText(state, "Validando");
  logger.info("Admin login attempt", usernameInput.value);

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
    loadAdmin();
  } catch (error) {
    logger.error("Admin login failed", error);
    showLogin();
    showMessage(messageBox, "No se pudo iniciar sesion. Revisa los datos o la conexion con la API.", "error");
  }
}

eventsContainer.addEventListener("click", (event) => {
  if (event.target.closest("[data-retry]")) {
    loadAdmin();
    return;
  }

  const button = event.target.closest("[data-save]");
  if (!button) return;
  saveEvent(button.closest(".event-card"));
});

categoryFilter.addEventListener("change", renderEvents);
statusFilter.addEventListener("change", renderEvents);
createButton.addEventListener("click", createEvent);
loginButton.addEventListener("click", login);
passwordInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") login();
});
logoutButton.addEventListener("click", () => {
  clearToken();
  allEvents = [];
  setHTML(eventsContainer, "");
  showLogin();
  showMessage(messageBox, "Sesion cerrada.", "ok");
});

if (getToken()) {
  loadAdmin();
} else {
  showLogin();
}
