from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    database_url: str
    secret_key: str
    # "development" (por defecto, uso local) o "production" (Railway u otro
    # despliegue real). Controla los flags dependientes del entorno que no
    # se pueden fijar a un unico valor sin romper alguno de los dos casos:
    # la cookie de sesion (ver app/auth/cookies.py) y CORS (ver app/main.py).
    environment: str = "development"
    # Origenes permitidos por CORS para peticiones cross-site del frontend,
    # separados por coma. Vacio por defecto: en desarrollo el proxy de Vite
    # (frontend/vite.config.ts) hace que las peticiones sean same-origin y
    # CORS no entra en juego.
    cors_origins: str = ""

    @field_validator("database_url")
    @classmethod
    def _use_asyncpg_driver(cls, value: str) -> str:
        """Railway (y la mayoria de proveedores gestionados) exponen
        DATABASE_URL con el esquema generico "postgres://" o
        "postgresql://", pensado para un driver sincrono. create_async_engine
        necesita el driver asyncpg explicito en el esquema
        ("postgresql+asyncpg://") o falla con NoSuchModuleError -- se
        reescribe aqui para no depender de que quien configure la variable
        de entorno se acuerde de hacerlo a mano."""
        for prefix in ("postgresql://", "postgres://"):
            if value.startswith(prefix):
                return "postgresql+asyncpg://" + value[len(prefix) :]
        return value

    @property
    def is_production(self) -> bool:
        return self.environment == "production"

    @property
    def cors_origins_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


settings = Settings()
