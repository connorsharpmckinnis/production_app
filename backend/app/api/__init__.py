from fastapi import APIRouter

from app.api import (
    auth,
    characters,
    costumes,
    cues,
    feedback,
    groups,
    lav_chart,
    notes,
    notifications,
    packs,
    productions,
    props,
    rehearsals,
    reports,
    set_pieces,
    settings,
    stage_movements,
    timeline,
    users,
    wires,
)

api_router = APIRouter()
api_router.include_router(auth.router)
api_router.include_router(users.router)
api_router.include_router(settings.router)
api_router.include_router(feedback.router)
api_router.include_router(notifications.router)
api_router.include_router(productions.router)
api_router.include_router(timeline.router)
api_router.include_router(timeline.lookup_router)
api_router.include_router(characters.router)
api_router.include_router(groups.router)
api_router.include_router(notes.router)
api_router.include_router(props.router)
api_router.include_router(cues.router)
api_router.include_router(costumes.router)
api_router.include_router(wires.router)
api_router.include_router(packs.router)
api_router.include_router(lav_chart.router)
api_router.include_router(set_pieces.router)
api_router.include_router(stage_movements.router)
api_router.include_router(rehearsals.router)
api_router.include_router(reports.router)
