#!/usr/bin/env -S uv run python
"""
Extract property-related data from PDF files in Dropbox folders.
Uses pymupdf (fitz) to read PDFs and extract text.
"""

import fitz  # pymupdf
import json
import re
import os
from pathlib import Path
from datetime import datetime

# Property folders to scan
PROPERTY_FOLDERS = {
    "88 Williams St - Providence RI": os.path.expanduser(
        "~/AnneSpalterStudios Dropbox/Property Management/88 Williams St - Providence RI/"
    ),
    "34 N 7th St - Brooklyn": os.path.expanduser(
        "~/AnneSpalterStudios Dropbox/Property Management/34 N 7th St - Brooklyn/"
    ),
    "Paris - 8 Rue Guynemer": os.path.expanduser(
        "~/AnneSpalterStudios Dropbox/Property Management/Paris - 8 Rue Guynemer/"
    ),
    "Vermont": os.path.expanduser(
        "~/AnneSpalterStudios Dropbox/Property Management/Vermont/"
    ),
}

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

def extract_insurance_info(text: str, filename: str) -> dict:
    """Extract insurance-related information from text."""
    info = {
        "filename": filename,
        "policy_numbers": [],
        "coverage_amounts": [],
        "deductibles": [],
        "expiration_dates": [],
        "carriers": [],
        "premiums": [],
        "raw_excerpts": []
    }

    # Policy number patterns
    policy_patterns = [
        r'(?:policy\s*(?:number|#|no\.?)?[:\s]*)([\w\d-]+)',
        r'(?:Policy\s*Number[:\s]*)([\w\d-]+)',
        r'(?:POLICY[:\s]*)([\w\d-]+)',
    ]
    for pattern in policy_patterns:
        matches = re.findall(pattern, text, re.IGNORECASE)
        info["policy_numbers"].extend(matches)

    # Coverage amounts
    coverage_patterns = [
        r'(?:coverage|limit|dwelling)[:\s]*\$?([\d,]+(?:\.\d{2})?)',
        r'(?:Coverage\s*A[:\s]*)\$?([\d,]+)',
        r'(?:Dwelling[:\s]*)\$?([\d,]+)',
    ]
    for pattern in coverage_patterns:
        matches = re.findall(pattern, text, re.IGNORECASE)
        info["coverage_amounts"].extend(matches)

    # Deductibles
    deductible_patterns = [
        r'(?:deductible)[:\s]*\$?([\d,]+(?:\.\d{2})?)',
        r'(?:DEDUCTIBLE)[:\s]*\$?([\d,]+)',
    ]
    for pattern in deductible_patterns:
        matches = re.findall(pattern, text, re.IGNORECASE)
        info["deductibles"].extend(matches)

    # Dates (expiration, effective)
    date_patterns = [
        r'(?:expir(?:es|ation)|valid until|policy period ends)[:\s]*(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})',
        r'(?:Effective\s*Date)[:\s]*(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})',
        r'(\d{1,2}/\d{1,2}/\d{4})\s*(?:to|through)\s*(\d{1,2}/\d{1,2}/\d{4})',
    ]
    for pattern in date_patterns:
        matches = re.findall(pattern, text, re.IGNORECASE)
        if matches:
            for match in matches:
                if isinstance(match, tuple):
                    info["expiration_dates"].extend(match)
                else:
                    info["expiration_dates"].append(match)

    # Premium amounts
    premium_patterns = [
        r'(?:premium|annual\s*premium|total\s*premium)[:\s]*\$?([\d,]+(?:\.\d{2})?)',
        r'(?:PREMIUM)[:\s]*\$?([\d,]+)',
    ]
    for pattern in premium_patterns:
        matches = re.findall(pattern, text, re.IGNORECASE)
        info["premiums"].extend(matches)

    # Insurance carriers
    carriers = [
        "Berkley One", "Berkeley One", "BERKLEY",
        "GEICO", "Nationwide", "State Farm", "Allstate",
        "Chubb", "AXA", "MAIF", "Allianz", "AIG",
        "W. R. Berkley"
    ]
    for carrier in carriers:
        if carrier.lower() in text.lower():
            info["carriers"].append(carrier)

    # Clean up duplicates
    for key in ["policy_numbers", "coverage_amounts", "deductibles",
                "expiration_dates", "carriers", "premiums"]:
        info[key] = list(set(info[key]))

    return info

def extract_tax_info(text: str, filename: str) -> dict:
    """Extract tax-related information from text."""
    info = {
        "filename": filename,
        "assessed_values": [],
        "tax_amounts": [],
        "due_dates": [],
        "parcel_ids": [],
        "tax_years": [],
        "installments": [],
        "raw_excerpts": []
    }

    # Assessed values
    assessed_patterns = [
        r'(?:assessed\s*value|assessment)[:\s]*\$?([\d,]+)',
        r'(?:ASSESSED\s*VALUE)[:\s]*\$?([\d,]+)',
        r'(?:Total\s*Assessment)[:\s]*\$?([\d,]+)',
    ]
    for pattern in assessed_patterns:
        matches = re.findall(pattern, text, re.IGNORECASE)
        info["assessed_values"].extend(matches)

    # Tax amounts
    tax_patterns = [
        r'(?:tax\s*(?:amount|due|bill))[:\s]*\$?([\d,]+(?:\.\d{2})?)',
        r'(?:Total\s*Tax)[:\s]*\$?([\d,]+)',
        r'(?:Amount\s*Due)[:\s]*\$?([\d,]+)',
        r'(?:quarterly|semi-annual)\s*(?:payment|tax)[:\s]*\$?([\d,]+)',
    ]
    for pattern in tax_patterns:
        matches = re.findall(pattern, text, re.IGNORECASE)
        info["tax_amounts"].extend(matches)

    # Due dates
    due_patterns = [
        r'(?:due\s*date|payment\s*due)[:\s]*(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})',
        r'(?:DUE)[:\s]*(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})',
    ]
    for pattern in due_patterns:
        matches = re.findall(pattern, text, re.IGNORECASE)
        info["due_dates"].extend(matches)

    # Parcel/SPAN/Block-Lot IDs
    id_patterns = [
        r'(?:SPAN|parcel|APN)[:\s#]*([\d-]+)',
        r'(?:Block)[:\s]*(\d+)[\s,]*(?:Lot)[:\s]*(\d+)',
    ]
    for pattern in id_patterns:
        matches = re.findall(pattern, text, re.IGNORECASE)
        for match in matches:
            if isinstance(match, tuple):
                info["parcel_ids"].append(f"Block {match[0]}, Lot {match[1]}")
            else:
                info["parcel_ids"].append(match)

    # Tax years
    year_patterns = [
        r'(?:tax\s*year|fiscal\s*year)[:\s]*(\d{4})',
        r'(\d{4})\s*[-/]\s*(\d{4})\s*(?:tax)',
    ]
    for pattern in year_patterns:
        matches = re.findall(pattern, text, re.IGNORECASE)
        for match in matches:
            if isinstance(match, tuple):
                info["tax_years"].append(f"{match[0]}-{match[1]}")
            else:
                info["tax_years"].append(match)

    # Clean up
    for key in ["assessed_values", "tax_amounts", "due_dates", "parcel_ids", "tax_years"]:
        info[key] = list(set(info[key]))

    return info

def extract_maintenance_contract_info(text: str, filename: str) -> dict:
    """Extract maintenance contract information."""
    info = {
        "filename": filename,
        "vendor_names": [],
        "contract_amounts": [],
        "terms": [],
        "expiration_dates": [],
        "services": [],
        "raw_excerpts": []
    }

    # Contract amounts
    amount_patterns = [
        r'(?:total|contract\s*amount|annual|monthly)[:\s]*\$?([\d,]+(?:\.\d{2})?)',
        r'(?:TOTAL)[:\s]*\$?([\d,]+)',
    ]
    for pattern in amount_patterns:
        matches = re.findall(pattern, text, re.IGNORECASE)
        info["contract_amounts"].extend(matches)

    # Terms (monthly, annual, etc.)
    term_patterns = [
        r'(annual|monthly|quarterly|semi-annual)\s*(?:contract|service|maintenance)',
        r'(?:term)[:\s]*(\d+)\s*(year|month)',
    ]
    for pattern in term_patterns:
        matches = re.findall(pattern, text, re.IGNORECASE)
        for match in matches:
            if isinstance(match, tuple):
                info["terms"].append(f"{match[0]} {match[1]}")
            else:
                info["terms"].append(match)

    # Dates
    date_patterns = [
        r'(?:expires?|valid\s*(?:until|through)|end\s*date)[:\s]*(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})',
    ]
    for pattern in date_patterns:
        matches = re.findall(pattern, text, re.IGNORECASE)
        info["expiration_dates"].extend(matches)

    # Service types
    service_keywords = [
        "HVAC", "elevator", "landscaping", "cleaning", "maintenance",
        "inspection", "pest control", "snow removal", "plumbing", "electrical"
    ]
    for service in service_keywords:
        if service.lower() in text.lower():
            info["services"].append(service)

    # Clean up
    for key in ["contract_amounts", "terms", "expiration_dates", "services"]:
        info[key] = list(set(info[key]))

    return info

def extract_utility_info(text: str, filename: str) -> dict:
    """Extract utility account information."""
    info = {
        "filename": filename,
        "account_numbers": [],
        "providers": [],
        "utility_types": [],
        "raw_excerpts": []
    }

    # Account numbers
    account_patterns = [
        r'(?:account\s*(?:number|#|no\.?))[:\s]*([\w\d-]+)',
        r'(?:ACCT)[:\s#]*([\w\d-]+)',
    ]
    for pattern in account_patterns:
        matches = re.findall(pattern, text, re.IGNORECASE)
        info["account_numbers"].extend(matches)

    # Utility types
    utility_keywords = [
        "electric", "gas", "water", "sewer", "internet",
        "cable", "phone", "trash", "oil", "propane"
    ]
    for utility in utility_keywords:
        if utility.lower() in text.lower():
            info["utility_types"].append(utility)

    # Clean up
    for key in ["account_numbers", "providers", "utility_types"]:
        info[key] = list(set(info[key]))

    return info

def categorize_pdf(filepath: str) -> str:
    """Categorize a PDF based on its path and name."""
    filepath_lower = filepath.lower()
    if "insurance" in filepath_lower:
        return "insurance"
    elif "tax" in filepath_lower:
        return "tax"
    elif any(x in filepath_lower for x in ["hvac", "elevator", "maintenance", "contract", "service"]):
        return "maintenance"
    elif any(x in filepath_lower for x in ["utility", "electric", "gas", "water"]):
        return "utility"
    elif "bill" in filepath_lower:
        return "bill"
    elif "condo" in filepath_lower or "hoa" in filepath_lower:
        return "hoa"
    else:
        return "other"

def process_property(property_name: str, folder_path: str) -> dict:
    """Process all PDFs in a property folder."""
    result = {
        "property_name": property_name,
        "folder_path": folder_path,
        "insurance": [],
        "taxes": [],
        "maintenance_contracts": [],
        "utilities": [],
        "hoa": [],
        "other_documents": [],
        "extraction_errors": []
    }

    if not os.path.exists(folder_path):
        result["extraction_errors"].append(f"Folder not found: {folder_path}")
        return result

    # Find all PDFs
    for root, dirs, files in os.walk(folder_path):
        for file in files:
            if file.lower().endswith('.pdf'):
                filepath = os.path.join(root, file)
                relative_path = filepath.replace(folder_path, "")

                print(f"  Processing: {relative_path}")

                # Extract text
                text = extract_text_from_pdf(filepath)
                if text.startswith("ERROR:"):
                    result["extraction_errors"].append({
                        "file": relative_path,
                        "error": text
                    })
                    continue

                # Categorize and extract relevant info
                category = categorize_pdf(filepath)

                if category == "insurance":
                    info = extract_insurance_info(text, relative_path)
                    info["raw_text_preview"] = text[:1500] if len(text) > 1500 else text
                    result["insurance"].append(info)
                elif category == "tax":
                    info = extract_tax_info(text, relative_path)
                    info["raw_text_preview"] = text[:1500] if len(text) > 1500 else text
                    result["taxes"].append(info)
                elif category == "maintenance":
                    info = extract_maintenance_contract_info(text, relative_path)
                    info["raw_text_preview"] = text[:1500] if len(text) > 1500 else text
                    result["maintenance_contracts"].append(info)
                elif category == "utility":
                    info = extract_utility_info(text, relative_path)
                    info["raw_text_preview"] = text[:1500] if len(text) > 1500 else text
                    result["utilities"].append(info)
                elif category == "hoa":
                    info = {"filename": relative_path, "raw_text_preview": text[:2000]}
                    result["hoa"].append(info)
                else:
                    # For other documents, just store filename and brief content preview
                    info = {
                        "filename": relative_path,
                        "raw_text_preview": text[:1000] if len(text) > 1000 else text
                    }
                    result["other_documents"].append(info)

    return result

def main():
    """Main extraction function."""
    all_results = {}

    for property_name, folder_path in PROPERTY_FOLDERS.items():
        print(f"\n{'='*60}")
        print(f"Processing: {property_name}")
        print(f"{'='*60}")

        result = process_property(property_name, folder_path)
        all_results[property_name] = result

    # Output results
    output_path = "/Users/toddhome/repo/propertymanagement/scripts/property_data_extraction.json"
    with open(output_path, 'w') as f:
        json.dump(all_results, f, indent=2)

    print(f"\n\nResults saved to: {output_path}")

    # Print summary
    print("\n" + "="*60)
    print("EXTRACTION SUMMARY")
    print("="*60)
    for prop_name, data in all_results.items():
        print(f"\n{prop_name}:")
        print(f"  Insurance documents: {len(data['insurance'])}")
        print(f"  Tax documents: {len(data['taxes'])}")
        print(f"  Maintenance contracts: {len(data['maintenance_contracts'])}")
        print(f"  Utility documents: {len(data['utilities'])}")
        print(f"  HOA documents: {len(data['hoa'])}")
        print(f"  Other documents: {len(data['other_documents'])}")
        print(f"  Extraction errors: {len(data['extraction_errors'])}")

    return all_results

if __name__ == "__main__":
    main()
