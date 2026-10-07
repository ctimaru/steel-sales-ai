# COST1 — Vercel Deployment Cost Control

## Goal

Reduce unnecessary Vercel build/deployment usage while keeping production releases safe and preserving on-demand visual previews.

## Policy

Automatic Vercel Git deployments are now restricted to:

- `main` — production deployments.
- `preview-*` — explicit visual/live preview branches.

All other feature, fix, audit and roadmap branches are validated by GitHub CI without triggering an automatic Vercel deployment.

## Development workflow

1. Develop on a normal branch such as `rfqh14-...`, `uxf5-...`, or `an1-3-...`.
2. GitHub runs the required test/typecheck/build gate.
3. Vercel does not build that branch.
4. Merge to `main` only after CI is green.
5. Vercel creates the production deployment from `main`.

When a live preview is actually needed, create/use a branch whose name starts with `preview-`.

## Existing optimization retained

The project keeps the existing `ignoreCommand` so commits that do not materially change `apps/web` can still be skipped by Vercel.

## Expected effect

This removes the repeated Vercel preview builds produced by iterative commits on ordinary development branches. GitHub remains the default validation environment; Vercel is reserved for explicit previews and production.
