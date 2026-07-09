from fastapi import APIRouter

from app.api import auth, characters, groups, notes, productions, timeline, users

api_router = APIRouter()
api_router.include_router(auth.router)
api_router.include_router(users.router)
api_router.include_router(productions.router)
api_router.include_router(timeline.router)
api_router.include_router(characters.router)
api_router.include_router(groups.router)
api_router.include_router(notes.router)
