import { mkdtemp, rm } from 'node:fs/promises'
import { existsSync, readFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { Logger } from '../src/logger.js'

describe('Logger', () => {
  let tmpDir = ''

  beforeEach(async () => {
    tmpDir = await mkdtemp(path.join(os.tmpdir(), 'mercury-logger-'))
  })

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true })
  })

  it('writes log entries to a file', () => {
    const logDir = path.join(tmpDir, 'logs')
    const logger = new Logger({ level: 'debug', logDir, fileName: 'test.log' })

    logger.info('hello world', { key: 'value' })
    logger.error('something broke')

    const logPath = path.join(logDir, 'test.log')
    expect(existsSync(logPath)).toBe(true)

    const content = readFileSync(logPath, 'utf8')
    expect(content).toContain('[INFO] hello world')
    expect(content).toContain('"key":"value"')
    expect(content).toContain('[ERROR] something broke')
  })

  it('filters messages below configured level', () => {
    const logDir = path.join(tmpDir, 'logs')
    const logger = new Logger({ level: 'warn', logDir, fileName: 'filtered.log' })

    logger.debug('debug msg')
    logger.info('info msg')
    logger.warn('warn msg')

    const logPath = path.join(logDir, 'test.log') // intentionally wrong — filtered.log
    const content = readFileSync(path.join(logDir, 'filtered.log'), 'utf8')
    expect(content).not.toContain('debug msg')
    expect(content).not.toContain('info msg')
    expect(content).toContain('warn msg')
  })

  it('notifies listeners of log entries', () => {
    const logDir = path.join(tmpDir, 'logs')
    const logger = new Logger({ level: 'debug', logDir, fileName: 'listener.log' })
    const received: string[] = []

    const remove = logger.onLog((entry) => {
      received.push(`${entry.level}:${entry.message}`)
    })

    logger.info('first')
    logger.warn('second')

    expect(received).toContain('info:first')
    expect(received).toContain('warn:second')

    remove()
    logger.info('third')
    expect(received).not.toContain('info:third')
  })
})
