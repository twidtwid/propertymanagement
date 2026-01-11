#!/usr/bin/env -S uv run python
"""
NYC Property Tax Lookup via Property Information Portal

Usage:
    python3 scripts/lookup_nyc_tax.py --boro 3 --block 2324 --lot 1305
    python3 scripts/lookup_nyc_tax.py --boro 3 --block 2324 --lot 1306
    python3 scripts/lookup_nyc_tax.py --json

Looks up actual property tax bills from NYC Finance portal.
Borough codes: 1=Manhattan, 2=Bronx, 3=Brooklyn, 4=Queens, 5=Staten Island
"""
import sys
import json
import re
import argparse
from datetime import datetime

sys.path.insert(0, '/Users/toddhome/Library/Python/3.12/lib/python/site-packages')

from playwright.sync_api import sync_playwright
import time

PORTAL_URL = "https://a836-pts-access.nyc.gov/care/search/commonsearch.aspx?mode=persprop"
DATALET_URL = "https://a836-pts-access.nyc.gov/care/datalets/datalet.aspx"

BOROUGHS = {
    '1': 'Manhattan',
    '2': 'Bronx',
    '3': 'Brooklyn',
    '4': 'Queens',
    '5': 'Staten Island'
}


def format_pin(boro: str, block: str, lot: str) -> str:
    """Format BBL into NYC PIN format: Borough(1) + Block(5) + Lot(4)."""
    return f"{boro}{block.zfill(5)}{lot.zfill(4)}"


def lookup_nyc_tax(boro: str, block: str, lot: str) -> dict:
    """Look up NYC property tax via NYC Finance PTS Access portal.

    Uses the Payment History page which shows actual amounts paid by tax year.
    """

    pin = format_pin(boro, block, lot)
    result = {
        'success': False,
        'boro': boro,
        'block': block,
        'lot': lot,
        'pin': pin,
        'borough_name': BOROUGHS.get(boro, 'Unknown'),
        'scraped_at': datetime.now().isoformat()
    }

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            user_agent='Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
        )
        page = context.new_page()

        try:
            # Go to Payment History page which shows actual amounts paid
            payment_url = f"{DATALET_URL}?mode=pa_pymts_hist&UseSearch=no&pin={pin}&jur=65&taxyr=2026&LMparent=20"
            print(f"[NYC Tax] Navigating to Payment History: {payment_url}...")
            page.goto(payment_url, timeout=60000)
            time.sleep(3)

            page.wait_for_load_state('networkidle', timeout=30000)
            page.screenshot(path='/tmp/nyc_tax_1_payments.png')
            print("[NYC Tax] Screenshot saved: /tmp/nyc_tax_1_payments.png")

            # Get page content
            body_text = page.locator('body').inner_text()
            html_content = page.content()

            # Save HTML for debugging
            with open('/tmp/nyc_tax_page.html', 'w') as f:
                f.write(html_content)
            print("[NYC Tax] HTML saved to /tmp/nyc_tax_page.html")

            # Extract address from header
            addr_match = re.search(r'(\d+\s+[A-Z0-9\s#]+STREET[^,\n]*)', body_text, re.IGNORECASE)
            if addr_match:
                result['address'] = addr_match.group(1).strip()

            # Parse payment history table
            # Format: Credited Date | Activity Date | Amount | Year
            payments = []

            # Look for dollar amounts with year context
            # Pattern: date | date | -$amount | year
            payment_pattern = r'(\d{2}/\d{2}/\d{4})\s+(\d{2}/\d{2}/\d{4})\s+-\$?([\d,]+\.?\d*)\s+(\d{4})'
            matches = re.findall(payment_pattern, body_text)

            for match in matches:
                credited_date, activity_date, amount_str, year = match
                try:
                    amount = float(amount_str.replace(',', ''))
                    if amount > 0:
                        payments.append({
                            'credited_date': credited_date,
                            'activity_date': activity_date,
                            'amount': amount,
                            'tax_year': int(year)
                        })
                        print(f"[NYC Tax] Payment: ${amount} for year {year} on {credited_date}")
                except:
                    continue

            # Group payments by tax year
            by_year = {}
            for payment in payments:
                year = payment['tax_year']
                if year not in by_year:
                    by_year[year] = {'total': 0, 'payments': []}
                by_year[year]['total'] += payment['amount']
                by_year[year]['payments'].append(payment)

            result['payments_by_year'] = by_year

            # Get most recent year's total
            if by_year:
                latest_year = max(by_year.keys())
                result['tax_year'] = latest_year
                result['tax_amount'] = by_year[latest_year]['total']
                result['success'] = True
                print(f"[NYC Tax] Latest year {latest_year}: ${result['tax_amount']:.2f}")
            else:
                result['error'] = 'No payment history found'
                result['page_preview'] = body_text[:1000]

            result['pin'] = pin
            browser.close()
            return result

        except Exception as e:
            page.screenshot(path='/tmp/nyc_tax_error.png')
            print(f"[NYC Tax] Error screenshot saved: /tmp/nyc_tax_error.png")
            browser.close()
            result['error'] = str(e)
            return result


def parse_nyc_bill(text: str, boro: str, block: str, lot: str, pin: str) -> dict:
    """Parse actual bill page for tax amounts."""

    result = {
        'success': False,
        'boro': boro,
        'block': block,
        'lot': lot,
        'pin': pin,
        'borough_name': BOROUGHS.get(boro, 'Unknown'),
    }

    # Look for address
    addr_match = re.search(r'(\d+\s+[A-Z0-9\s#]+(?:STREET|ST|AVENUE|AVE|ROAD|RD)?[^,\n]*)', text, re.IGNORECASE)
    if addr_match:
        result['address'] = addr_match.group(1).strip()

    # Look for "Amount Due" or similar
    amount_patterns = [
        r'Amount\s+Due[:\s]*\$?([\d,]+\.?\d*)',
        r'Total\s+Due[:\s]*\$?([\d,]+\.?\d*)',
        r'Current\s+Amount[:\s]*\$?([\d,]+\.?\d*)',
        r'Tax\s+Amount[:\s]*\$?([\d,]+\.?\d*)',
        r'Quarterly\s+Amount[:\s]*\$?([\d,]+\.?\d*)',
        r'Balance[:\s]*\$?([\d,]+\.?\d*)',
        r'\$\s*([\d,]+\.\d{2})',  # Generic dollar amount
    ]

    for pattern in amount_patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            amount_str = match.group(1).replace(',', '')
            try:
                amount = float(amount_str)
                # For 421-a properties, quarterly amounts should be very small (<$50)
                if amount > 0 and amount < 5000:
                    result['tax_amount'] = amount
                    print(f"[NYC Tax] Found amount: ${amount}")
                    break
            except:
                continue

    # Look for due date
    due_patterns = [
        r'Due\s+Date[:\s]*(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})',
        r'Due[:\s]*(\w+\s+\d{1,2},?\s+\d{4})',
        r'(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4}',
    ]

    for pattern in due_patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            result['due_date'] = match.group(1) if match.lastindex else match.group(0)
            break

    # Look for quarter info
    quarter_match = re.search(r'Q([1-4])|Quarter\s*([1-4])', text, re.IGNORECASE)
    if quarter_match:
        result['quarter'] = int(quarter_match.group(1) or quarter_match.group(2))

    # Check for 421-a abatement
    if '421' in text or 'abatement' in text.lower():
        result['has_abatement'] = True
        result['abatement_type'] = '421-a'

    if result.get('tax_amount'):
        result['success'] = True
    else:
        result['error'] = 'Could not parse tax amount from bill'
        result['page_preview'] = text[:1000] if len(text) > 1000 else text

    return result


def parse_nyc_results(text: str, boro: str, block: str, lot: str) -> dict:
    """Parse tax information from NYC portal results."""

    result = {
        'success': False,
        'boro': boro,
        'block': block,
        'lot': lot,
        'borough_name': BOROUGHS.get(boro, 'Unknown'),
    }

    # Look for address
    addr_patterns = [
        r'(\d+\s+[A-Z\s]+(?:STREET|ST|AVENUE|AVE|ROAD|RD|PLACE|PL|DRIVE|DR))',
        r'Address[:\s]+([^\n]+)',
    ]
    for pattern in addr_patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            result['address'] = match.group(1).strip()
            break

    # Look for owner
    owner_match = re.search(r'Owner[:\s]+([^\n]+)', text, re.IGNORECASE)
    if owner_match:
        result['owner'] = owner_match.group(1).strip()

    # Look for tax amounts - various patterns
    tax_patterns = [
        r'Tax\s+Amount[:\s]*\$?([\d,]+\.?\d*)',
        r'Annual\s+Tax[:\s]*\$?([\d,]+\.?\d*)',
        r'Property\s+Tax[:\s]*\$?([\d,]+\.?\d*)',
        r'Total\s+Tax[:\s]*\$?([\d,]+\.?\d*)',
        r'Amount\s+Due[:\s]*\$?([\d,]+\.?\d*)',
        r'Current\s+Amount[:\s]*\$?([\d,]+\.?\d*)',
        r'Quarterly\s+Amount[:\s]*\$?([\d,]+\.?\d*)',
        r'\$\s*([\d,]+\.\d{2})',  # Generic dollar amount
    ]

    for pattern in tax_patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            amount_str = match.group(1).replace(',', '')
            try:
                amount = float(amount_str)
                if amount > 0 and amount < 100000:  # Sanity check
                    result['tax_amount'] = amount
                    break
            except:
                continue

    # Look for abatement info
    if '421' in text or 'abatement' in text.lower():
        result['has_abatement'] = True
        abatement_match = re.search(r'421[-\s]?[aA]', text)
        if abatement_match:
            result['abatement_type'] = '421-a'

    # Look for assessed value
    assessed_patterns = [
        r'Assessed\s+Value[:\s]*\$?([\d,]+)',
        r'Assessment[:\s]*\$?([\d,]+)',
    ]
    for pattern in assessed_patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            result['assessed_value'] = float(match.group(1).replace(',', ''))
            break

    # Look for market value
    market_patterns = [
        r'Market\s+Value[:\s]*\$?([\d,]+)',
        r'Full\s+Value[:\s]*\$?([\d,]+)',
    ]
    for pattern in market_patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            result['market_value'] = float(match.group(1).replace(',', ''))
            break

    # Look for tax year
    year_match = re.search(r'(202[4-9])[/-](202[5-9])', text)
    if year_match:
        result['tax_year'] = int(year_match.group(2))
    else:
        year_match = re.search(r'FY\s*(202[5-9])', text, re.IGNORECASE)
        if year_match:
            result['tax_year'] = int(year_match.group(1))

    # Check for success
    if result.get('tax_amount') or result.get('address'):
        result['success'] = True
    else:
        result['error'] = 'Could not parse tax information from page'
        result['page_preview'] = text[:500] if len(text) > 500 else text

    return result


def main():
    parser = argparse.ArgumentParser(description='NYC Property Tax Lookup')
    parser.add_argument('--boro', required=True, help='Borough code (1=Manhattan, 2=Bronx, 3=Brooklyn, 4=Queens, 5=Staten Island)')
    parser.add_argument('--block', required=True, help='Block number')
    parser.add_argument('--lot', required=True, help='Lot number')
    parser.add_argument('--json', action='store_true', help='Output as JSON only')
    args = parser.parse_args()

    result = lookup_nyc_tax(args.boro, args.block, args.lot)

    if args.json:
        print(json.dumps(result, indent=2))
    else:
        print("\n" + "="*60)
        print("NYC PROPERTY TAX LOOKUP")
        print("="*60)

        print(f"\nBBL: {args.boro}-{args.block}-{args.lot}")
        print(f"Borough: {result.get('borough_name', 'Unknown')}")

        if result.get('success'):
            print(f"Address: {result.get('address', 'N/A')}")
            print(f"Owner: {result.get('owner', 'N/A')}")

            if result.get('tax_amount'):
                print(f"\nTax Amount: ${result.get('tax_amount'):,.2f}")
            if result.get('tax_year'):
                print(f"Tax Year: {result.get('tax_year')}")
            if result.get('has_abatement'):
                print(f"Abatement: {result.get('abatement_type', 'Yes')}")
            if result.get('assessed_value'):
                print(f"Assessed Value: ${result.get('assessed_value'):,.0f}")
            if result.get('market_value'):
                print(f"Market Value: ${result.get('market_value'):,.0f}")
        else:
            print(f"\nError: {result.get('error', 'Unknown error')}")
            if result.get('page_preview'):
                print(f"\nPage content preview:\n{result.get('page_preview')}")

        print(f"\nScraped: {result.get('scraped_at')}")
        print("="*60)

    return result


if __name__ == "__main__":
    main()
