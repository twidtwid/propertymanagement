#!/usr/bin/env node

/**
 * Capture snapshot from Nest WebRTC camera using Playwright
 *
 * Usage: node scripts/capture-nest-snapshot.js <cameraId> [outputPath]
 *
 * This script:
 * 1. Opens a headless browser
 * 2. Establishes WebRTC connection to the Nest camera
 * 3. Waits for video frames
 * 4. Captures a frame to canvas
 * 5. Saves as JPEG
 */

// Use Chrome instead of Chromium for H264 codec support (required by Nest WebRTC)
const playwright = require('playwright')
const { chromium } = playwright
const { writeFileSync } = require('fs')
const path = require('path')

const CAMERA_ID = process.argv[2]
const OUTPUT_PATH = process.argv[3] || path.join(process.cwd(), 'public', 'camera-snapshots', `${CAMERA_ID}.jpg`)
const APP_URL = process.env.APP_URL || 'http://localhost:3000'
const CRON_SECRET = process.env.CRON_SECRET
const TIMEOUT = 60000 // 60 seconds max

if (!CAMERA_ID) {
  console.error('Usage: node scripts/capture-nest-snapshot.js <cameraId> [outputPath]')
  process.exit(1)
}

if (!CRON_SECRET) {
  console.error('CRON_SECRET environment variable required')
  process.exit(1)
}

// Capture URL - served by the app to avoid CORS issues
const CAPTURE_URL = `${APP_URL}/api/cameras/capture-frame?cameraId=${CAMERA_ID}`

async function captureNestSnapshot() {
  // Set HOME to temp if not writable (Docker permission issue)
  if (!process.env.HOME || !require('fs').existsSync(process.env.HOME)) {
    process.env.HOME = '/tmp'
  }

  console.log(`[Nest Snapshot] Capturing camera ${CAMERA_ID}`)
  console.log(`[Nest Snapshot] App URL: ${APP_URL}`)
  console.log(`[Nest Snapshot] Output: ${OUTPUT_PATH}`)

  // Try Chrome first (has H264 codec for Nest WebRTC), fall back to Chromium
  // Chrome not available on Arm64, so dev uses Chromium and may fail for Modern Nest
  let browser
  const browserArgs = [
    '--use-fake-ui-for-media-stream', // Auto-allow media
    '--use-fake-device-for-media-stream',
    '--autoplay-policy=no-user-gesture-required',
    '--no-sandbox', // Required for Docker
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage', // Overcome limited resource problems
    '--disable-gpu', // Disable GPU
    '--disable-crash-reporter', // Avoid crash handler permission issues
    '--disable-crashpad', // Disable crashpad (alternative)
    '--no-first-run', // Skip first run setup
    '--disable-features=Crashpad', // Ensure crashpad is disabled
  ]

  try {
    // Try Chrome first (has H264 support required by Nest)
    browser = await chromium.launch({
      headless: true,
      channel: 'chrome',
      args: browserArgs
    })
    console.log('[Nest Snapshot] Using Chrome via Playwright channel (H264 supported)')
  } catch (chromeError) {
    // Try system Chrome (installed via npx playwright install chrome)
    try {
      browser = await chromium.launch({
        headless: true,
        executablePath: '/usr/bin/google-chrome',
        args: browserArgs
      })
      console.log('[Nest Snapshot] Using system Chrome at /usr/bin/google-chrome (H264 supported)')
    } catch (systemChromeError) {
      // Fall back to Chromium (may fail for Nest due to missing H264)
      console.log('[Nest Snapshot] System Chrome failed:', systemChromeError.message)
      console.log('[Nest Snapshot] Falling back to Chromium (H264 not supported)')
      browser = await chromium.launch({
        headless: true,
        args: browserArgs
      })
    }
  }

  try {
    const context = await browser.newContext({
      permissions: ['camera', 'microphone'],
      ignoreHTTPSErrors: true,
      extraHTTPHeaders: {
        'Authorization': `Bearer ${CRON_SECRET}`
      }
    })

    const page = await context.newPage()

    // Capture console logs
    page.on('console', msg => console.log('[Browser]', msg.text()))
    page.on('pageerror', err => console.error('[Browser Error]', err.message))

    // Navigate to the capture page (served by app to avoid CORS)
    console.log(`[Nest Snapshot] Navigating to ${CAPTURE_URL}`)
    await page.goto(CAPTURE_URL, { timeout: 30000 })

    console.log('[Nest Snapshot] Waiting for WebRTC stream...')

    // Wait for snapshot to be ready
    await page.waitForFunction(
      () => window.snapshotReady === true,
      { timeout: TIMEOUT }
    )

    // Check for error
    const error = await page.evaluate(() => window.snapshotError)
    if (error) {
      throw new Error(error)
    }

    // Get the captured data
    const dataUrl = await page.evaluate(() => window.snapshotData)

    if (!dataUrl) {
      throw new Error('No snapshot data captured')
    }

    // Convert base64 to buffer
    const base64Data = dataUrl.replace(/^data:image\/jpeg;base64,/, '')
    const imageBuffer = Buffer.from(base64Data, 'base64')

    console.log(`[Nest Snapshot] Captured ${imageBuffer.length} bytes`)

    // Save to file
    writeFileSync(OUTPUT_PATH, imageBuffer)
    console.log(`[Nest Snapshot] Saved to ${OUTPUT_PATH}`)

    // Output for caller
    console.log(JSON.stringify({
      success: true,
      cameraId: CAMERA_ID,
      outputPath: OUTPUT_PATH,
      size: imageBuffer.length,
      timestamp: new Date().toISOString()
    }))

  } catch (error) {
    console.error(`[Nest Snapshot] Error: ${error.message}`)
    console.log(JSON.stringify({
      success: false,
      cameraId: CAMERA_ID,
      error: error.message
    }))
    process.exit(1)
  } finally {
    await browser.close()
  }
}

captureNestSnapshot()
