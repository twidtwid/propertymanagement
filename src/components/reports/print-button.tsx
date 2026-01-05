"use client"

import { useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Printer } from "lucide-react"

interface PrintButtonProps {
  className?: string
}

// Print styles embedded in iframe - Safari-compatible
const PRINT_STYLES = `
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    padding: 0.3in;
    color: black;
    background: white;
  }
  .print-header { margin-bottom: 12px; }
  .print-header h1 { font-size: 14pt; font-weight: 600; margin: 0; }
  .print-header p { font-size: 8pt; margin: 2px 0 0 0; color: #666; }
  table { width: 100%; border-collapse: collapse; font-size: 9pt; }
  th {
    font-size: 8pt; font-weight: 600; color: #666;
    text-transform: uppercase; text-align: left;
    padding: 4px 8px; border-bottom: 1px solid #ccc;
  }
  td { padding: 3px 8px; border-bottom: 0.5px solid #eee; vertical-align: top; }
  .category-header td {
    padding: 8px 8px 4px 0; border-bottom: 1px solid #999;
    font-size: 10pt;
  }
  .contact-name { font-size: 8pt; color: #666; }
  .specialty-text { font-size: 8pt; color: #888; }
  strong { font-weight: 500; }
  @page { margin: 0.3in; size: landscape; }
`

export function PrintButton({ className }: PrintButtonProps) {
  const handlePrint = useCallback(() => {
    // Get print content
    const printHeader = document.querySelector('.print-header')
    const printTable = document.querySelector('.print-table')

    if (!printTable) {
      // Fallback to regular print if no print-specific content
      window.print()
      return
    }

    // Create hidden iframe (react-to-print approach - works in Safari)
    const iframe = document.createElement('iframe')
    iframe.style.position = 'absolute'
    iframe.style.top = '-10000px'
    iframe.style.left = '-10000px'
    iframe.style.width = '0'
    iframe.style.height = '0'
    iframe.style.border = 'none'
    document.body.appendChild(iframe)

    const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document
    if (!iframeDoc) {
      document.body.removeChild(iframe)
      window.print()
      return
    }

    // Write content to iframe
    iframeDoc.open()
    iframeDoc.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Vendor Directory</title>
        <style>${PRINT_STYLES}</style>
      </head>
      <body>
        ${printHeader ? printHeader.outerHTML : ''}
        ${printTable.outerHTML}
      </body>
      </html>
    `)
    iframeDoc.close()

    // Print once iframe is ready
    const triggerPrint = () => {
      setTimeout(() => {
        iframe.contentWindow?.focus()
        iframe.contentWindow?.print()

        // Clean up after print dialog closes
        setTimeout(() => {
          if (iframe.parentNode) {
            document.body.removeChild(iframe)
          }
        }, 1000)
      }, 100)
    }

    // Use onload for browsers that support it, otherwise trigger immediately
    if (iframeDoc.readyState === 'complete') {
      triggerPrint()
    } else {
      iframe.onload = triggerPrint
    }
  }, [])

  return (
    <Button
      variant="outline"
      onClick={handlePrint}
      className={className}
    >
      <Printer className="h-4 w-4 mr-2" />
      Print / PDF
    </Button>
  )
}
