#!/usr/bin/env -S uv run python
"""
Master Tax Sync Script

Runs all property tax lookups and posts results to the web app.

Usage:
    python3 scripts/sync_all_taxes.py
    python3 scripts/sync_all_taxes.py --callback http://localhost:3000/api/taxes/sync/callback
    python3 scripts/sync_all_taxes.py --dry-run

This script is meant to be run weekly via cron or manually.
Add to crontab:
    0 6 * * 1 cd /path/to/propertymanagement && python3 scripts/sync_all_taxes.py --callback https://yourapp.vercel.app/api/taxes/sync/callback
"""
import sys
import json
import subprocess
import argparse
from datetime import datetime

sys.path.insert(0, '/Users/toddhome/Library/Python/3.12/lib/python/site-packages')

# Property configurations for each scraper
PROPERTIES = {
    'santa_clara_county': [
        {
            'name': '125 Dana Avenue, San Jose',
            'script': 'scripts/lookup_scc_tax.py',
            'args': []
        }
    ],
    'city_hall_systems': [
        {
            'name': '88 Williams St, Providence',
            'script': 'scripts/lookup_providence_tax.py',
            'args': ['--address', '88 Williams']
        }
    ],
    'vermont_nemrc': [
        {
            'name': '2055 Sunset Lake Rd, Dummerston (Main House)',
            'script': 'scripts/lookup_vermont_tax.py',
            'args': ['--address', '2055 Sunset Lake']
        },
        {
            'name': '1910 Sunset Lake Rd, Dummerston (Booth House)',
            'script': 'scripts/lookup_vermont_tax.py',
            'args': ['--address', '1910 Sunset Lake']
        },
        {
            'name': '2001 Sunset Lake Rd, Dummerston (Guest House)',
            'script': 'scripts/lookup_vermont_tax.py',
            'args': ['--address', '2001 Sunset Lake']
        }
    ]
}

# NYC properties are synced via the web app's API (no Playwright needed)
NYC_NOTE = """
NYC Brooklyn properties are synced directly via the web app using NYC Open Data API.
Run: curl -X POST https://yourapp.vercel.app/api/cron/sync-taxes
"""


def run_scraper(script: str, args: list, callback_url: str = None, dry_run: bool = False) -> dict:
    """Run a single tax scraper script."""
    cmd = ['python3', script] + args + ['--json']

    if callback_url:
        cmd.extend(['--callback', callback_url])

    if dry_run:
        print(f"  [DRY RUN] Would run: {' '.join(cmd)}")
        return {'success': True, 'dry_run': True}

    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=120  # 2 minute timeout per scraper
        )

        # Try to parse JSON from output
        try:
            # Find the JSON in the output (may have log lines before it)
            output_lines = result.stdout.strip().split('\n')
            json_start = None
            for i, line in enumerate(output_lines):
                if line.strip().startswith('{'):
                    json_start = i
                    break

            if json_start is not None:
                json_str = '\n'.join(output_lines[json_start:])
                return json.loads(json_str)
        except json.JSONDecodeError:
            pass

        return {
            'success': result.returncode == 0,
            'stdout': result.stdout,
            'stderr': result.stderr
        }

    except subprocess.TimeoutExpired:
        return {'success': False, 'error': 'Script timed out after 120 seconds'}
    except Exception as e:
        return {'success': False, 'error': str(e)}


def main():
    parser = argparse.ArgumentParser(description='Sync all property taxes')
    parser.add_argument('--callback', help='Callback URL for posting results')
    parser.add_argument('--dry-run', action='store_true', help='Show what would be run without executing')
    parser.add_argument('--provider', help='Only run specific provider (santa_clara_county, city_hall_systems, vermont_nemrc)')
    args = parser.parse_args()

    print("=" * 70)
    print("PROPERTY TAX SYNC - " + datetime.now().strftime('%Y-%m-%d %H:%M:%S'))
    print("=" * 70)

    if args.callback:
        print(f"Callback URL: {args.callback}")
    if args.dry_run:
        print("DRY RUN MODE - No scripts will be executed")

    print()

    results = {
        'started_at': datetime.now().isoformat(),
        'callback_url': args.callback,
        'properties': []
    }

    total = 0
    successful = 0

    for provider, properties in PROPERTIES.items():
        if args.provider and provider != args.provider:
            continue

        print(f"\n--- {provider.upper().replace('_', ' ')} ---")

        for prop in properties:
            total += 1
            print(f"\n[{total}] {prop['name']}")

            result = run_scraper(
                prop['script'],
                prop['args'],
                args.callback,
                args.dry_run
            )

            success = result.get('success', False)
            if success:
                successful += 1
                print(f"    ✓ Success")
                if result.get('annual_tax'):
                    print(f"    Annual Tax: ${result.get('annual_tax'):,.2f}")
                elif result.get('total_assessed_value'):
                    print(f"    Assessed Value: ${result.get('total_assessed_value'):,.2f}")
            else:
                print(f"    ✗ Failed: {result.get('error', 'Unknown error')}")

            results['properties'].append({
                'name': prop['name'],
                'provider': provider,
                'success': success,
                'data': result
            })

    print("\n" + "=" * 70)
    print(f"SUMMARY: {successful}/{total} successful")
    print("=" * 70)

    print(NYC_NOTE)

    results['completed_at'] = datetime.now().isoformat()
    results['total'] = total
    results['successful'] = successful

    return results


if __name__ == "__main__":
    main()
