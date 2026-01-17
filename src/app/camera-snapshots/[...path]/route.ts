import { NextRequest, NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import { join } from 'path'
import { existsSync } from 'fs'

export const dynamic = 'force-dynamic'

/**
 * Serve camera snapshot files from the public directory.
 * This is needed because Next.js standalone mode doesn't serve /public automatically.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  try {
    const filePath = params.path.join('/')

    // Security: only allow .jpg files and prevent path traversal
    if (!filePath.endsWith('.jpg') || filePath.includes('..')) {
      return NextResponse.json({ error: 'Invalid path' }, { status: 400 })
    }

    const fullPath = join(process.cwd(), 'public', 'camera-snapshots', filePath)

    if (!existsSync(fullPath)) {
      return NextResponse.json({ error: 'Snapshot not found' }, { status: 404 })
    }

    const imageBuffer = await readFile(fullPath)

    return new NextResponse(imageBuffer, {
      headers: {
        'Content-Type': 'image/jpeg',
        'Cache-Control': 'public, max-age=60', // Cache for 1 minute
      },
    })
  } catch (error) {
    console.error('[Camera Snapshots] Error serving file:', error)
    return NextResponse.json({ error: 'Failed to serve snapshot' }, { status: 500 })
  }
}
