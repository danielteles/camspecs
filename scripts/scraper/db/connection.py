"""Async SQLAlchemy engine/session management for the Postgres database."""

from __future__ import annotations

import os

from dotenv import load_dotenv
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, async_sessionmaker, create_async_engine

load_dotenv()

_engine: AsyncEngine | None = None


def get_database_url() -> str:
    url = os.environ.get("DATABASE_URL")
    if not url:
        raise RuntimeError(
            "DATABASE_URL is not set. Copy scripts/scraper/.env.example to "
            "scripts/scraper/.env and fill it in."
        )
    # Hosted providers (Vercel Postgres, Neon, Supabase) — and Next.js's own
    # Postgres clients — hand out plain "postgres://" / "postgresql://" URLs,
    # but SQLAlchemy's async engine needs the asyncpg driver named explicitly.
    if url.startswith("postgres://"):
        return "postgresql+asyncpg://" + url[len("postgres://") :]
    if url.startswith("postgresql://") and not url.startswith("postgresql+asyncpg://"):
        return "postgresql+asyncpg://" + url[len("postgresql://") :]
    return url


def get_engine() -> AsyncEngine:
    global _engine
    if _engine is None:
        _engine = create_async_engine(get_database_url(), pool_pre_ping=True)
    return _engine


def get_session_factory() -> async_sessionmaker[AsyncSession]:
    return async_sessionmaker(get_engine(), expire_on_commit=False)


async def dispose_engine() -> None:
    global _engine
    if _engine is not None:
        await _engine.dispose()
        _engine = None
