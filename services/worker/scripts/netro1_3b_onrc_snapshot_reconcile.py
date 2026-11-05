"""NET-RO1.3.B — read-only reconciliation against a local ONRC open-data snapshot.

Never downloads, imports, publishes, scrapes individuals, or reads database credentials.
ONRC snapshots are historical, not real-time identity/rights verification.
Only company identity fields are projected; no representative/contact data is read.
"""
from __future__ import annotations

import argparse
from collections import defaultdict
import csv
from datetime import date
import json
from pathlib import Path
import re
import unicodedata
from urllib.parse import urlparse

DATA = Path(__file__).resolve().parents[1] / "data"
LEDGER = DATA / "netro1_first50_qualification_ledger_20261105.json"
OBSERVATIONS = DATA / "netro1_3_identity_evidence_observations_20261105.json"
SNAPSHOT_DATE = "2026-10-19"
EXPECTED_LICENSE = {"cc-by-4.0", "cc-by-4.0-international"}
# Pinned from 2026-10-19 ONRC official resource links surfaced through
# the government catalogue and referenced by a public-source index.
# This is a resource identity check, NOT independent authenticated origin
# verification, licensing approval, file content retrieval or live ONRC status.
PINNED_COMPANIES_PACKAGE = "1962670f-acda-41b5-b52c-c430d7a1ef5e"
PINNED_ONRC_RESOURCES = {
    "OD_FIRME": (
        "361e52e3-4590-40af-ae0f-8a15089fc927",
        "https://data.gov.ro/dataset/1962670f-acda-41b5-b52c-c430d7a1ef5e/resource/361e52e3-4590-40af-ae0f-8a15089fc927/download/od_firme.csv",
    ),
    "OD_STARE_FIRMA": (
        "0689b858-8371-44ec-bc2f-0fc6e5ae2fcc",
        "https://data.gov.ro/dataset/1962670f-acda-41b5-b52c-c430d7a1ef5e/resource/0689b858-8371-44ec-bc2f-0fc6e5ae2fcc/download/od_stare_firma.csv",
    ),
}
FIELDS = {
    "name": ("DENUMIRE", "DENUMIRE_FIRMA", "DENUMIRE_PROFESIONIST", "DENUMIRE_SOCIETATE"),
    "cui": ("CUI", "COD_UNIC_INREGISTRARE", "COD_UNIC_DE_INREGISTRARE", "COD_FISCAL"),
    "key": ("COD_INMATRICULARE", "COD_INMATRICULARE_FIRMA"),
    "registry_no": ("NR_REG_COM", "NR_INREGISTRARE", "NUMAR_INREGISTRARE", "NR_REGISTRUL_COMERTULUI"),
    "status": ("COD_STARE_FIRMA", "STARE_FIRMA", "COD_STARE"),
    "legal_form": ("FORMA_JURIDICA", "DENUMIRE_FORMA_JURIDICA"),
}


def normalize_name(value: str) -> str:
    """Accent-insensitive comparison; legal suffixes are deliberately NOT stripped."""
    value = unicodedata.normalize("NFKD", value or "")
    value = "".join(c for c in value if not unicodedata.combining(c))
    value = value.translate(str.maketrans({"ș": "s", "Ș": "S", "ț": "t", "Ț": "T", "ş": "s", "ţ": "t"}))
    return "".join(c for c in value.casefold() if c.isalnum())


def is_corporate_entity(name: str, legal_form: str = "") -> bool:
    """Only company forms; never project a sole trader / PFA or natural-person row."""
    label = (name + " " + legal_form).upper()
    if re.search(r"\b(PFA|P\.F\.A\.|II|I\.I\.|IF|I\.F\.|PERSOANA FIZICA|INTREPRINDERE INDIVIDUALA|INTREPRINDERE FAMILIALA)\b", label):
        return False
    # Unknown numeric legal-form codes do not by themselves prove corporation.
    return bool(re.search(r"\b(S\.?R\.?L\.?|S\.?A\.?|SNC|SCS|SCA)\b", name.upper()) or
                re.search(r"\b(SOCIETATE CU RASPUNDERE LIMITATA|SOCIETATE PE ACTIUNI)\b", legal_form.upper()))


def normalize_cui(value: str | None) -> str:
    raw = re.sub(r"\s+", "", value or "").upper()
    if raw.startswith("RO"):
        raw = raw[2:]
    return raw if re.fullmatch(r"[0-9]{2,10}", raw) else ""


def col(columns: list[str], candidates: tuple[str, ...], *, required: bool = True) -> str | None:
    normalized = {re.sub(r"[^A-Z0-9]", "", c.upper().lstrip("\ufeff")): c for c in columns}
    for candidate in candidates:
        found = normalized.get(re.sub(r"[^A-Z0-9]", "", candidate.upper()))
        if found:
            return found
    if required:
        raise ValueError(f"Official CSV header missing mandatory column {candidates}; observed {columns!r}")
    return None


def load_catalog_metadata(path: Path) -> dict:
    """Read direct official CKAN package_show output; fail closed on mismatched metadata."""
    doc = json.loads(path.read_text(encoding="utf-8"))
    if doc.get("success") is not True:
        raise ValueError("Not a successful official CKAN package response")
    result = doc.get("result")
    if isinstance(result, dict) and "results" in result:
        raise ValueError("Refuse ambiguous package_search results; export one package_show record")
    if not isinstance(result, dict):
        raise ValueError("Missing CKAN result object")
    title = result.get("title", "")
    if result.get("id") != PINNED_COMPANIES_PACKAGE:
        raise ValueError("ONRC package ID does not match the pinned 2026-10-19 company dataset")
    if "19.10.2026" not in title:
        raise ValueError("Dataset is not the ONRC 19.10.2026 snapshot")
    organization = result.get("organization") or {}
    org_name = str(organization.get("name", "")).casefold()
    if org_name not in {"onrc", "oficiul-national-al-registrului-comertului"}:
        raise ValueError("Publisher is not the official ONRC organization")
    license_id = str(result.get("license_id", "")).casefold()
    if license_id not in EXPECTED_LICENSE:
        raise ValueError("Publisher metadata does not declare expected CC BY 4.0 licence")
    resource_map = {}
    for resource in result.get("resources", []):
        name = str(resource.get("name") or resource.get("url", "").split("/")[-1]).upper().replace("-", "_")
        name = name.replace(".CSV", "").strip()
        if name not in {"OD_FIRME", "OD_STARE_FIRMA"}:
            continue
        url = resource.get("url", "")
        parsed = urlparse(url)
        if parsed.scheme != "https" or parsed.hostname not in {"data.gov.ro", "www.data.gov.ro"}:
            raise ValueError(f"Unverified third-party CSV resource for {name}")
        if name in resource_map:
            raise ValueError(f"Duplicate named ONRC resource {name}")
        expected_id, expected_url = PINNED_ONRC_RESOURCES[name]
        if str(resource.get("id", "")) != expected_id or url != expected_url:
            raise ValueError(f"Unexpected 2026-10-19 ONRC resource identity for {name}")
        resource_map[name] = {
            "resource_id": str(resource.get("id", "")),
            "url": url,
            "declared_name": str(resource.get("name", "")),
        }
    if set(resource_map) != {"OD_FIRME", "OD_STARE_FIRMA"}:
        raise ValueError("Exact ONRC company and status CSV resources not identified in package metadata")
    return {
        "snapshot_date": SNAPSHOT_DATE,
        "publisher": "ONRC",
        "title": title,
        "package_id": str(result.get("id", "")),
        "license_id_declared": result.get("license_id"),
        "package_license_matches_expected_declaration": True,
        "ckan_file_provenance_independently_audited": False,
        "source_reuse_approved": False,
        "company_rights_reviewed": False,
        "resources": resource_map,
        "status": "official_ckan_metadata_only",
    }


def candidates_from_ledger(ledger: dict, observations: dict) -> list[dict]:
    if ledger.get("country") != "RO" or ledger.get("production_write_authorized") is not False:
        raise ValueError("Wrong country or unexpected import authority")
    if observations.get("country") != "RO" or observations.get("production_write_authorized") is not False:
        raise ValueError("Identity observations are not research-only")
    by_id = {x["candidate_id"]: x for x in observations["records"]}
    if len(by_id) != len(observations["records"]):
        raise ValueError("Duplicate identity observation ID")
    records = []
    for row in ledger["records"]:
        obs = by_id.get(row["candidate_id"], {})
        aliases = {normalize_name(row["name"])}
        if obs.get("observed_current_name"):
            aliases.add(normalize_name(obs["observed_current_name"]))
        records.append({
            "candidate_id": row["candidate_id"],
            "research_name": row["name"],
            "domain": row["domain"],
            "role": row["proposed_role"],
            "cui_hint": normalize_cui(obs.get("cui_hint")),
            "name_keys": aliases - {""},
            "qualification_lane": row["qualification_lane"],
        })
    if len(records) != 50 or len({r["candidate_id"] for r in records}) != 50:
        raise ValueError("Expected exactly 50 original research candidates")
    return records


def _iter_csv(path: Path):
    # Multigigabyte files are read streaming, without loading the full registry.
    with path.open("r", encoding="utf-8-sig", errors="strict", newline="") as stream:
        reader = csv.DictReader(stream, delimiter="^")
        columns = reader.fieldnames or []
        if not columns:
            raise ValueError("Empty ONRC CSV header")
        yield reader, columns
        for row in reader:
            if None in row:
                raise ValueError("Malformed ONRC CSV row")
            yield row, columns


def scan_companies(path: Path, candidates: list[dict]) -> tuple[dict[str, list[dict]], int]:
    name_index = defaultdict(set)
    cui_index = defaultdict(set)
    for candidate in candidates:
        for name in candidate["name_keys"]:
            name_index[name].add(candidate["candidate_id"])
        if candidate["cui_hint"]:
            cui_index[candidate["cui_hint"]].add(candidate["candidate_id"])

    matches = defaultdict(dict)
    total = 0
    it = _iter_csv(path)
    _, columns = next(it)
    name_col = col(columns, FIELDS["name"])
    cui_col = col(columns, FIELDS["cui"])
    key_col = col(columns, FIELDS["key"])
    registry_col = col(columns, FIELDS["registry_no"], required=False)
    form_col = col(columns, FIELDS["legal_form"], required=False)
    for row, _ in it:
        total += 1
        cui = normalize_cui(row.get(cui_col))
        name_key = normalize_name(row.get(name_col, ""))
        # Individual traders also occur in OD_FIRME. Do not retain person names.
        if not is_corporate_entity(row.get(name_col, ""), row.get(form_col, "") if form_col else ""):
            continue
        ids = name_index.get(name_key, set()) | cui_index.get(cui, set())
        if not ids:
            continue
        # Only corporate identity fields are projected; never addresses or officers.
        minimal = {
            "cui": cui,
            "registered_name": row[name_col],
            "cod_inmatriculare": str(row.get(key_col) or ""),
            "registration_number": str(row.get(registry_col) or "") if registry_col else "",
        }
        if not minimal["cui"] or not minimal["cod_inmatriculare"]:
            continue
        for candidate_id in ids:
            unique_key = minimal["cod_inmatriculare"] + ":" + cui
            matches[candidate_id][unique_key] = minimal
    return {k: list(v.values()) for k, v in matches.items()}, total


def scan_status(path: Path, selected_keys: set[str]) -> dict[str, list[str]]:
    if not selected_keys:
        return {}
    states = defaultdict(set)
    it = _iter_csv(path)
    _, columns = next(it)
    key_col = col(columns, FIELDS["key"])
    status_col = col(columns, FIELDS["status"])
    for row, _ in it:
        key = str(row.get(key_col) or "")
        if key in selected_keys:
            states[key].add(str(row.get(status_col) or "").strip())
    return {k: sorted(v) for k, v in states.items()}


def reconcile(candidates: list[dict], matches: dict, states: dict) -> list[dict]:
    resolved = []
    for candidate in candidates:
        rows = matches.get(candidate["candidate_id"], [])
        cuis = {r["cui"] for r in rows}
        hint = candidate["cui_hint"]
        if not rows:
            code = "not_found"
        elif len(rows) != 1 or len(cuis) != 1:
            code = "ambiguous_multiple_registry_rows"
        elif hint and hint != rows[0]["cui"]:
            code = "cui_conflicts_with_name_match"
        elif hint and normalize_name(rows[0]["registered_name"]) not in candidate["name_keys"]:
            code = "cui_match_legal_rename_review"
        elif not hint:
            code = "unique_exact_name_snapshot_cui_discovered"
        else:
            code = "cui_and_name_snapshot_match"
        # The match is only to a HISTORICAL open-data snapshot, not ONRC live verification.
        selected = [{
            "cui": r["cui"],
            "registered_name": r["registered_name"],
            "registration_number": r["registration_number"],
            "cod_inmatriculare": r["cod_inmatriculare"],
            "state_codes": states.get(r["cod_inmatriculare"], []),
            "state_verified_active": False,
        } for r in rows]
        resolved.append({
            "candidate_id": candidate["candidate_id"],
            "domain": candidate["domain"],
            "research_name": candidate["research_name"],
            "proposed_role": candidate["role"],
            "match_result": code,
            "snapshot_matches": selected,
            "onrc_live_verification": "not_completed",
            "legal_identity_approved": False,
            "source_rights_approved": False,
            "opt_out_cleared": False,
            "qualified_for_import": False,
        })
    by_cui = defaultdict(set)
    for row in resolved:
        for match in row["snapshot_matches"]:
            by_cui[match["cui"]].add(row["candidate_id"])
    duplicates = {cui for cui, ids in by_cui.items() if len(ids) > 1}
    for row in resolved:
        if any(x["cui"] in duplicates for x in row["snapshot_matches"]):
            row["match_result"] = "cross_candidate_duplicate_cui_hold"
    return resolved


def run(ledger_path: Path, observations_path: Path, metadata_path: Path, firms_csv: Path, status_csv: Path) -> dict:
    meta = load_catalog_metadata(metadata_path)
    ledger = json.loads(ledger_path.read_text(encoding="utf-8"))
    observations = json.loads(observations_path.read_text(encoding="utf-8"))
    candidates = candidates_from_ledger(ledger, observations)
    matches, total = scan_companies(firms_csv, candidates)
    keys = {r["cod_inmatriculare"] for rows in matches.values() for r in rows}
    states = scan_status(status_csv, keys)
    decisions = reconcile(candidates, matches, states)
    count = defaultdict(int)
    for item in decisions:
        count[item["match_result"]] += 1
    return {
        "contract": "netro1.3b-onrc-snapshot-reconciliation-v1",
        "mode": "local_offline_read_only",
        "country": "RO",
        "source_metadata": meta,
        "source_snapshot_not_live": True,
        "csv_rows_scanned": total,
        "candidate_websites": len(decisions),
        "snapshot_identification_results": dict(sorted(count.items())),
        "onrc_live_verified": 0,
        "legal_identity_and_source_rights_approved": 0,
        "import_authorized": False,
        "production_writes": 0,
        "results": decisions,
    }


def main(argv=None):
    parser = argparse.ArgumentParser(description="Read-only ONRC corporate registry snapshot matching; no network or DB calls.")
    parser.add_argument("--package-json", type=Path, required=True, help="Official ONRC CKAN package_show JSON, not a third-party mirror.")
    parser.add_argument("--firms", type=Path, required=True, help="Local original OD_FIRME.CSV")
    parser.add_argument("--status", type=Path, required=True, help="Local original OD_STARE_FIRMA.CSV")
    parser.add_argument("--ledger", type=Path, default=LEDGER)
    parser.add_argument("--observations", type=Path, default=OBSERVATIONS)
    parser.add_argument("--output", type=Path, help="Optional local JSON report (no raw CSV data)")
    args = parser.parse_args(argv)
    result = run(args.ledger, args.observations, args.package_json, args.firms, args.status)
    payload = json.dumps(result, ensure_ascii=False, indent=2, sort_keys=True) + "\n"
    if args.output:
        if args.output.suffix.lower() != ".json":
            parser.error("--output must be a .json file")
        args.output.write_text(payload, encoding="utf-8")
    else:
        print(payload)


if __name__ == "__main__":
    main()
