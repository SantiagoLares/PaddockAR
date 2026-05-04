(function () {
  const { API_BASE_URL } = window.PaddockARCommon;

  async function request(path, options = {}) {
    const response = await fetch(`${API_BASE_URL}${path}`, options);
    return response;
  }

  async function getJson(path, options = {}) {
    const response = await request(path, options);
    if (!response.ok) {
      const error = new Error(`API ${response.status}`);
      error.status = response.status;
      throw error;
    }
    return response.json();
  }

  async function sendJson(path, { method = "POST", body, headers = {}, ...rest } = {}) {
    const response = await request(path, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...headers,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      ...rest,
    });
    return response;
  }

  window.PaddockARApi = {
    request,
    getJson,
    sendJson,
  };
})();
