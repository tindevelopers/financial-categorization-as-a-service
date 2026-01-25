import fs from 'fs'
import path from 'path'

const LOG_DIR = path.join(process.cwd(), '.logs')
const LOG_FILE = path.join(LOG_DIR, 'server.log')

// Ensure log directory exists
try {
  if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true })
    console.log(`[logging] Created log directory: ${LOG_DIR}`)
  }
} catch (err) {
  console.error('[logging] Failed to create log directory:', err)
}

function formatLog(level: string, message: string, data?: any): string {
  const timestamp = new Date().toISOString()
  const dataStr = data ? ` ${JSON.stringify(data)}` : ''
  return `[${timestamp}] [${level}] ${message}${dataStr}\n`
}

function writeToFile(logLine: string) {
  try {
    fs.appendFileSync(LOG_FILE, logLine, { flag: 'a', encoding: 'utf-8' })
  } catch (err) {
    console.error('[logging] Failed to write to log file:', err)
  }
}

export const logger = {
  log(message: string, data?: any) {
    const logLine = formatLog('LOG', message, data)
    console.log(message, data || '')
    writeToFile(logLine)
  },
  
  error(message: string, error?: any) {
    const logLine = formatLog('ERROR', message, error)
    console.error(message, error || '')
    writeToFile(logLine)
  },
  
  warn(message: string, data?: any) {
    const logLine = formatLog('WARN', message, data)
    console.warn(message, data || '')
    writeToFile(logLine)
  },
  
  info(message: string, data?: any) {
    const logLine = formatLog('INFO', message, data)
    console.info(message, data || '')
    writeToFile(logLine)
  },
  
  debug(message: string, data?: any) {
    const logLine = formatLog('DEBUG', message, data)
    console.debug(message, data || '')
    writeToFile(logLine)
  },
}


