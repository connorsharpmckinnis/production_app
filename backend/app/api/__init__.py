from fastapi import APIRouter

from app.api import (
    auth,
    characters,
    costumes,
    cues,
    groups,
    microphones,
    notes,
    productions,
    props,
    reports,
    set_pieces,
    settings,
    stage_movements,
    timeline,
    users,
)

api_router = APIRouter()
api_router.include_router(auth.router)
api_router.include_router(users.router)
api_router.include_router(settings.router)
api_router.include_router(productions.router)
api_router.include_router(timeline.router)
api_router.include_router(timeline.lookup_router)
api_router.include_router(characters.router)
api_router.include_router(groups.router)
api_router.include_router(notes.router)
api_router.include_router(props.router)
api_router.include_router(cues.router)
api_router.include_router(costumes.router)
api_router.include_router(microphones.router)
api_router.include_router(set_pieces.router)
api_router.include_router(stage_movements.router)
api_router.include_router(reports.router)
