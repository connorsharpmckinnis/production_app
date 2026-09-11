import pytest
from sqlalchemy.orm import Session

from app.db.seed import seed_database
from app.models import (
    Act,
    Character,
    Dialogue,
    Moment,
    Organization,
    Production,
    Song,
    StageDirection,
)
from app.services.importer.errors import ImportLineError
from app.services.importer.mapped_importer import persist_profile_preview
from app.services.importer.rule_engine import (
    ImportPreview,
    PreviewAct,
    PreviewMoment,
    PreviewScene,
    PreviewWarning,
    UnclassifiedLine,
)


@pytest.fixture
def production(db_session: Session, test_settings) -> Production:
    seed_database(db_session, test_settings)
    organization = db_session.query(Organization).first()
    production = Production(organization_id=organization.id, title="Mapped Show")
    db_session.add(production)
    db_session.commit()
    return production


def _preview() -> ImportPreview:
    return ImportPreview(
        acts=[
            PreviewAct(
                number=1,
                scenes=[
                    PreviewScene(
                        number=1,
                        title="Town Square",
                        moments=[
                            PreviewMoment(
                                type="stage_direction",
                                text="Fog rolls in.",
                            ),
                            PreviewMoment(
                                type="dialogue",
                                text="Good evening.",
                                speakers=["Storyteller"],
                            ),
                            PreviewMoment(
                                type="song_header",
                                text='SONG: "WELCOME"',
                                title="WELCOME",
                            ),
                            PreviewMoment(
                                type="lyric",
                                text="Welcome one and all!",
                                speakers=["Carolers (A)"],
                            ),
                        ],
                    )
                ],
            )
        ]
    )


def test_persist_profile_preview_creates_existing_domain_records(
    db_session: Session,
    production: Production,
):
    result = persist_profile_preview(db_session, production, _preview())

    assert result.acts_created == 1
    assert result.scenes_created == 1
    assert result.moments_created == 4
    assert result.songs_created == 1
    assert result.characters_created == 2
    assert db_session.query(Act).count() == 1
    assert db_session.query(Moment).count() == 4
    assert db_session.query(StageDirection).one().direction_text == "Fog rolls in."
    assert db_session.query(Dialogue).one().dialogue_text == "Good evening."
    assert db_session.query(Song).one().title == "WELCOME"
    assert {item.name for item in db_session.query(Character)} == {
        "Storyteller",
        "Carolers (A)",
    }


def test_persist_rejects_unclassified_lines_without_writing(
    db_session: Session,
    production: Production,
):
    preview = _preview()
    preview.unclassified.append(
        UnclassifiedLine(line_number=8, text="MYSTERY", page=5)
    )

    with pytest.raises(ImportLineError):
        persist_profile_preview(db_session, production, preview)

    assert db_session.query(Act).count() == 0
    assert db_session.query(Moment).count() == 0


def test_persist_rejects_preview_warnings(
    db_session: Session,
    production: Production,
):
    preview = _preview()
    preview.warnings.append(
        PreviewWarning(line_number=3, message="Moment-like line appeared before a scene")
    )

    with pytest.raises(ImportLineError) as exc_info:
        persist_profile_preview(db_session, production, preview)

    assert any(
        "Import blocked by warning" in issue.message for issue in exc_info.value.issues
    )
    assert db_session.query(Act).count() == 0


def test_persist_defaults_missing_act_title(
    db_session: Session,
    production: Production,
):
    preview = _preview()
    preview.acts[0].title = None

    persist_profile_preview(db_session, production, preview)

    act = db_session.query(Act).one()
    assert act.title == "Act 1"

