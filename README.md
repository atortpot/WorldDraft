# WorldDraft 

Plataforma web de juego competitivo donde construyes tu selección histórica de la Copa del Mundo mediante un sistema de draft y compites en un torneo de 7 partidos contra selecciones reales, con un motor de simulación basado en aprendizaje automático.

 **Demo en producción:** https://worlddraft.up.railway.app

---

## ¿Cómo se juega?

1. **Elige tu formación** entre 12 opciones tácticas (4-3-3, 4-4-2, 4-2-3-1...)
2. **Draft por tiradas:** en cada tirada te sale una selección y año del Mundial aleatorios. Elige un jugador y colócalo en tu formación. Tienes 3 pases máximo.
3. **Compite en el torneo:** fase de grupos (4 equipos, tabla real) + eliminatorias. Los empates van a prórroga y penaltis.
4. **El resultado lo decide un modelo ML** entrenado con 372 partidos históricos de la Copa del Mundo FIFA (1994-2014).

**Modo Folgar:** los ratings están ocultos. Solo ves el nombre y la posición.

---

## Stack tecnológico

| Capa | Tecnología |
|------|-----------|
| Backend | FastAPI (Python 3.12) + SQLAlchemy async |
| Base de datos | PostgreSQL + Alembic (migraciones) |
| Modelo ML | scikit-learn · Regresión logística multinomial |
| Frontend | React 19 + TypeScript + Tailwind CSS |
| Servidor web | nginx (proxy inverso en producción) |
| Despliegue | Railway (Docker) + CI/CD desde GitHub |

---

## Datos

- **6.992 jugadores** reales de 9 Mundiales (1994-2026)
- **5 fuentes integradas:** Wikipedia (scraping), Kaggle FIFA Dataset, Fjelstul World Cup Database, FIFA 2026 Dataset, FIFA Ranking Dataset
- **78,3%** de jugadores con rating calculado a partir de goles, asistencias y minutos reales

---

## Modelo ML

- Regresión logística multinomial entrenada con partidos FIFA 1994-2014
- Validación **leave-one-tournament-out**
- Accuracy: **50,8%** · Log-loss: **1,030** (baseline aleatorio: 33,3% / 1,099)
- Variables: diferencia de puntos FIFA, puntos FIFA absolutos, goal average, fase del torneo

---

## Ejecutar en local

```bash
# Requisitos: Python 3.12+, uv, Docker, Node.js 18+

# 1. Clonar el repositorio
git clone https://github.com/atortpot/WorldDraft.git
cd WorldDraft

# 2. Levantar PostgreSQL
docker compose up -d

# 3. Instalar dependencias y migrar la base de datos
uv sync
uv run alembic upgrade head

# 4. Importar jugadores (requiere los CSVs en data/)
uv run python -m app.players.importer

# 5. Arrancar el backend
uv run uvicorn app.main:app --reload --port 8000

# 6. Arrancar el frontend
cd frontend
npm install
npm run dev
```

La API estará disponible en http://localhost:8000 y la documentación interactiva en http://localhost:8000/docs.

---

## Estructura del proyecto

```
WorldDraft/
├── app/
│   ├── auth/          # JWT, cookies httpOnly, validación
│   ├── db/            # Modelos SQLAlchemy, sesión async
│   ├── game/          # Draft, torneo, formaciones, narrativa
│   ├── model/         # Simulador ML, match_model.pkl
│   └── players/       # Importador, matching de nombres
├── frontend/
│   ├── src/
│   │   ├── pages/     # LoginPage, DraftPage, TournamentPage...
│   │   ├── components/# Pitch.tsx, BoxScore, PenaltyShootout...
│   │   └── context/   # AuthContext, DraftContext
│   └── nginx.conf     # Proxy inverso /api/* → backend
├── scripts/           # Scraping Wikipedia, entrenamiento ML
├── data/              # CSVs de ranking FIFA y partidos
└── alembic/           # Migraciones de base de datos
```

---

## TFG

Proyecto desarrollado como Trabajo de Fin de Grado en Ingeniería Informática en la Universidad Alfonso X el Sabio (UAX), curso 2025-2026.

**Alumno:** Amador Tortosa Potous  
**Tutor:** Jesús Velayos Herrero
