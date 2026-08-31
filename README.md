
# Terminal 1 - Base de datos
docker compose up -d

# Terminal 2 - Backend
uv run uvicorn app.main:app --reload

# Terminal 3 - Frontend
cd frontend
pnpm dev