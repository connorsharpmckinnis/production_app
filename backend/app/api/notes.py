from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session, joinedload

from app.api.deps import (
    get_production_or_404,
    require_production_capability,
    user_has_production_capability,
)
from app.auth.dependencies import require_authenticated, user_has_role
from app.db.session import get_db
from app.models import Act, Bookmark, Character, Moment, Note, Production, Rehearsal, Scene, User
from app.schemas.bookmarks import BookmarkCreate, BookmarkResponse
from app.schemas.notes import NoteCreate, NoteResponse, NoteUpdate
from app.services.rehearsal_stamp import matching_rehearsal_id

router = APIRouter(tags=["notes-bookmarks"])


def _user_display_name(user: User) -> str:
    return f"{user.first_name} {user.last_name}".strip()


def _note_response(note: Note, current_user_id: int) -> NoteResponse:
    updated_by_name = None
    if note.updated_by_user_id is not None and note.updated_by is not None:
        updated_by_name = _user_display_name(note.updated_by)
    return NoteResponse(
        id=note.id,
        user_id=note.user_id,
        author_display_name=_user_display_name(note.user),
        visibility=note.visibility,
        moment_id=note.moment_id,
        character_id=note.character_id,
        rehearsal_id=note.rehearsal_id,
        content=note.content,
        created_at=note.created_at,
        updated_at=note.updated_at,
        updated_by_display_name=updated_by_name,
        is_mine=note.user_id == current_user_id,
        scene_id=note.moment.scene_id if note.moment is not None else None,
    )


def _get_moment_in_production_or_404(
    db: Session,
    production_id: int,
    moment_id: int,
) -> Moment:
    moment = (
        db.query(Moment)
        .join(Scene)
        .join(Act)
        .filter(Moment.id == moment_id, Act.production_id == production_id)
        .first()
    )
    if moment is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Moment not found")
    return moment


def _verify_note_in_production(db: Session, production_id: int, note: Note) -> None:
    """Confirm a note's moment or character actually belongs to production_id.

    Notes are looked up by note_id alone, so without this check a note from
    one production could be edited or deleted through another production's URL.
    """
    if note.moment_id is not None:
        _get_moment_in_production_or_404(db, production_id, note.moment_id)
    elif note.character_id is not None:
        character = (
            db.query(Character)
            .filter(Character.id == note.character_id, Character.production_id == production_id)
            .first()
        )
        if character is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Note not found")
    elif note.rehearsal_id is not None:
        rehearsal = (
            db.query(Rehearsal)
            .filter(Rehearsal.id == note.rehearsal_id, Rehearsal.production_id == production_id)
            .first()
        )
        if rehearsal is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Note not found")
    else:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Note not found")


def notes_visible_to_user(notes: list[Note], user: User) -> list[Note]:
    """Public notes, the caller's private notes, and every note for Admin."""
    if user_has_role(user, "Admin"):
        return list(notes)
    return [
        note
        for note in notes
        if note.visibility == "public" or note.user_id == user.id
    ]


def _load_note(db: Session, note_id: int) -> Note | None:
    return (
        db.query(Note)
        .options(
            joinedload(Note.user),
            joinedload(Note.updated_by),
            joinedload(Note.moment),
        )
        .filter(Note.id == note_id)
        .first()
    )


def _resolved_visibility(
    db: Session,
    user: User,
    production: Production,
    requested: str,
) -> str:
    if requested != "public":
        return "private"
    if user_has_role(user, "Admin") or user_has_production_capability(
        db, user, production, "notes", "publish"
    ):
        return "public"
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="notes publish access required",
    )


@router.get("/productions/{production_id}/notes", response_model=list[NoteResponse])
def list_production_notes(
    production_id: int,
    moment_id: int | None = Query(default=None),
    character_id: int | None = Query(default=None),
    rehearsal_id: int | None = Query(default=None),
    session_only: bool = Query(default=False),
    user: User = Depends(require_production_capability("notes", "read")),
    db: Session = Depends(get_db),
) -> list[NoteResponse]:
    query = db.query(Note).options(
        joinedload(Note.user),
        joinedload(Note.updated_by),
        joinedload(Note.moment),
    )

    if moment_id is not None:
        _get_moment_in_production_or_404(db, production_id, moment_id)
        query = query.filter(Note.moment_id == moment_id)
    elif character_id is not None:
        character = (
            db.query(Character)
            .filter(Character.id == character_id, Character.production_id == production_id)
            .first()
        )
        if character is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Character not found")
        query = query.filter(Note.character_id == character_id)
    elif rehearsal_id is not None:
        rehearsal = (
            db.query(Rehearsal)
            .filter(Rehearsal.id == rehearsal_id, Rehearsal.production_id == production_id)
            .first()
        )
        if rehearsal is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Rehearsal not found")
        query = query.filter(Note.rehearsal_id == rehearsal_id)
        if session_only:
            query = query.filter(Note.moment_id.is_(None), Note.character_id.is_(None))
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Provide moment_id, character_id, or rehearsal_id",
        )

    notes = query.order_by(Note.created_at).all()
    visible = notes_visible_to_user(notes, user)
    return [_note_response(note, user.id) for note in visible]


@router.post(
    "/productions/{production_id}/notes",
    response_model=NoteResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_note(
    production_id: int,
    body: NoteCreate,
    user: User = Depends(require_production_capability("notes", "create")),
    db: Session = Depends(get_db),
) -> NoteResponse:
    production = get_production_or_404(db, production_id)
    if body.moment_id is not None:
        _get_moment_in_production_or_404(db, production_id, body.moment_id)
    if body.character_id is not None:
        character = (
            db.query(Character)
            .filter(Character.id == body.character_id, Character.production_id == production_id)
            .first()
        )
        if character is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Character not found")
    if body.rehearsal_id is not None:
        rehearsal = (
            db.query(Rehearsal)
            .filter(
                Rehearsal.id == body.rehearsal_id,
                Rehearsal.production_id == production_id,
            )
            .first()
        )
        if rehearsal is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Rehearsal not found")

    visibility = _resolved_visibility(db, user, production, body.visibility)
    rehearsal_id = body.rehearsal_id
    if rehearsal_id is None and body.moment_id is not None:
        rehearsal_id = matching_rehearsal_id(db, production_id)

    note = Note(
        user_id=user.id,
        visibility=visibility,
        moment_id=body.moment_id,
        character_id=body.character_id,
        rehearsal_id=rehearsal_id,
        content=body.content.strip(),
        updated_by_user_id=user.id,
    )
    db.add(note)
    db.commit()
    note = _load_note(db, note.id)
    assert note is not None
    return _note_response(note, user.id)


@router.patch("/productions/{production_id}/notes/{note_id}", response_model=NoteResponse)
def update_note(
    production_id: int,
    note_id: int,
    body: NoteUpdate,
    user: User = Depends(require_production_capability("notes", "update")),
    db: Session = Depends(get_db),
) -> NoteResponse:
    note = _load_note(db, note_id)
    if note is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Note not found")
    _verify_note_in_production(db, production_id, note)
    if note.user_id != user.id and not user_has_role(user, "Admin"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cannot edit another user's note")

    production = get_production_or_404(db, production_id)
    if body.content is not None:
        note.content = body.content.strip()
    if body.visibility is not None:
        note.visibility = _resolved_visibility(db, user, production, body.visibility)
    note.updated_by_user_id = user.id

    db.commit()
    note = _load_note(db, note.id)
    assert note is not None
    return _note_response(note, user.id)


@router.delete("/productions/{production_id}/notes/{note_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_note(
    production_id: int,
    note_id: int,
    user: User = Depends(require_production_capability("notes", "delete")),
    db: Session = Depends(get_db),
) -> None:
    note = db.query(Note).filter(Note.id == note_id).first()
    if note is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Note not found")
    _verify_note_in_production(db, production_id, note)
    if note.user_id != user.id and not user_has_role(user, "Admin"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cannot delete another user's note")
    db.delete(note)
    db.commit()


@router.post("/bookmarks", response_model=BookmarkResponse, status_code=status.HTTP_201_CREATED)
def create_bookmark(
    body: BookmarkCreate,
    user: User = Depends(require_authenticated),
    db: Session = Depends(get_db),
) -> BookmarkResponse:
    moment = (
        db.query(Moment)
        .options(joinedload(Moment.scene).joinedload(Scene.act).joinedload(Act.production))
        .filter(Moment.id == body.moment_id)
        .first()
    )
    if moment is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Moment not found")

    production = moment.scene.act.production
    require_production_capability("bookmarks", "create")(
        production_id=production.id,
        user=user,
        db=db,
    )

    existing = (
        db.query(Bookmark)
        .filter(Bookmark.user_id == user.id, Bookmark.moment_id == body.moment_id)
        .first()
    )
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Moment already bookmarked")

    bookmark = Bookmark(
        user_id=user.id,
        moment_id=body.moment_id,
        label=body.label,
    )
    db.add(bookmark)
    db.commit()
    db.refresh(bookmark)
    return BookmarkResponse(
        id=bookmark.id,
        moment_id=bookmark.moment_id,
        label=bookmark.label,
        created_at=bookmark.created_at,
        production_id=production.id,
        production_title=production.title,
        scene_id=moment.scene_id,
        act_number=moment.scene.act.number,
        scene_number=moment.scene.number,
        sequence_number=moment.sequence_number,
        moment_preview=moment.original_text[:120],
    )


@router.delete("/bookmarks/{bookmark_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_bookmark(
    bookmark_id: int,
    user: User = Depends(require_authenticated),
    db: Session = Depends(get_db),
) -> None:
    bookmark = (
        db.query(Bookmark)
        .options(
            joinedload(Bookmark.moment)
            .joinedload(Moment.scene)
            .joinedload(Scene.act)
            .joinedload(Act.production),
        )
        .filter(Bookmark.id == bookmark_id)
        .first()
    )
    if bookmark is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Bookmark not found")
    if bookmark.user_id != user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cannot delete another user's bookmark")
    require_production_capability("bookmarks", "delete")(
        production_id=bookmark.moment.scene.act.production.id,
        user=user,
        db=db,
    )
    db.delete(bookmark)
    db.commit()


@router.get("/users/me/bookmarks", response_model=list[BookmarkResponse])
def list_my_bookmarks(
    production_id: int | None = Query(default=None),
    user: User = Depends(require_authenticated),
    db: Session = Depends(get_db),
) -> list[BookmarkResponse]:
    if production_id is not None:
        require_production_capability("bookmarks", "read")(
            production_id=production_id,
            user=user,
            db=db,
        )
    query = (
        db.query(Bookmark)
        .options(
            joinedload(Bookmark.moment)
            .joinedload(Moment.scene)
            .joinedload(Scene.act)
            .joinedload(Act.production),
        )
        .filter(Bookmark.user_id == user.id)
        .order_by(Bookmark.created_at.desc())
    )
    bookmarks = query.all()

    results: list[BookmarkResponse] = []
    for bookmark in bookmarks:
        moment = bookmark.moment
        production = moment.scene.act.production
        if production_id is not None and production.id != production_id:
            continue
        results.append(
            BookmarkResponse(
                id=bookmark.id,
                moment_id=bookmark.moment_id,
                label=bookmark.label,
                created_at=bookmark.created_at,
                production_id=production.id,
                production_title=production.title,
                scene_id=moment.scene_id,
                act_number=moment.scene.act.number,
                scene_number=moment.scene.number,
                sequence_number=moment.sequence_number,
                moment_preview=moment.original_text[:120],
            )
        )
    return results
