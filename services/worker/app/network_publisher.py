"""NET-PIPELINE1B.2G: opt-in governed publisher runner.

No action occurs at import. Run manually in the existing Railway worker container:
python -m app.network_publisher --dry-run

Production publishing needs explicit --publish and a separately enabled SQL kill switch.
Uses the EXISTING Railway server-side service credential; never sends it to clients.
"""
from __future__ import annotations

import argparse
import json
import os
import sys

import httpx


def run(*, publish: bool = False, limit: int = 5) -> dict:
    if not 1 <= limit <= 10:
        raise ValueError("limit must be 1..10")
    base = os.environ.get("SUPABASE_URL", "").rstrip("/")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
    if not base or not key:
        raise RuntimeError("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required")
    # Calls only the narrowly scoped SQL RPC; no direct table insert privileges.
    response = httpx.post(
        f"{base}/rest/v1/rpc/net_pipeline1b2_technical_batch",
        headers={
            "apikey": key,
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json",
        },
        json={"p_max": limit, "p_dry_run": not publish},
        timeout=30.0,
    )
    response.raise_for_status()
    return response.json()


def main() -> int:
    parser = argparse.ArgumentParser()
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument("--dry-run", action="store_true")
    mode.add_argument("--publish", action="store_true")
    parser.add_argument("--limit", type=int, default=5)
    args = parser.parse_args()
    try:
        result = run(publish=args.publish, limit=args.limit)
    except (ValueError, RuntimeError, httpx.HTTPError) as exc:
        print(f"Publisher failed: {type(exc).__name__}", file=sys.stderr)
        return 1
    print(json.dumps(result, indent=2, default=str))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
