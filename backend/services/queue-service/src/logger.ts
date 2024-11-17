import winston from 'winston';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ timestamp, level, message, service }) => {
      return `${timestamp} [${level.toUpperCase()}]${service ? `[${service}]` : ''}: ${message}`;
    })
  ),
  transports: [new winston.transports.Console()],
});

export function setAppLogLevel(level: 'verbose' | 'info') {
  logger.level = level;
}

export function createLogger(name: string) {
  const meta = { service: name };
  return {
    verbose: (message: string) => {
      logger.verbose(message, meta);
    },
    info: (message: string) => {
      logger.info(message, meta);
    },
    error: (message: string) => {
      logger.error(message, meta);
    },
  };
}
