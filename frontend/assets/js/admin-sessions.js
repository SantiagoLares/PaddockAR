const { renderCategoryBadge, createLogger } = window.PaddockARCommon;
const { request, sendJson } = window.PaddockARApi;
const { setHTML, setText, renderEmpty, renderError, showMessage } = window.PaddockARDom;
const logger = createLogger("PaddockAR Admin");
const TOKEN_KEY = "paddockar_admin_token";

const loginPanel = document.querySelector("#loginPanel");
const adminPanel = document.querySelector("#adminPanel");
const usernameInput = document.querySelector("#username");
const passwordInput = document.querySelector("#password");
const loginButton = document.querySelector("#loginButton");
const logoutButton = document.querySelector("#logoutButton");
const sessionsContainer = document.querySelector("#sessions");
const state = document.querySelector("#state");
const messageBox = document.querySelector("#message");
const categoryFilter = document.querySelector("#categoryFilter");
const eventFilter = document.querySelector("#eventFilter");

let allSessions = [];

function renderAdminLoadError() {
  setHTML(
    sessionsContainer,
    renderError("No se pudo cargar el panel admin. Revisa la conexion con la API y volve a intentar.", {
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
  state.textContent = "Login requerido";
}

function showAdmin() {
  loginPanel.hidden = true;
  adminPanel.hidden = false;
  logoutButton.hidden = false;
}

function toDateTimeLocal(value) {
  if (!value) return "";

  const date = new Date(value);
  const pad = (number) => String(number).padStart(2, "0");
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
  ].join("-") + `T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function fromDateTimeLocal(value) {
  return value || null;
}

function fillFilters() {
  const categories = [
    ...new Map(
      allSessions.map((session) => [session.event.category.short_name, session.event.category]),
    ).values(),
  ];

  const events = [...new Map(allSessions.map((session) => [session.event.id, session.event])).values()];

  categoryFilter.innerHTML =
    '<option value="all">Todas las categorias</option>' +
    categories
      .map((category) => `<option value="${category.short_name}">${category.short_name}</option>`)
      .join("");

  eventFilter.innerHTML =
    '<option value="all">Todos los eventos</option>' +
    events.map((event) => `<option value="${event.id}">${event.name}</option>`).join("");
}

function filteredSessions() {
  return allSessions.filter((session) => {
    const matchesCategory =
      categoryFilter.value === "all" || session.event.category.short_name === categoryFilter.value;
    const matchesEvent = eventFilter.value === "all" || String(session.event.id) === eventFilter.value;

    return matchesCategory && matchesEvent;
  });
}

function renderSessions() {
  const sessions = filteredSessions();
  state.textContent = `${sessions.length}/${allSessions.length} sesiones`;

  if (!sessions.length) {
    setHTML(sessionsContainer, renderEmpty("No hay sesiones para los filtros seleccionados."));
    return;
  }

  setHTML(sessionsContainer, sessions
    .map(
      (session) => `
        <article class="session-card" data-session-id="${session.id}">
          <header class="session-head">
            ${renderCategoryBadge(session.event.category, { extraClass: "admin-cat" })}
            <div class="event-name">${session.event.name}</div>
            <div class="session-id mono">ID ${session.id}</div>
          </header>
          <div class="edit-grid">
            <div class="field">
              <label class="mono">Nombre</label>
              <input data-field="name" value="${session.name}" />
            </div>
            <div class="field">
              <label class="mono">Tipo</label>
              <input data-field="session_type" value="${session.session_type}" />
            </div>
            <div class="field">
              <label class="mono">Inicio</label>
              <input data-field="starts_at" type="datetime-local" value="${toDateTimeLocal(session.starts_at)}" />
            </div>
            <div class="field">
              <label class="mono">Fin</label>
              <input data-field="ends_at" type="datetime-local" value="${toDateTimeLocal(session.ends_at)}" />
            </div>
            <div class="field">
              <label class="mono">Estado</label>
              <select data-field="status">
                <option value="scheduled" ${session.status === "scheduled" ? "selected" : ""}>scheduled</option>
                <option value="live" ${session.status === "live" ? "selected" : ""}>live</option>
                <option value="finished" ${session.status === "finished" ? "selected" : ""}>finished</option>
                <option value="cancelled" ${session.status === "cancelled" ? "selected" : ""}>cancelled</option>
              </select>
            </div>
            <button class="save-button mono" type="button" data-save>Guardar</button>
          </div>
        </article>
      `,
    )
    .join(""));
}

async function loadSessions() {
  setText(state, "Cargando");
  showMessage(messageBox, "");
  logger.info("Loading admin sessions", "/api/admin/sessions");

  try {
    const response = await request("/api/admin/sessions", { headers: authHeaders() });

    if (response.status === 401) {
      logger.info("Admin sessions rejected with 401");
      clearToken();
      showLogin();
      showMessage(messageBox, "Sesion vencida o invalida.", "error");
      return;
    }

    if (!response.ok) throw new Error(`API ${response.status}`);

    allSessions = await response.json();
    logger.info("Admin sessions loaded", allSessions.length);
    showAdmin();
    fillFilters();
    renderSessions();
  } catch (error) {
    logger.error("Admin sessions failed", error);
    showAdmin();
    renderAdminLoadError();
  }
}

async function saveSession(card) {
  const id = card.dataset.sessionId;
  const payload = {};

  card.querySelectorAll("[data-field]").forEach((field) => {
    const key = field.dataset.field;
    payload[key] = key === "starts_at" || key === "ends_at" ? fromDateTimeLocal(field.value) : field.value;
  });

  try {
    logger.info("Saving session", id, Object.keys(payload));
    const response = await sendJson(`/api/admin/sessions/${id}`, {
      method: "PUT",
      headers: authHeaders(),
      body: payload,
    });

    if (response.status === 401) {
      logger.info("Save session rejected with 401", id);
      clearToken();
      showLogin();
      showMessage(messageBox, "Sesion vencida o invalida.", "error");
      return;
    }

    if (!response.ok) throw new Error(`API ${response.status}`);

    const updated = await response.json();
    logger.info("Session saved", updated.id);
    allSessions = allSessions.map((session) => (session.id === updated.id ? updated : session));
    showMessage(messageBox, `Sesion ${id} guardada correctamente.`, "ok");
    renderSessions();
  } catch (error) {
    logger.error("Save session failed", id, error);
    showMessage(
      messageBox,
      `No se pudo guardar la sesion ${id}. Revisa la conexion con la API y volve a intentar.<br><button class="retry-button mono" type="button" data-retry-save="${id}">Reintentar</button>`,
      "error",
    );
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
    logger.info("Admin login succeeded");
    passwordInput.value = "";
    showMessage(messageBox, "Login correcto.", "ok");
    loadSessions();
  } catch (error) {
    logger.error("Admin login failed", error);
    showLogin();
    showMessage(
      messageBox,
      'No se pudo iniciar sesion. Revisa los datos o la conexion con la API.<br><button class="retry-button mono" type="button" data-retry-login>Reintentar</button>',
      "error",
    );
  }
}

sessionsContainer.addEventListener("click", (event) => {
  if (event.target.closest("[data-retry]")) {
    loadSessions();
    return;
  }

  const button = event.target.closest("[data-save]");
  if (!button) return;
  saveSession(button.closest(".session-card"));
});

messageBox.addEventListener("click", (event) => {
  if (event.target.closest("[data-retry-login]")) {
    login();
    return;
  }

  const retrySaveButton = event.target.closest("[data-retry-save]");
  if (!retrySaveButton) return;

  const card = sessionsContainer.querySelector(`[data-session-id="${retrySaveButton.dataset.retrySave}"]`);
  if (card) saveSession(card);
});

categoryFilter.addEventListener("change", renderSessions);
eventFilter.addEventListener("change", renderSessions);
loginButton.addEventListener("click", login);
passwordInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") login();
});
logoutButton.addEventListener("click", () => {
  clearToken();
  allSessions = [];
  setHTML(sessionsContainer, "");
  showLogin();
  showMessage(messageBox, "Sesion cerrada.", "ok");
});

if (getToken()) {
  loadSessions();
} else {
  showLogin();
}
