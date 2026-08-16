from app.db import models  # noqa: F401  (registra los modelos en Base.metadata)
from app.db.database import Base, engine


async def create_tables() -> None:
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
