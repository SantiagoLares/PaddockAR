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
const sessionFilter = document.querySelector("#sessionFilter");
const sessionMeta = document.querySelector("#sessionMeta");
const resultsContainer = document.querySelector("#results");
const state = document.querySelector("#state");
const messageBox = document.querySelector("#message");
const createButton = document.querySelector("#createButton");

const newPositionInput = document.querySelector("#newPosition");
const newDriverNameInput = document.querySelector("#newDriverName");
const newTeamNameInput = document.querySelector("#newTeamName");
const newTimeOrGapInput = document.querySelector("#newTimeOrGap");
const newPointsInput = document.querySelector("#newPoints");

let allSessions = [];
let currentResults = [];

function renderAdminLoadError() {
  setHTML(
    resultsContainer,
    renderError("No se pudo cargar el panel de resultados. Revisa la conexion con la API y volve a intentar.", {
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

function formatDateTime(value) {
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value));
}

function currentSession() {
  return allSessions.find((session) => String(session.id) === sessionFilter.value) || null;
}

function fillSessionOptions() {
  sessionFilter.innerHTML =
    '<option value="">Selecciona una sesion</option>' +
    allSessions
      .map(
        (session) =>
          `<option value="${session.id}">${session.event.category.short_name} - ${session.event.name} - ${session.name} - ${formatDateTime(session.starts_at)}</option>`,
      )
      .join("");
}

function renderSessionMeta() {
  const session = currentSession();
  if (!session) {
    sessionMeta.hidden = true;
    setHTML(sessionMeta, "");
    return;
  }

  sessionMeta.hidden = false;
  setHTML(
    sessionMeta,
    `
      <div class="session-meta-head">
        ${renderCategoryBadge(session.event.category, { tag: "span", extraClass: "admin-cat" })}
        <div class="session-meta-main">${session.event.name} - ${session.name}</div>
      </div>
      <div class="session-meta-sub">${formatDateTime(session.starts_at)} | ${session.event.circuit.name} - ${session.event.circuit.city || session.event.circuit.country}</div>
    `,
  );
}

function resetCreateForm() {
  newPositionInput.value = "";
  newDriverNameInput.value = "";
  newTeamNameInput.value = "";
  newTimeOrGapInput.value = "";
  newPointsInput.value = "";
}

function renderResults() {
  const session = currentSession();
  if (!session) {
    setText(state, `${allSessions.length} sesiones disponibles`);
    setHTML(resultsContainer, renderEmpty("Selecciona una sesion para ver resultados."));
    return;
  }

  setText(state, `${currentResults.length} resultados`);

  if (!currentResults.length) {
    setHTML(resultsContainer, renderEmpty("Todavia no hay resultados cargados para esta sesion."));
    return;
  }

  setHTML(
    resultsContainer,
    currentResults
      .map(
        (result) => `
          <article class="result-card" data-result-id="${result.id}">
            <header class="result-head">
              <div class="result-pos mono">P${result.position}</div>
              <div class="result-driver">${result.driver_name}</div>
              <div class="result-id mono">ID ${result.id}</div>
            </header>
            <div class="edit-grid">
              <div class="field">
                <label class="mono">Pos</label>
                <input data-field="position" type="number" min="1" value="${result.position}" />
              </div>
              <div class="field">
                <label class="mono">Piloto</label>
                <input data-field="driver_name" value="${result.driver_name}" />
              </div>
              <div class="field">
                <label class="mono">Equipo</label>
                <input data-field="team_name" value="${result.team_name}" />
              </div>
              <div class="field">
                <label class="mono">Tiempo / Dif</label>
                <input data-field="time_or_gap" value="${result.time_or_gap || ""}" />
              </div>
              <div class="field">
                <label class="mono">Pts</label>
                <input data-field="points" type="number" min="0" value="${result.points ?? ""}" />
              </div>
              <button class="save-button mono" type="button" data-save>Guardar</button>
              <button class="delete-button mono" type="button" data-delete>Eliminar</button>
            </div>
          </article>
        `,
      )
      .join(""),
  );
}

function normalizeResultPayload(source) {
  return {
    session_id: Number(sessionFilter.value),
    position: Number(source.position),
    driver_name: source.driver_name.trim(),
    team_name: source.team_name.trim(),
    time_or_gap: source.time_or_gap.trim() || null,
    points: source.points === "" ? null : Number(source.points),
  };
}

function createPayloadFromCard(card) {
  const raw = {};
  card.querySelectorAll("[data-field]").forEach((field) => {
    raw[field.dataset.field] = field.value;
  });
  return normalizeResultPayload(raw);
}

function createPayloadFromForm() {
  return normalizeResultPayload({
    position: newPositionInput.value,
    driver_name: newDriverNameInput.value,
    team_name: newTeamNameInput.value,
    time_or_gap: newTimeOrGapInput.value,
    points: newPointsInput.value,
  });
}

async function loadSessions() {
  const response = await request("/api/admin/sessions", { headers: authHeaders() });

  if (response.status === 401) {
    clearToken();
    showLogin();
    showMessage(messageBox, "Sesion vencida o invalida.", "error");
    return false;
  }

  if (!response.ok) throw new Error(`API ${response.status}`);

  allSessions = await response.json();
  fillSessionOptions();
  return true;
}

async function loadResults() {
  const session = currentSession();
  renderSessionMeta();

  if (!session) {
    currentResults = [];
    renderResults();
    return;
  }

  setText(state, "Cargando");
  logger.info("Loading admin results", session.id);

  try {
    const response = await request(`/api/admin/results/session/${session.id}`, { headers: authHeaders() });

    if (response.status === 401) {
      clearToken();
      showLogin();
      showMessage(messageBox, "Sesion vencida o invalida.", "error");
      return;
    }

    if (!response.ok) throw new Error(`API ${response.status}`);

    currentResults = await response.json();
    renderResults();
  } catch (error) {
    logger.error("Admin results failed", error);
    renderAdminLoadError();
  }
}

async function loadAdmin() {
  setText(state, "Cargando");
  showMessage(messageBox, "");

  try {
    const loaded = await loadSessions();
    if (!loaded) return;
    showAdmin();
    await loadResults();
  } catch (error) {
    logger.error("Admin setup failed", error);
    showAdmin();
    renderAdminLoadError();
  }
}

async function createResult() {
  if (!currentSession()) {
    showMessage(messageBox, "Primero selecciona una sesion.", "error");
    return;
  }

  const payload = createPayloadFromForm();

  try {
    const response = await sendJson("/api/admin/results", {
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
    currentResults = [...currentResults, created].sort((a, b) => a.position - b.position);
    resetCreateForm();
    showMessage(messageBox, `Resultado ${created.id} creado correctamente.`, "ok");
    renderResults();
  } catch (error) {
    logger.error("Create result failed", error);
    showMessage(messageBox, "No se pudo crear el resultado. Revisa los datos y volve a intentar.", "error");
  }
}

async function saveResult(card) {
  const id = card.dataset.resultId;
  const payload = createPayloadFromCard(card);

  try {
    const response = await sendJson(`/api/admin/results/${id}`, {
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
    currentResults = currentResults
      .map((result) => (result.id === updated.id ? updated : result))
      .sort((a, b) => a.position - b.position);
    showMessage(messageBox, `Resultado ${id} guardado correctamente.`, "ok");
    renderResults();
  } catch (error) {
    logger.error("Save result failed", id, error);
    showMessage(messageBox, `No se pudo guardar el resultado ${id}.`, "error");
  }
}

async function deleteResult(card) {
  const id = card.dataset.resultId;
  if (!window.confirm(`Eliminar resultado ${id}?`)) return;

  try {
    const response = await request(`/api/admin/results/${id}`, {
      method: "DELETE",
      headers: authHeaders(),
    });

    if (response.status === 401) {
      clearToken();
      showLogin();
      showMessage(messageBox, "Sesion vencida o invalida.", "error");
      return;
    }

    if (!response.ok) throw new Error(`API ${response.status}`);

    currentResults = currentResults.filter((result) => String(result.id) !== id);
    showMessage(messageBox, `Resultado ${id} eliminado correctamente.`, "ok");
    renderResults();
  } catch (error) {
    logger.error("Delete result failed", id, error);
    showMessage(messageBox, `No se pudo eliminar el resultado ${id}.`, "error");
  }
}

async function login() {
  showMessage(messageBox, "");
  setText(state, "Validando");

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

sessionFilter.addEventListener("change", loadResults);
createButton.addEventListener("click", createResult);
loginButton.addEventListener("click", login);
passwordInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") login();
});
logoutButton.addEventListener("click", () => {
  clearToken();
  allSessions = [];
  currentResults = [];
  setHTML(resultsContainer, "");
  setHTML(sessionMeta, "");
  sessionMeta.hidden = true;
  showLogin();
  showMessage(messageBox, "Sesion cerrada.", "ok");
});

resultsContainer.addEventListener("click", (event) => {
  if (event.target.closest("[data-retry]")) {
    loadAdmin();
    return;
  }

  const saveButton = event.target.closest("[data-save]");
  if (saveButton) {
    saveResult(saveButton.closest(".result-card"));
    return;
  }

  const deleteButton = event.target.closest("[data-delete]");
  if (deleteButton) {
    deleteResult(deleteButton.closest(".result-card"));
  }
});

if (getToken()) {
  loadAdmin();
} else {
  showLogin();
}
