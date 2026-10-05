from uuid import UUID

from app.price_list_import import parse_padana_page_texts


COVER = """
Padana Tubi e Profilati Acciaio S.p.A.
PTC 18/2026
Unita/Unit Euro/Mtr FCA
28/09/2026
DC 8.2_01 rev.6
* Extra per certificato Melted and Poured: solo dove possibile a richiesta, costo da concordare commercialmente.
Il prezzo finale e' determinato dalla somma del prezzo base, sul quale viene applicato lo sconto commerciale
concordato, e del relativo extra fisso non soggetto a sconto.
* Sconto efficientamento logistico: 12 EUR/Tonn per ordini di almeno 3 pacchi per articolo a 6 metri,
oppure almeno 2 pacchi per articolo a 12 metri, su una singola spedizione.
"""


def test_padana_parser_extracts_base_extra_and_rules() -> None:
    page = """
Dimensione Spessore (mm) Base €/Mtr Extra €/Mtr Note
Ø 33,7x2,0 2,0 2,1060 0,4537
PTC 18 - LISTINO PREZZI / PRICE LIST
EN10219 - Tubi Tondi - Finitura Nera | Euro/Mtr Ex-Work | DC 8.2_01 rev.6
EN10219 - TUBI TONDI - QUALITA S235JRH / EN10219 - CIRCULAR HOLLOW SECTION - GRADE S235JRH
2 / 36
"""
    result = parse_padana_page_texts([COVER, page], content_checksum="a" * 64)

    assert result.document["manufacturer_version_code"] == "PTC 18/2026"
    assert result.document["manufacturer_revision_code"] == "DC 8.2_01 rev.6"
    assert result.summary["extracted_item_count"] == 1
    assert result.summary["extracted_rule_count"] == 3

    item = next(row for row in result.rows if row.row_type == "item")
    assert item.validation_status == "valid"
    assert item.normalized_data["item"]["geometry_candidate_key"] == "round|od=33.7|t=2"
    assert item.normalized_data["components"][0]["amount"] == "2.1060"
    assert item.normalized_data["components"][0]["discountable"] is True
    assert item.normalized_data["components"][1]["amount"] == "0.4537"
    assert item.normalized_data["components"][1]["discountable"] is False

    assert any(anomaly["code"] == "DELIVERY_TERM_CONFLICT" for anomaly in result.anomalies)


def test_multi_standard_rows_are_reviewed_unless_note_resolves_override() -> None:
    page = """
Dimensione Spessore (mm) Base €/Mtr Extra €/Mtr Note
PTC 18 - LISTINO PREZZI / PRICE LIST
EN10305-3 and EN 10219- Tubi Quadri - Finitura Zincata Sendzimir | Euro/Mtr Ex-Work | DC 8.2_01 rev.6
TUBI QUADRI ZINCATI SENDZIMIR - QUALITA E220+CR2S4 / SQUARE HOLLOW SECTION SENDZIMIR - GRADE E220+CR2S4
80x80x2,5 2,5 9,7120 3,2400
80x80x4,0 4,0 14,8480 3,9870 EN10219-2 DX51D
31 / 36
"""
    result = parse_padana_page_texts([COVER, page], content_checksum="b" * 64)
    items = [row for row in result.rows if row.row_type == "item"]

    unresolved, override = items
    assert unresolved.validation_status == "review"
    assert "AMBIGUOUS_STANDARD" in unresolved.validation_codes
    assert unresolved.normalized_data["section"]["standard_code"] is None

    assert override.validation_status == "valid"
    assert override.normalized_data["section"]["standard_code"] == "EN10219-2"
    assert override.normalized_data["section"]["weight_standard_key"] == "EN10219"
    assert override.normalized_data["section"]["grade_code"] == "DX51D"


def test_special_shape_source_conflict_is_preserved_not_silently_normalized() -> None:
    page = """
Dimensione Spessore (mm) Base €/Mtr Extra €/Mtr Note
PTC 18 - LISTINO PREZZI / PRICE LIST
Profili Speciali / per Serramenti, Ovali, Semiovali, Triangolari - tutte le finiture | Euro/Mtr Ex-Work | DC 8.2_01 rev.6
Ovale 50x25x2,0 2,0 3,1520 1,1281 Sendzimir
TUBI OVALI ZINCATI SENDZIMIR - QUALITA DX51D / OVAL HOLLOW SECTION SENDZIMIR - GRADE E220+DX51D
36 / 36
"""
    result = parse_padana_page_texts([COVER, page], content_checksum="c" * 64)
    item = next(row for row in result.rows if row.row_type == "item")

    assert item.validation_status == "review"
    assert "SOURCE_GRADE_LABEL_CONFLICT" in item.validation_codes
    assert "MISSING_STANDARD" in item.validation_codes
    assert item.normalized_data["section"]["grade_raw"] == "DX51D / E220+DX51D"
    assert item.normalized_data["section"]["grade_code"] is None
    assert item.normalized_data["item"]["shape_detail"] == "ovale"


def test_staging_row_signature_is_deterministic() -> None:
    page = """
EN10219 - Tubi Rettangolari - Finitura Nera | Euro/Mtr Ex-Work | DC 8.2_01 rev.6
EN10219 - TUBI RETTANGOLARI - QUALITA S355J2H / EN10219 - RECTANGULAR HOLLOW SECTION - GRADE S355J2H
100x50x4,0 4,0 13,8400 4,2167
"""
    result = parse_padana_page_texts([COVER, page], content_checksum="d" * 64)
    item = next(row for row in result.rows if row.row_type == "item")
    run_id = UUID("00000000-0000-0000-0000-000000000001")

    first = item.as_staging_row(run_id)
    second = item.as_staging_row(run_id)

    assert first["row_signature"] == second["row_signature"]
    assert first["normalized_data"]["item"]["geometry_candidate_key"] == "rect|100x50|t=4"
