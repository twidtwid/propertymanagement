#!/usr/bin/env npx ts-node
/**
 * Santa Clara County Property Tax Lookup Script
 *
 * Usage:
 *   npx ts-node scripts/scrapers/scc-tax-lookup.ts --parcel 274-15-034
 *   npx ts-node scripts/scrapers/scc-tax-lookup.ts --parcel 274-15-034 --callback http://localhost:3000/api/taxes/sync/callback
 *
 * This script uses Playwright to scrape the Santa Clara County tax site
 * and optionally posts results to a callback URL.
 */

import { chromium, type Page } from 'playwright'

interface SCCTaxResult {
  success: boolean
  parcelNumber: string
  data?: {
    address: string
    taxYear: number
    annualTaxAmount: number
    installments: {
      number: 1 | 2
      amount: number
      dueDate: string
      status: 'paid' | 'unpaid' | 'delinquent'
      penaltyAmount?: number
    }[]
    assessedValue?: number
  }
  error?: string
  scrapedAt: string
}

const TAX_SITE_URL = 'https://payments.sccgov.org/propertytax'

async function lookupTax(parcelNumber: string): Promise<SCCTaxResult> {
  console.log(`[SCC Tax] Looking up parcel: ${parcelNumber}`)

  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()

  try {
    // Navigate to tax site
    console.log('[SCC Tax] Navigating to tax site...')
    await page.goto(TAX_SITE_URL, { waitUntil: 'networkidle', timeout: 60000 })

    // Wait for page to load
    await page.waitForTimeout(2000)

    // Look for parcel number input
    const parcelInput = await page.locator('input[name*="parcel"], input[id*="parcel"], input[placeholder*="parcel"]').first()

    if (await parcelInput.count() === 0) {
      // Try alternative: look for a search link
      const searchLink = await page.locator('a:has-text("Search"), a:has-text("Parcel")').first()
      if (await searchLink.count() > 0) {
        await searchLink.click()
        await page.waitForTimeout(2000)
      }
    }

    // Fill parcel number
    const input = await page.locator('input').first()
    await input.fill(parcelNumber)
    await page.screenshot({ path: '/tmp/scc_filled.png' })

    // Submit search
    const submitBtn = await page.locator('button[type="submit"], input[type="submit"], button:has-text("Search")').first()
    if (await submitBtn.count() > 0) {
      await submitBtn.click()
    } else {
      await input.press('Enter')
    }

    await page.waitForTimeout(3000)
    await page.screenshot({ path: '/tmp/scc_results.png' })

    // Extract tax data from page
    const pageText = await page.locator('body').innerText()

    // Parse results
    const result = parsePageContent(pageText, parcelNumber)

    await browser.close()

    return {
      success: result.success,
      parcelNumber,
      data: result.data,
      error: result.error,
      scrapedAt: new Date().toISOString(),
    }
  } catch (error) {
    await page.screenshot({ path: '/tmp/scc_error.png' })
    await browser.close()

    return {
      success: false,
      parcelNumber,
      error: error instanceof Error ? error.message : 'Unknown error',
      scrapedAt: new Date().toISOString(),
    }
  }
}

function parsePageContent(text: string, parcelNumber: string): {
  success: boolean
  data?: SCCTaxResult['data']
  error?: string
} {
  // Look for common patterns in tax bills
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean)

  let annualAmount: number | undefined
  let firstInstallment: number | undefined
  let secondInstallment: number | undefined
  let address: string | undefined

  for (const line of lines) {
    // Look for dollar amounts
    const amountMatch = line.match(/\$?([\d,]+\.?\d*)/g)
    if (amountMatch) {
      for (const match of amountMatch) {
        const amount = parseFloat(match.replace(/[$,]/g, ''))
        if (amount > 1000 && amount < 100000) {
          if (!annualAmount) {
            annualAmount = amount
          }
        }
      }
    }

    // Look for address
    if (line.toUpperCase().includes('DANA') && !address) {
      address = line
    }

    // Look for installment info
    if (line.toLowerCase().includes('1st') || line.toLowerCase().includes('first')) {
      const match = line.match(/\$?([\d,]+\.?\d*)/)
      if (match) {
        firstInstallment = parseFloat(match[1].replace(/,/g, ''))
      }
    }
    if (line.toLowerCase().includes('2nd') || line.toLowerCase().includes('second')) {
      const match = line.match(/\$?([\d,]+\.?\d*)/)
      if (match) {
        secondInstallment = parseFloat(match[1].replace(/,/g, ''))
      }
    }
  }

  if (!annualAmount && firstInstallment && secondInstallment) {
    annualAmount = firstInstallment + secondInstallment
  }

  if (annualAmount) {
    const half = annualAmount / 2
    const currentYear = new Date().getFullYear()

    return {
      success: true,
      data: {
        address: address || 'Unknown',
        taxYear: currentYear,
        annualTaxAmount: annualAmount,
        installments: [
          {
            number: 1,
            amount: firstInstallment || half,
            dueDate: `${currentYear}-12-10`,
            status: 'unpaid',
          },
          {
            number: 2,
            amount: secondInstallment || half,
            dueDate: `${currentYear + 1}-04-10`,
            status: 'unpaid',
          },
        ],
      },
    }
  }

  return {
    success: false,
    error: 'Could not parse tax information from page',
  }
}

async function postToCallback(url: string, result: SCCTaxResult): Promise<void> {
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        provider: 'santa_clara_county',
        ...result,
      }),
    })

    if (!response.ok) {
      console.error(`[SCC Tax] Callback failed: ${response.status}`)
    } else {
      console.log('[SCC Tax] Callback successful')
    }
  } catch (error) {
    console.error('[SCC Tax] Callback error:', error)
  }
}

// CLI entry point
async function main() {
  const args = process.argv.slice(2)
  const parcelIndex = args.indexOf('--parcel')
  const callbackIndex = args.indexOf('--callback')

  if (parcelIndex === -1 || !args[parcelIndex + 1]) {
    console.error('Usage: npx ts-node scc-tax-lookup.ts --parcel XXX-XX-XXX [--callback URL]')
    process.exit(1)
  }

  const parcelNumber = args[parcelIndex + 1]
  const callbackUrl = callbackIndex !== -1 ? args[callbackIndex + 1] : undefined

  const result = await lookupTax(parcelNumber)

  console.log('\n[SCC Tax] Result:')
  console.log(JSON.stringify(result, null, 2))

  if (callbackUrl) {
    await postToCallback(callbackUrl, result)
  }
}

main().catch(console.error)
