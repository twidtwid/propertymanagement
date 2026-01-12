#!/usr/bin/env -S uv run python
"""
Analyze unmatched email senders using Claude to identify potential property management vendors.
"""

import json
import os
import sys
from pathlib import Path

import anthropic
import psycopg2

# Load environment variables from .env.local
env_path = Path(__file__).parent.parent / ".env.local"
env_vars = {}
if env_path.exists():
    for line in env_path.read_text().splitlines():
        if "=" in line and not line.startswith("#"):
            key, value = line.split("=", 1)
            env_vars[key.strip()] = value.strip()

ANTHROPIC_API_KEY = env_vars.get("ANTHROPIC_API_KEY")
DATABASE_URL = env_vars.get("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/propertymanagement")

if not ANTHROPIC_API_KEY:
    print("Error: ANTHROPIC_API_KEY not found in .env.local")
    sys.exit(1)


def load_email_analysis():
    """Load the email analysis JSON file."""
    analysis_path = Path(__file__).parent.parent / "email-analysis-2025.json"
    with open(analysis_path) as f:
        return json.load(f)


def get_existing_vendors():
    """Get existing vendors from the database."""
    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor()
    cur.execute("SELECT id, name, email, specialty FROM vendors")
    vendors = cur.fetchall()
    cur.close()
    conn.close()
    return vendors


def analyze_senders_with_claude(senders, client):
    """
    Use Claude Haiku to categorize senders as property-related or not.
    Process in batches to be efficient.
    """
    # Build a list of sender info for Claude to analyze
    sender_list = []
    for s in senders[:100]:  # Top 100 unmatched senders
        sender_list.append(f"- {s['email']} | {s.get('name', 'Unknown')} | {s['count']} emails")

    sender_text = "\n".join(sender_list)

    prompt = f"""Analyze this list of email senders for a property management system.
The user (Anne) owns 10 properties in Vermont, Brooklyn NY, Rhode Island, Martinique, Paris, and San Jose CA.
She also has 7 vehicles.

Identify senders that are likely PROPERTY MANAGEMENT RELATED vendors/services such as:
- Contractors (HVAC, plumbing, electrical, roofing, general contractors)
- Property services (landscaping, cleaning, pest control, pool/spa, security)
- Utilities (electric, gas, water, internet, phone)
- Insurance agents/companies
- Property management companies
- Building management (for condos)
- Auto services (for the 7 vehicles)
- Professional services (lawyers, accountants, bookkeepers)
- Home automation/smart home services (A/V, thermostats, cameras, alarms)
- Fuel/oil delivery
- Snow removal, tree services, etc.

EXCLUDE:
- Retail stores and shopping (Amazon, Costco, clothing brands, etc.)
- News/media (NY Times, Bloomberg, newsletters)
- Social media (Nextdoor, Reddit)
- Banks and financial services (unless they're mortgage-related)
- Marketing/spam emails
- Personal contacts

For each property-related sender, identify:
1. The vendor specialty category (use one of: hvac, plumbing, electrical, roofing, general_contractor, landscaping, cleaning, pest_control, pool_spa, appliance, locksmith, alarm_security, snow_removal, fuel_oil, property_management, architect, movers, trash, internet, phone, water, septic, forester, auto_service, insurance, utility, professional, other)
2. A suggested vendor name (company name or person's name)
3. Why you think they're property-related

Email senders to analyze:
{sender_text}

Respond with a JSON array of objects with this structure:
[
  {{
    "email": "sender@example.com",
    "name": "Suggested Vendor Name",
    "specialty": "category",
    "reason": "Why this is property-related",
    "confidence": "high/medium/low"
  }}
]

Only include senders you're confident are property-related. Be conservative - if unsure, exclude them.
Return ONLY the JSON array, no other text."""

    response = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=4096,
        messages=[{"role": "user", "content": prompt}]
    )

    # Parse the response
    response_text = response.content[0].text.strip()
    # Remove any markdown code blocks if present
    if response_text.startswith("```"):
        response_text = response_text.split("```")[1]
        if response_text.startswith("json"):
            response_text = response_text[4:]

    try:
        return json.loads(response_text)
    except json.JSONDecodeError as e:
        print(f"Error parsing Claude response: {e}")
        print(f"Response was: {response_text[:500]}")
        return []


def search_for_smarthaven(analysis_data, client):
    """
    Search for SmartHaven or similar A/V vendors in the top senders.
    The user specifically mentioned SmartHaven as an A/V vendor.
    """
    print("\n🔍 Searching for SmartHaven and A/V vendors...")

    all_senders = analysis_data.get("topSenders", []) + analysis_data.get("unmatchedSenders", [])

    # Search for common A/V, smart home, and automation terms
    av_keywords = ["smart", "audio", "video", "av ", "a/v", "automation", "control4",
                   "crestron", "savant", "sonos", "lutron", "nest", "ring", "adt",
                   "vivint", "haven", "cinema", "theater", "speaker", "sound"]

    potential_av = []
    for sender in all_senders:
        email = sender.get("email", "").lower()
        name = (sender.get("name") or "").lower()

        for keyword in av_keywords:
            if keyword in email or keyword in name:
                potential_av.append(sender)
                break

    if potential_av:
        print(f"  Found {len(potential_av)} potential A/V-related senders:")
        for s in potential_av[:20]:
            print(f"    - {s['email']} | {s.get('name', 'Unknown')} ({s['count']} emails)")
    else:
        print("  No obvious A/V vendors found in email addresses/names.")

    return potential_av


def map_specialty_to_enum(specialty):
    """Map Claude's specialty suggestion to valid database enum values."""
    # Valid enum values from the database schema
    valid_specialties = {
        'hvac', 'plumbing', 'electrical', 'roofing', 'general_contractor',
        'landscaping', 'cleaning', 'pest_control', 'pool_spa', 'appliance',
        'locksmith', 'alarm_security', 'snow_removal', 'fuel_oil',
        'property_management', 'architect', 'movers', 'trash', 'internet',
        'phone', 'water', 'septic', 'forester', 'other'
    }

    # Mapping of Claude's suggestions to valid enums
    mappings = {
        'home_automation': 'alarm_security',  # Smart home -> alarm/security
        'smart_home': 'alarm_security',
        'automation': 'alarm_security',
        'auto_service': 'other',
        'insurance': 'other',
        'utility': 'other',
        'professional': 'other',
        'bookkeeper': 'other',
        'accountant': 'other',
        'lawyer': 'other',
    }

    specialty_lower = specialty.lower().strip()

    if specialty_lower in valid_specialties:
        return specialty_lower

    return mappings.get(specialty_lower, 'other')


def add_vendors_to_database(vendors_to_add, dry_run=True):
    """Add identified vendors to the database."""
    if not vendors_to_add:
        print("\n📭 No new vendors to add.")
        return

    # Filter out professionals (they should go in a different table)
    professionals = [v for v in vendors_to_add if v.get('specialty') in ['professional', 'bookkeeper', 'accountant', 'lawyer']]
    vendors = [v for v in vendors_to_add if v not in professionals]

    if professionals:
        print(f"\n📋 Found {len(professionals)} professional contacts (bookkeeper/accountant/lawyer):")
        for p in professionals:
            print(f"  - {p['name']} - {p['email']}")
        print("  (These should be added to the 'professionals' table, not vendors)")

    if dry_run:
        print(f"\n📋 DRY RUN: Would add {len(vendors)} vendors:")
        for v in vendors:
            mapped_specialty = map_specialty_to_enum(v['specialty'])
            print(f"  - {v['name']} ({v['specialty']} -> {mapped_specialty}) - {v['email']}")
            print(f"    Reason: {v['reason']}")
        return

    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor()

    added = 0
    for v in vendors:
        try:
            mapped_specialty = map_specialty_to_enum(v['specialty'])
            cur.execute("""
                INSERT INTO vendors (name, email, specialty, notes, is_active)
                VALUES (%s, %s, %s, %s, TRUE)
                ON CONFLICT DO NOTHING
                RETURNING id
            """, (
                v["name"],
                v["email"],
                mapped_specialty,
                f"Auto-discovered from email analysis. {v['reason']}"
            ))
            if cur.fetchone():
                added += 1
                print(f"  ✅ Added: {v['name']} ({mapped_specialty})")
            else:
                print(f"  ⏭️  Skipped (already exists): {v['name']}")
            conn.commit()  # Commit after each insert to avoid transaction issues
        except Exception as e:
            conn.rollback()
            print(f"  ❌ Error adding {v['name']}: {e}")

    cur.close()
    conn.close()

    print(f"\n✅ Added {added} new vendors to database.")


def main():
    print("=" * 60)
    print("  VENDOR EXTRACTION FROM EMAIL ANALYSIS")
    print("  Using Claude AI to identify property-related vendors")
    print("=" * 60)

    # Load analysis data
    print("\n📊 Loading email analysis data...")
    analysis = load_email_analysis()
    print(f"  Total emails: {analysis['totalEmails']}")
    print(f"  Unique senders: {analysis['uniqueSenders']}")
    print(f"  Already matched vendors: {len(analysis.get('matchedVendors', []))}")
    print(f"  Unmatched senders: {len(analysis.get('unmatchedSenders', []))}")

    # Get existing vendors
    print("\n📦 Getting existing vendors from database...")
    existing = get_existing_vendors()
    print(f"  Found {len(existing)} existing vendors")
    existing_emails = {v[2].lower() if v[2] else "" for v in existing}

    # Initialize Claude client
    client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)

    # Search for SmartHaven specifically
    av_vendors = search_for_smarthaven(analysis, client)

    # Analyze unmatched senders with Claude
    print("\n🤖 Analyzing unmatched senders with Claude Haiku...")
    unmatched = analysis.get("unmatchedSenders", [])

    # Filter out senders that are already in the database
    unmatched_filtered = [
        s for s in unmatched
        if s["email"].lower() not in existing_emails
    ]
    print(f"  Analyzing {len(unmatched_filtered[:100])} senders (top 100 by frequency)...")

    potential_vendors = analyze_senders_with_claude(unmatched_filtered, client)

    print(f"\n📋 Claude identified {len(potential_vendors)} potential property-related vendors:")
    for v in potential_vendors:
        confidence_icon = "🟢" if v.get("confidence") == "high" else ("🟡" if v.get("confidence") == "medium" else "🔴")
        print(f"  {confidence_icon} {v['name']} ({v['specialty']}) - {v['email']}")
        print(f"      {v['reason']}")

    # Filter high-confidence vendors
    high_confidence = [v for v in potential_vendors if v.get("confidence") in ["high", "medium"]]

    # Add to database (dry run first)
    print("\n" + "=" * 60)
    print("  ADDING VENDORS TO DATABASE")
    print("=" * 60)

    # First do a dry run
    add_vendors_to_database(high_confidence, dry_run=True)

    # Then actually add them
    print("\n🚀 Now adding vendors for real...")
    add_vendors_to_database(high_confidence, dry_run=False)

    # Save full analysis to file
    output_path = Path(__file__).parent.parent / "vendor-analysis-results.json"
    with open(output_path, "w") as f:
        json.dump({
            "analyzed_at": analysis.get("analyzedAt"),
            "av_vendors_found": av_vendors[:20] if av_vendors else [],
            "potential_vendors": potential_vendors,
            "added_vendors": high_confidence
        }, f, indent=2)

    print(f"\n💾 Full analysis saved to: vendor-analysis-results.json")
    print("\n✅ Vendor extraction complete!")


if __name__ == "__main__":
    main()
