"""NET-FAST3B: monthly official CORDIS archive, private organization leads first.

Never assume project URLs are company URLs. Only accept a URL explicitly in
the organization's own website column. Do not copy VAT, addresses or contacts.
No source can run without an existing human-reviewed SaaS redistribution grant.
"""
from __future__ import annotations

import asyncio
import csv
import io
import ipaddress
import json
import re
from urllib.parse import urlsplit
import zipfile

import httpx

from .github_actions_crawler import credentials_from_environment
from .netfast2_wikidata_feed import api_rpc as _legacy_api_rpc

DOWNLOAD_URL = "https://cordis.europa.eu/data/cordis-HORIZONprojects-csv.zip"
MAX_DOWNLOAD = 90_000_000
MAX_ORGANIZATION_CSV = 150_000_000
MAX_STAGED = 30_000
CHUNK = 500
SOURCE_ENDPOINTS = {
    "netfast3b_cordis_open", "netfast3b_cordis_commit", "netfast3b_cordis_close",
}
INDUSTRIAL_TERMS = re.compile(
    r"(acciai|siderurg|metall|steel|metal|meccanic|mechanic|"
    r"automotiv|veicol|carpenter|machiner|macchin|tubif|tubi|"
    r"fabricat|fonder|foundr|manufactur|engineering)",
    re.I,
)

def safe_official_domain(raw: str) -> str:
    text = (raw or "").strip()
    if not text or len(text) > 500:
        return ""
    try:
        parsed = urlsplit(text)
        if parsed.scheme != "https" or parsed.username or parsed.password or parsed.port:
            return ""
        if parsed.query or parsed.fragment:
            return ""
        host = (parsed.hostname or "").lower().rstrip(".")
        if host.startswith("www."):
            host = host[4:]
        if not re.fullmatch(r"[a-z0-9][a-z0-9.-]*\.[a-z]{2,24}", host) or ".." in host:
            return ""
        try:
            ipaddress.ip_address(host)
            return ""
        except ValueError:
            pass
        excluded = ("linkedin.com","facebook.com","instagram.com","youtube.com",
                    "wikidata.org","wikipedia.org","google.com","tiktok.com",
                    "wordpress.com","cordis.europa.eu","europa.eu")
        if any(host == item or host.endswith("." + item) for item in excluded):
            return ""
        return host
    except ValueError:
        return ""


def rows_from_organization_csv(csv_content: bytes, max_records: int = MAX_STAGED) -> list[dict[str,str]]:
    if len(csv_content) > MAX_ORGANIZATION_CSV:
        raise ValueError("Oversize CORDIS organization.csv")
    if not 1 <= max_records <= MAX_STAGED:
        raise ValueError("Invalid organization record budget")
    source = io.TextIOWrapper(io.BytesIO(csv_content), encoding="utf-8-sig", errors="replace", newline="")
    reader = csv.DictReader(source, delimiter=";")
    columns = set(reader.fieldnames or ())
    id_field = "organisationID" if "organisationID" in columns else "organizationID"
    if not {"name", "country", "projectID", "activityType", id_field}.issubset(columns):
        raise ValueError("CORDIS organization.csv schema changed")
    # Never use project-related webLink.csv or project.csv links as homepages.
    site_col = next((x for x in ("organisationWebsite","organizationWebsite",
                "organisationURL","organizationURL","website") if x in columns), None)
    unique: set[str] = set()
    result: list[dict[str,str]] = []
    for row in reader:
        if not row or (row.get("country") or "").strip().upper() != "IT":
            continue
        if (row.get("activityType") or "").strip().upper() != "PRC":
            continue
        identifier = (row.get(id_field) or "").strip()
        project_id = (row.get("projectID") or "").strip()
        label = (row.get("name") or "").strip()
        if (not re.fullmatch(r"[0-9]{2,20}", identifier) or
            not re.fullmatch(r"[0-9]{2,20}", project_id) or
            not 3 <= len(label) <= 180 or
            re.search(r"(?i)https?://|[@<>\x00-\x1f]", label) or
            identifier in unique):
            continue
        unique.add(identifier)
        domain = safe_official_domain(row.get(site_col, "") if site_col else "")
        # A good-looking domain does NOT imply industrial tube use. Only
        # industrial-name signals can become visible, still "Da confermare".
        if not INDUSTRIAL_TERMS.search(label):
            domain = ""
        result.append({
            "organisation_id": identifier, "project_id": project_id,
            "name": label, "domain": domain,
        })
        if len(result) >= max_records:
            break
    return result


def extract_organization_csv(archive: bytes) -> bytes:
    if len(archive) > MAX_DOWNLOAD:
        raise ValueError("Oversize CORDIS archive")
    with zipfile.ZipFile(io.BytesIO(archive)) as zipped:
        files = [info for info in zipped.infolist()
                 if info.filename.replace("\\","/").split("/")[-1].lower() == "organization.csv"]
        if len(files) != 1 or files[0].is_dir():
            raise ValueError("CORDIS archive needs exactly one organization.csv")
        if files[0].file_size > MAX_ORGANIZATION_CSV:
            raise ValueError("CORDIS organization.csv uncompressed size exceeds limit")
        with zipped.open(files[0]) as member:
            result = member.read(MAX_ORGANIZATION_CSV + 1)
            if len(result) > MAX_ORGANIZATION_CSV:
                raise ValueError("Oversize extracted organization.csv")
            return result


async def rpc(client: httpx.AsyncClient, url: str, key: str, name: str,
              args: dict) -> dict:
    if name not in SOURCE_ENDPOINTS:
        raise ValueError("Unsupported NET-FAST3B procedure")
    response = await client.post(
        url + "/rest/v1/rpc/" + name, json=args,
        headers={"apikey": key, "Content-Type": "application/json",
                 "Accept": "application/json",
                 "User-Agent": "SmartSteelSales-NETFAST3B/1.0"},
    )
    if response.status_code != 200:
        raise RuntimeError(f"NET-FAST3B {name} HTTP {response.status_code}")
    payload = response.json()
    if not isinstance(payload, dict):
        raise RuntimeError("Invalid NET-FAST3B RPC result")
    return payload


async def run() -> dict:
    url, key = credentials_from_environment()
    async with httpx.AsyncClient(timeout=httpx.Timeout(30.0), follow_redirects=False) as api:
        grant = await rpc(api,url,key,"netfast3b_cordis_open",{})
        if grant.get("eligible") is not True:
            report={"status":"skipped","reason":grant.get("reason","license_not_approved"),
                    "fetched":0,"new_research":0,"new_unconfirmed":0}
            print(json.dumps(report,sort_keys=True))
            return report
        if (grant.get("download_url") != DOWNLOAD_URL or
            grant.get("monthly_limit") != MAX_STAGED or grant.get("chunk_limit") != CHUNK):
            raise RuntimeError("Unexpected CORDIS download contract")
        # No redirect and no unknown hosts. Stream with strict byte limit.
        async with httpx.AsyncClient(timeout=httpx.Timeout(180.0),follow_redirects=False) as network:
            async with network.stream("GET",DOWNLOAD_URL,
                 headers={"User-Agent":"SmartSteelSales/NETFAST3B-data/1.0"}) as response:
                if response.status_code!=200:
                    raise RuntimeError(f"CORDIS archive fetch HTTP {response.status_code}")
                data=bytearray()
                async for chunk in response.aiter_bytes():
                    data.extend(chunk)
                    if len(data)>MAX_DOWNLOAD:
                        raise ValueError("CORDIS download exceeds 90 MB")
        organizations=rows_from_organization_csv(extract_organization_csv(bytes(data)))
        summary={"status":"completed","downloaded_bytes":len(data),
                 "eligible_organizations":len(organizations),
                 "new_research":0,"new_unconfirmed":0}
        for offset in range(0,len(organizations),CHUNK):
            chunk=organizations[offset:offset+CHUNK]
            result=await rpc(api,url,key,"netfast3b_cordis_commit",
                 {"p_run_id":grant["run_id"],"p_items":chunk})
            if result.get("status")!="staged_research_only" or result.get("canonical_published")!=0:
                raise RuntimeError("Unexpected CORDIS promotion response")
            summary["new_research"]+=result.get("new_research",0)
            summary["new_unconfirmed"]+=result.get("new_unconfirmed",0)
        final=await rpc(api,url,key,"netfast3b_cordis_close",{"p_run_id":grant["run_id"]})
        if final.get("status")!="completed" or final.get("canonical_published")!=0:
            raise RuntimeError("Unexpected CORDIS completion response")
        summary["scanned"]=final.get("scanned",0)
        print(json.dumps(summary,sort_keys=True))
        return summary


if __name__=="__main__":
    asyncio.run(run())
