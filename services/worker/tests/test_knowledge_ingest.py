from io import BytesIO
from zipfile import ZipFile

from app.knowledge_ingest import build_knowledge_document, detect_language, extract_text_units


def test_email_knowledge_document_preserves_subject_and_locator() -> None:
    eml = (
        b"Subject: Offerta tubi P265GH\n"
        b"From: sales@example.com\n"
        b"To: buyer@example.com\n"
        b"Message-ID: <offer-1@example.com>\n"
        b"Content-Type: text/plain; charset=utf-8\n\n"
        b"Offro P265GH 406,4x6,3x12000 EN 10224. Prezzo EUR 68,38/mt. "
        b"Consegna disponibile da stock."
    )

    document = build_knowledge_document(
        filename="offer.eml",
        payload=eml,
        storage_path="2026/09/14/offer.eml",
        document_type="email_message",
        extraction_version="v3.1+knowledge-v1",
    )

    assert document["title"] == "Offerta tubi P265GH"
    assert document["language_code"] == "it"
    assert len(document["chunks"]) == 1
    chunk = document["chunks"][0]
    assert chunk["source_locator"]["kind"] == "email"
    assert chunk["source_locator"]["message_id"] == "<offer-1@example.com>"
    assert chunk["section_path"][0] == "Email"
    assert len(chunk["content_checksum"]) == 64


def test_zip_archive_keeps_member_provenance() -> None:
    archive_bytes = BytesIO()
    with ZipFile(archive_bytes, "w") as archive:
        archive.writestr(
            "mail/offer.eml",
            "Subject: Quote\nContent-Type: text/plain; charset=utf-8\n\n"
            "The offer is for P265GH 406.4x6.3 with delivery in October.",
        )
        archive.writestr("notes.txt", "Internal steel tube production notes")

    units = extract_text_units("archive.zip", archive_bytes.getvalue())

    assert len(units) == 2
    email_unit = next(unit for unit in units if unit.locator["kind"] == "email")
    assert email_unit.locator["archive_member"] == "mail/offer.eml"
    assert email_unit.section_path[:2] == ["Archive", "mail/offer.eml"]


def test_long_text_is_split_deterministically_with_overlap() -> None:
    body = ("Offerta P265GH 406,4x6,3 EN 10224 disponibile con consegna. " * 80).encode()
    eml = b"Subject: Long offer\nContent-Type: text/plain; charset=utf-8\n\n" + body

    first = build_knowledge_document(
        filename="long.eml",
        payload=eml,
        storage_path="long.eml",
        document_type="email_message",
        extraction_version="v3.1+knowledge-v1",
    )
    second = build_knowledge_document(
        filename="long.eml",
        payload=eml,
        storage_path="long.eml",
        document_type="email_message",
        extraction_version="v3.1+knowledge-v1",
    )

    assert len(first["chunks"]) > 1
    assert [chunk["content_checksum"] for chunk in first["chunks"]] == [
        chunk["content_checksum"] for chunk in second["chunks"]
    ]
    assert first["chunks"][1]["source_locator"]["unit_char_start"] < first["chunks"][0]["source_locator"]["unit_char_end"]


def test_language_detection_supports_italian_and_english() -> None:
    assert detect_language("Il prezzo e la consegna sono disponibili per la produzione") == "it"
    assert detect_language("The price and delivery are available for the production offer") == "en"
