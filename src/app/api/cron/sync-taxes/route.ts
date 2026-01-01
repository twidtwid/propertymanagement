import { NextRequest, NextResponse } from 'next/server'
import { syncAllTaxes, getActiveTaxConfigs } from '@/lib/taxes/sync'

export const dynamic = 'force-dynamic'
export const maxDuration = 60 // 60 seconds max for serverless

/**
 * Weekly property tax sync endpoint
 *
 * Called by Vercel Cron or manually via:
 *   curl -X POST http://localhost:3000/api/cron/sync-taxes \
 *     -H "Authorization: Bearer YOUR_CRON_SECRET"
 *
 * Configure in vercel.json:
 *   {
 *     "crons": [{
 *       "path": "/api/cron/sync-taxes",
 *       "schedule": "0 6 * * 1"  // Every Monday at 6 AM
 *     }]
 *   }
 */
export async function GET(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  return runSync()
}

export async function POST(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  return runSync()
}

async function runSync() {
  console.log('[Tax Sync] Starting weekly tax sync...')

  try {
    const configs = await getActiveTaxConfigs()
    console.log(`[Tax Sync] Found ${configs.length} active configurations`)

    if (configs.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No active tax lookup configurations found',
        results: []
      })
    }

    const results = await syncAllTaxes()

    console.log(`[Tax Sync] Complete: ${results.successful}/${results.total} successful`)

    return NextResponse.json({
      success: true,
      syncedAt: new Date().toISOString(),
      summary: {
        total: results.total,
        successful: results.successful,
        failed: results.failed
      },
      results: results.results.map(r => ({
        property: r.propertyName,
        provider: r.provider,
        success: r.success,
        changesDetected: r.changesDetected,
        error: r.error
      }))
    })
  } catch (error) {
    console.error('[Tax Sync] Failed:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
