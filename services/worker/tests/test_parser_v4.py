from app.extractor_v4 import extract_observations
from app.parser_v4 import ParserInput, ParserV4Adapter


def test_round_tube_three_dimensions_are_od_wall_length() -> None:
    row = extract_observations(
        "Offro 406,4x6,3x12000 P265GH EN 10224 €68,38/mt",
        "offer.eml",
    )[0]

    assert row["outer_diameter_mm"] == 406.4
    assert row["thickness_mm"] == 6.3
    assert row["length_mm"] == 12000
    assert "width_mm" not in row
    assert row["metadata"]["dimension_interpretation"] == "round_od_thickness_length"
    assert row["metadata"]["validation"]["status"] == "valid"
    assert row["confidence"] >= 0.90


def test_rectangular_three_dimensions_are_width_height_wall() -> None:
    row = extract_observations(
        "Tubo 300x100x5 S355J2 EN 10219",
        "offer.eml",
    )[0]

    assert row["width_mm"] == 300
    assert row["height_mm"] == 100
    assert row["thickness_mm"] == 5
    assert "outer_diameter_mm" not in row
    assert row["metadata"]["dimension_interpretation"] == "rectangular_width_height_thickness"
    assert row["metadata"]["validation"]["status"] == "valid"


def test_square_three_dimensions_are_width_height_wall() -> None:
    row = extract_observations("220x220x8 S355J2H", "rfq.eml")[0]

    assert row["width_mm"] == 220
    assert row["height_mm"] == 220
    assert row["thickness_mm"] == 8
    assert row["metadata"]["dimension_interpretation"] == "square_width_height_thickness"


def test_zero_wall_thickness_is_invalid_and_review_routed() -> None:
    row = extract_observations(
        "Tubo 300x100x0 s355j2 lunghezza 8mt",
        "bad-source.eml",
    )[0]

    validation = row["metadata"]["validation"]
    assert row["width_mm"] == 300
    assert row["height_mm"] == 100
    assert row["thickness_mm"] == 0
    assert validation["status"] == "invalid"
    assert validation["issues"][0]["code"] == "invalid_wall_thickness"
    assert validation["issues"][0]["severity"] == "error"
    assert "invalid_wall_thickness" in row["metadata"]["flags"]
    assert row["confidence"] <= 0.35


def test_physically_impossible_round_wall_is_invalid() -> None:
    row = extract_observations("100x60 S355J2", "bad-source.eml")[0]

    issues = row["metadata"]["validation"]["issues"]
    assert any(issue["code"] == "invalid_wall_thickness_ratio" for issue in issues)
    assert row["metadata"]["validation"]["status"] == "invalid"


def test_missing_grade_produces_medium_confidence_review() -> None:
    row = extract_observations("Richiesta 323,9x7,1x12000", "rfq.eml")[0]

    assert row["confidence"] == 0.80
    assert row["metadata"]["confidence"]["band"] == "medium"
    assert row["metadata"]["validation"]["status"] == "review_required"
    assert "low_confidence" in row["metadata"]["flags"]


def test_extended_structural_grade_variants_are_recognized() -> None:
    rows = extract_observations(
        "100x100x5 S275J0H\n120x120x6 S235JRH",
        "grades.eml",
    )

    assert rows[0]["grade"] == "S275J0H"
    assert rows[1]["grade"] == "S235JRH"


def test_api_5l_standard_is_recognized() -> None:
    row = extract_observations("406,4x6,3 L275 API 5L", "api.eml")[0]
    assert row["standard"] == "API 5L"


def test_parser_v4_summary_exposes_validation_distribution() -> None:
    parser = ParserV4Adapter()
    payload = (
        b"Subject: mixed\n\n"
        b"Offro 406,4x6,3x12000 P265GH EN 10224 EUR 68,38/mt\n"
        b"Tubo 300x100x0 S355J2\n"
        b"Richiesta 323,9x7,1x12000\n"
    )
    result = parser.prepare(
        ParserInput(
            filename="mixed.eml",
            extension=".eml",
            size_bytes=len(payload),
            storage_path="memory://mixed.eml",
        ),
        payload,
    )

    assert result.parser_version == "v4"
    assert result.validation_summary["valid"] == 1
    assert result.validation_summary["invalid"] == 1
    assert result.validation_summary["review_required"] == 1


def test_multiline_item_cohesion_inherits_grade_length_and_pack_quantity() -> None:
    rows = extract_observations(
        "Tubo tondo 273x8 a 12000\n2 pacchi\ns355",
        "p114b-rdo-273.eml",
    )

    assert len(rows) == 1
    row = rows[0]
    assert row["product_type"] if "product_type" in row else True
    assert row["grade"] == "S355"
    assert row["outer_diameter_mm"] == 273
    assert row["thickness_mm"] == 8
    assert row["length_mm"] == 12000
    assert row["quantity"] == 2
    assert row["quantity_unit"] == "PACCHI"
    assert row["metadata"]["validation"]["status"] == "valid"
    assert row["confidence"] >= 0.90
