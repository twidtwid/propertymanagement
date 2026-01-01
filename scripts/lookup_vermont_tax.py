#!/usr/bin/env python3
"""
Vermont Property Tax Lookup via NEMRC (Dummerston) and AxisGIS (Brattleboro)

Usage:
    python3 scripts/lookup_vermont_tax.py
    python3 scripts/lookup_vermont_tax.py --address "2055 Sunset Lake"
    python3 scripts/lookup_vermont_tax.py --town brattleboro --parcel "081-025-11151"
    python3 scripts/lookup_vermont_tax.py --json

Looks up property tax for Vermont properties.
"""
import sys
import json
import re
import argparse
from datetime import datetime

sys.path.insert(0, '/Users/toddhome/Library/Python/3.12/lib/python/site-packages')

from playwright.sync_api import sync_playwright
import time

# Vermont towns and their database URLs
VERMONT_DATABASES = {
    'dummerston': {
        'name': 'Dummerston',
        'type': 'nemrc',
        'url': 'https://nemrc.info/web_data/vtdumm/searchT.php'
    },
    'brattleboro': {
        'name': 'Brattleboro',
        'type': 'axisgis',
        'url': 'https://www.axisgis.com/BrattleboroVT/'
    }
}

# Default property - Vermont Main House
DEFAULT_TOWN = 'dummerston'
DEFAULT_ADDRESS = '2055 Sunset Lake'


def lookup_dummerston_tax(address: str = DEFAULT_ADDRESS) -> dict:
    """Look up Dummerston VT property tax via NEMRC database."""

    result = {
        'success': False,
        'address': address,
        'municipality': 'Dummerston, VT',
        'scraped_at': datetime.now().isoformat()
    }

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            user_agent='Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
        )
        page = context.new_page()

        try:
            url = VERMONT_DATABASES['dummerston']['url']
            print(f"[VT Tax] Navigating to {url}...")
            page.goto(url, timeout=60000)
            time.sleep(2)

            # Parse address into number and street name
            addr_parts = address.split(' ', 1)
            street_num = addr_parts[0] if addr_parts[0].isdigit() else ''
            street_name = addr_parts[1] if len(addr_parts) > 1 else address

            # Fill search form - look for form inputs
            print(f"[VT Tax] Searching for: {address}")

            # Get all text inputs on the page
            inputs = page.locator('input[type="text"]')
            input_count = inputs.count()
            print(f"[VT Tax] Found {input_count} text inputs")

            # Fill in street number (usually first or second field after parcel)
            if street_num and input_count >= 3:
                # Field order: Parcel ID, Owner Name, Parcel Street #, Street Name
                num_input = inputs.nth(2)  # Third field is usually street number
                num_input.fill(street_num)

            if input_count >= 4:
                # Fourth field is street name
                name_input = inputs.nth(3)
                name_input.fill(street_name)

            # Submit search
            submit_btn = page.locator('input[type="submit"], button[type="submit"]').first
            submit_btn.click()
            time.sleep(3)

            page.screenshot(path='/tmp/vermont_tax_search.png')
            print("[VT Tax] Search results screenshot saved to /tmp/vermont_tax_search.png")

            # Get results page
            body_text = page.locator('body').inner_text()

            # Look for the specific property row in results table
            # Find rows that contain our street number
            rows = page.locator('tr')
            target_row = None

            for i in range(rows.count()):
                row_text = rows.nth(i).inner_text()
                # Look for the specific street number
                if street_num and street_num in row_text and street_name.upper()[:6] in row_text.upper():
                    print(f"[VT Tax] Found matching row: {row_text[:80]}...")
                    target_row = rows.nth(i)
                    break

            # Find and click the View Detail link
            if target_row:
                detail_link = target_row.locator('a').first
                if detail_link.count() > 0:
                    detail_link.click()
                    time.sleep(2)
                else:
                    print("[VT Tax] No link in matching row, trying first View Detail link")
                    page.locator('a:has-text("View Detail")').first.click()
                    time.sleep(2)
            else:
                # Fallback: try clicking first View Detail link
                property_links = page.locator('a:has-text("View Detail")')
                if property_links.count() > 0:
                    print(f"[VT Tax] Found {property_links.count()} View Detail links, clicking first")
                    property_links.first.click()
                    time.sleep(2)
                else:
                    print("[VT Tax] No View Detail links found")
                    result['error'] = 'No properties found matching search criteria'
                    browser.close()
                    return result

            # Now we should be on the detail page
            page.screenshot(path='/tmp/vermont_tax_result.png')
            print("[VT Tax] Property detail screenshot saved to /tmp/vermont_tax_result.png")

            detail_text = page.locator('body').inner_text()
            result = parse_nemrc_property(detail_text, address)
            result['scraped_at'] = datetime.now().isoformat()

            browser.close()
            return result

        except Exception as e:
            page.screenshot(path='/tmp/vermont_tax_error.png')
            browser.close()
            result['error'] = str(e)
            return result


def parse_nemrc_property(text: str, search_address: str) -> dict:
    """Parse property information from NEMRC detail page."""

    result = {
        'success': False,
        'address': search_address,
        'municipality': 'Dummerston, VT'
    }

    lines = text.split('\n')
    lines = [l.strip() for l in lines if l.strip()]

    # Look for SPAN number
    span_match = re.search(r'SPAN[:\s]+(\d{3}-\d{3}-\d{5})', text)
    if span_match:
        result['span_number'] = span_match.group(1)

    # Look for parcel ID
    parcel_match = re.search(r'Parcel ID[:\s]+([A-Z0-9\-]+)', text, re.IGNORECASE)
    if parcel_match:
        result['parcel_id'] = parcel_match.group(1)

    # Look for owner name
    owner_match = re.search(r'Owner[:\s]+([A-Z][A-Z\s,\.]+)', text)
    if owner_match:
        result['owner'] = owner_match.group(1).strip()

    # Look for address
    addr_match = re.search(r'Location[:\s]+(.+?)(?:\n|$)', text, re.IGNORECASE)
    if addr_match:
        result['full_address'] = addr_match.group(1).strip()

    # Look for assessed values
    land_match = re.search(r'Land[:\s]+\$?([\d,]+)', text)
    if land_match:
        result['land_value'] = float(land_match.group(1).replace(',', ''))

    building_match = re.search(r'Building[s]?[:\s]+\$?([\d,]+)', text)
    if building_match:
        result['building_value'] = float(building_match.group(1).replace(',', ''))

    total_match = re.search(r'Total[:\s]+\$?([\d,]+)', text)
    if total_match:
        result['total_assessed_value'] = float(total_match.group(1).replace(',', ''))

    # Look for tax amounts
    # Vermont taxes are typically semi-annual (Aug 15 and Feb 15)
    tax_match = re.search(r'Tax[:\s]+\$?([\d,]+\.?\d*)', text)
    if tax_match:
        result['annual_tax'] = float(tax_match.group(1).replace(',', ''))
        result['installments'] = [
            {'number': 1, 'amount': result['annual_tax'] / 2, 'due_date': '08/15', 'status': 'unknown'},
            {'number': 2, 'amount': result['annual_tax'] / 2, 'due_date': '02/15', 'status': 'unknown'}
        ]

    # Check if we found enough data
    if result.get('span_number') or result.get('parcel_id') or result.get('total_assessed_value'):
        result['success'] = True
        # Note: NEMRC shows assessed values, not tax amounts
        # Tax amounts need to be calculated from assessed value * tax rate
        # Or obtained from the town's grand list
        result['note'] = 'NEMRC shows assessed values only. Tax amounts require town tax rate.'
    else:
        result['error'] = 'Could not parse property information from results'

    return result


def lookup_brattleboro_tax(parcel: str, address: str = None) -> dict:
    """Look up Brattleboro VT property tax via AxisGIS."""

    result = {
        'success': False,
        'parcel_id': parcel,
        'municipality': 'Brattleboro, VT',
        'scraped_at': datetime.now().isoformat()
    }

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            user_agent='Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
        )
        page = context.new_page()

        try:
            url = VERMONT_DATABASES['brattleboro']['url']
            print(f"[VT Tax] Navigating to {url}...")
            page.goto(url, timeout=60000)

            # Wait for AxisGIS to fully load (it's a heavy JS app)
            print("[VT Tax] Waiting for AxisGIS to load...")
            time.sleep(8)

            # AxisGIS has a search icon in the toolbar - click it first
            print(f"[VT Tax] Looking for search interface...")

            # Try to find and click the search/find button in the toolbar
            search_btn = page.locator('[title*="Search"], [title*="Find"], .esri-search, button:has-text("Search")').first
            if search_btn.count() > 0:
                print("[VT Tax] Found search button, clicking...")
                search_btn.click()
                time.sleep(2)

            # Look for search input - AxisGIS uses various input types
            search_input = page.locator('input.esri-search__input, input[type="search"], input[placeholder*="Find"], input[placeholder*="Search"]').first

            if search_input.count() == 0:
                # Try broader selector
                search_input = page.locator('input[type="text"]').first

            if search_input.count() > 0:
                # Try address first if provided, then parcel
                search_term = address if address else parcel
                print(f"[VT Tax] Found search input, searching for: {search_term}")
                search_input.click()
                search_input.fill(search_term)
                time.sleep(2)

                # Look for autocomplete suggestions and click first one
                suggestions = page.locator('.esri-search__suggestions-list li, .autocomplete-suggestion, [role="option"]')
                if suggestions.count() > 0:
                    print(f"[VT Tax] Found {suggestions.count()} suggestions, clicking first...")
                    suggestions.first.click()
                    time.sleep(3)
                else:
                    # Just press enter
                    search_input.press('Enter')
                    time.sleep(5)
            else:
                print("[VT Tax] Could not find search input")

            page.screenshot(path='/tmp/brattleboro_tax_result.png')
            print("[VT Tax] Screenshot saved to /tmp/brattleboro_tax_result.png")

            # Try to get any property info panel that might have appeared
            body_text = page.locator('body').inner_text()

            # Check if we found anything related to the parcel
            parcel_normalized = parcel.replace('-', '')
            if parcel_normalized in body_text.replace('-', '').replace(' ', ''):
                result['success'] = True
                result['note'] = 'Parcel found in AxisGIS - see screenshot for details'

                # Try to extract values from popup/panel
                if 'Kelly' in body_text or 'KELLY' in body_text:
                    result['address_confirmed'] = True

                # Look for assessed value pattern
                value_match = re.search(r'(?:Total|Assessed|Value)[:\s]*\$?([\d,]+)', body_text)
                if value_match:
                    result['total_assessed_value'] = float(value_match.group(1).replace(',', ''))
            else:
                result['error'] = 'Could not find parcel in AxisGIS results'
                result['note'] = 'AxisGIS requires interactive map. Try: https://www.axisgis.com/BrattleboroVT/'

            browser.close()
            return result

        except Exception as e:
            page.screenshot(path='/tmp/brattleboro_tax_error.png')
            browser.close()
            result['error'] = str(e)
            return result


def post_to_callback(url: str, data: dict, town: str) -> bool:
    """Post results to callback URL."""
    import urllib.request

    payload = json.dumps({
        'provider': 'vermont_nemrc',
        'property_id': None,  # Will be matched by SPAN
        'parcel_number': data.get('span_number'),
        'address': data.get('full_address', data.get('address')),
        'tax_year': datetime.now().year,
        'assessed_value': data.get('total_assessed_value'),
        'annual_tax': data.get('annual_tax'),
        'owner': data.get('owner'),
        'success': data.get('success', False),
        'error': data.get('error'),
        'raw_data': {**data, 'town': town}
    }).encode('utf-8')

    req = urllib.request.Request(
        url,
        data=payload,
        headers={'Content-Type': 'application/json'}
    )

    try:
        with urllib.request.urlopen(req) as response:
            print(f"[VT Tax] Callback response: {response.status}")
            resp_body = response.read().decode('utf-8')
            print(f"[VT Tax] Response: {resp_body}")
            return response.status == 200
    except Exception as e:
        print(f"[VT Tax] Callback failed: {e}")
        return False


def main():
    parser = argparse.ArgumentParser(description='Vermont Property Tax Lookup')
    parser.add_argument('--town', default=DEFAULT_TOWN, choices=['dummerston', 'brattleboro'],
                        help='Town to search')
    parser.add_argument('--address', default=DEFAULT_ADDRESS, help='Property address to search')
    parser.add_argument('--parcel', help='Parcel ID (for Brattleboro)')
    parser.add_argument('--json', action='store_true', help='Output as JSON only')
    parser.add_argument('--callback', help='URL to POST results to')
    args = parser.parse_args()

    if args.town == 'brattleboro':
        if not args.parcel and not args.address:
            print("Error: Brattleboro requires --parcel or --address argument")
            return {'success': False, 'error': 'Parcel ID or address required for Brattleboro'}
        result = lookup_brattleboro_tax(args.parcel or '', args.address)
    else:
        result = lookup_dummerston_tax(args.address)

    if args.json:
        print(json.dumps(result, indent=2))
    else:
        print("\n" + "="*60)
        print(f"VERMONT PROPERTY TAX LOOKUP - {result.get('municipality', 'Unknown')}")
        print("="*60)

        if result.get('success'):
            print(f"\nAddress: {result.get('full_address', result.get('address'))}")
            print(f"SPAN: {result.get('span_number', 'N/A')}")
            print(f"Parcel ID: {result.get('parcel_id', 'N/A')}")
            print(f"Owner: {result.get('owner', 'N/A')}")

            if result.get('land_value'):
                print(f"\nLand Value: ${result.get('land_value'):,.2f}")
            if result.get('building_value'):
                print(f"Building Value: ${result.get('building_value'):,.2f}")
            if result.get('total_assessed_value'):
                print(f"Total Assessed: ${result.get('total_assessed_value'):,.2f}")

            if result.get('annual_tax'):
                print(f"\nAnnual Tax: ${result.get('annual_tax'):,.2f}")

            if result.get('installments'):
                print("\nInstallment Schedule:")
                for inst in result['installments']:
                    print(f"  #{inst['number']}: ${inst['amount']:,.2f} due {inst['due_date']}")
        else:
            print(f"\nError: {result.get('error', 'Unknown error')}")

        print(f"\nScraped: {result.get('scraped_at')}")
        print("="*60)

    if args.callback:
        print(f"\n[VT Tax] Posting to callback: {args.callback}")
        post_to_callback(args.callback, result, args.town)

    return result


if __name__ == "__main__":
    main()
