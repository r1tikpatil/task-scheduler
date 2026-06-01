const API_BASE = import.meta.env.VITE_API_URL ?? "";

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

export async function apiRequest(path, options = {}) {
  const { apiKey, body, method = "GET", headers = {} } = options;

  const requestHeaders = {
    "Content-Type": "application/json",
    ...headers,
  };

  if (apiKey) {
    requestHeaders["X-API-Key"] = apiKey;
  }

  const response = await fetch(`${API_BASE}${path}`, {
    method,
    headers: requestHeaders,
    body: body != null ? JSON.stringify(body) : undefined,
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new ApiError(payload.message || "Request failed", response.status);
  }

  return payload;
}
