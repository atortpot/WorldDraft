from fastapi import APIRouter, Depends, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.cookies import clear_auth_cookie, set_auth_cookie
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


# Segundo backend de autenticacion (ademas del Bearer de arriba, que se
# mantiene para Swagger/clientes de API): cookie httpOnly de sesion, usada
# por el frontend para persistir la sesion entre recargas.


@router.post("/cookie/login", response_model=UserResponse)
async def cookie_login_endpoint(
    payload: LoginRequest, response: Response, db: AsyncSession = Depends(get_db)
):
    user = await authenticate_user(payload.email, payload.password, db)
    set_auth_cookie(response, create_access_token(user.id))
    return UserResponse(id=user.id, email=user.email, created_at=user.created_at)


@router.post("/cookie/logout")
async def cookie_logout_endpoint(response: Response):
    clear_auth_cookie(response)
    return {"detail": "Sesion cerrada"}
