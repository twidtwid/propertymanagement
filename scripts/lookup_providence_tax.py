#!/usr/bin/env python3
"""
Providence RI Property Tax Lookup via City Hall Systems

Usage:
    python3 scripts/lookup_providence_tax.py
    python3 scripts/lookup_providence_tax.py --address "88 Williams St"
    python3 scripts/lookup_providence_tax.py --json

Looks up property tax for Providence, RI properties.
"""
import sys
import json
import re
import argparse
from datetime import datetime

sys.path.insert(0, '/Users/toddhome/Library/Python/3.12/lib/python/site-packages')

from playwright.sync_api import sync_playwright
import time

DEFAULT_ADDRESS = "88 Williams"
SITE_URL = "https://epay.cityhallsystems.com"


def lookup_providence_tax(address: str = DEFAULT_ADDRESS) -> dict:
    """Look up Providence RI property tax via City Hall Systems."""

    result = {
        'success': False,
        'address': address,
        'municipality': 'Providence, RI',
        'scraped_at': datetime.now().isoformat()
    }

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            user_agent='Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
        )
        page = context.new_page()

        try:
            print(f"[Providence Tax] Navigating to {SITE_URL}...")
            page.goto(SITE_URL, timeout=60000)
            time.sleep(2)

            # Select Providence, RI from municipality dropdown
            print("[Providence Tax] Selecting Providence, RI...")
            muni_input = page.locator('input[type="text"]').nth(1)
            muni_input.fill('Providence RI')
            time.sleep(1)
            muni_input.press('ArrowDown')
            muni_input.press('Enter')
            time.sleep(3)

            # Click View/Pay bills
            print("[Providence Tax] Clicking View/Pay bills...")
            btn = page.locator('button:has-text("View/Pay bills")').first
            btn.click()
            time.sleep(3)

            # Select Real Estate bill type
            print("[Providence Tax] Selecting Real Estate...")
            page.evaluate('selectionTypes("re")')
            time.sleep(3)

            # Search for address
            print(f"[Providence Tax] Searching for: {address}")
            search_input = page.locator('#form_for')
            search_input.fill(address)
            search_btn = page.locator('button:has-text("Search Bill")').first
            search_btn.click()
            time.sleep(3)

            # Get results page text
            body_text = page.locator('body').inner_text()

            # Parse results
            result = parse_providence_results(body_text, address)
            result['scraped_at'] = datetime.now().isoformat()

            page.screenshot(path='/tmp/providence_tax_result.png')
            print("[Providence Tax] Screenshot saved to /tmp/providence_tax_result.png")

            # Try to download the PDF bill
            try:
                pdf_link = page.locator('a:has-text("click here to view your bill")').first
                if pdf_link.count() > 0:
                    print("[Providence Tax] Found PDF link, downloading...")
                    with page.expect_download() as download_info:
                        pdf_link.click()
                    download = download_info.value
                    pdf_path = '/tmp/providence_tax_bill.pdf'
                    download.save_as(pdf_path)
                    result['pdf_downloaded'] = True
                    result['pdf_path'] = pdf_path
                    print(f"[Providence Tax] PDF saved to {pdf_path}")
            except Exception as pdf_error:
                print(f"[Providence Tax] Could not download PDF: {pdf_error}")

            browser.close()
            return result

        except Exception as e:
            page.screenshot(path='/tmp/providence_tax_error.png')
            browser.close()
            result['error'] = str(e)
            return result


def parse_providence_results(text: str, search_address: str) -> dict:
    """Parse tax information from City Hall Systems results page."""

    lines = text.split('\n')
    lines = [l.strip() for l in lines if l.strip()]

    result = {
        'success': False,
        'address': search_address,
        'municipality': 'Providence, RI'
    }

    # Look for parcel number pattern: XXX-XXXX-XXXX
    parcel_match = re.search(r'(\d{3}-\d{4}-\d{4})', text)
    if parcel_match:
        result['parcel_number'] = parcel_match.group(1)

    # Look for address in results
    addr_match = re.search(r'(\d{3}-\d{4}-\d{4})\s+(.+?(?:ST|AVE|RD|DR|LN|CT|PL|WAY)),?\s*PROVIDENCE', text, re.IGNORECASE)
    if addr_match:
        result['full_address'] = addr_match.group(2).strip() + ', Providence'

    # Look for owner name (usually after parcel on same line or line before address)
    owner_match = re.search(r'(\d{4})\s+\d+\s+([A-Z][A-Z\s]+)\s+\d{3}-\d{4}', text)
    if owner_match:
        result['owner'] = owner_match.group(2).strip()
    else:
        # Try another pattern
        for i, line in enumerate(lines):
            if 'SPALTER' in line.upper() or re.match(r'^[A-Z\s]+$', line) and len(line) > 5:
                if any(c.isdigit() for c in lines[i-1] if i > 0) or any(c.isdigit() for c in lines[i+1] if i < len(lines)-1):
                    result['owner'] = line.strip()
                    break

    # Look for due date and amount patterns
    # Pattern: "Due MM/DD/YYYY: $ X,XXX.XX"
    due_matches = re.findall(r'Due\s+(\d{2}/\d{2}/\d{4}):\s*\$\s*([\d,]+\.\d{2})', text)
    if due_matches:
        result['next_due_date'] = due_matches[0][0]
        result['next_due_amount'] = float(due_matches[0][1].replace(',', ''))

    # Look for full balance (remaining balance, not annual)
    balance_match = re.search(r'Full Balance:\s*\$\s*([\d,]+\.\d{2})', text)
    if balance_match:
        result['remaining_balance'] = float(balance_match.group(1).replace(',', ''))

    # Look for year
    year_match = re.search(r'\b(202[4-9])\b.*TAX', text)
    if year_match:
        result['tax_year'] = int(year_match.group(1))
    else:
        result['tax_year'] = datetime.now().year

    # The quarterly amount is in the "Due" line, use that as the authoritative amount
    if result.get('next_due_amount'):
        result['quarterly_amount'] = result['next_due_amount']
        result['annual_tax'] = result['quarterly_amount'] * 4

        # Generate installment schedule
        year = result.get('tax_year', datetime.now().year)
        quarterly = result['quarterly_amount']
        result['installments'] = [
            {'number': 1, 'amount': quarterly, 'due_date': f'07/24/{year}', 'status': 'unknown'},
            {'number': 2, 'amount': quarterly, 'due_date': f'10/24/{year}', 'status': 'unknown'},
            {'number': 3, 'amount': quarterly, 'due_date': f'01/24/{year+1}', 'status': 'unknown'},
            {'number': 4, 'amount': quarterly, 'due_date': f'04/24/{year+1}', 'status': 'unknown'},
        ]

    # Check if we found enough data
    if result.get('parcel_number') or result.get('full_balance'):
        result['success'] = True
    else:
        result['error'] = 'Could not parse tax information from results'

    return result


def post_to_callback(url: str, data: dict) -> bool:
    """Post results to callback URL."""
    import urllib.request

    # Format installments for the callback
    installments = []
    for inst in data.get('installments', []):
        installments.append({
            'installment_number': inst.get('number'),
            'amount': inst.get('amount'),
            'due_date': inst.get('due_date'),
            'status': inst.get('status', 'unknown')
        })

    payload = json.dumps({
        'provider': 'city_hall_systems',
        'property_id': None,  # Will be matched by parcel number or address
        'parcel_number': data.get('parcel_number'),
        'address': data.get('full_address', data.get('address')),
        'tax_year': data.get('tax_year'),
        'assessed_value': data.get('total_assessed_value'),
        'annual_tax': data.get('annual_tax'),
        'quarterly_amount': data.get('quarterly_amount'),
        'owner': data.get('owner'),
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
            print(f"[Providence Tax] Callback response: {response.status}")
            resp_body = response.read().decode('utf-8')
            print(f"[Providence Tax] Response: {resp_body}")
            return response.status == 200
    except Exception as e:
        print(f"[Providence Tax] Callback failed: {e}")
        return False


def main():
    parser = argparse.ArgumentParser(description='Providence RI Property Tax Lookup')
    parser.add_argument('--address', default=DEFAULT_ADDRESS, help='Property address to search')
    parser.add_argument('--json', action='store_true', help='Output as JSON only')
    parser.add_argument('--callback', help='URL to POST results to')
    args = parser.parse_args()

    result = lookup_providence_tax(args.address)

    if args.json:
        print(json.dumps(result, indent=2))
    else:
        print("\n" + "="*60)
        print("PROVIDENCE RI PROPERTY TAX LOOKUP")
        print("="*60)

        if result.get('success'):
            print(f"\nAddress: {result.get('full_address', result.get('address'))}")
            print(f"Parcel: {result.get('parcel_number', 'N/A')}")
            print(f"Owner: {result.get('owner', 'N/A')}")
            print(f"Tax Year: {result.get('tax_year', 'N/A')}")
            print(f"\nAnnual Tax: ${result.get('annual_tax', 0):,.2f}")
            print(f"Quarterly: ${result.get('quarterly_amount', 0):,.2f}")

            if result.get('next_due_date'):
                print(f"\nNext Due: {result.get('next_due_date')} - ${result.get('next_due_amount', 0):,.2f}")

            if result.get('installments'):
                print("\nInstallment Schedule:")
                for inst in result['installments']:
                    print(f"  Q{inst['number']}: ${inst['amount']:,.2f} due {inst['due_date']}")
        else:
            print(f"\nError: {result.get('error', 'Unknown error')}")

        print(f"\nScraped: {result.get('scraped_at')}")
        print("="*60)

    if args.callback:
        print(f"\n[Providence Tax] Posting to callback: {args.callback}")
        post_to_callback(args.callback, result)

    return result


if __name__ == "__main__":
    main()
