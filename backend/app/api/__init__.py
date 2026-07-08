from fastapi import APIRouter

from app.api import auth, productions, timeline, users

api_router = APIRouter()
api_router.include_router(auth.router)
api_router.include_router(users.router)
api_router.include_router(productions.router)
api_router.include_router(timeline.router)
