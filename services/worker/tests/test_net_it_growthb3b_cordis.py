"""B3.B CORDIS: source authorization, safe Italian company URLs, pagination."""
import asyncio
import csv
import io
import zipfile
from unittest.mock import AsyncMock, patch

import pytest

from app import net_it_growthb3b_cordis as b3


HEADER = [
    "projectID", "organisationID", "country", "activityType",
    "name", "organisationUrl", "city",
]


def record(
    project="101111", organization="998877", country="IT", activity="PRC",
    name="CARPENTERIA INDUSTRIALE SRL", website="https://carpenteria-nuova.it/",
    city="Torino",
):
    return {
        "projectID": project, "organisationID": organization,
        "country": country, "activityType": activity, "name": name,
        "organisationUrl": website, "city": city,
    }


def build_csv(records, sep=";"):
    target = io.StringIO()
    writer = csv.DictWriter(target, fieldnames=HEADER, delimiter=sep)
    writer.writeheader()
    writer.writerows(records)
    target.seek(0)
    return target


def test_schema_accepts_british_and_us_organisation_spelling():
    m = b3.choose_columns(HEADER)
    assert m["organization_id"] == "organisationID"
    assert m["website"] == "organisationUrl"
    assert b3.choose_columns([
        "projectID", "organizationID", "country", "activityType",
        "name", "organizationUrl", "city"
    ])["website"] == "organizationUrl"
    with pytest.raises(ValueError):
        b3.choose_columns(["projectID", "organizationID", "name"])


def test_only_private_italian_industrial_companies_and_https_root_urls():
    rows = [
        record(),
        record(project="101112", organization="998878",
               name="UNIVERSITA DI TORINO", website="https://universita.it/",
               activity="HES"),
        record(project="101113", organization="998879", country="DE"),
        record(project="101114", organization="998880", name="TECH CONSULT SRL"),
        record(project="101115", organization="998881", name="ACCIAI DIVERSI SPA",
               website="https://linkedin.com/companies/123"),
        record(project="101116", organization="998882", name="TUBIFICIO METAL SPA",
               website="http://www.tubificio-nuovo.it/lavorazioni"),
        record(project="101117", organization="998883", name="TUBIFICIO GIA NOTO SRL",
               website="http://www.tubificio-nuovo.it/altro"),
    ]
    result, metrics = b3.parse_organisations(build_csv(rows), offset=0, limit=10)
    assert metrics["raw_rows"] == len(rows)
    assert metrics["eligible_distinct_domains"] == 2
    assert metrics["exhausted"] is True
    assert [r["domain"] for r in result] == [
        "carpenteria-nuova.it", "tubificio-nuovo.it"
    ]
    assert all(set(r) == {
        "domain", "homepage", "organization_id", "project_id",
    } for r in result)
    assert result[1]["homepage"] == "https://tubificio-nuovo.it/"
    assert all("name" not in r and "city" not in r and "contact" not in r
               for r in result)


def test_geographical_prioritization_uses_only_explicit_cordis_city_hint():
    rows = [
        record(name="ACCIAI SARDI SPA", website="https://acciai-sardi.it/",
               city="Cagliari"),
        record(name="CARPENTERIA PIEMONTE SPA", website="https://piemonte.it/",
               project="100004", city="Novara"),
        record(name="OFFICINE MARCHE SRL", website="https://officine-marche.it/",
               project="100005", city="Jesi"),
    ]
    data, metrics = b3.parse_organisations(
        build_csv(rows, sep=","), offset=0, limit=2
    )
    assert [x["domain"] for x in data] == [
        "piemonte.it", "acciai-sardi.it"
    ]
    assert metrics["eligible_distinct_domains"] == 3
    assert metrics["exhausted"] is False
    data2, metrics2 = b3.parse_organisations(
        build_csv(rows, sep=","), offset=2, limit=2
    )
    assert [x["domain"] for x in data2] == ["officine-marche.it"]
    assert metrics2["exhausted"] is True


def test_invalid_urls_rejected_without_dns_or_site_fetches():
    for bad in [
        "javascript:alert(1)", "file:///etc/passwd", "http://localhost/",
        "http://127.0.0.1/", "https://alice:password@azienda.it/",
        "https://company.it:8080/", "https://linkedin.com/foo",
        "https://www.google.com", "https://example..it",
    ]:
        assert b3.canonical_website(bad) is None


def test_archived_member_enforced_size_and_single_organization_csv():
    archive = io.BytesIO()
    with zipfile.ZipFile(archive, "w", compression=zipfile.ZIP_DEFLATED) as z:
        z.writestr("HORIZON/organization.csv",
                   build_csv([record()]).getvalue())
        z.writestr("project.csv", "untrusted\n")
    archive.seek(0)
    rows, metrics = b3.parse_archive(archive, offset=0, limit=10)
    assert rows[0]["domain"] == "carpenteria-nuova.it"
    assert metrics["raw_rows"] == 1
    bad = io.BytesIO()
    with zipfile.ZipFile(bad, "w") as z:
        z.writestr("project.csv", "not an organisation\n")
    bad.seek(0)
    with pytest.raises(ValueError):
        b3.parse_archive(bad, offset=0, limit=10)


def test_pagination_bounds_and_missing_header_fail_closed():
    with pytest.raises(ValueError):
        b3.parse_organisations(build_csv([record()]), offset=-1, limit=1)
    with pytest.raises(ValueError):
        b3.parse_organisations(build_csv([record()]), offset=0, limit=101)
    with pytest.raises(ValueError):
        b3.parse_organisations(io.StringIO("hello,bye\none,two"),
                               offset=0, limit=1)


def test_unapproved_cordis_source_skips_without_download_or_company_staging():
    asyncio.run(_skipped())


async def _skipped():
    with patch.object(b3, "credentials_from_environment",
                      return_value=("https://test.supabase.co", "testkey")), \
         patch.object(b3, "call_rpc", new=AsyncMock(return_value={
             "contract": "net-it-growthb3b-v1", "eligible": False,
             "reason": "source_not_owner_approved",
         })) as rpc, \
         patch.object(b3, "download_archive", new=AsyncMock()) as download:
        value = await b3.main()
    assert rpc.await_count == 1
    download.assert_not_awaited()
    assert value["published"] == 0
    assert value["status"] == "skipped"


def test_approved_source_commits_only_website_pointers_with_no_pii():
    asyncio.run(_approved())


async def _approved():
    doc = io.BytesIO()
    with zipfile.ZipFile(doc, "w", compression=zipfile.ZIP_DEFLATED) as z:
        z.writestr("organization.csv", build_csv([record()]).getvalue())
    doc.seek(0)
    with patch.object(b3, "credentials_from_environment",
                      return_value=("https://test.supabase.co", "testkey")), \
         patch.object(b3, "call_rpc", new=AsyncMock(side_effect=[
             {"contract": "net-it-growthb3b-v1", "eligible": True,
              "source": b3.SOURCE, "download_url": b3.DOWNLOAD_URL,
              "offset": 0, "limit": 20, "run_id": "test-run"},
             {"contract": "net-it-growthb3b-v1", "status": "completed",
              "published": 0, "net_new_to_network": 1,
              "duplicate_or_rejected": 0},
         ])) as rpc, \
         patch.object(b3, "download_archive", new=AsyncMock(return_value=doc)):
        value = await b3.main()
    assert value["net_new_to_network"] == 1
    assert value["published"] == 0
    assert rpc.await_count == 2
    args = rpc.await_args_list[1].args[4]
    assert args["p_run_id"] == "test-run"
    assert args["p_items"] == [{
        "domain": "carpenteria-nuova.it",
        "homepage": "https://carpenteria-nuova.it/",
        "organization_id": "998877", "project_id": "101111",
    }]
    assert args["p_exhausted"] is True
    assert args["p_raw_rows"] == 1
