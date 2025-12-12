/**
 * Logger utility for Electron main process
 * Provides colored, formatted, searchable console output
 */

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',

  // Foreground colors
  black: '\x1b[30m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  gray: '\x1b[90m',

  // Bright colors
  brightRed: '\x1b[91m',
  brightGreen: '\x1b[92m',
  brightYellow: '\x1b[93m',
  brightBlue: '\x1b[94m',
  brightMagenta: '\x1b[95m',
  brightCyan: '\x1b[96m',

  // Background colors
  bgRed: '\x1b[41m',
  bgGreen: '\x1b[42m',
  bgYellow: '\x1b[43m',
  bgBlue: '\x1b[44m',
};

// Log levels
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  NONE = 4,
}

// Module/subsystem identifiers with their colors
const moduleColors: Record<string, string> = {
  GIT: colors.brightGreen,
  CLAUDE: colors.brightMagenta,
  FILE: colors.brightCyan,
  TERMINAL: colors.brightYellow,
  LSP: colors.blue,
  TEST: colors.magenta,
  IPC: colors.gray,
  WINDOW: colors.cyan,
  STORE: colors.yellow,
  SYSTEM: colors.white,
};

// Icons for different log types
const icons = {
  info: 'ℹ',
  success: '✓',
  warn: '⚠',
  error: '✗',
  start: '→',
  end: '←',
  data: '◆',
  debug: '•',
};

// Current log level (can be configured)
let currentLogLevel: LogLevel = LogLevel.DEBUG;

// Whether to show timestamps
let showTimestamps = true;

// Whether logging is enabled
let loggingEnabled = true;

/**
 * Configure the logger
 */
export function configureLogger(options: {
  level?: LogLevel;
  timestamps?: boolean;
  enabled?: boolean;
}) {
  if (options.level !== undefined) currentLogLevel = options.level;
  if (options.timestamps !== undefined) showTimestamps = options.timestamps;
  if (options.enabled !== undefined) loggingEnabled = options.enabled;
}

/**
 * Get current timestamp formatted for logging
 */
function getTimestamp(): string {
  const now = new Date();
  const hours = now.getHours().toString().padStart(2, '0');
  const minutes = now.getMinutes().toString().padStart(2, '0');
  const seconds = now.getSeconds().toString().padStart(2, '0');
  const ms = now.getMilliseconds().toString().padStart(3, '0');
  return `${hours}:${minutes}:${seconds}.${ms}`;
}

/**
 * Format a module tag with color
 */
function formatModule(module: string): string {
  const color = moduleColors[module] || colors.white;
  const paddedModule = module.padEnd(8);
  return `${color}[${paddedModule}]${colors.reset}`;
}

/**
 * Format log level with color and icon
 */
function formatLevel(level: 'debug' | 'info' | 'warn' | 'error' | 'success'): { color: string; icon: string } {
  switch (level) {
    case 'debug':
      return { color: colors.gray, icon: icons.debug };
    case 'info':
      return { color: colors.blue, icon: icons.info };
    case 'warn':
      return { color: colors.yellow, icon: icons.warn };
    case 'error':
      return { color: colors.red, icon: icons.error };
    case 'success':
      return { color: colors.green, icon: icons.success };
  }
}

/**
 * Format additional data for logging
 */
function formatData(data: unknown): string {
  if (data === undefined) return '';
  if (data === null) return `${colors.dim}null${colors.reset}`;
  if (typeof data === 'string') {
    // Truncate long strings
    const maxLen = 200;
    if (data.length > maxLen) {
      return `${colors.dim}"${data.substring(0, maxLen)}..."${colors.reset}`;
    }
    return `${colors.dim}"${data}"${colors.reset}`;
  }
  if (typeof data === 'number' || typeof data === 'boolean') {
    return `${colors.cyan}${data}${colors.reset}`;
  }
  if (Array.isArray(data)) {
    if (data.length === 0) return `${colors.dim}[]${colors.reset}`;
    if (data.length <= 3) {
      return `${colors.dim}[${data.map(formatData).join(', ')}]${colors.reset}`;
    }
    return `${colors.dim}[${data.length} items]${colors.reset}`;
  }
  if (typeof data === 'object') {
    try {
      const keys = Object.keys(data);
      if (keys.length === 0) return `${colors.dim}{}${colors.reset}`;
      if (keys.length <= 3) {
        const preview = keys.map(k => `${k}: ${formatData((data as Record<string, unknown>)[k])}`).join(', ');
        return `${colors.dim}{ ${preview} }${colors.reset}`;
      }
      return `${colors.dim}{ ${keys.slice(0, 3).join(', ')}... (${keys.length} keys) }${colors.reset}`;
    } catch {
      return `${colors.dim}[Object]${colors.reset}`;
    }
  }
  return `${colors.dim}${String(data)}${colors.reset}`;
}

/**
 * Core logging function
 */
function log(
  level: 'debug' | 'info' | 'warn' | 'error' | 'success',
  module: string,
  message: string,
  data?: unknown
) {
  if (!loggingEnabled) return;

  const levelMap: Record<string, LogLevel> = {
    debug: LogLevel.DEBUG,
    info: LogLevel.INFO,
    success: LogLevel.INFO,
    warn: LogLevel.WARN,
    error: LogLevel.ERROR,
  };

  if (levelMap[level] < currentLogLevel) return;

  const { color, icon } = formatLevel(level);
  const timestamp = showTimestamps ? `${colors.dim}${getTimestamp()}${colors.reset} ` : '';
  const moduleTag = formatModule(module);
  const formattedData = data !== undefined ? ` ${formatData(data)}` : '';

  const output = `${timestamp}${moduleTag} ${color}${icon} ${message}${colors.reset}${formattedData}`;

  if (level === 'error') {
    console.error(output);
  } else if (level === 'warn') {
    console.warn(output);
  } else {
    console.log(output);
  }
}

/**
 * Create a logger for a specific module
 */
export function createLogger(module: string) {
  return {
    debug: (message: string, data?: unknown) => log('debug', module, message, data),
    info: (message: string, data?: unknown) => log('info', module, message, data),
    success: (message: string, data?: unknown) => log('success', module, message, data),
    warn: (message: string, data?: unknown) => log('warn', module, message, data),
    error: (message: string, data?: unknown) => log('error', module, message, data),

    // Special log methods for common patterns
    start: (action: string, data?: unknown) => {
      if (!loggingEnabled || LogLevel.DEBUG < currentLogLevel) return;
      const timestamp = showTimestamps ? `${colors.dim}${getTimestamp()}${colors.reset} ` : '';
      const moduleTag = formatModule(module);
      const formattedData = data !== undefined ? ` ${formatData(data)}` : '';
      console.log(`${timestamp}${moduleTag} ${colors.blue}${icons.start} ${action}${colors.reset}${formattedData}`);
    },

    end: (action: string, data?: unknown) => {
      if (!loggingEnabled || LogLevel.DEBUG < currentLogLevel) return;
      const timestamp = showTimestamps ? `${colors.dim}${getTimestamp()}${colors.reset} ` : '';
      const moduleTag = formatModule(module);
      const formattedData = data !== undefined ? ` ${formatData(data)}` : '';
      console.log(`${timestamp}${moduleTag} ${colors.green}${icons.end} ${action}${colors.reset}${formattedData}`);
    },

    // Log a command being executed
    command: (cmd: string, args?: string[]) => {
      if (!loggingEnabled || LogLevel.DEBUG < currentLogLevel) return;
      const timestamp = showTimestamps ? `${colors.dim}${getTimestamp()}${colors.reset} ` : '';
      const moduleTag = formatModule(module);
      const argsStr = args?.length ? ` ${colors.dim}${args.join(' ')}${colors.reset}` : '';
      console.log(`${timestamp}${moduleTag} ${colors.cyan}$ ${cmd}${argsStr}${colors.reset}`);
    },

    // Log IPC handler calls
    ipc: (handler: string, direction: 'in' | 'out', data?: unknown) => {
      if (!loggingEnabled || LogLevel.DEBUG < currentLogLevel) return;
      const timestamp = showTimestamps ? `${colors.dim}${getTimestamp()}${colors.reset} ` : '';
      const moduleTag = formatModule(module);
      const arrow = direction === 'in' ? `${colors.blue}→` : `${colors.green}←`;
      const formattedData = data !== undefined ? ` ${formatData(data)}` : '';
      console.log(`${timestamp}${moduleTag} ${arrow} ${handler}${colors.reset}${formattedData}`);
    },

    // Log with timing
    timed: async <T>(action: string, fn: () => Promise<T>): Promise<T> => {
      const startTime = Date.now();
      log('debug', module, `Starting: ${action}`);
      try {
        const result = await fn();
        const duration = Date.now() - startTime;
        log('success', module, `Completed: ${action}`, `${duration}ms`);
        return result;
      } catch (error) {
        const duration = Date.now() - startTime;
        log('error', module, `Failed: ${action} (${duration}ms)`, error);
        throw error;
      }
    },
  };
}

// Pre-created loggers for common modules
export const gitLogger = createLogger('GIT');
export const claudeLogger = createLogger('CLAUDE');
export const fileLogger = createLogger('FILE');
export const terminalLogger = createLogger('TERMINAL');
export const lspLogger = createLogger('LSP');
export const testLogger = createLogger('TEST');
export const ipcLogger = createLogger('IPC');
export const windowLogger = createLogger('WINDOW');
export const storeLogger = createLogger('STORE');
export const systemLogger = createLogger('SYSTEM');

// Export default configuration based on environment
if (process.env.NODE_ENV === 'production') {
  configureLogger({ level: LogLevel.INFO });
} else {
  configureLogger({ level: LogLevel.DEBUG });
}
