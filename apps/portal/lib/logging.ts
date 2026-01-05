import fs from 'fs'
import path from 'path'

const LOG_DIR = path.join(process.cwd(), '.logs')
const LOG_FILE = path.join(LOG_DIR, 'server.log')

// Ensure log directory exists
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true })
}

function formatLog(level: string, message: string, data?: any): string {
  const timestamp = new Date().toISOString()
  const dataStr = data ? ` ${JSON.stringify(data)}` : ''
  return `[${timestamp}] [${level}] ${message}${dataStr}\n`
}

export const logger = {
  log(message: string, data?: any) {
    const logLine = formatLog('LOG', message, data)
    console.log(message, data || '')
    fs.appendFileSync(LOG_FILE, logLine)
  },
  
  error(message: string, error?: any) {
    const logLine = formatLog('ERROR', message, error)
    console.error(message, error || '')
    fs.appendFileSync(LOG_FILE, logLine)
  },
  
  warn(message: string, data?: any) {
    const logLine = formatLog('WARN', message, data)
    console.warn(message, data || '')
    fs.appendFileSync(LOG_FILE, logLine)
  },
  
  info(message: string, data?: any) {
    const logLine = formatLog('INFO', message, data)
    console.info(message, data || '')
    fs.appendFileSync(LOG_FILE, logLine)
  },
}


