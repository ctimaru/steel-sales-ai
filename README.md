# Steel Sales AI

Steel Sales AI is a commercial intelligence application for the steel/tube sales workflow.

## Scope

- Reconstruct commercial email threads
- Extract requested / offered / ordered / delivered steel items
- Track grades, standards, dimensions, quantities, prices and availability
- Review uncertain extractions before promotion
- Search commercial history and price intelligence
- Add an AI assistant with source provenance

## Architecture

- `apps/web` — Next.js + TypeScript frontend
- `services/worker` — Python/FastAPI document and parsing worker
- `supabase` — database migrations and Supabase project assets
- `packages` — shared packages as the project grows

## Cloud

- Supabase — PostgreSQL, Auth, Storage, RLS
- Vercel — Next.js frontend
- Railway — Python/FastAPI worker
- GitHub — source control and CI/CD

## Project management

monday.com is the official source of project status, milestones, bugs and architectural decisions.
