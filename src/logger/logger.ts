import pino from "pino";

export const logger = pino({
  base: null,
  transport: {
    target: "pino-pretty",
    options: {
      translateTime: "SYS:dd-mm-yyyy HH:MM:ss", // usa SYS: per forzare il locale
      colorize: true,
    },
  },
  level: "debug",
});
