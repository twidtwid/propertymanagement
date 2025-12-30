#!/usr/bin/env python3
"""
Lookup Santa Clara County property tax using Playwright
"""
import sys
sys.path.insert(0, '/Users/toddhome/Library/Python/3.12/lib/python/site-packages')

from playwright.sync_api import sync_playwright
import time
import re

def lookup_property_tax():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        print("Navigating to Santa Clara County property tax site...")
        page.goto("https://santaclaracounty.telleronline.net/search/1/PropertyAddress", timeout=60000)
        page.wait_for_load_state("networkidle", timeout=30000)
        time.sleep(3)

        print(f"Page title: {page.title()}")

        # Fill the property address field
        print("\nFilling property address...")
        address_input = page.locator("#mat-input-1")
        address_input.fill("125 DANA AV SAN JOSE")
        time.sleep(1)

        page.screenshot(path="/tmp/scc_filled.png")
        print("Filled address, looking for search button...")

        # Find and click search button
        # Look for the search icon button in mat-form-field
        search_buttons = page.locator("button").all()
        print(f"Found {len(search_buttons)} buttons")

        # Click the search/submit button (usually has mat-icon-button class or search icon)
        try:
            # Try clicking a button with search icon
            search_btn = page.locator("button.mat-mdc-icon-button").first
            search_btn.click()
            print("Clicked search button")
        except:
            # Try pressing Enter instead
            print("Trying Enter key...")
            address_input.press("Enter")

        time.sleep(3)
        page.wait_for_load_state("networkidle", timeout=30000)

        page.screenshot(path="/tmp/scc_results.png")
        print("Screenshot saved to /tmp/scc_results.png")

        # Check if we have results
        print("\nLooking for search results...")

        # Look for result rows
        rows = page.locator("tr, .mat-row, [class*='result'], [class*='property']").all()
        print(f"Found {len(rows)} potential result rows")

        # Get page text
        body_text = page.locator("body").inner_text()

        # Look for property-related text
        if "125 DANA" in body_text.upper():
            print("\nFound property in results!")

            # Try to find and click on the result
            result_link = page.locator("a:has-text('125'), td:has-text('125'), [class*='clickable']").first
            try:
                result_link.click()
                time.sleep(3)
                page.wait_for_load_state("networkidle", timeout=30000)
                page.screenshot(path="/tmp/scc_detail.png")
                print("Clicked on result, screenshot saved to /tmp/scc_detail.png")
            except Exception as e:
                print(f"Could not click result: {e}")

        # Print relevant text from the page
        print("\n--- Page text (searching for tax info) ---")
        lines = body_text.split('\n')
        for line in lines:
            line = line.strip()
            if any(keyword in line.upper() for keyword in ['TAX', 'ASSESSED', 'VALUE', 'AMOUNT', 'DANA', 'TOTAL', 'DUE', '$']):
                if line and len(line) < 200:
                    print(line)

        # Look for the details page URL
        print(f"\nCurrent URL: {page.url}")

        # If we're on a details page, extract the data
        if "details" in page.url.lower() or "bill" in page.url.lower():
            print("\n--- On details page ---")
            detail_text = page.locator("body").inner_text()
            print(detail_text[:3000])

        # Try to find table data
        tables = page.locator("table").all()
        print(f"\nFound {len(tables)} tables")
        for i, table in enumerate(tables):
            try:
                table_text = table.inner_text()
                if len(table_text) > 10:
                    print(f"\nTable {i}:\n{table_text[:1500]}")
            except:
                pass

        browser.close()

if __name__ == "__main__":
    lookup_property_tax()
