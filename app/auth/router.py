from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user
from app.auth.schemas import LoginRequest, RegisterRequest, TokenResponse, UserResponse
from app.auth.security import create_access_token
from app.auth.service import authenticate_user, register_user
from app.db.database import get_db
from app.db.models import User

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=TokenResponse)
async def register_endpoint(payload: RegisterRequest, db: AsyncSession = Depends(get_db)):
    user = await register_user(payload.email, payload.password, db)
    return TokenResponse(access_token=create_access_token(user.id))


@router.post("/login", response_model=TokenResponse)
async def login_endpoint(payload: LoginRequest, db: AsyncSession = Depends(get_db)):
    user = await authenticate_user(payload.email, payload.password, db)
    return TokenResponse(access_token=create_access_token(user.id))


@router.get("/me", response_model=UserResponse)
async def me_endpoint(current_user: User = Depends(get_current_user)):
    return UserResponse(id=current_user.id, email=current_user.email, created_at=current_user.created_at)
