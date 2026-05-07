type Level = 'debug' | 'info' | 'warn' | 'error';

interface Logger {
  debug(message: string, ...args: unknown[]): void;
  info(message: string, ...args: unknown[]): void;
  warn(message: string, ...args: unknown[]): void;
  error(message: string, ...args: unknown[]): void;
}

const isDev = __DEV__;

function emit(level: Level, message: string, args: unknown[]): void {
  // ESLint's no-console rule allows warn/error; we route everything through those channels.
  if (!isDev && (level === 'debug' || level === 'info')) return;
  const tag = `[${level}]`;
  if (level === 'error') {
    console.error(tag, message, ...args);
  } else {
    console.warn(tag, message, ...args);
  }
}

export const logger: Logger = {
  debug: (message, ...args) => emit('debug', message, args),
  info: (message, ...args) => emit('info', message, args),
  warn: (message, ...args) => emit('warn', message, args),
  error: (message, ...args) => emit('error', message, args),
};
