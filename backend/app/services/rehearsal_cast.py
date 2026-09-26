"""Derive who is needed for rehearsal call suggestions from timeline presence."""

from datetime import datetime

from sqlalchemy.orm import Session, joinedload

from app.models import (
    Act,
    Character,
    Dialogue,
    LyricLine,
    Moment,
    MomentEntrance,
    MomentExit,
    Scene,
    Song,
    User,
    UserCharacterAssignment,
)
from app.models.rehearsal import (
    REHEARSAL_FOCUS_CHOREO,
    REHEARSAL_FOCUS_DIALOG,
    REHEARSAL_FOCUS_MUSIC,
)
from app.services.production_memberships import list_active_production_users


def character_ids_in_scenes(
    db: Session,
    production_id: int,
    scene_ids: list[int],
) -> set[int]:
    """Characters with dialogue, lyrics, entrance, or exit in any of the scenes."""
    if not scene_ids:
        return set()

    dialogue_ids = {
        row[0]
        for row in (
            db.query(Dialogue.character_id)
            .join(Moment, Moment.id == Dialogue.moment_id)
            .join(Scene, Scene.id == Moment.scene_id)
            .join(Act, Act.id == Scene.act_id)
            .filter(
                Moment.scene_id.in_(scene_ids),
                Act.production_id == production_id,
            )
            .distinct()
            .all()
        )
    }
    lyric_ids = {
        row[0]
        for row in (
            db.query(LyricLine.character_id)
            .join(Moment, Moment.id == LyricLine.moment_id)
            .join(Scene, Scene.id == Moment.scene_id)
            .join(Act, Act.id == Scene.act_id)
            .filter(
                Moment.scene_id.in_(scene_ids),
                Act.production_id == production_id,
            )
            .distinct()
            .all()
        )
    }
    entrance_ids = {
        row[0]
        for row in (
            db.query(MomentEntrance.character_id)
            .join(Moment, Moment.id == MomentEntrance.moment_id)
            .join(Scene, Scene.id == Moment.scene_id)
            .join(Act, Act.id == Scene.act_id)
            .filter(
                Moment.scene_id.in_(scene_ids),
                Act.production_id == production_id,
            )
            .distinct()
            .all()
        )
    }
    exit_ids = {
        row[0]
        for row in (
            db.query(MomentExit.character_id)
            .join(Moment, Moment.id == MomentExit.moment_id)
            .join(Scene, Scene.id == Moment.scene_id)
            .join(Act, Act.id == Scene.act_id)
            .filter(
                Moment.scene_id.in_(scene_ids),
                Act.production_id == production_id,
            )
            .distinct()
            .all()
        )
    }
    return dialogue_ids | lyric_ids | entrance_ids | exit_ids


def character_ids_in_songs(
    db: Session,
    production_id: int,
    song_ids: list[int],
) -> set[int]:
    """Characters with dialogue, lyrics, entrance, or exit on moments for the songs."""
    if not song_ids:
        return set()

    dialogue_ids = {
        row[0]
        for row in (
            db.query(Dialogue.character_id)
            .join(Moment, Moment.id == Dialogue.moment_id)
            .join(Song, Song.id == Moment.song_id)
            .filter(
                Moment.song_id.in_(song_ids),
                Song.production_id == production_id,
            )
            .distinct()
            .all()
        )
    }
    lyric_ids = {
        row[0]
        for row in (
            db.query(LyricLine.character_id)
            .join(Moment, Moment.id == LyricLine.moment_id)
            .join(Song, Song.id == Moment.song_id)
            .filter(
                Moment.song_id.in_(song_ids),
                Song.production_id == production_id,
            )
            .distinct()
            .all()
        )
    }
    entrance_ids = {
        row[0]
        for row in (
            db.query(MomentEntrance.character_id)
            .join(Moment, Moment.id == MomentEntrance.moment_id)
            .join(Song, Song.id == Moment.song_id)
            .filter(
                Moment.song_id.in_(song_ids),
                Song.production_id == production_id,
            )
            .distinct()
            .all()
        )
    }
    exit_ids = {
        row[0]
        for row in (
            db.query(MomentExit.character_id)
            .join(Moment, Moment.id == MomentExit.moment_id)
            .join(Song, Song.id == Moment.song_id)
            .filter(
                Moment.song_id.in_(song_ids),
                Song.production_id == production_id,
            )
            .distinct()
            .all()
        )
    }
    return dialogue_ids | lyric_ids | entrance_ids | exit_ids


def _users_for_character_ids(
    db: Session,
    production_id: int,
    character_ids: set[int],
) -> list[tuple[User, list[str]]]:
    if not character_ids:
        return []

    actor_user_ids = {
        user.id
        for user in list_active_production_users(db, production_id, role_code="actor")
    }
    if not actor_user_ids:
        return []

    rows = (
        db.query(User, Character)
        .join(UserCharacterAssignment, UserCharacterAssignment.user_id == User.id)
        .join(Character, Character.id == UserCharacterAssignment.character_id)
        .filter(
            Character.production_id == production_id,
            Character.id.in_(character_ids),
            User.id.in_(actor_user_ids),
        )
        .order_by(User.last_name, User.first_name, Character.name)
        .all()
    )

    by_user: dict[int, tuple[User, list[str]]] = {}
    for user, character in rows:
        if user.id not in by_user:
            by_user[user.id] = (user, [])
        by_user[user.id][1].append(character.name)
    return list(by_user.values())


def suggested_users_for_scenes(
    db: Session,
    production_id: int,
    scene_ids: list[int],
) -> list[tuple[User, list[str]]]:
    """Return cast users who play characters present in the scenes."""
    return _users_for_character_ids(
        db,
        production_id,
        character_ids_in_scenes(db, production_id, scene_ids),
    )


def suggested_users_for_targets(
    db: Session,
    production_id: int,
    scene_ids: list[int],
    song_ids: list[int],
) -> list[tuple[User, list[str]]]:
    """Return cast users present in any of the selected scenes or songs."""
    character_ids = character_ids_in_scenes(
        db, production_id, scene_ids
    ) | character_ids_in_songs(db, production_id, song_ids)
    return _users_for_character_ids(db, production_id, character_ids)


def scene_recommendations(
    db: Session,
    production_id: int,
) -> list[Scene]:
    """Scenes ordered by times_rehearsed ascending (never-run first)."""
    return (
        db.query(Scene)
        .join(Act, Act.id == Scene.act_id)
        .filter(Act.production_id == production_id)
        .order_by(Scene.times_rehearsed.asc(), Act.number.asc(), Scene.sort_order.asc())
        .all()
    )


def _scene_dialog_label(scene: Scene) -> str:
    act_number = scene.act.number if scene.act is not None else None
    base = f"{act_number}.{scene.number}" if act_number is not None else f"Sc {scene.number}"
    title = f" — {scene.title}" if scene.title else ""
    return f"{base}{title} · Dialog"


def _song_focus_label(song: Song, focus: str) -> str:
    kind = "Music" if focus == REHEARSAL_FOCUS_MUSIC else "Choreo"
    return f"{song.title} · {kind}"


def rehearsal_recommendations(
    db: Session,
    production_id: int,
) -> list[dict]:
    """Under-rehearsed dialog scenes + song music/choreo, least first."""
    scenes = (
        db.query(Scene)
        .options(joinedload(Scene.act))
        .join(Act, Act.id == Scene.act_id)
        .filter(Act.production_id == production_id)
        .all()
    )
    songs = (
        db.query(Song)
        .filter(Song.production_id == production_id)
        .order_by(Song.title.asc())
        .all()
    )

    rows: list[dict] = []
    for scene in scenes:
        rows.append(
            {
                "focus": REHEARSAL_FOCUS_DIALOG,
                "scene_id": scene.id,
                "song_id": None,
                "act_number": scene.act.number if scene.act else None,
                "number": scene.number,
                "title": scene.title,
                "times_rehearsed": scene.times_rehearsed or 0,
                "last_rehearsed_at": scene.last_rehearsed_at,
                "label": _scene_dialog_label(scene),
                "sort_title": (scene.title or "").lower(),
                "sort_act": scene.act.number if scene.act else 0,
                "sort_number": scene.number,
            }
        )
    for song in songs:
        rows.append(
            {
                "focus": REHEARSAL_FOCUS_MUSIC,
                "scene_id": None,
                "song_id": song.id,
                "act_number": None,
                "number": None,
                "title": song.title,
                "times_rehearsed": song.times_music_rehearsed or 0,
                "last_rehearsed_at": song.last_music_rehearsed_at,
                "label": _song_focus_label(song, REHEARSAL_FOCUS_MUSIC),
                "sort_title": song.title.lower(),
                "sort_act": 0,
                "sort_number": 0,
            }
        )
        rows.append(
            {
                "focus": REHEARSAL_FOCUS_CHOREO,
                "scene_id": None,
                "song_id": song.id,
                "act_number": None,
                "number": None,
                "title": song.title,
                "times_rehearsed": song.times_choreo_rehearsed or 0,
                "last_rehearsed_at": song.last_choreo_rehearsed_at,
                "label": _song_focus_label(song, REHEARSAL_FOCUS_CHOREO),
                "sort_title": song.title.lower(),
                "sort_act": 0,
                "sort_number": 0,
            }
        )

    rows.sort(
        key=lambda row: (
            row["times_rehearsed"],
            row["sort_act"],
            row["sort_number"],
            row["sort_title"],
            row["focus"],
        )
    )
    return rows


def validate_scenes_in_production(
    db: Session,
    production_id: int,
    scene_ids: list[int],
) -> list[Scene]:
    if not scene_ids:
        return []
    scenes = (
        db.query(Scene)
        .join(Act, Act.id == Scene.act_id)
        .filter(Act.production_id == production_id, Scene.id.in_(scene_ids))
        .all()
    )
    found = {s.id for s in scenes}
    missing = set(scene_ids) - found
    if missing:
        raise ValueError(f"Scenes not in production: {sorted(missing)}")
    return scenes


def validate_songs_in_production(
    db: Session,
    production_id: int,
    song_ids: list[int],
) -> list[Song]:
    if not song_ids:
        return []
    songs = (
        db.query(Song)
        .filter(Song.production_id == production_id, Song.id.in_(song_ids))
        .all()
    )
    found = {s.id for s in songs}
    missing = set(song_ids) - found
    if missing:
        raise ValueError(f"Songs not in production: {sorted(missing)}")
    return songs


def bump_rehearsal_progress(
    db: Session,
    *,
    scene_ids: set[int],
    music_song_ids: set[int],
    choreo_song_ids: set[int],
    when: datetime,
) -> None:
    """Increment progress counters for completed rehearsal targets."""
    if scene_ids:
        scenes = db.query(Scene).filter(Scene.id.in_(scene_ids)).all()
        for scene in scenes:
            scene.times_rehearsed = (scene.times_rehearsed or 0) + 1
            scene.last_rehearsed_at = when

    song_ids = music_song_ids | choreo_song_ids
    if not song_ids:
        return
    songs = db.query(Song).filter(Song.id.in_(song_ids)).all()
    for song in songs:
        if song.id in music_song_ids:
            song.times_music_rehearsed = (song.times_music_rehearsed or 0) + 1
            song.last_music_rehearsed_at = when
        if song.id in choreo_song_ids:
            song.times_choreo_rehearsed = (song.times_choreo_rehearsed or 0) + 1
            song.last_choreo_rehearsed_at = when
