#!/usr/bin/env -S uv run python
"""
Extract property-related data from PDF files - Version 2
More targeted extraction with cleaner results.
"""

import fitz  # pymupdf
import json
import re
import os
from pathlib import Path

def extract_text_from_pdf(pdf_path: str) -> str:
    """Extract all text from a PDF file."""
    try:
        doc = fitz.open(pdf_path)
        text = ""
        for page in doc:
            text += page.get_text()
        doc.close()
        return text
    except Exception as e:
        return f"ERROR: {str(e)}"

def clean_text(text: str) -> str:
    """Clean extracted text."""
    # Remove excessive whitespace
    text = re.sub(r'\s+', ' ', text)
    return text.strip()

def extract_dollar_amounts(text: str) -> list:
    """Extract dollar amounts from text."""
    # Match $X,XXX.XX or $X,XXX,XXX.XX patterns
    pattern = r'\$[\d,]+(?:\.\d{2})?'
    matches = re.findall(pattern, text)
    return list(set(matches))

def extract_dates(text: str) -> list:
    """Extract dates in various formats."""
    patterns = [
        r'\d{1,2}/\d{1,2}/\d{4}',  # MM/DD/YYYY
        r'\d{1,2}/\d{1,2}/\d{2}',  # MM/DD/YY
        r'(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{1,2},?\s+\d{4}',  # Month DD, YYYY
    ]
    dates = []
    for pattern in patterns:
        matches = re.findall(pattern, text, re.IGNORECASE)
        dates.extend(matches)
    return list(set(dates))

def process_providence_insurance(folder_path: str) -> dict:
    """Process Providence RI insurance documents."""
    results = {
        "property": "88 Williams St, Providence, RI",
        "policies": []
    }

    insurance_folder = os.path.join(folder_path, "Insurance")
    if not os.path.exists(insurance_folder):
        return results

    for filename in os.listdir(insurance_folder):
        if filename.lower().endswith('.pdf'):
            filepath = os.path.join(insurance_folder, filename)
            text = extract_text_from_pdf(filepath)

            policy = {"filename": filename, "type": "homeowners"}

            # Extract policy number (HO followed by digits)
            policy_match = re.search(r'(HO\d+)', text)
            if policy_match:
                policy["policy_number"] = policy_match.group(1)

            # Extract policy period dates
            period_match = re.search(r'Policy Period:\s*(?:to)?\s*(\d{2}/\d{2}/\d{4})\s*(?:to)?\s*(\d{2}/\d{2}/\d{4})?', text)
            if not period_match:
                period_match = re.search(r'(\d{2}/\d{2}/\d{4})\s+(\d{2}/\d{2}/\d{4})\s+at\s+12:01', text)
            if period_match:
                policy["effective_date"] = period_match.group(1) if period_match.group(1) else None
                policy["expiration_date"] = period_match.group(2) if len(period_match.groups()) > 1 and period_match.group(2) else None

            # Extract dwelling coverage
            dwelling_match = re.search(r'Dwelling[:\s]+(?:Guaranteed Replacement Cost)?[:\s]*\$?([\d,]+)', text)
            if dwelling_match:
                policy["dwelling_coverage"] = f"${dwelling_match.group(1)}"

            # Extract other structures coverage
            other_match = re.search(r'Other Structures[:\s]+(?:Fixed Replacement Cost)?[:\s]*\$?([\d,]+)', text)
            if other_match:
                policy["other_structures_coverage"] = f"${other_match.group(1)}"

            # Extract contents coverage
            contents_match = re.search(r'Contents[:\s]+\$?([\d,]+)', text)
            if contents_match:
                policy["contents_coverage"] = f"${contents_match.group(1)}"

            # Extract liability coverage
            liability_match = re.search(r'Personal Liability[:\s]+\$?([\d,]+)', text)
            if liability_match:
                policy["personal_liability"] = f"${liability_match.group(1)}"

            # Extract deductible
            deductible_match = re.search(r'Base Deductible[:\s]+\$?([\d,]+)', text)
            if deductible_match:
                policy["deductible"] = f"${deductible_match.group(1)}"

            # Extract premium
            premium_match = re.search(r'(?:Base Policy Premium|Annual Premium|Total Premium)[:\s]+\$?([\d,]+(?:\.\d{2})?)', text)
            if premium_match:
                policy["annual_premium"] = f"${premium_match.group(1)}"

            # Carrier
            if "Berkley" in text or "BERKLEY" in text:
                policy["carrier"] = "Berkley One"

            # Address from policy
            addr_match = re.search(r'Residence Premises.*?(\d+\s+[^,\n]+,\s*Providence,\s*RI\s*\d{5})', text, re.DOTALL)
            if addr_match:
                policy["property_address"] = addr_match.group(1).strip()

            results["policies"].append(policy)

    return results

def process_providence_taxes(folder_path: str) -> dict:
    """Process Providence RI tax documents."""
    results = {
        "property": "88 Williams St, Providence, RI",
        "parcel_id": "016-0200-0000",
        "tax_records": []
    }

    taxes_folder = os.path.join(folder_path, "Taxes")
    if not os.path.exists(taxes_folder):
        return results

    for filename in os.listdir(taxes_folder):
        if filename.lower().endswith('.pdf'):
            filepath = os.path.join(taxes_folder, filename)
            text = extract_text_from_pdf(filepath)

            record = {"filename": filename}

            # Extract parcel ID
            parcel_match = re.search(r'(\d{3}-\d{4}-\d{4})', text)
            if parcel_match:
                record["parcel_id"] = parcel_match.group(1)

            # Extract tax amounts
            amounts = extract_dollar_amounts(text)
            if amounts:
                record["amounts_found"] = amounts

            # Extract payment info
            if "ECHECK" in text or "eCheck" in text:
                record["payment_method"] = "eCheck"

            # Look for quarterly info
            if "quarterly" in text.lower() or "installment" in text.lower():
                record["payment_schedule"] = "quarterly"

            results["tax_records"].append(record)

    return results

def process_providence_elevator(folder_path: str) -> dict:
    """Process Providence elevator maintenance contracts."""
    results = {
        "property": "88 Williams St, Providence, RI",
        "contracts": []
    }

    elevator_folder = os.path.join(folder_path, "Elevator")
    if not os.path.exists(elevator_folder):
        return results

    for filename in os.listdir(elevator_folder):
        if filename.lower().endswith('.pdf'):
            filepath = os.path.join(elevator_folder, filename)
            text = extract_text_from_pdf(filepath)

            contract = {"filename": filename, "service_type": "elevator"}

            # Extract vendor name
            if "Otis" in text:
                contract["vendor"] = "Otis Elevator"

            # Look for equipment ID
            equip_match = re.search(r'(?:Unit|Equipment|ID)[:\s#]*(\d{5,})', text)
            if equip_match:
                contract["equipment_id"] = equip_match.group(1)

            # Look for service type
            if "Semi Annual" in text or "semi-annual" in text.lower():
                contract["service_frequency"] = "semi-annual"
            elif "Annual" in text or "annual" in text.lower():
                contract["service_frequency"] = "annual"

            # Extract amounts
            amounts = extract_dollar_amounts(text)
            if amounts:
                contract["contract_amounts"] = amounts

            results["contracts"].append(contract)

    return results

def process_brooklyn_insurance(folder_path: str) -> dict:
    """Process Brooklyn insurance documents."""
    results = {
        "property": "34 N 7th St, Brooklyn, NY (PH2E & PH2F)",
        "policies": []
    }

    insurance_folder = os.path.join(folder_path, "Insurance")
    if not os.path.exists(insurance_folder):
        return results

    for filename in os.listdir(insurance_folder):
        if filename.lower().endswith('.pdf'):
            filepath = os.path.join(insurance_folder, filename)
            text = extract_text_from_pdf(filepath)

            policy = {"filename": filename}

            # Extract policy number
            policy_match = re.search(r'(?:Policy|Number)[:\s]*([\w\d]+)', text)
            if policy_match:
                policy["policy_number"] = policy_match.group(1)

            # Determine if condo policy
            if "condo" in text.lower() or "condominium" in text.lower():
                policy["type"] = "condo"

            # Check for mortgage clause info
            if "Wells Fargo" in text or "mortgage" in text.lower():
                policy["mortgage_info"] = True
                # Extract loan number
                loan_match = re.search(r'Loan\s*(?:number)?[:\s]*(\d+)', text)
                if loan_match:
                    policy["loan_number"] = loan_match.group(1)

            # Extract amounts
            amounts = extract_dollar_amounts(text)
            if amounts:
                policy["coverage_amounts"] = amounts

            results["policies"].append(policy)

    return results

def process_brooklyn_hvac(folder_path: str) -> dict:
    """Process Brooklyn HVAC contracts."""
    results = {
        "property": "34 N 7th St, Brooklyn, NY (PH2E & PH2F)",
        "contracts": []
    }

    hvac_folder = os.path.join(folder_path, "HVAC")
    if not os.path.exists(hvac_folder):
        return results

    for filename in os.listdir(hvac_folder):
        if filename.lower().endswith('.pdf'):
            filepath = os.path.join(hvac_folder, filename)
            text = extract_text_from_pdf(filepath)

            contract = {"filename": filename, "service_type": "HVAC"}

            # Extract vendor
            if "Major Air" in text:
                contract["vendor"] = "Major Air"

            # Check for maintenance contract
            if "maintenance" in text.lower() or "service contract" in text.lower():
                contract["contract_type"] = "maintenance"

            # Extract amounts
            amounts = extract_dollar_amounts(text)
            if amounts:
                contract["amounts"] = amounts

            # Look for semi-annual inspection info
            if "semi-annual" in text.lower() or "Semi-Annual" in text:
                contract["service_frequency"] = "semi-annual"

            results["contracts"].append(contract)

    return results

def process_brooklyn_hoa(folder_path: str) -> dict:
    """Process Brooklyn HOA/Condo documents."""
    results = {
        "property": "34 N 7th St, Brooklyn, NY (PH2E & PH2F)",
        "hoa_info": []
    }

    hoa_folder = os.path.join(folder_path, "Condo & HOA")
    if not os.path.exists(hoa_folder):
        return results

    for filename in os.listdir(hoa_folder):
        if filename.lower().endswith('.pdf'):
            filepath = os.path.join(hoa_folder, filename)
            text = extract_text_from_pdf(filepath)

            info = {"filename": filename}

            # Extract management company
            if "AKAM" in text or "akam" in text.lower():
                info["management_company"] = "AKAM"

            # Extract amounts (likely HOA fees)
            amounts = extract_dollar_amounts(text)
            if amounts:
                info["amounts"] = amounts

            results["hoa_info"].append(info)

    return results

def process_brooklyn_taxes(folder_path: str) -> dict:
    """Process Brooklyn tax documents."""
    results = {
        "property": "34 N 7th St, Brooklyn, NY (PH2E & PH2F)",
        "block": "02324",
        "lot_ph2e": "1305",
        "lot_ph2f": "1306",
        "tax_records": []
    }

    taxes_folder = os.path.join(folder_path, "Taxes")
    if not os.path.exists(taxes_folder):
        return results

    for filename in os.listdir(taxes_folder):
        if filename.lower().endswith('.pdf'):
            filepath = os.path.join(taxes_folder, filename)
            text = extract_text_from_pdf(filepath)

            record = {"filename": filename}

            # Extract amounts
            amounts = extract_dollar_amounts(text)
            if amounts:
                record["amounts"] = amounts

            # Check which unit
            if "PH2E" in text or "PH 2E" in text:
                record["unit"] = "PH2E"
            if "PH2F" in text or "PH 2F" in text:
                record["unit"] = "PH2F"

            results["tax_records"].append(record)

    return results

def process_paris_insurance(folder_path: str) -> dict:
    """Process Paris insurance documents."""
    results = {
        "property": "8 Rue Guynemer, Paris, France",
        "policies": []
    }

    insurance_folder = os.path.join(folder_path, "Insurance")
    if not os.path.exists(insurance_folder):
        return results

    for filename in os.listdir(insurance_folder):
        if filename.lower().endswith('.pdf'):
            filepath = os.path.join(insurance_folder, filename)
            text = extract_text_from_pdf(filepath)

            policy = {"filename": filename}

            # Extract policy/contract number
            contract_match = re.search(r'(?:Contrat|N[°o]|Reference)[:\s]*([\w\d-]+)', text, re.IGNORECASE)
            if contract_match:
                policy["contract_number"] = contract_match.group(1)

            # Look for "Attestation" documents
            if "Attestation" in text or "attestation" in text.lower():
                policy["document_type"] = "attestation"

            # Look for MRH (Multirisque Habitation)
            if "MRH" in text or "habitation" in text.lower():
                policy["type"] = "habitation (homeowners)"

            # Extract euro amounts
            euro_pattern = r'[\d,.\s]+(?:EUR|€|euros?)'
            euro_matches = re.findall(euro_pattern, text, re.IGNORECASE)
            if euro_matches:
                policy["amounts_eur"] = euro_matches[:5]  # Limit to first 5

            results["policies"].append(policy)

    return results

def process_vermont_taxes(folder_path: str) -> dict:
    """Process Vermont tax documents."""
    results = {
        "properties": [
            {"name": "Vermont Main House (2055 Sunset Lake Rd)", "span": "186-059-10695", "jurisdiction": "Dummerston"},
            {"name": "Booth House", "span": "186-059-10098", "jurisdiction": "Dummerston"},
            {"name": "Guest House (1910 Sunset Lake Rd)", "span": "186-059-10693", "jurisdiction": "Dummerston"},
            {"name": "Vermont Land", "span": "081-025-11151", "jurisdiction": "Brattleboro"},
        ],
        "tax_records": []
    }

    taxes_folder = os.path.join(folder_path, "Taxes")
    if not os.path.exists(taxes_folder):
        return results

    for filename in os.listdir(taxes_folder):
        if filename.lower().endswith('.pdf'):
            filepath = os.path.join(taxes_folder, filename)
            text = extract_text_from_pdf(filepath)

            record = {"filename": filename}

            # Extract SPAN numbers
            span_matches = re.findall(r'(\d{3}-\d{3}-\d{5})', text)
            if span_matches:
                record["span_numbers"] = list(set(span_matches))

            # Extract amounts
            amounts = extract_dollar_amounts(text)
            if amounts:
                record["amounts"] = amounts

            # Check jurisdiction
            if "Dummerston" in text:
                record["jurisdiction"] = "Dummerston"
            if "Brattleboro" in text:
                record["jurisdiction"] = "Brattleboro"

            # Extract due dates
            dates = extract_dates(text)
            if dates:
                record["dates_found"] = dates

            results["tax_records"].append(record)

    return results

def main():
    """Main extraction function."""
    base_path = os.path.expanduser("~/AnneSpalterStudios Dropbox/Property Management/")

    all_results = {
        "extraction_date": "2026-01-01",
        "properties": {}
    }

    # Providence RI
    providence_path = os.path.join(base_path, "88 Williams St - Providence RI")
    print("Processing Providence RI...")
    all_results["properties"]["88 Williams St - Providence RI"] = {
        "address": "88 Williams Street, Providence, RI 02906",
        "parcel_id": "016-0200-0000",
        "insurance": process_providence_insurance(providence_path),
        "taxes": process_providence_taxes(providence_path),
        "elevator_maintenance": process_providence_elevator(providence_path)
    }

    # Brooklyn
    brooklyn_path = os.path.join(base_path, "34 N 7th St - Brooklyn")
    print("Processing Brooklyn...")
    all_results["properties"]["34 N 7th St - Brooklyn"] = {
        "address": "34 N 7th Street, Brooklyn, NY 11249",
        "units": ["PH2E", "PH2F"],
        "block_lot": {"block": "02324", "lot_ph2e": "1305", "lot_ph2f": "1306"},
        "insurance": process_brooklyn_insurance(brooklyn_path),
        "taxes": process_brooklyn_taxes(brooklyn_path),
        "hvac_contracts": process_brooklyn_hvac(brooklyn_path),
        "hoa": process_brooklyn_hoa(brooklyn_path)
    }

    # Paris
    paris_path = os.path.join(base_path, "Paris - 8 Rue Guynemer")
    print("Processing Paris...")
    all_results["properties"]["Paris - 8 Rue Guynemer"] = {
        "address": "8 Rue Guynemer, 75006 Paris, France",
        "insurance": process_paris_insurance(paris_path)
    }

    # Vermont
    vermont_path = os.path.join(base_path, "Vermont")
    print("Processing Vermont...")
    all_results["properties"]["Vermont"] = {
        "properties_list": [
            {"name": "Main House", "address": "2055 Sunset Lake Rd, Dummerston, VT", "span": "186-059-10695"},
            {"name": "Booth House", "address": "Dummerston, VT", "span": "186-059-10098"},
            {"name": "Guest House", "address": "1910 Sunset Lake Rd, Dummerston, VT", "span": "186-059-10693"},
            {"name": "Land", "address": "Brattleboro, VT", "span": "081-025-11151"},
            {"name": "22 Kelly Road", "address": "22 Kelly Rd, Dummerston, VT"}
        ],
        "taxes": process_vermont_taxes(vermont_path)
    }

    # Save results
    output_path = "/Users/toddhome/repo/propertymanagement/scripts/property_data_structured.json"
    with open(output_path, 'w') as f:
        json.dump(all_results, f, indent=2)

    print(f"\nResults saved to: {output_path}")
    return all_results

if __name__ == "__main__":
    results = main()
    print("\n" + "="*60)
    print(json.dumps(results, indent=2))
