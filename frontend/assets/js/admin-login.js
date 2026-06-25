(function () {
  const usernameInput = document.querySelector("#username");
  const passwordInput = document.querySelector("#password");
  const loginButton = document.querySelector("#loginButton");
  const state = document.querySelector("#state");
  const message = document.querySelector("#message");

  const auth = window.PaddockARAdminAuth;

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
    setMessage("");

    try {
      const response = await fetch(`${window.PaddockARCommon.API_BASE_URL}/api/auth/login`, {
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ username, password }),
      });

      if (!response.ok) {
        throw new Error(`Login ${response.status}`);
      }

      const data = await response.json();
      const token = data.access_token || data.token;

      if (!token) {
        throw new Error("Token missing");
      }

      auth.setToken(token);

      setState("Acceso correcto");
      setMessage("Ingresando al panel...", "success");

      setTimeout(() => {
        window.location.href = "dashboard.html";
      }, 400);
    } catch (error) {
      console.error("[PaddockAR Admin Login]", error);
      auth.clearToken();
      setState("Login requerido");
      setMessage("Credenciales incorrectas o API no disponible.", "error");
    } finally {
      loginButton.disabled = false;
    }
  }

  if (auth?.isLoggedIn()) {
    window.location.href = "dashboard.html";
    return;
  }

  loginButton?.addEventListener("click", login);

  passwordInput?.addEventListener("keydown", (event) => {
    if (event.key === "Enter") login();
  });

  console.log("[PaddockAR Admin] Login listo");
})();