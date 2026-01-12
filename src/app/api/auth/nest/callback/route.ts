import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const code = searchParams.get('code')
  const error = searchParams.get('error')

  if (error) {
    return new Response(
      `
      <!DOCTYPE html>
      <html>
        <head><title>Nest OAuth Error</title></head>
        <body style="font-family: system-ui; padding: 40px; max-width: 600px; margin: 0 auto;">
          <h1>❌ Authorization Failed</h1>
          <p>Error: ${error}</p>
          <p>Please try again or contact support.</p>
        </body>
      </html>`,
      {
        headers: { 'Content-Type': 'text/html' },
      }
    )
  }

  if (!code) {
    return new Response('Missing authorization code', { status: 400 })
  }

  return new Response(
    `<!DOCTYPE html>
    <html>
      <head>
        <title>Nest Authorization</title>
        <style>
          body { font-family: system-ui; max-width: 600px; margin: 50px auto; padding: 20px; }
          code { background: #f4f4f4; padding: 2px 6px; border-radius: 3px; font-family: monospace; }
          .code-box { background: #f5f5f5; padding: 15px; border-radius: 8px; margin: 20px 0; overflow-wrap: break-word; }
        </style>
      </head>
      <body>
        <h1>✅ Authorization Successful!</h1>
        <p>Copy the code below and return to your terminal:</p>
        <div class="code-box">
          <code id="auth-code">${code}</code>
          <button onclick="navigator.clipboard.writeText('${code}').then(() => this.textContent = 'Copied!')">
            Copy Code
          </button>
        </div>
        <h3>Next step:</h3>
        <pre>node scripts/nest-token-exchange.js ${code}</pre>
      </body>
    </html>`,
    {
      headers: { 'Content-Type': 'text/html' },
    }
  )
}
