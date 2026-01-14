#!/usr/bin/env -S uv run python
"""
Automated Nest Legacy Token Refresh

Logs into home.nest.com via Google OAuth and extracts the user_token cookie.
Updates the production database with the encrypted token.

Usage:
    # First time setup (interactive login):
    npm run nest:auto-refresh -- --setup

    # Automated runs (uses saved session):
    npm run nest:auto-refresh

    # Force interactive login again:
    npm run nest:auto-refresh -- --interactive

Environment Variables Required:
    NEST_LEGACY_EMAIL - Anne's email for Nest account
    NEST_LEGACY_PASSWORD - Anne's password
    DATABASE_URL - PostgreSQL connection string
    TOKEN_ENCRYPTION_KEY - 64-char hex key for AES-256-GCM encryption
    PUSHOVER_TOKEN - Pushover app token (for notifications)
    PUSHOVER_USER_TODD - Todd's Pushover user key
    PUSHOVER_USER_ANNE - Anne's Pushover user key
"""

import sys
import os
import json
import subprocess
import requests
from datetime import datetime, timedelta
from pathlib import Path
from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeout

try:
    from playwright_stealth import Stealth
    STEALTH_AVAILABLE = True
except ImportError:
    STEALTH_AVAILABLE = False

# Configuration
LOGIN_TIMEOUT = 60000  # 60 seconds
NAVIGATION_TIMEOUT = 30000  # 30 seconds
PROFILE_DIR = Path(__file__).parent / '.playwright-nest-profile'


def log(message):
    """Print timestamped log message"""
    timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    print(f'[{timestamp}] {message}', flush=True)


def send_pushover_notification(title, message, priority=0):
    """Send Pushover notification to Todd and Anne"""
    token = os.environ.get('PUSHOVER_TOKEN')
    users = [
        os.environ.get('PUSHOVER_USER_TODD'),
        os.environ.get('PUSHOVER_USER_ANNE')
    ]

    if not token or not any(users):
        log('⚠️  Pushover not configured - skipping notification')
        return

    for user in filter(None, users):
        try:
            requests.post('https://api.pushover.net/1/messages.json', data={
                'token': token,
                'user': user,
                'title': title,
                'message': message,
                'priority': priority
            }, timeout=10)
        except Exception as e:
            log(f'⚠️  Failed to send Pushover to {user[:8]}...: {e}')


def test_token_validity(token):
    """Test token against Dropcam API (same pattern as update-nest-token-manual.js)"""
    log('Testing token validity against Dropcam API...')

    try:
        # Use a dummy UUID - 404 means token is valid, 401/403 means invalid
        response = requests.get(
            'https://nexusapi-us1.camera.home.nest.com/get_image',
            params={'uuid': 'test-uuid-for-validation', 'width': 640},
            headers={
                'Cookie': f'user_token={token}',
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
                'Referer': 'https://home.nest.com/'
            },
            timeout=10
        )

        # 404 = valid token but invalid UUID (expected)
        # 200 = valid token and valid UUID (also good)
        if response.status_code in [200, 404]:
            log('✓ Token is valid')
            return True
        elif response.status_code in [401, 403]:
            log(f'✗ Token is invalid (HTTP {response.status_code})')
            return False
        else:
            log(f'⚠️  Unexpected status {response.status_code}, assuming valid')
            return True

    except Exception as e:
        log(f'⚠️  Token test failed: {e}, assuming valid')
        return True


def encrypt_token(plaintext):
    """Encrypt token using Node.js crypto (reuses existing TOKEN_ENCRYPTION_KEY)"""
    log('Encrypting token...')

    encryption_key = os.environ.get('TOKEN_ENCRYPTION_KEY')
    if not encryption_key:
        raise ValueError('TOKEN_ENCRYPTION_KEY not set')

    # Call Node.js to encrypt (matches src/lib/encryption.ts)
    node_script = f"""
    const crypto = require('crypto');
    const TOKEN_ENCRYPTION_KEY = '{encryption_key}';

    function encryptToken(plaintext) {{
        const key = Buffer.from(TOKEN_ENCRYPTION_KEY, 'hex');
        const iv = crypto.randomBytes(16);
        const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
        const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
        const authTag = cipher.getAuthTag();
        return Buffer.concat([iv, encrypted, authTag]).toString('base64');
    }}

    console.log(encryptToken(process.argv[1]));
    """

    try:
        result = subprocess.run(
            ['node', '-e', node_script, plaintext],
            capture_output=True,
            text=True,
            timeout=10,
            check=True
        )
        encrypted = result.stdout.strip()
        log(f'✓ Token encrypted ({len(encrypted)} chars)')
        return encrypted
    except subprocess.CalledProcessError as e:
        raise RuntimeError(f'Encryption failed: {e.stderr}')


def update_database(encrypted_credentials):
    """Update camera_credentials table with encrypted token"""
    log('Updating database...')

    database_url = os.environ.get('DATABASE_URL')
    if not database_url:
        raise ValueError('DATABASE_URL not set')

    # Use docker exec to run psql through the database container
    update_sql = f"""
    UPDATE camera_credentials
    SET credentials_encrypted = '{encrypted_credentials}', updated_at = NOW()
    WHERE provider = 'nest_legacy'
    RETURNING id;
    """

    try:
        # Try docker exec first (development) - try postgres user
        result = subprocess.run(
            ['docker', 'exec', 'propertymanagement-db-1', 'psql', '-U', 'postgres', '-d', 'propertymanagement', '-t', '-c', update_sql],
            capture_output=True,
            text=True,
            timeout=10,
            check=True
        )

        if result.stdout.strip():
            log('✓ Database updated successfully')
            return True
        else:
            raise RuntimeError('No nest_legacy credentials found in database')

    except subprocess.CalledProcessError as e:
        raise RuntimeError(f'Database update failed: {e.stderr}')
    except FileNotFoundError:
        # If docker command not found, try direct psql (production)
        try:
            result = subprocess.run(
                ['psql', database_url, '-t', '-c', update_sql],
                capture_output=True,
                text=True,
                timeout=10,
                check=True
            )

            if result.stdout.strip():
                log('✓ Database updated successfully')
                return True
            else:
                raise RuntimeError('No nest_legacy credentials found in database')

        except subprocess.CalledProcessError as e:
            raise RuntimeError(f'Database update failed: {e.stderr}')


def extract_token_from_browser(interactive=False):
    """Launch Playwright, log in to home.nest.com, extract user_token cookie

    Args:
        interactive: If True, launch browser with headless=False for manual login
    """
    email = os.environ.get('NEST_LEGACY_EMAIL')
    password = os.environ.get('NEST_LEGACY_PASSWORD')

    if not email or not password:
        raise ValueError('NEST_LEGACY_EMAIL and NEST_LEGACY_PASSWORD must be set')

    # Ensure profile directory exists
    PROFILE_DIR.mkdir(parents=True, exist_ok=True)

    log(f'Starting browser automation for {email}...')
    if interactive:
        log('⚠️  INTERACTIVE MODE: Browser window will open for manual login')
        log('    Please log in manually, then the script will extract the token')

    with sync_playwright() as p:
        # Launch browser with persistent context (saves cookies/session)
        # Use aggressive anti-detection settings
        context = p.chromium.launch_persistent_context(
            user_data_dir=str(PROFILE_DIR),
            headless=not interactive,  # Show browser if interactive
            args=[
                '--disable-blink-features=AutomationControlled',  # Hide automation
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-web-security'
            ],
            viewport={'width': 1280, 'height': 720},
            user_agent='Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            ignore_default_args=['--enable-automation'],  # Don't show automation flag
        )

        try:
            # Get or create a page
            if context.pages:
                page = context.pages[0]
            else:
                page = context.new_page()

            # Navigate to home.nest.com
            log('Navigating to home.nest.com...')
            page.goto('https://home.nest.com', timeout=NAVIGATION_TIMEOUT, wait_until='load')

            # Wait a moment for potential redirect
            page.wait_for_timeout(2000)

            # Check if already logged in or needs to authenticate
            current_url = page.url
            log(f'Current URL: {current_url}')

            # Handle login
            if '/login' in current_url or 'accounts.google.com' in current_url:
                if interactive:
                    # Interactive mode: Keep browser open and wait
                    log('⚠️  Browser window is open')
                    log('    Please log in manually and navigate to see your cameras')
                    log('    Waiting 15 seconds before starting to check...')
                    log('    Then will check every 5 seconds (max 5 minutes total)')
                    log('')

                    # Give user time to see the browser and start logging in
                    page.wait_for_timeout(15000)  # Wait 15 seconds initially

                    # Wait for successful login by checking URL
                    start_time = datetime.now()
                    check_count = 0

                    while True:
                        check_count += 1
                        page.wait_for_timeout(5000)  # Wait 5 seconds between checks

                        current_url = page.url
                        log(f'[Check {check_count}] Current URL: {current_url[:60]}...')

                        # Check if logged in (on home page or camera page)
                        if 'home.nest.com' in current_url and '/login' not in current_url and '/callback' not in current_url:
                            log('✓ Login successful! Waiting 5 more seconds for page to fully load...')
                            page.wait_for_timeout(5000)
                            break

                        # Timeout after 5 minutes
                        elapsed = (datetime.now() - start_time).seconds
                        if elapsed > 300:
                            raise TimeoutError('Manual login timeout (5 minutes)')

                        remaining = 300 - elapsed
                        log(f'    Waiting... ({remaining} seconds remaining)')
                else:
                    # Automated mode: Try automated login (may fail due to bot detection)
                    log('⚠️  Login required - automated login may fail due to Google bot detection')
                    log('   If this fails, run with --setup flag for manual login')
                    raise RuntimeError('Not logged in. Run with --setup flag to log in manually first.')

            elif 'home.nest.com' in current_url and '/login' not in current_url:
                log('✓ Already logged in (using saved session)')
            else:
                raise RuntimeError(f'Unexpected URL after navigation: {current_url}')

            # Wait for page to fully stabilize and tokens to be set
            log('Waiting for page to fully load and tokens to be set...')
            page.wait_for_timeout(10000)  # Wait 10 seconds for everything to settle

            # Extract user_token - try multiple sources
            log('Extracting user_token...')

            # First, try cookies (check ALL cookies, not just nest.com)
            cookies = context.cookies()
            log(f'   Total cookies: {len(cookies)}')

            # Show all cookie names and domains for debugging
            for c in cookies[:15]:  # Show first 15
                log(f'     - {c["name"]} (domain: {c.get("domain", "?")})')

            user_token = next((c['value'] for c in cookies if c['name'] == 'user_token'), None)
            if not user_token:
                user_token = next((c['value'] for c in cookies if c['name'] == 'cztoken'), None)

            # If not in cookies, try localStorage
            if not user_token:
                log('   Token not in cookies, checking localStorage...')
                try:
                    local_storage = page.evaluate('() => Object.assign({}, window.localStorage)')
                    log(f'   LocalStorage keys: {list(local_storage.keys())}')

                    # Check for nestToken.* keys - these contain the actual tokens
                    nest_token_keys = [k for k in local_storage.keys() if k.startswith('nestToken.')]
                    if nest_token_keys:
                        log(f'   Found {len(nest_token_keys)} nestToken keys, checking each...')

                        # Check all nestToken keys to find the one with actual data
                        for key in nest_token_keys:
                            token_data = local_storage[key]

                            if not token_data or len(str(token_data)) == 0:
                                log(f'     {key}: empty')
                                continue

                            log(f'     {key}: {len(str(token_data))} chars')

                            # The token might be stored as JSON or plain string
                            if isinstance(token_data, str) and len(token_data) > 100:
                                if token_data.startswith('g.'):  # Looks like a Google token
                                    user_token = token_data
                                    log(f'   ✓ Found Nest Legacy token in {key}!')
                                    break
                                else:
                                    # Try parsing as JSON
                                    try:
                                        import json
                                        parsed = json.loads(token_data)
                                        # Look for token field in JSON
                                        potential_token = parsed.get('token') or parsed.get('access_token')
                                        if potential_token and potential_token.startswith('g.'):
                                            user_token = potential_token
                                            log(f'   ✓ Found Nest Legacy token in JSON at {key}!')
                                            break
                                    except:
                                        pass

                    # Fallback: check for common token keys
                    if not user_token:
                        for key in ['user_token', 'cztoken', 'access_token', 'token', 'auth_token']:
                            if key in local_storage:
                                user_token = local_storage[key]
                                log(f'   Found token in localStorage["{key}"]')
                                break
                except Exception as e:
                    log(f'   localStorage check failed: {e}')

            # If still not found, try sessionStorage
            if not user_token:
                log('   Checking sessionStorage...')
                try:
                    session_storage = page.evaluate('() => Object.assign({}, window.sessionStorage)')
                    log(f'   SessionStorage keys: {list(session_storage.keys())}')

                    for key in ['user_token', 'cztoken', 'access_token', 'token', 'auth_token']:
                        if key in session_storage:
                            user_token = session_storage[key]
                            log(f'   Found token in sessionStorage["{key}"]')
                            break
                except Exception as e:
                    log(f'   sessionStorage check failed: {e}')

            if not user_token:
                raise RuntimeError('user_token not found in cookies, localStorage, or sessionStorage')

            log(f'✓ Token extracted ({len(user_token)} chars)')
            return user_token

        finally:
            context.close()


def main():
    """Main automation flow"""
    try:
        # Parse command-line arguments
        interactive = '--setup' in sys.argv or '--interactive' in sys.argv

        log('=== Nest Legacy Token Auto-Refresh Started ===')
        if interactive:
            log('Mode: INTERACTIVE (manual login)')
        else:
            log('Mode: AUTOMATED (using saved session)')

        # Step 1: Extract token from browser
        token = extract_token_from_browser(interactive=interactive)

        # Step 2: Test token validity
        if not test_token_validity(token):
            raise RuntimeError('Extracted token is invalid')

        # Step 3: Prepare credentials JSON
        expires_at = (datetime.now() + timedelta(days=30)).isoformat()
        credentials = {
            'access_token': token,
            'expires_at': expires_at,
            'updated_at': datetime.now().isoformat()
        }
        credentials_json = json.dumps(credentials)

        # Step 4: Encrypt credentials
        encrypted = encrypt_token(credentials_json)

        # Step 5: Update database
        update_database(encrypted)

        # Step 6: Send success notification
        log('✓ Token refresh completed successfully')
        send_pushover_notification(
            '✅ Nest Token Auto-Refreshed',
            f'Nest Legacy token automatically refreshed.\n\nExpires: {expires_at[:10]}\nNext refresh: Tomorrow at 2:30 AM',
            priority=0
        )

        log('=== Success ===')
        return 0

    except PlaywrightTimeout as e:
        error_msg = f'Browser automation timeout: {e}'
        log(f'✗ {error_msg}')
        send_pushover_notification(
            '⚠️ Nest Token Auto-Refresh Failed',
            f'Automated token refresh failed:\n{error_msg}\n\nPlease manually refresh: npm run nest:update-token <token>',
            priority=1
        )
        return 1

    except Exception as e:
        error_msg = str(e)
        log(f'✗ Error: {error_msg}')
        send_pushover_notification(
            '⚠️ Nest Token Auto-Refresh Failed',
            f'Automated token refresh failed:\n{error_msg}\n\nPlease manually refresh: npm run nest:update-token <token>',
            priority=1
        )
        return 1


if __name__ == '__main__':
    sys.exit(main())
