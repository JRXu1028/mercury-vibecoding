import { appendFileSync, mkdirSync } from 'node:fs'
import path from 'node:path'

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3
}

export interface LogEntry {
  timestamp: string
  level: LogLevel
  message: string
  details?: unknown
}

export type LogListener = (entry: LogEntry) => void

export interface LoggerOptions {
  level?: LogLevel
  logDir?: string
  fileName?: string
}

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

function nowLocal(): string {
  const d = new Date()
  const pad = (n: number): string => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${String(d.getMilliseconds()).padStart(3, '0')}`
}

export class Logger {
  private logFilePath: string | null = null
  private logDirOption: string | null = null
  private readonly level: LogLevel
  private listeners = new Set<LogListener>()
  private dirCreated = false

  constructor(options: LoggerOptions = {}) {
    this.level = options.level ?? 'debug'
    this.logDirOption = options.logDir ?? null
    const file = options.fileName ?? 'mercury.log'

    if (this.logDirOption) {
      this.logFilePath = path.resolve(this.logDirOption, file)
    }
  }

  /** Set or change the log directory. Used when app.getPath is available after ready. */
  setLogDir(dir: string, fileName = 'mercury.log'): void {
    this.logDirOption = dir
    this.logFilePath = path.resolve(dir, fileName)
    this.dirCreated = false
  }

  debug(message: string, details?: unknown): void {
    this.emit('debug', message, details)
  }

  info(message: string, details?: unknown): void {
    this.emit('info', message, details)
  }

  warn(message: string, details?: unknown): void {
    this.emit('warn', message, details)
  }

  error(message: string, details?: unknown): void {
    this.emit('error', message, details)
  }

  onLog(listener: LogListener): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  private ensureDir(): void {
    if (this.dirCreated || !this.logDirOption) {
      return
    }
    try {
      mkdirSync(this.logDirOption, { recursive: true })
      this.dirCreated = true
    } catch {
      // Can't create log dir — file logging disabled.
    }
  }

  private emit(level: LogLevel, message: string, details?: unknown): void {
    if (LEVEL_ORDER[level] < LEVEL_ORDER[this.level]) {
      return
    }

    const entry: LogEntry = {
      timestamp: nowLocal(),
      level,
      message,
      details
    }

    this.writeToConsole(entry)
    this.writeToFile(entry)
    this.notifyListeners(entry)
  }

  private writeToConsole(entry: LogEntry): void {
    const formatted = this.formatEntry(entry)
    const stream = entry.level === 'error' ? process.stderr : process.stdout
    stream.write(`${formatted}\n`)
  }

  private writeToFile(entry: LogEntry): void {
    if (!this.logFilePath) {
      return
    }
    this.ensureDir()
    const formatted = this.formatEntry(entry)
    try {
      appendFileSync(this.logFilePath, `${formatted}\n`, 'utf8')
    } catch {
      // Fail silently — don't cause a logging cascade.
    }
  }

  private notifyListeners(entry: LogEntry): void {
    for (const listener of this.listeners) {
      try {
        listener(entry)
      } catch {
        // Ignore errors in listeners.
      }
    }
  }

  private formatEntry(entry: LogEntry): string {
    const base = `[${entry.timestamp}] [${entry.level.toUpperCase()}] ${entry.message}`
    if (entry.details !== undefined) {
      const detailsStr = entry.details instanceof Error
        ? `${entry.details.message}\n${entry.details.stack ?? ''}`
        : safeStringify(entry.details)
      return `${base} ${detailsStr}`
    }
    return base
  }
}

let _logger: Logger | null = null

export function getLogger(): Logger {
  if (!_logger) {
    _logger = new Logger()
  }
  return _logger
}

/** Convenience proxy — delegates to the lazy singleton. */
export const logger: Logger = new Proxy({} as Logger, {
  get(_target, prop: string | symbol) {
    return (getLogger() as unknown as Record<string | symbol, unknown>)[prop]
  }
})
