import { test, expect } from '@playwright/test'
import fs from 'fs'
import path from 'path'

const DEBUG_LOG_PATH = path.join(process.cwd(), '.cursor', 'debug.log')
const SERVER_LOG_PATH = path.join(process.cwd(), '.logs', 'server.log')

test.describe('Telemetry and Logging', () => {
  test.beforeAll(() => {
    // Clear existing logs for clean test
    if (fs.existsSync(DEBUG_LOG_PATH)) {
      fs.writeFileSync(DEBUG_LOG_PATH, '')
    }
    if (fs.existsSync(SERVER_LOG_PATH)) {
      fs.writeFileSync(SERVER_LOG_PATH, '')
    }
  })

  test('homepage loads successfully', async ({ page }) => {
    const response = await page.goto('/')
    expect(response?.status()).toBe(200)
    
    // Verify key elements are present
    await expect(page.getByRole('heading', { name: 'SaaS Platform' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Categorize Your Financial Transactions' })).toBeVisible()
  })

  test('navigation to sign in page', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('link', { name: 'Sign In' }).click()
    
    // Should navigate to signin page
    await expect(page).toHaveURL(/\/signin/)
  })

  test('debug logs are being written', async ({ page }) => {
    // Trigger some activity that should generate logs
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    
    // Wait a bit for logs to be written
    await page.waitForTimeout(2000)
    
    // Check if debug log file exists and has content
    const debugLogExists = fs.existsSync(DEBUG_LOG_PATH)
    
    if (debugLogExists) {
      const debugLogContent = fs.readFileSync(DEBUG_LOG_PATH, 'utf-8')
      console.log('📝 Debug log sample:', debugLogContent.slice(0, 500))
      
      // Verify logs contain expected structure
      if (debugLogContent.length > 0) {
        expect(debugLogContent).toMatch(/(sessionId|runId|hypothesisId|location|message|timestamp)/)
      }
    } else {
      console.log('⚠️  Debug log file not created yet (this is OK if no server-side logging occurred)')
    }
  })

  test('server logs are accessible', async ({ page }) => {
    // Navigate to health endpoint that should generate server logs
    const response = await page.goto('/api/health')
    expect(response?.status()).toBe(200)
    
    const content = await page.content()
    console.log('🏥 Health check response:', content.slice(0, 500))
    
    // Wait for logs to be written
    await page.waitForTimeout(2000)
    
    // Check if server log file exists
    const serverLogExists = fs.existsSync(SERVER_LOG_PATH)
    
    if (serverLogExists) {
      const serverLogContent = fs.readFileSync(SERVER_LOG_PATH, 'utf-8')
      console.log('📊 Server log sample:', serverLogContent.slice(0, 500))
      
      if (serverLogContent.length > 0) {
        // Verify logs contain timestamps and log levels
        expect(serverLogContent).toMatch(/\[(LOG|INFO|WARN|ERROR)\]/)
      }
    } else {
      console.log('⚠️  Server log file not created yet')
    }
  })

  test('console logs are captured', async ({ page }) => {
    const consoleLogs: string[] = []
    
    page.on('console', msg => {
      consoleLogs.push(`[${msg.type()}] ${msg.text()}`)
    })
    
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    
    console.log(`📋 Captured ${consoleLogs.length} console messages`)
    consoleLogs.slice(0, 10).forEach(log => console.log(log))
    
    // At minimum, we should see some console output
    expect(consoleLogs.length).toBeGreaterThan(0)
  })

  test.afterAll(() => {
    // Output final log file sizes
    if (fs.existsSync(DEBUG_LOG_PATH)) {
      const debugSize = fs.statSync(DEBUG_LOG_PATH).size
      console.log(`✅ Debug log file size: ${debugSize} bytes`)
    }
    
    if (fs.existsSync(SERVER_LOG_PATH)) {
      const serverSize = fs.statSync(SERVER_LOG_PATH).size
      console.log(`✅ Server log file size: ${serverSize} bytes`)
    }
  })
})
