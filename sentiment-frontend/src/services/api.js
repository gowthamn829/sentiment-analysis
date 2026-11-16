
import axios from "axios";
import { logger } from "./logger";

const api = axios.create({
  baseURL: "http://127.0.0.1:8000",
  timeout: 600000,
});

api.interceptors.request.use(
  (config) => {
    logger.info("API request started", {
      method: config.method?.toUpperCase(),
      endpoint: config.url,
    });

    return config;
  },
  (error) => {
    logger.error("API request setup failed", {
      message: error.message,
    });

    return Promise.reject(error);
  }
);

api.interceptors.response.use(
  (response) => {
    logger.info("API response received", {
      endpoint: response.config.url,
      status: response.status,
    });

    return response;
  },
  (error) => {
    logger.error("API request failed", {
      endpoint: error.config?.url,
      status: error.response?.status ?? "No HTTP response",
      message: error.message,
      detail: error.response?.data?.detail,
    });

    return Promise.reject(error);
  }
);

export async function predictSentiment(text) {
  const response = await api.post("/predict", { text });
  return response.data;
}

export async function uploadDataset(file) {
  const formData = new FormData();
  formData.append("user_file", file);

  const response = await api.post("/upload-dataset", formData);
  return response.data;
}

export default api;
