(function () {
  const usernameInput = document.querySelector("#username");
  const passwordInput = document.querySelector("#password");
  const loginButton = document.querySelector("#loginButton");
  const state = document.querySelector("#state");
  const message = document.querySelector("#message");

  function setState(text) {
    if (state) state.textContent = text;
  }

  function setMessage(text, type = "info") {
    if (!message) return;

    message.textContent = text;
    message.className = `admin-login-message admin-login-message--${type}`;
  }

  async function login() {
    const username = usernameInput?.value?.trim();
    const password = passwordInput?.value;

    if (!username || !password) {
      setMessage("Completá usuario y contraseña.", "error");
      return;
    }

    loginButton.disabled = true;
    setState("Validando credenciales...");

    try {
      const response = await fetch("http://127.0.0.1:8000/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username,
          password,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();

      if (data.access_token) {
        localStorage.setItem(
          "paddockar_admin_token",
          data.access_token
        );
      }

      setState("Acceso correcto");
      setMessage("Login exitoso.", "success");

      setTimeout(() => {
        window.location.href = "dashboard.html";
      }, 500);
    } catch (error) {
      console.error(error);

      setState("Login requerido");
      setMessage(
        "No se pudo iniciar sesión. Revisá backend y credenciales.",
        "error"
      );
    } finally {
      loginButton.disabled = false;
    }
  }

  loginButton?.addEventListener("click", login);

  passwordInput?.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      login();
    }
  });

  console.log("[PaddockAR Admin] Login cargado");
})();