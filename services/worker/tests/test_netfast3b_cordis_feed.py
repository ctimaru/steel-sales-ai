import csv
import io
import zipfile

import pytest

from app.netfast3b_cordis_feed import (
    DOWNLOAD_URL, MAX_STAGED, extract_organization_csv,
    rows_from_organization_csv, safe_official_domain,
)

HEAD = "projectID;organisationID;name;country;activityType;organisationWebsite\n"

def make_zip(csv_text: str) -> bytes:
    out = io.BytesIO()
    with zipfile.ZipFile(out,"w") as arc:
        arc.writestr("csv/organization.csv", csv_text)
        arc.writestr("csv/project.csv", "projectID;projectURL\n123;https://project-site.example\n")
    return out.getvalue()

def test_parse_genuine_companies_without_misattributing_project_website():
    csv_text = HEAD + (
        "123;321;Acciai Nord SRL;IT;PRC;https://www.acciainord.it/contact\n"
        "124;321;Acciai Nord SRL;IT;PRC;https://www.acciainord.it/contact\n"
        "125;654;Industria Meccanica SPA;IT;PRC;\n"
        "126;777;Università Example;IT;HES;https://uni.example/\n"
        "127;888;Auto Machinery Gmbh;DE;PRC;https://auto.example/\n"
        "128;999;Not Relevant Software SRL;IT;PRC;https://software.example/\n"
    )
    records = rows_from_organization_csv(extract_organization_csv(make_zip(csv_text)))
    assert len(records) == 3
    assert records[0] == {
        "organisation_id":"321","project_id":"123",
        "name":"Acciai Nord SRL","domain":"acciainord.it"
    }
    assert records[1]["domain"] == ""
    assert records[2]["domain"] == ""
    assert "project-site.example" not in str(records)

def test_no_guess_from_project_links_or_missing_website_column():
    text="projectID;organisationID;name;country;activityType\n123;321;Acciai Nord SRL;IT;PRC\n"
    records=rows_from_organization_csv(extract_organization_csv(make_zip(text)))
    assert records[0]["domain"]==""

def test_host_validation_rejects_redirects_and_nonofficial_urls():
    for url in ("http://acciai.it","https://linkedin.com/steel",
                "https://evil.example:8080/path","https://a@legit.it/",
                "https://127.0.0.1/","https://cordis.europa.eu/projects",
                "https://example.it/?s=private"):
        assert safe_official_domain(url)==""
    assert safe_official_domain("https://www.steel-example.it/")=="steel-example.it"

def test_zip_requires_exactly_one_bounded_organization_csv():
    with pytest.raises(ValueError,match="organization.csv"):
        out=io.BytesIO()
        with zipfile.ZipFile(out,"w") as arc:
            arc.writestr("project.csv","projectID;name\\n123;demo\\n")
        extract_organization_csv(out.getvalue())
    with pytest.raises(ValueError,match="schema"):
        rows_from_organization_csv(b"foo;bar\nhello;world")
    with pytest.raises(ValueError,match="budget"):
        rows_from_organization_csv(HEAD.encode(),MAX_STAGED+1)
