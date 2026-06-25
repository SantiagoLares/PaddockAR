(function () {
  const { sendJson } = window.PaddockARApi;

  const form = document.querySelector("#weekendForm");
  const sessionsEditor = document.querySelector("#sessionsEditor");
  const addSessionButton = document.querySelector("#addSessionButton");
  const generateSessionsButton = document.querySelector("#generateSessionsButton");
  const message = document.querySelector("#createWeekendMessage");

  function token() {
    return localStorage.getItem("paddockar_admin_token");
  }

  function showMessage(text, type = "info") {
    message.hidden = false;
    message.textContent = text;
    message.className = `admin-v2-empty admin-create-message admin-create-message--${type}`;
  }

  function field(id) {
    return document.querySelector(`#${id}`)?.value?.trim() || "";
  }

  function boolFromCheckbox(input) {
    return Boolean(input?.checked);
  }

  function sessionRowTemplate(data = {}) {
    const id = crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random());

    return `
      <article class="admin-session-row" data-session-row="${id}">
        <label class="field">
          <span>Nombre</span>
          <input data-session-name value="${data.name || ""}" placeholder="Carrera" required />
        </label>

        <label class="field">
          <span>Tipo</span>
          <select data-session-type required>
            <option value="practice" ${data.session_type === "practice" ? "selected" : ""}>practice</option>
            <option value="qualifying" ${data.session_type === "qualifying" ? "selected" : ""}>qualifying</option>
            <option value="sprint" ${data.session_type === "sprint" ? "selected" : ""}>sprint</option>
            <option value="race" ${data.session_type === "race" ? "selected" : ""}>race</option>
            <option value="session" ${data.session_type === "session" ? "selected" : ""}>session</option>
          </select>
        </label>

        <label class="field">
          <span>Fecha</span>
          <input data-session-date type="date" value="${data.date || field("eventStartDate")}" required />
        </label>

        <label class="field">
          <span>Hora ARG</span>
          <input data-session-time value="${data.time_arg || "15:00"}" placeholder="15:00" required />
        </label>

        <label class="field">
          <span>Duración</span>
          <input data-session-duration type="number" min="1" value="${data.duration_minutes || 60}" required />
        </label>

        <label class="field">
          <span>Estado</span>
          <select data-session-status>
            <option value="scheduled" ${data.status === "scheduled" ? "selected" : ""}>scheduled</option>
            <option value="live" ${data.status === "live" ? "selected" : ""}>live</option>
            <option value="finished" ${data.status === "finished" ? "selected" : ""}>finished</option>
            <option value="cancelled" ${data.status === "cancelled" ? "selected" : ""}>cancelled</option>
          </select>
        </label>

        <label class="admin-feature-check">
          <input data-session-feature type="checkbox" ${data.is_feature ? "checked" : ""} />
          <span>Feature</span>
        </label>

        <button class="admin-session-remove" type="button">Eliminar</button>
      </article>
    `;
  }

  function addSession(data = {}) {
    sessionsEditor.insertAdjacentHTML("beforeend", sessionRowTemplate(data));
  }

  function generateTemplate() {
    sessionsEditor.innerHTML = "";

    const start = field("eventStartDate");
    const end = field("eventEndDate") || start;
    const format = field("weekendFormat");

    if (format === "sprint") {
      addSession({ name: "Práctica 1", session_type: "practice", date: start, time_arg: "12:30", duration_minutes: 60 });
      addSession({ name: "Clasificación", session_type: "qualifying", date: start, time_arg: "16:00", duration_minutes: 60 });
      addSession({ name: "Sprint", session_type: "sprint", date: end, time_arg: "11:00", duration_minutes: 45 });
      addSession({ name: "Carrera", session_type: "race", date: end, time_arg: "15:00", duration_minutes: 120, is_feature: true });
      return;
    }

    addSession({ name: "Práctica 1", session_type: "practice", date: start, time_arg: "12:30", duration_minutes: 60 });
    addSession({ name: "Práctica 2", session_type: "practice", date: start, time_arg: "16:00", duration_minutes: 60 });
    addSession({ name: "Clasificación", session_type: "qualifying", date: end, time_arg: "12:00", duration_minutes: 60 });
    addSession({ name: "Carrera", session_type: "race", date: end, time_arg: "15:00", duration_minutes: 120, is_feature: true });
  }

  function buildSessions() {
    return Array.from(document.querySelectorAll("[data-session-row]")).map((row, index) => ({
      name: row.querySelector("[data-session-name]").value.trim(),
      session_type: row.querySelector("[data-session-type]").value,
      date: row.querySelector("[data-session-date]").value,
      time_arg: row.querySelector("[data-session-time]").value.trim(),
      duration_minutes: Number(row.querySelector("[data-session-duration]").value || 60),
      status: row.querySelector("[data-session-status]").value,
      order_index: index + 1,
      is_feature: boolFromCheckbox(row.querySelector("[data-session-feature]")),
      data_quality: field("dataQuality") || "official",
      source_note: field("sourceNote"),
      source_url: field("sourceUrl"),
    }));
  }

  function buildPayload() {
    return {
      category_slug: field("categorySlug"),
      circuit: {
        name: field("circuitName"),
        city: field("circuitCity"),
        country: field("circuitCountry"),
        timezone: field("circuitTimezone") || "America/Argentina/Buenos_Aires",
      },
      event: {
        name: field("eventName"),
        slug: field("eventSlug") || null,
        season_year: Number(field("seasonYear")),
        round_number: field("roundNumber") ? Number(field("roundNumber")) : null,
        start_date: field("eventStartDate"),
        end_date: field("eventEndDate"),
        status: field("eventStatus") || "scheduled",
        data_quality: field("dataQuality") || "official",
        source_url: field("sourceUrl") || null,
        source_note: field("sourceNote") || null,
      },
      sessions: buildSessions(),
    };
  }

  async function saveWeekend(event) {
    event.preventDefault();

    const adminToken = token();

    if (!adminToken) {
      showMessage("No hay sesión admin. Volvé a ingresar.", "error");
      setTimeout(() => {
        window.location.href = "index.html";
      }, 1000);
      return;
    }

    const payload = buildPayload();

    if (!payload.sessions.length) {
      showMessage("Agregá al menos una sesión.", "error");
      return;
    }

    showMessage("Guardando fin de semana...", "info");

    try {
      const response = await sendJson("/admin/weekends", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
        body: payload,
      });

      if (!response.ok) {
        const detail = await response.text();
        throw new Error(detail || `HTTP ${response.status}`);
      }

      const data = await response.json();

      showMessage(
        `Guardado correctamente. Evento ${data.event_created ? "creado" : "actualizado"}. Sesiones creadas: ${data.sessions_created}. Actualizadas: ${data.sessions_updated}.`,
        "success"
      );

      setTimeout(() => {
        window.location.href = "events.html";
      }, 1400);
    } catch (error) {
      console.error("[PaddockAR Admin Create Weekend]", error);
      showMessage("No se pudo guardar. Revisá los datos o la sesión admin.", "error");
    }
  }

  sessionsEditor?.addEventListener("click", (event) => {
    const button = event.target.closest(".admin-session-remove");
    if (!button) return;
    button.closest("[data-session-row]")?.remove();
  });

  addSessionButton?.addEventListener("click", () => addSession());
  generateSessionsButton?.addEventListener("click", generateTemplate);
  form?.addEventListener("submit", saveWeekend);

  addSession({ name: "Carrera", session_type: "race", time_arg: "15:00", duration_minutes: 120, is_feature: true });
})();