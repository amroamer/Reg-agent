from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # App
    APP_NAME: str = "RegInspector"
    DEBUG: bool = False
    CORS_ORIGINS: str = "http://localhost,http://localhost:3000"

    # PostgreSQL
    DATABASE_URL: str = "postgresql+asyncpg://reginspector:change-me@postgres:5432/reginspector"
    DATABASE_URL_SYNC: str = "postgresql://reginspector:change-me@postgres:5432/reginspector"

    # Redis
    REDIS_URL: str = "redis://redis:6379/0"

    # Qdrant
    QDRANT_HOST: str = "qdrant"
    QDRANT_PORT: int = 6333
    QDRANT_COLLECTION: str = "regulations"

    # Ollama
    OLLAMA_HOST: str = "ollama"
    OLLAMA_PORT: int = 11434
    OLLAMA_MODEL: str = "qwen2.5:72b"

    # Claude API
    ANTHROPIC_API_KEY: str = ""
    LLM_PROVIDER: str = "claude"
    LLM_MODEL: str = "claude-sonnet-4-20250514"

    # Embedding
    EMBEDDING_MODEL: str = "intfloat/multilingual-e5-large"

    # Auth
    SECRET_KEY: str = "change-me-to-a-random-64-char-string"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()
