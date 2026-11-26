FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PORT=8000

WORKDIR /app

COPY services/worker/pyproject.toml /app/pyproject.toml
COPY services/worker/app /app/app
COPY services/worker/audits/net_it_carp_mass11j_a_20261124_gers.csv /app/audits/net_it_carp_mass11j_a_20261124_gers.csv

COPY services/worker/audits/net_it_lombardia1b_20261126_fresh_gers.csv /app/audits/net_it_lombardia1b_20261126_fresh_gers.csv

COPY services/worker/audits/net_it_lombardia1i_20261126_fresh_gers.csv /app/audits/net_it_lombardia1i_20261126_fresh_gers.csv

RUN pip install --no-cache-dir .

EXPOSE 8000

CMD ["sh", "-c", "uvicorn app.server:app --host 0.0.0.0 --port ${PORT:-8000}"]
