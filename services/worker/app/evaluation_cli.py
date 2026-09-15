from __future__ import annotations

import argparse
import asyncio
import json

from .evaluation import run_golden_evaluation


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Run the M5.8 Golden Retrieval/RAG evaluation harness.")
    parser.add_argument("--set-version", default="v1")
    parser.add_argument("--match-count", type=int, default=10)
    parser.add_argument("--candidate-count", type=int, default=60)
    parser.add_argument("--rrf-k", type=int, default=60)
    parser.add_argument("--rag", action="store_true", help="Evaluate semantic/negative/security cases through grounded RAG.")
    parser.add_argument("--persist", action="store_true", help="Persist run and per-case results to Supabase.")
    parser.add_argument("--include-cases", action="store_true", help="Include all per-case details in stdout JSON.")
    parser.add_argument("--enforce", action="store_true", help="Exit non-zero when quality gates fail.")
    return parser


async def _main() -> int:
    args = build_parser().parse_args()
    result = await run_golden_evaluation(
        set_version=args.set_version,
        include_rag=args.rag,
        persist=args.persist,
        match_count=args.match_count,
        candidate_count=args.candidate_count,
        rrf_k=args.rrf_k,
    )
    print(json.dumps(result.as_dict(include_cases=args.include_cases), ensure_ascii=False, separators=(",", ":")))
    return 2 if args.enforce and not result.passed else 0


def main() -> None:
    raise SystemExit(asyncio.run(_main()))


if __name__ == "__main__":
    main()
