"""
Parse 2022 and 2023 FHSD election PDFs into JSON.
Uses pypdf for fast page-by-page extraction — only processes pages
containing 'FRANCIS HOWELL R-III SCHOOL BOARD'.
"""
import json
import re
import sys
import pypdf

FHSD_PRECINCTS = {
    "213","214","215","301","303","304","305","306","307",
    "316","317","401","506","508","509","510","511","512",
    "514","515","516","517","616","617","701","702","703",
    "704","705","706","707","708","709","710","711","712",
    "713","714"
}

def extract_fhsd_pages(pdf_path, section_title):
    """Return concatenated text of only the pages containing the FHSD section."""
    reader = pypdf.PdfReader(pdf_path)
    pages = []
    for page in reader.pages:
        text = page.extract_text() or ""
        if section_title in text:
            pages.append(text)
    return pages

def parse_candidate_names_2023(header_text):
    """
    Extract candidate names from the 2023 page header.
    Header has pairs like: DOUG\nZIEGEMEIER  ANDREW\nFLETT  ...  WRITE IN
    After pypdf extracts them they appear as 'DOUG\nZIEGEMEIER' etc.
    We just hard-code the known order since parsing multi-word split names is fragile.
    """
    return [
        "DOUG ZIEGEMEIER",
        "ANDREW FLETT",
        "AMY EASTERLING",
        "JANE PUSZKAR",
        "MARK PONDER",
        "RON HARMON",
        "HARRY HARRIS",
        # WRITE IN is last but we skip it
    ]

def parse_candidate_names_2022(header_text):
    return [
        "CHRISTINE HYMAN",
        "ADAM BERTRAND",
        "RANDY COOK JR.",
        "JUSTIN MCCOY",
        "RICK RICE",
        "MIKE HOEHN",
    ]

def parse_vote_pairs(token_str, n_candidates):
    """
    Parse 'votes pct% votes pct% ...' into list of (votes, pct) tuples.
    Returns list of n_candidates vote counts.
    """
    tokens = re.findall(r'(\d+)\s+([\d.]+)%', token_str)
    return [int(t[0]) for t in tokens[:n_candidates]]

def parse_data_row_2023(line, candidates):
    """
    Parse a 2023 row:
      213 2273 1013 88 8.69% 16 1.58% 89 8.79% 250 24.68% 247 24.38% 244 24.09% 78 7.70% 1 0.10%
      CENTRAL 1 0 15 3 20.00% ...
      ABSENTEE 0 3966 581 14.65% ...
    Returns (precinct_key, dict) or None.
    """
    # Match: precinct_id (number OR named like 'CENTRAL 1' or 'ABSENTEE') reg_voters total_votes ...
    m = re.match(
        r'^((?:\d{3}|CENTRAL \d|ABSENTEE))\s+(\d+)\s+(\d+)\s+(.*)',
        line.strip()
    )
    if not m:
        return None
    precinct = m.group(1)
    reg_voters = int(m.group(2))
    total_votes = int(m.group(3))
    rest = m.group(4)

    vote_counts = parse_vote_pairs(rest, len(candidates))
    if len(vote_counts) < len(candidates):
        return None  # malformed row

    row = {"reg_voters": reg_voters, "total_votes": total_votes}
    for cand, votes in zip(candidates, vote_counts):
        row[cand] = votes
    return precinct, row

def parse_data_row_2022(line, candidates):
    """
    Parse a 2022 row:
      15 WASHINGTON 2802 435 101 23.22% 103 23.68% ... 14 3.22% 49 11.26% 0 49
      ABSENTEE 0 1385 343 24.77% ...
      Total 94166 26875 5410 20.13% ...
    The precinct field is a number + NAME or 'ABSENTEE' or 'Total'.
    Ends with overvotes (integer) undervotes (integer) — no trailing %.
    """
    # Named precinct: "15 WASHINGTON", "100 McCLAY", etc.
    m = re.match(
        r'^(\d+\s+[A-Z][A-Z .\']+?)\s+(\d+)\s+(\d+)\s+(.*)',
        line.strip()
    )
    if not m:
        # Try ABSENTEE / Total
        m = re.match(r'^(ABSENTEE|Total)\s+(\d+)\s+(\d+)\s+(.*)', line.strip())
    if not m:
        return None

    label = m.group(1).strip()
    reg_voters = int(m.group(2))
    total_votes = int(m.group(3))
    rest = m.group(4)

    vote_counts = parse_vote_pairs(rest, len(candidates))
    if len(vote_counts) < len(candidates):
        return None

    # Extract precinct number from label
    num_match = re.match(r'^(\d+)', label)
    key = num_match.group(1) if num_match else label

    row = {
        "precinct_label": label,
        "reg_voters": reg_voters,
        "total_votes": total_votes,
    }
    for cand, votes in zip(candidates, vote_counts):
        row[cand] = votes
    return key, row


def build_totals(precincts_dict, candidates, absentee=None, central=None):
    """Sum all map precincts + non-map to get totals."""
    totals = {"registered_voters": 0, "total_votes": 0}
    for c in candidates:
        totals[c] = 0
    all_rows = list(precincts_dict.values())
    if absentee:
        all_rows += list(absentee.values())
    if central:
        all_rows += list(central.values())
    for row in all_rows:
        totals["registered_voters"] += row.get("reg_voters", 0)
        totals["total_votes"] += row.get("total_votes", 0)
        for c in candidates:
            totals[c] += row.get(c, 0)
    return totals


def parse_2023(pdf_path):
    print(f"  Loading {pdf_path} ...")
    pages = extract_fhsd_pages(pdf_path, "FRANCIS HOWELL R-III SCHOOL BOARD MEMBER")
    print(f"  Found {len(pages)} FHSD page(s)")

    candidates = parse_candidate_names_2023("")
    precincts = {}
    non_map = {}

    for page_text in pages:
        for line in page_text.split("\n"):
            result = parse_data_row_2023(line, candidates)
            if result is None:
                continue
            key, row = result
            if key == "Total":
                continue
            if key in ("CENTRAL 1", "CENTRAL 2", "ABSENTEE"):
                non_map[key] = row
            else:
                precincts[key] = row

    # Validate: check that all expected FHSD precincts are present
    missing = FHSD_PRECINCTS - set(precincts.keys())
    if missing:
        print(f"  WARNING: missing precincts: {sorted(missing)}")

    totals = build_totals(precincts, candidates, absentee=non_map)

    return {
        "year": 2023,
        "election_date": "2023-04-04",
        "race": "FRANCIS HOWELL R-III SCHOOL BOARD MEMBER",
        "seats": 3,
        "candidates": candidates,
        "slates": {
            "fh_families": ["JANE PUSZKAR", "MARK PONDER", "RON HARMON"],
            "fh_forward": ["ANDREW FLETT", "AMY EASTERLING", "HARRY HARRIS"],
            "independent": ["DOUG ZIEGEMEIER"]
        },
        "totals": totals,
        "precincts": {k: precincts[k] for k in sorted(precincts, key=lambda x: int(x) if x.isdigit() else 9999)},
        "non_map_precincts": non_map,
    }


def parse_2022(pdf_path):
    print(f"  Loading {pdf_path} ...")
    pages = extract_fhsd_pages(pdf_path, "FRANCIS HOWELL R-III SCHOOL BOARD")
    print(f"  Found {len(pages)} FHSD page(s)")

    candidates = parse_candidate_names_2022("")
    precincts = {}
    non_map = {}
    totals_row = None

    for page_text in pages:
        for line in page_text.split("\n"):
            result = parse_data_row_2022(line, candidates)
            if result is None:
                continue
            key, row = result
            if key == "Total":
                totals_row = row
                continue
            if row.get("precinct_label", key) == "ABSENTEE" or key == "ABSENTEE":
                non_map["ABSENTEE"] = row
            else:
                precincts[key] = row

    if totals_row:
        totals = {"registered_voters": totals_row["reg_voters"],
                  "total_votes": totals_row["total_votes"]}
        for c in candidates:
            totals[c] = totals_row.get(c, 0)
    else:
        totals = build_totals(precincts, candidates, absentee=non_map)

    return {
        "year": 2022,
        "election_date": "2022-04-05",
        "race": "FRANCIS HOWELL R-III SCHOOL BOARD",
        "seats": 2,
        "candidates": candidates,
        "slates": {
            "fh_families": ["ADAM BERTRAND", "RANDY COOK JR."],
            "fh_forward": ["CHRISTINE HYMAN", "JUSTIN MCCOY", "RICK RICE", "MIKE HOEHN"],
            "note": "No formal FH Forward slate in 2022. Non-FH Families grouped as opposition."
        },
        "note": (
            "2022 used different precinct names (e.g. '214 HAWK RIDGE'). "
            "Keys are old precinct numbers; 2023+ use new DIST_NUM. "
            "Per-precinct swing 2022→2023 not available due to redistricting."
        ),
        "totals": totals,
        "precincts": dict(sorted(precincts.items(), key=lambda x: int(x[0]) if x[0].isdigit() else 9999)),
        "non_map_precincts": non_map,
    }


def main():
    base = "c:/Election Map/fhsd-election-map/data"

    print("=== Parsing 2023 ===")
    r2023 = parse_2023(f"{base}/fhsd_2023.pdf")
    print(f"  Precincts: {len(r2023['precincts'])}")
    print(f"  213: {r2023['precincts'].get('213')}")
    print(f"  701: {r2023['precincts'].get('701')}")
    print(f"  Totals: {r2023['totals']}")
    with open(f"{base}/fhsd_2023.json", "w") as f:
        json.dump(r2023, f, indent=2)
    print("  Saved fhsd_2023.json\n")

    print("=== Parsing 2022 ===")
    r2022 = parse_2022(f"{base}/fhsd_2022.pdf")
    print(f"  Precincts: {len(r2022['precincts'])}")
    print(f"  214 (HAWK RIDGE): {r2022['precincts'].get('214')}")
    print(f"  Totals: {r2022['totals']}")
    with open(f"{base}/fhsd_2022.json", "w") as f:
        json.dump(r2022, f, indent=2)
    print("  Saved fhsd_2022.json")


if __name__ == "__main__":
    main()
