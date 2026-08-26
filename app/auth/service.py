from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.security import hash_password, verify_password
from app.db.models import User


async def get_user_by_email(email: str, db: AsyncSession) -> User | None:
    result = await db.execute(select(User).where(User.email == email))
    return result.scalar_one_or_none()


async def register_user(email: str, password: str, db: AsyncSession) -> User:
    if await get_user_by_email(email, db) is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Ya existe una cuenta con ese email"
        )

    user = User(email=email, hashed_password=hash_password(password))
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


async def authenticate_user(email: str, password: str, db: AsyncSession) -> User:
    user = await get_user_by_email(email, db)
    if user is None or not verify_password(password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Email o contraseña incorrectos"
        )
    return user
