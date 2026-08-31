# Backend FastAPI. Ver .dockerignore para lo que se deja fuera del
# contexto de build (data/ casi entera, scripts/, frontend/, .venv/, etc.)
FROM python:3.12-slim

# Binario estatico de uv, sin tener que instalarlo via pip.
COPY --from=ghcr.io/astral-sh/uv:0.9 /uv /uvx /bin/

WORKDIR /app

ENV UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    PYTHONUNBUFFERED=1 \
    PATH="/app/.venv/bin:$PATH"

# Capa de dependencias separada del codigo: solo se reinstala si cambian
# pyproject.toml/uv.lock, no en cada cambio de app/.
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev

# Codigo del backend (incluye app/model/match_model.pkl, el modelo ya
# entrenado) y las migraciones -- necesarias para poder correr
# `alembic upgrade head` contra la base de datos de Railway antes de
# arrancar el servicio, aunque el arranque en si (CMD) no las ejecute.
COPY app/ ./app/
COPY alembic/ ./alembic/
COPY alembic.ini ./

# Datos historicos que la app necesita en tiempo de ejecucion (no solo en
# los scripts de import puntual): sorteo de rivales por fuerza historica
# (app/game/draft_service.py) y ranking FIFA para las stats de simulacion
# (app/model/fifa_data.py). El resto de data/ (squads.csv,
# WorldCupPlayers.csv, player_appearances.csv, etc.) solo lo usan los
# scripts de scripts/ para poblar la tabla players una vez, no el
# servicio en marcha -- se deja fuera a proposito.
COPY data/WorldCupMatches.csv ./data/WorldCupMatches.csv
COPY data/fifa_ranking-2024-06-20.csv ./data/fifa_ranking-2024-06-20.csv

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
