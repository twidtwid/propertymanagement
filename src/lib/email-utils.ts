/**
 * Sanitizes HTML from vendor emails to prevent style bleeding into the page.
 * Removes <style>, <link> tags and inline styles that could affect the page layout.
 */
export function sanitizeEmailHtml(html: string): string {
  if (!html) return ''

  // Remove <style> tags and their content
  let sanitized = html.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')

  // Remove <link> tags (especially stylesheet links)
  sanitized = sanitized.replace(/<link[^>]*>/gi, '')

  // Remove inline style attributes
  sanitized = sanitized.replace(/\s*style\s*=\s*["'][^"']*["']/gi, '')

  // Remove class attributes to prevent external CSS interference
  sanitized = sanitized.replace(/\s*class\s*=\s*["'][^"']*["']/gi, '')

  // Remove script tags for security
  sanitized = sanitized.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')

  // Remove onclick and other event handlers
  sanitized = sanitized.replace(/\s*on\w+\s*=\s*["'][^"']*["']/gi, '')

  return sanitized
}
