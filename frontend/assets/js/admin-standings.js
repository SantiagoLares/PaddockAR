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
const standingsContainer = document.querySelector("#standings");
const state = document.querySelector("#state");
const messageBox = document.querySelector("#message");
const categoryFilter = document.querySelector("#categoryFilter");
const typeFilter = document.querySelector("#typeFilter");
const createButton = document.querySelector("#createButton");

const newCategorySelect = document.querySelector("#newCategoryId");
const newStandingTypeSelect = document.querySelector("#newStandingType");
const newPositionInput = document.querySelector("#newPosition");
const newNameInput = document.querySelector("#newName");
const newTeamNameInput = document.querySelector("#newTeamName");
const newPointsInput = document.querySelector("#newPoints");
const newWinsInput = document.querySelector("#newWins");

let categories = [];
let allStandings = [];

function renderAdminLoadError() {
  setHTML(
    standingsContainer,
    renderError("No se pudo cargar el panel de standings. Revisá la conexión con la API y volvé a intentar.", {
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

function fillCategoryOptions() {
  categoryFilter.innerHTML =
    '<option value="all">Todas las categorías</option>' +
    categories.map((category) => `<option value="${category.id}">${category.short_name}</option>`).join("");

  newCategorySelect.innerHTML = categories
    .map((category) => `<option value="${category.id}">${category.name}</option>`)
    .join("");
}

function resetCreateForm() {
  if (categories[0]) newCategorySelect.value = String(categories[0].id);
  newStandingTypeSelect.value = "drivers";
  newPositionInput.value = "";
  newNameInput.value = "";
  newTeamNameInput.value = "";
  newPointsInput.value = "0";
  newWinsInput.value = "0";
}

function filteredStandings() {
  return allStandings.filter((standing) => {
    const matchesCategory = categoryFilter.value === "all" || String(standing.category_id) === categoryFilter.value;
    const matchesType = typeFilter.value === "all" || standing.standing_type === typeFilter.value;
    return matchesCategory && matchesType;
  });
}

function sortStandings(rows) {
  return [...rows].sort((a, b) => {
    if (a.category_id !== b.category_id) return a.category_id - b.category_id;
    if (a.standing_type !== b.standing_type) return a.standing_type.localeCompare(b.standing_type);
    if (a.position !== b.position) return a.position - b.position;
    return a.id - b.id;
  });
}

function renderStandings() {
  const standings = sortStandings(filteredStandings());
  setText(state, `${standings.length}/${allStandings.length} posiciones`);

  if (!standings.length) {
    setHTML(standingsContainer, renderEmpty("No hay posiciones para los filtros seleccionados."));
    return;
  }

  setHTML(
    standingsContainer,
    standings
      .map(
        (standing) => `
          <article class="standing-card" data-standing-id="${standing.id}">
            <header class="standing-head">
              ${renderCategoryBadge(standing.category, { extraClass: "admin-cat" })}
              <div class="standing-name">${standing.name}</div>
              <div class="standing-meta mono">${standing.standing_type}</div>
              <div class="standing-id mono">ID ${standing.id}</div>
            </header>
            <div class="edit-grid">
              <div class="field">
                <label class="mono">Categoría</label>
                <select data-field="category_id">
                  ${categories
                    .map(
                      (category) => `<option value="${category.id}" ${category.id === standing.category_id ? "selected" : ""}>${category.name}</option>`,
                    )
                    .join("")}
                </select>
              </div>
              <div class="field">
                <label class="mono">Tipo</label>
                <select data-field="standing_type">
                  <option value="drivers" ${standing.standing_type === "drivers" ? "selected" : ""}>drivers</option>
                  <option value="constructors" ${standing.standing_type === "constructors" ? "selected" : ""}>constructors</option>
                  <option value="general" ${standing.standing_type === "general" ? "selected" : ""}>general</option>
                </select>
              </div>
              <div class="field">
                <label class="mono">Pos</label>
                <input data-field="position" type="number" min="1" value="${standing.position}" />
              </div>
              <div class="field">
                <label class="mono">Nombre</label>
                <input data-field="name" value="${standing.name}" />
              </div>
              <div class="field">
                <label class="mono">Equipo</label>
                <input data-field="team_name" value="${standing.team_name || ""}" />
              </div>
              <div class="field">
                <label class="mono">Pts</label>
                <input data-field="points" type="number" min="0" value="${standing.points}" />
              </div>
              <div class="field">
                <label class="mono">Wins</label>
                <input data-field="wins" type="number" min="0" value="${standing.wins}" />
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

function normalizeStandingPayload(source) {
  return {
    category_id: Number(source.category_id),
    standing_type: source.standing_type,
    position: Number(source.position),
    name: source.name.trim(),
    team_name: source.team_name.trim() || null,
    points: Number(source.points || 0),
    wins: Number(source.wins || 0),
  };
}

function createPayloadFromCard(card) {
  const raw = {};
  card.querySelectorAll("[data-field]").forEach((field) => {
    raw[field.dataset.field] = field.value;
  });
  return normalizeStandingPayload(raw);
}

function createPayloadFromForm() {
  return normalizeStandingPayload({
    category_id: newCategorySelect.value,
    standing_type: newStandingTypeSelect.value,
    position: newPositionInput.value,
    name: newNameInput.value,
    team_name: newTeamNameInput.value,
    points: newPointsInput.value,
    wins: newWinsInput.value,
  });
}

async function loadReferenceData() {
  categories = await getJson("/api/categories");
  fillCategoryOptions();
  resetCreateForm();
}

async function loadStandings() {
  setText(state, "Cargando");
  showMessage(messageBox, "");
  logger.info("Loading admin standings", "/api/admin/standings");

  try {
    const response = await request("/api/admin/standings", { headers: authHeaders() });

    if (response.status === 401) {
      clearToken();
      showLogin();
      showMessage(messageBox, "Sesión vencida o inválida.", "error");
      return;
    }

    if (!response.ok) throw new Error(`API ${response.status}`);

    allStandings = await response.json();
    showAdmin();
    renderStandings();
  } catch (error) {
    logger.error("Admin standings failed", error);
    showAdmin();
    renderAdminLoadError();
  }
}

async function loadAdmin() {
  setText(state, "Cargando");
  try {
    await loadReferenceData();
    await loadStandings();
  } catch (error) {
    logger.error("Admin standings setup failed", error);
    showAdmin();
    renderAdminLoadError();
  }
}

async function createStanding() {
  const payload = createPayloadFromForm();

  try {
    const response = await sendJson("/api/admin/standings", {
      method: "POST",
      headers: authHeaders(),
      body: payload,
    });

    if (response.status === 401) {
      clearToken();
      showLogin();
      showMessage(messageBox, "Sesión vencida o inválida.", "error");
      return;
    }

    if (!response.ok) throw new Error(`API ${response.status}`);

    const created = await response.json();
    allStandings = sortStandings([...allStandings, created]);
    resetCreateForm();
    showMessage(messageBox, `Posicion ${created.id} creada correctamente.`, "ok");
    renderStandings();
  } catch (error) {
    logger.error("Create standing failed", error);
    showMessage(messageBox, "No se pudo crear la posición. Revisá los datos y volvé a intentar.", "error");
  }
}

async function saveStanding(card) {
  const id = card.dataset.standingId;
  const payload = createPayloadFromCard(card);

  try {
    const response = await sendJson(`/api/admin/standings/${id}`, {
      method: "PUT",
      headers: authHeaders(),
      body: payload,
    });

    if (response.status === 401) {
      clearToken();
      showLogin();
      showMessage(messageBox, "Sesión vencida o inválida.", "error");
      return;
    }

    if (!response.ok) throw new Error(`API ${response.status}`);

    const updated = await response.json();
    allStandings = sortStandings(allStandings.map((standing) => (standing.id === updated.id ? updated : standing)));
    showMessage(messageBox, `Posicion ${id} guardada correctamente.`, "ok");
    renderStandings();
  } catch (error) {
    logger.error("Save standing failed", id, error);
    showMessage(messageBox, `No se pudo guardar la posicion ${id}.`, "error");
  }
}

async function deleteStanding(card) {
  const id = card.dataset.standingId;
  if (!window.confirm(`Eliminar posicion ${id}?`)) return;

  try {
    const response = await request(`/api/admin/standings/${id}`, {
      method: "DELETE",
      headers: authHeaders(),
    });

    if (response.status === 401) {
      clearToken();
      showLogin();
      showMessage(messageBox, "Sesión vencida o inválida.", "error");
      return;
    }

    if (!response.ok) throw new Error(`API ${response.status}`);

    allStandings = allStandings.filter((standing) => String(standing.id) !== id);
    showMessage(messageBox, `Posicion ${id} eliminada correctamente.`, "ok");
    renderStandings();
  } catch (error) {
    logger.error("Delete standing failed", id, error);
    showMessage(messageBox, `No se pudo eliminar la posicion ${id}.`, "error");
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
    showMessage(messageBox, "No se pudo iniciar sesión. Revisá los datos o la conexión con la API.", "error");
  }
}

standingsContainer.addEventListener("click", (event) => {
  if (event.target.closest("[data-retry]")) {
    loadAdmin();
    return;
  }

  const saveButton = event.target.closest("[data-save]");
  if (saveButton) {
    saveStanding(saveButton.closest(".standing-card"));
    return;
  }

  const deleteButton = event.target.closest("[data-delete]");
  if (deleteButton) {
    deleteStanding(deleteButton.closest(".standing-card"));
  }
});

categoryFilter.addEventListener("change", renderStandings);
typeFilter.addEventListener("change", renderStandings);
createButton.addEventListener("click", createStanding);
loginButton.addEventListener("click", login);
passwordInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") login();
});
logoutButton.addEventListener("click", () => {
  clearToken();
  allStandings = [];
  setHTML(standingsContainer, "");
  showLogin();
  showMessage(messageBox, "Sesión cerrada.", "ok");
});

if (getToken()) {
  loadAdmin();
} else {
  showLogin();
}
