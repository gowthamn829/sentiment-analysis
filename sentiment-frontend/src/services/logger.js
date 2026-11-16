const PREFIX = "[Sentiment Frontend]";

export const logger = {
  info(message, details) {
    if (import.meta.env.DEV) {
      console.info(`${PREFIX} ${message}`, details ?? "");
    }
  },

  warn(message, details) {
    if (import.meta.env.DEV) {
      console.warn(`${PREFIX} ${message}`, details ?? "");
    }
  },

  error(message, details) {
    if (import.meta.env.DEV) {
      console.error(`${PREFIX} ${message}`, details ?? "");
    }
  },
};