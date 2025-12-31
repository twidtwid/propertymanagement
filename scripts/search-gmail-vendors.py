#!/usr/bin/env python3
"""
Search Gmail for specific vendor names and A/V-related terms.
"""

import json
import base64
import os
import sys
from pathlib import Path

# We need to use the existing Node.js googleapis setup
# For now, let's search the raw JSON data more thoroughly

# Load environment variables
env_path = Path(__file__).parent.parent / ".env.local"
env_vars = {}
if env_path.exists():
    for line in env_path.read_text().splitlines():
        if "=" in line and not line.startswith("#"):
            key, value = line.split("=", 1)
            env_vars[key.strip()] = value.strip()


def search_email_analysis():
    """Search through the email analysis for specific vendors."""
    analysis_path = Path(__file__).parent.parent / "email-analysis-2025.json"

    with open(analysis_path) as f:
        data = json.load(f)

    # Terms to search for
    search_terms = [
        # A/V and smart home
        "smarthaven", "smart haven", "smart-haven",
        "audio", "video", "a/v", "av ",
        "sonos", "lutron", "control4", "crestron", "savant",
        "home theater", "cinema",
        "automation", "adt", "vivint", "ring",

        # Contractors and services
        "hvac", "plumb", "electric", "roof",
        "landscap", "tree", "lawn",
        "pool", "spa", "pest",
        "clean", "alarm", "security",

        # Vermont specific
        "vermont", "vt", "brattleboro", "dummerston",

        # Rhode Island specific
        "providence", "rhode island", "ri",

        # Brooklyn specific
        "brooklyn", "williamsburg",

        # Property-related
        "property", "maintenance", "repair", "install",
        "contractor", "service",
    ]

    all_senders = data.get("topSenders", []) + data.get("unmatchedSenders", [])

    # Remove duplicates
    seen = set()
    unique_senders = []
    for s in all_senders:
        if s["email"] not in seen:
            seen.add(s["email"])
            unique_senders.append(s)

    print(f"Searching {len(unique_senders)} unique senders...")
    print("=" * 60)

    matches = {}
    for term in search_terms:
        term_lower = term.lower()
        for sender in unique_senders:
            email = sender.get("email", "").lower()
            name = (sender.get("name") or "").lower()

            if term_lower in email or term_lower in name:
                if sender["email"] not in matches:
                    matches[sender["email"]] = {
                        "sender": sender,
                        "matched_terms": []
                    }
                matches[sender["email"]]["matched_terms"].append(term)

    # Group by category
    categories = {
        "A/V & Smart Home": ["smarthaven", "smart haven", "smart-haven", "audio", "video", "a/v", "av ", "sonos", "lutron", "control4", "crestron", "savant", "home theater", "cinema", "automation", "adt", "vivint", "ring"],
        "HVAC/Plumbing/Electrical": ["hvac", "plumb", "electric"],
        "Exterior Services": ["landscap", "tree", "lawn", "pool", "spa", "roof"],
        "Cleaning & Pest": ["clean", "pest"],
        "Security": ["alarm", "security"],
        "Property Services": ["property", "maintenance", "repair", "install", "contractor", "service"],
        "Local (VT)": ["vermont", "vt", "brattleboro", "dummerston"],
        "Local (RI)": ["providence", "rhode island", "ri"],
        "Local (Brooklyn)": ["brooklyn", "williamsburg"],
    }

    for category, terms in categories.items():
        category_matches = [
            m for email, m in matches.items()
            if any(t in m["matched_terms"] for t in terms)
        ]
        if category_matches:
            print(f"\n{category}:")
            for m in sorted(category_matches, key=lambda x: -x["sender"]["count"]):
                s = m["sender"]
                terms_str = ", ".join(m["matched_terms"])
                print(f"  {s['count']:4}x  {s['email'][:45]:45}  {(s.get('name') or '')[:30]:30}  [{terms_str}]")

    # Also look for potential local vendors by domain
    print("\n" + "=" * 60)
    print("POTENTIAL LOCAL VENDORS (non-corporate domains):")
    print("=" * 60)

    corporate_domains = [
        "gmail.com", "yahoo.com", "outlook.com", "hotmail.com", "icloud.com",
        "amazon", "google", "facebook", "twitter", "instagram", "linkedin",
        "nytimes", "bloomberg", "wsj", "washingtonpost", "newyorker",
        "substack", "mailchimp", "constantcontact", "sendgrid",
        "shopify", "squarespace", "wix",
        "paypal", "stripe", "square",
        "uber", "lyft", "doordash",
        "nextdoor", "reddit", "pinterest",
    ]

    local_vendors = []
    for sender in unique_senders:
        email = sender.get("email", "").lower()
        count = sender.get("count", 0)

        # Skip very low or very high frequency
        if count < 2 or count > 200:
            continue

        # Skip corporate domains
        is_corporate = any(corp in email for corp in corporate_domains)
        if is_corporate:
            continue

        # Skip obvious marketing/noreply
        if any(x in email for x in ["noreply", "no-reply", "donotreply", "newsletter", "marketing", "promo", "news@", "info@lists"]):
            continue

        local_vendors.append(sender)

    # Sort by count
    local_vendors.sort(key=lambda x: -x["count"])

    for s in local_vendors[:50]:
        print(f"  {s['count']:4}x  {s['email'][:50]:50}  {(s.get('name') or '')[:35]}")


if __name__ == "__main__":
    search_email_analysis()
