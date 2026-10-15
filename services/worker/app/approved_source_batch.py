"""CRAWL-IT6.8 — governed approved-source staging, no auto-publication.

Uses existing CRAWL-IT3 source claim and domain lead review queue.
Requires a reviewed licensed source and explicit operator enablement.
"""
from __future__ import annotations

import argparse
import asyncio
import json
import os

from .italian_source_discovery import harvest_once

MAX_SOURCES_PER_RUN = 3


async def run(max_sources: int) -> dict[str, object]:
    if os.getenv("CRAWL_IT68_ENABLED") != "true":
        raise RuntimeError("CRAWL_IT68_ENABLED must be true; staging is disabled")
    if not 1 <= max_sources <= MAX_SOURCES_PER_RUN:
        raise ValueError("Source limit must be 1-3")
    staged = 0
    # Claim and review gates remain inside existing DB RPC; never bypass.
    # A single source can stage at most 20 domains as enforced by harvester.
    for _ in range(max_sources):
        staged += await harvest_once()
    return {
        "mode": "GOVERNED_APPROVED_SOURCE_STAGING",
        "source_attempts": max_sources,
        "staged_leads": staged,
        "max_leads_per_source": 20,
        "published": 0,
        "personal_contacts": 0,
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--sources", type=int, choices=(1, 2, 3), default=1)
    args = parser.parse_args()
    print(json.dumps(asyncio.run(run(args.sources)), indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
