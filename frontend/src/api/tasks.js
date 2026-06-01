import { apiRequest } from "./client";

export const fetchTasks = (query = {}) => {
  const params = new URLSearchParams();

  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      params.set(key, String(value));
    }
  });

  const queryString = params.toString();
  return apiRequest(`/api/tasks${queryString ? `?${queryString}` : ""}`);
};

export const fetchTaskStats = () => apiRequest("/api/tasks/stats");

export const fetchTask = (taskId) => apiRequest(`/api/tasks/${taskId}`);

export const submitTask = (apiKey, payload) =>
  apiRequest("/api/tasks", { method: "POST", apiKey, body: payload });

export const cancelTask = (taskId) =>
  apiRequest(`/api/tasks/${taskId}/cancel`, { method: "POST" });

export const retryTask = (taskId) =>
  apiRequest(`/api/tasks/${taskId}/retry`, { method: "POST" });

export const fetchWorkerStats = () => apiRequest("/api/workers/stats");

export const fetchAnalytics = (hours = 24) =>
  apiRequest(`/api/analytics?hours=${hours}`);

export const seedTasks = (count = 55) =>
  apiRequest("/api/tasks/seed", { method: "POST", body: { count } });
