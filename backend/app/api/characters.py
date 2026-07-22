from fastapi import APIRouter, Depends, File, HTTPException, Response, UploadFile, status
from sqlalchemy import distinct, func
from sqlalchemy.orm import Session, joinedload

from app.api.catalog_csv_routes import (
    catalog_csv_error_http,
    catalog_template_response,
    read_catalog_upload,
)
from app.api.deps import get_accessible_production
from app.auth.dependencies import require_authenticated, require_role, user_has_role
from app.db.session import get_db
from app.models import (
    Character,
    Dialogue,
    Moment,
    Scene,
    Song,
    User,
    UserCharacterAssignment,
)
from app.schemas.casting import (
    CastAssignmentResponse,
    CastCharacterRequest,
    CastCharacterResponse,
    CastableUserResponse,
)
from app.schemas.catalog_csv import CatalogImportResult
from app.schemas.characters import (
    AssignedActorResponse,
    CharacterCreate,
    CharacterDetailResponse,
    CharacterUpdate,
    SongCreate,
    SongDetailResponse,
    SongUpdate,
)
from app.services.catalog_csv import CatalogCsvError, SONGS_COLUMNS, import_songs_csv

router = APIRouter(prefix="/productions", tags=["characters"])

require_director = require_role("Admin", "Director")


def _get_character_or_404(db: Session, production_id: int, character_id: int) -> Character:
    character = (
        db.query(Character)
        .filter(Character.id == character_id, Character.production_id == production_id)
        .first()
    )
    if character is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Character not found")
    return character


def _user_display_name(user: User) -> str:
    return f"{user.first_name} {user.last_name}".strip()


def _scene_counts_by_character(db: Session, production_id: int) -> dict[int, int]:
    """Count distinct scenes where each character has dialogue."""
    rows = (
        db.query(Dialogue.character_id, func.count(distinct(Scene.id)))
        .join(Moment, Moment.id == Dialogue.moment_id)
        .join(Scene, Scene.id == Moment.scene_id)
        .join(Character, Character.id == Dialogue.character_id)
        .filter(Character.production_id == production_id)
        .group_by(Dialogue.character_id)
        .all()
    )
    return {character_id: count for character_id, count in rows}


def _character_detail(
    character: Character,
    scene_count: int,
) -> CharacterDetailResponse:
    assigned_actor = None
    if character.actor_assignment and character.actor_assignment.user:
        user = character.actor_assignment.user
        assigned_actor = AssignedActorResponse(
            user_id=user.id,
            display_name=_user_display_name(user),
        )
    return CharacterDetailResponse(
        id=character.id,
        name=character.name,
        description=character.description,
        scene_count=scene_count,
        assigned_actor=assigned_actor,
    )


@router.get("/{production_id}/characters", response_model=list[CharacterDetailResponse])
def list_characters(
    production_id: int,
    user: User = Depends(require_authenticated),
    db: Session = Depends(get_db),
) -> list[CharacterDetailResponse]:
    get_accessible_production(db, user, production_id)
    characters = (
        db.query(Character)
        .options(
            joinedload(Character.actor_assignment).joinedload(UserCharacterAssignment.user),
        )
        .filter(Character.production_id == production_id)
        .order_by(Character.name)
        .all()
    )
    scene_counts = _scene_counts_by_character(db, production_id)
    return [
        _character_detail(character, scene_counts.get(character.id, 0))
        for character in characters
    ]


@router.post(
    "/{production_id}/characters",
    response_model=CharacterDetailResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_character(
    production_id: int,
    body: CharacterCreate,
    director: User = Depends(require_director),
    db: Session = Depends(get_db),
) -> CharacterDetailResponse:
    get_accessible_production(db, director, production_id)
    character = Character(
        production_id=production_id,
        name=body.name.strip(),
        description=body.description,
    )
    db.add(character)
    db.commit()
    db.refresh(character)
    return _character_detail(character, 0)


@router.patch("/{production_id}/characters/{character_id}", response_model=CharacterDetailResponse)
def update_character(
    production_id: int,
    character_id: int,
    body: CharacterUpdate,
    _director: User = Depends(require_director),
    db: Session = Depends(get_db),
) -> CharacterDetailResponse:
    character = (
        db.query(Character)
        .options(
            joinedload(Character.actor_assignment).joinedload(UserCharacterAssignment.user),
        )
        .filter(Character.id == character_id, Character.production_id == production_id)
        .first()
    )
    if character is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Character not found")

    if body.description is not None:
        character.description = body.description

    db.commit()
    db.refresh(character)
    scene_counts = _scene_counts_by_character(db, production_id)
    return _character_detail(character, scene_counts.get(character.id, 0))


@router.delete("/{production_id}/characters/{character_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_character(
    production_id: int,
    character_id: int,
    _director: User = Depends(require_director),
    db: Session = Depends(get_db),
) -> None:
    character = _get_character_or_404(db, production_id, character_id)
    has_dialogue = (
        db.query(Dialogue.id).filter(Dialogue.character_id == character_id).first() is not None
    )
    if has_dialogue:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Cannot delete a character that has dialogue in the script",
        )
    db.delete(character)
    db.commit()


@router.get("/{production_id}/songs", response_model=list[SongDetailResponse])
def list_songs(
    production_id: int,
    user: User = Depends(require_authenticated),
    db: Session = Depends(get_db),
) -> list[SongDetailResponse]:
    get_accessible_production(db, user, production_id)
    songs = (
        db.query(Song)
        .filter(Song.production_id == production_id)
        .order_by(Song.title)
        .all()
    )
    return [
        SongDetailResponse(
            id=song.id,
            title=song.title,
            composer=song.composer,
            lyricist=song.lyricist,
            description=song.description,
        )
        for song in songs
    ]


@router.post(
    "/{production_id}/songs",
    response_model=SongDetailResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_song(
    production_id: int,
    body: SongCreate,
    director: User = Depends(require_director),
    db: Session = Depends(get_db),
) -> SongDetailResponse:
    get_accessible_production(db, director, production_id)
    song = Song(
        production_id=production_id,
        title=body.title.strip(),
        composer=body.composer,
        lyricist=body.lyricist,
        description=body.description,
    )
    db.add(song)
    db.commit()
    db.refresh(song)
    return SongDetailResponse(
        id=song.id,
        title=song.title,
        composer=song.composer,
        lyricist=song.lyricist,
        description=song.description,
    )


@router.patch("/{production_id}/songs/{song_id}", response_model=SongDetailResponse)
def update_song(
    production_id: int,
    song_id: int,
    body: SongUpdate,
    _director: User = Depends(require_director),
    db: Session = Depends(get_db),
) -> SongDetailResponse:
    song = (
        db.query(Song)
        .filter(Song.id == song_id, Song.production_id == production_id)
        .first()
    )
    if song is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Song not found")

    if body.composer is not None:
        song.composer = body.composer
    if body.lyricist is not None:
        song.lyricist = body.lyricist
    if body.description is not None:
        song.description = body.description

    db.commit()
    db.refresh(song)
    return SongDetailResponse(
        id=song.id,
        title=song.title,
        composer=song.composer,
        lyricist=song.lyricist,
        description=song.description,
    )


@router.get("/{production_id}/songs/import/template")
def download_songs_csv_template(
    production_id: int,
    director: User = Depends(require_director),
    db: Session = Depends(get_db),
) -> Response:
    get_accessible_production(db, director, production_id)
    return catalog_template_response("songs_template.csv", SONGS_COLUMNS)


@router.post(
    "/{production_id}/songs/import",
    response_model=CatalogImportResult,
)
async def import_songs(
    production_id: int,
    file: UploadFile = File(...),
    director: User = Depends(require_director),
    db: Session = Depends(get_db),
) -> CatalogImportResult:
    get_accessible_production(db, director, production_id)
    content = await read_catalog_upload(file)
    try:
        return import_songs_csv(db, production_id, content)
    except CatalogCsvError as exc:
        raise catalog_csv_error_http(exc) from exc


@router.get("/{production_id}/casting", response_model=list[CastAssignmentResponse])
def list_casting(
    production_id: int,
    user: User = Depends(require_authenticated),
    db: Session = Depends(get_db),
) -> list[CastAssignmentResponse]:
    get_accessible_production(db, user, production_id)
    characters = (
        db.query(Character)
        .options(
            joinedload(Character.actor_assignment).joinedload(UserCharacterAssignment.user),
        )
        .filter(Character.production_id == production_id)
        .order_by(Character.name)
        .all()
    )
    results: list[CastAssignmentResponse] = []
    for character in characters:
        user_id = None
        display_name = None
        if character.actor_assignment and character.actor_assignment.user:
            user_id = character.actor_assignment.user.id
            display_name = _user_display_name(character.actor_assignment.user)
        results.append(
            CastAssignmentResponse(
                character_id=character.id,
                character_name=character.name,
                user_id=user_id,
                user_display_name=display_name,
            )
        )
    return results


@router.put("/{production_id}/characters/{character_id}/cast", response_model=CastCharacterResponse)
def cast_character(
    production_id: int,
    character_id: int,
    body: CastCharacterRequest,
    _director: User = Depends(require_director),
    db: Session = Depends(get_db),
) -> CastCharacterResponse:
    character = _get_character_or_404(db, production_id, character_id)

    if body.user_id is None:
        existing = (
            db.query(UserCharacterAssignment)
            .filter(UserCharacterAssignment.character_id == character_id)
            .first()
        )
        if existing:
            db.delete(existing)
        db.commit()
        return CastCharacterResponse(
            character_id=character.id,
            user_id=None,
            user_display_name=None,
        )

    actor = (
        db.query(User)
        .options(joinedload(User.app_roles))
        .filter(User.id == body.user_id, User.is_active.is_(True))
        .first()
    )
    if actor is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    if not user_has_role(actor, "Actor"):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Only users with the Actor role can be cast",
        )

    existing = (
        db.query(UserCharacterAssignment)
        .filter(UserCharacterAssignment.character_id == character_id)
        .first()
    )
    if existing:
        existing.user_id = actor.id
    else:
        db.add(UserCharacterAssignment(user_id=actor.id, character_id=character_id))

    db.commit()
    return CastCharacterResponse(
        character_id=character.id,
        user_id=actor.id,
        user_display_name=_user_display_name(actor),
    )


@router.get("/{production_id}/castable-users", response_model=list[CastableUserResponse])
def list_castable_users(
    production_id: int,
    director: User = Depends(require_director),
    db: Session = Depends(get_db),
) -> list[CastableUserResponse]:
    get_accessible_production(db, director, production_id)
    users = (
        db.query(User)
        .options(joinedload(User.app_roles))
        .filter(User.is_active.is_(True))
        .order_by(User.last_name, User.first_name)
        .all()
    )
    return [
        CastableUserResponse(id=user.id, display_name=_user_display_name(user))
        for user in users
        if user_has_role(user, "Actor")
    ]
