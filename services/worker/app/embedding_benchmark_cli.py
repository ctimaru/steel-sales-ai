from __future__ import annotations

import argparse
import asyncio
import json

from .embedding_benchmark import run_embedding_benchmark_suite
from .embeddings import run_embedding_batch
from .repository import WorkerRepository


DEFAULT_MODELS = (
    "baai-bge-m3-v1",
    "multilingual-e5-base-v1",
    "multilingual-minilm-l12-v2",
)


async def fill_model_embeddings(
    model_key: str,
    *,
    batch_size: int,
    max_batches: int,
) -> dict[str, int | str | bool]:
    embedded = 0
    batches = 0
    complete = False
    for _ in range(max_batches):
        result = await run_embedding_batch(model_key=model_key, limit=batch_size)
        batches += 1
        embedded += result.embedded
        if result.selected == 0:
            complete = True
            break
    return {
        "model_key": model_key,
        "batches": batches,
        "embedded": embedded,
        "complete": complete,
    }


async def run(args: argparse.Namespace) -> dict[str, object]:
    model_keys = tuple(args.models or DEFAULT_MODELS)
    payload: dict[str, object] = {"models": list(model_keys)}

    if args.fill:
        fill_results = []
        for model_key in model_keys:
            fill_results.append(
                await fill_model_embeddings(
                    model_key,
                    batch_size=args.batch_size,
                    max_batches=args.max_batches,
                )
            )
        payload["fill"] = fill_results
        incomplete = [row for row in fill_results if not row["complete"]]
        if incomplete:
            payload["warning"] = (
                "One or more models still have chunks requiring embeddings; "
                "increase --max-batches before treating benchmark results as final."
            )

    suite = await run_embedding_benchmark_suite(
        model_keys=model_keys,
        case_limit=args.case_limit,
        match_count=args.match_count,
        quality_margin=args.quality_margin,
    )
    payload["benchmark"] = suite.as_dict(include_cases=args.include_cases)

    if args.activate_recommended:
        if not suite.recommended_model_key:
            raise RuntimeError("Benchmark did not produce a recommended model.")
        payload["activation"] = await WorkerRepository().activate_embedding_model(
            suite.recommended_model_key
        )

    return payload


def parser() -> argparse.ArgumentParser:
    cli = argparse.ArgumentParser(
        description="Fill M5 embeddings, benchmark candidate models and optionally activate the recommendation."
    )
    cli.add_argument("--models", nargs="+", default=None)
    cli.add_argument("--fill", action="store_true")
    cli.add_argument("--batch-size", type=int, default=64)
    cli.add_argument("--max-batches", type=int, default=64)
    cli.add_argument("--case-limit", type=int, default=40)
    cli.add_argument("--match-count", type=int, default=10)
    cli.add_argument("--quality-margin", type=float, default=0.03)
    cli.add_argument("--include-cases", action="store_true")
    cli.add_argument("--activate-recommended", action="store_true")
    return cli


def main() -> None:
    args = parser().parse_args()
    if args.batch_size < 1 or args.batch_size > 128:
        raise SystemExit("--batch-size must be between 1 and 128")
    if args.max_batches < 1:
        raise SystemExit("--max-batches must be at least 1")
    result = asyncio.run(run(args))
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
