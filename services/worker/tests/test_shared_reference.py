import asyncio

from app.shared_reference import (
    enrich_records_with_shared_reference,
    validate_parser_observations_with_shared_reference,
)


class FakeRepo:
    def __init__(self, payload):
        self.payload = payload
        self.calls = []

    async def _request(self, method, path, *, json=None, prefer=None):
        self.calls.append((method, path, json))
        assert path == "/rest/v1/rpc/p1_resolve_shared_steel_reference"
        return dict(self.payload)


def test_reference_enrichment_caches_identical_signatures():
    repo = FakeRepo({
        "resolution_status": "matched",
        "matched": True,
        "calculation_allowed": True,
        "effective_weight_kg_m": 28.26,
    })
    records = [
        {
            "grade": "P265GH",
            "standard": "EN 10216-2",
            "outer_diameter_mm": 168.3,
            "thickness_mm": 7.11,
            "metadata": {},
        },
        {
            "grade": "P265GH",
            "standard": "EN 10216-2",
            "outer_diameter_mm": 168.3,
            "thickness_mm": 7.11,
            "metadata": {"existing": True},
        },
    ]

    enriched = asyncio.run(enrich_records_with_shared_reference(repo, records))

    assert len(repo.calls) == 1
    assert enriched[0]["metadata"]["shared_reference"]["resolution_status"] == "matched"
    assert enriched[1]["metadata"]["existing"] is True


def test_reference_conflict_becomes_parser_validation_issue():
    repo = FakeRepo({
        "resolution_status": "standard_dimension_not_applicable",
        "matched": False,
        "calculation_allowed": False,
    })
    observations = [{
        "grade": "P265GH",
        "standard": "EN 10216-2",
        "outer_diameter_mm": 406.4,
        "thickness_mm": 6.3,
        "metadata": {
            "parser_contract_version": "v4",
            "validation": {"status": "valid", "issues": []},
            "flags": [],
        },
    }]

    enriched = asyncio.run(validate_parser_observations_with_shared_reference(repo, observations))
    metadata = enriched[0]["metadata"]

    assert metadata["validation"]["status"] == "invalid"
    assert "reference_standard_dimension_not_applicable" in metadata["flags"]
    assert metadata["validation"]["issues"][0]["severity"] == "error"


def test_canonical_missing_is_visible_but_not_a_hard_conflict():
    repo = FakeRepo({
        "resolution_status": "matched_canonical_missing",
        "matched": True,
        "calculation_allowed": False,
    })
    observations = [{
        "grade": "P265GH",
        "standard": "EN 10216-2",
        "outer_diameter_mm": 168.3,
        "thickness_mm": 7.11,
        "metadata": {
            "parser_contract_version": "v4",
            "validation": {"status": "valid", "issues": []},
            "flags": [],
        },
    }]

    enriched = asyncio.run(validate_parser_observations_with_shared_reference(repo, observations))
    metadata = enriched[0]["metadata"]

    assert metadata["shared_reference"]["resolution_status"] == "matched_canonical_missing"
    assert "reference_canonical_weight_missing" in metadata["flags"]
    assert metadata["validation"]["status"] == "review_required"
