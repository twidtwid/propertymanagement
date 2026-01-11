#!/usr/bin/env -S uv run python
"""
Santa Clara County Property Tax Lookup using Playwright

Usage:
    python3 scripts/lookup_scc_tax.py
    python3 scripts/lookup_scc_tax.py --callback http://localhost:3000/api/taxes/sync/callback

Looks up property tax for 125 Dana Ave, San Jose and optionally posts results to callback URL.
"""
import sys
import json
import re
import argparse
from datetime import datetime

# Add playwright to path if needed
sys.path.insert(0, '/Users/toddhome/Library/Python/3.12/lib/python/site-packages')

from playwright.sync_api import sync_playwright
import time

PROPERTY_ADDRESS = "125 DANA AV SAN JOSE"
PARCEL_NUMBER = "274-15-034"
TAX_SITE_URL = "https://payments.sccgov.org/propertytax"

def parse_tax_data(text: str) -> dict:
    """Parse tax information from page text."""
    lines = text.split('\n')
    lines = [l.strip() for l in lines if l.strip()]

    result = {
        'success': True,
        'parcel_number': PARCEL_NUMBER,
        'address': PROPERTY_ADDRESS,
        'tax_years': [],
        'scraped_at': datetime.now().isoformat()
    }

    current_year = None
    current_installment = None
    installments = []

    i = 0
    while i < len(lines):
        line = lines[i]

        # Detect tax year header (e.g., "2025/2026 Annual Tax Bill")
        year_match = re.match(r'(\d{4}/\d{4}) Annual Tax Bill', line)
        if year_match:
            # Save previous year's data if exists
            if current_year and installments:
                result['tax_years'].append({
                    'tax_year': current_year,
                    'installments': installments
                })
            current_year = year_match.group(1)
            installments = []
            i += 1
            continue

        # Detect installment header
        if line.startswith('Installment 1') or line.startswith('Installment 2'):
            current_installment = {
                'number': 1 if 'Installment 1' in line else 2,
                'tax_year': current_year
            }
            i += 1
            continue

        # Parse installment details
        if current_installment:
            if line == 'Tax Amount' and i + 1 < len(lines):
                amount_str = lines[i + 1].replace('$', '').replace(',', '')
                try:
                    current_installment['amount'] = float(amount_str)
                except:
                    pass
                i += 2
                continue

            if line == 'Additional Charges' and i + 1 < len(lines):
                charges_str = lines[i + 1].replace('$', '').replace(',', '')
                try:
                    current_installment['additional_charges'] = float(charges_str)
                except:
                    pass
                i += 2
                continue

            if line == 'Balance Due' and i + 1 < len(lines):
                balance_str = lines[i + 1].replace('$', '').replace(',', '')
                try:
                    current_installment['balance_due'] = float(balance_str)
                except:
                    pass
                i += 2
                continue

            if line == 'Pay By Date' and i + 1 < len(lines):
                current_installment['due_date'] = lines[i + 1]
                i += 2
                continue

            if line == 'Status' and i + 1 < len(lines):
                status = lines[i + 1].upper()
                current_installment['status'] = 'paid' if status == 'PAID' else 'unpaid'
                i += 2
                continue

            if line == 'Last Payment Date' and i + 1 < len(lines):
                payment_date = lines[i + 1]
                if payment_date != 'N/A':
                    current_installment['payment_date'] = payment_date

                # This marks the end of an installment block
                if current_installment.get('amount'):
                    installments.append(current_installment.copy())
                current_installment = {'number': current_installment.get('number', 0) + 1}
                i += 2
                continue

        i += 1

    # Don't forget the last year
    if current_year and installments:
        result['tax_years'].append({
            'tax_year': current_year,
            'installments': installments
        })

    return result


def lookup_property_tax() -> dict:
    """Scrape Santa Clara County tax site for property tax info."""

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        # Use a real browser user agent to avoid Cloudflare blocks
        context = browser.new_context(
            user_agent='Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        )
        page = context.new_page()

        try:
            print(f"[SCC Tax] Navigating to {TAX_SITE_URL}...")
            page.goto(TAX_SITE_URL, timeout=60000)
            page.wait_for_load_state("networkidle", timeout=30000)
            time.sleep(3)

            print(f"[SCC Tax] Page title: {page.title()}")
            print(f"[SCC Tax] URL: {page.url}")

            # Click on "Secured Property Tax" to get to search page
            secured_link = page.locator('a[href="/search/1"]').first
            if secured_link.count() > 0:
                print("[SCC Tax] Clicking on Secured Property Tax link...")
                secured_link.click()
                time.sleep(3)
                page.wait_for_load_state("networkidle", timeout=30000)

            print(f"[SCC Tax] Current URL: {page.url}")
            print(f"[SCC Tax] Page title: {page.title()}")

            # Find the address input - try different selectors
            print(f"[SCC Tax] Searching for: {PROPERTY_ADDRESS}")
            address_input = None
            for selector in ["#mat-input-1", "#mat-input-0", "input[type='text']", "input"]:
                try:
                    inp = page.locator(selector).first
                    if inp.count() > 0:
                        address_input = inp
                        print(f"[SCC Tax] Found input with selector: {selector}")
                        break
                except:
                    continue

            if not address_input:
                raise Exception("Could not find address input field")

            address_input.fill(PROPERTY_ADDRESS)
            time.sleep(1)

            # Submit search
            try:
                search_btn = page.locator("button.mat-mdc-icon-button, button[type='submit']").first
                search_btn.click()
            except:
                address_input.press("Enter")

            time.sleep(3)
            page.wait_for_load_state("networkidle", timeout=30000)

            # Get page text
            body_text = page.locator("body").inner_text()

            # Check if we found the property
            if "125 DANA" not in body_text.upper():
                browser.close()
                return {
                    'success': False,
                    'error': 'Property not found in search results',
                    'scraped_at': datetime.now().isoformat()
                }

            # Parse the tax data
            result = parse_tax_data(body_text)

            # Take screenshot for debugging
            page.screenshot(path="/tmp/scc_tax_result.png")
            print("[SCC Tax] Screenshot saved to /tmp/scc_tax_result.png")

            browser.close()
            return result

        except Exception as e:
            page.screenshot(path="/tmp/scc_tax_error.png")
            browser.close()
            return {
                'success': False,
                'error': str(e),
                'scraped_at': datetime.now().isoformat()
            }


def post_to_callback(url: str, data: dict) -> bool:
    """Post results to callback URL."""
    import urllib.request

    # Format installments for the callback
    installments = []
    for year_data in data.get('tax_years', []):
        for inst in year_data.get('installments', []):
            installments.append({
                'installment_number': inst.get('number'),
                'amount': inst.get('amount'),
                'due_date': inst.get('due_date'),
                'status': inst.get('status', 'unknown')
            })

    # Calculate total annual tax
    annual_tax = sum(inst.get('amount', 0) for inst in installments[:2])  # First 2 installments = 1 year

    payload = json.dumps({
        'provider': 'santa_clara_county',
        'property_id': None,  # Will be matched by parcel number
        'parcel_number': PARCEL_NUMBER,
        'address': PROPERTY_ADDRESS,
        'tax_year': int(data.get('tax_years', [{}])[0].get('tax_year', '2025/2026').split('/')[0]) if data.get('tax_years') else datetime.now().year,
        'annual_tax': annual_tax,
        'installments': installments,
        'success': data.get('success', False),
        'error': data.get('error'),
        'raw_data': data
    }).encode('utf-8')

    req = urllib.request.Request(
        url,
        data=payload,
        headers={'Content-Type': 'application/json'}
    )

    try:
        with urllib.request.urlopen(req) as response:
            print(f"[SCC Tax] Callback response: {response.status}")
            resp_body = response.read().decode('utf-8')
            print(f"[SCC Tax] Response: {resp_body}")
            return response.status == 200
    except Exception as e:
        print(f"[SCC Tax] Callback failed: {e}")
        return False


def main():
    parser = argparse.ArgumentParser(description='Santa Clara County Property Tax Lookup')
    parser.add_argument('--callback', help='URL to POST results to')
    parser.add_argument('--json', action='store_true', help='Output as JSON only')
    args = parser.parse_args()

    result = lookup_property_tax()

    if args.json:
        print(json.dumps(result, indent=2))
    else:
        print("\n" + "="*60)
        print("SANTA CLARA COUNTY PROPERTY TAX LOOKUP")
        print("="*60)

        if result.get('success'):
            print(f"\nProperty: {result.get('address')}")
            print(f"Parcel: {result.get('parcel_number')}")
            print(f"Scraped: {result.get('scraped_at')}")

            for year_data in result.get('tax_years', []):
                print(f"\n--- {year_data['tax_year']} ---")
                for inst in year_data.get('installments', []):
                    status_icon = "✅" if inst.get('status') == 'paid' else "⏳"
                    print(f"  Installment {inst.get('number')}: ${inst.get('amount', 0):,.2f}")
                    print(f"    Due: {inst.get('due_date', 'N/A')}")
                    print(f"    Status: {status_icon} {inst.get('status', 'unknown').upper()}")
                    if inst.get('balance_due', 0) > 0:
                        print(f"    Balance Due: ${inst.get('balance_due'):,.2f}")
                    if inst.get('payment_date'):
                        print(f"    Paid: {inst.get('payment_date')}")
        else:
            print(f"\nError: {result.get('error')}")

        print("\n" + "="*60)

    if args.callback:
        print(f"\n[SCC Tax] Posting to callback: {args.callback}")
        post_to_callback(args.callback, result)

    return result


if __name__ == "__main__":
    main()
