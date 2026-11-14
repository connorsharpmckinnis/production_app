"""Suggest missing entrances before a character/group first speaks in a scene."""

from app.models import Moment
from app.services.suggestions.context import (
    SceneSuggestionContext,
    character_covered_before,
    entrance_already_on_moment,
    group_covered_before,
    speaking_subjects_for_moment,
)
from app.services.suggestions.types import (
    RuleSpec,
    SuggestionAction,
    SuggestionDraft,
    SuggestionSubject,
    make_fingerprint,
)

RULE_SPEC = RuleSpec(
    id="entrance_imminence",
    title="Entrance imminence",
    supports_groups=True,
    look_ahead=15,
)


def _placement_anchor(
    moments: list[Moment],
    speaking_index: int,
) -> Moment:
    """Nearest prior stage_direction, else nearest prior moment, else speaking moment."""
    if speaking_index <= 0:
        return moments[speaking_index]

    prior = moments[:speaking_index]
    for moment in reversed(prior):
        if moment.moment_type and moment.moment_type.name == "stage_direction":
            return moment
    return prior[-1]


def evaluate_entrance_imminence(
    ctx: SceneSuggestionContext,
) -> list[SuggestionDraft]:
    """One suggestion per subject for their first speaking moment while off-stage."""
    moments = ctx.moments
    if not moments:
        return []

    first_speech: dict[tuple[str, int], tuple[int, Moment]] = {}
    for index, moment in enumerate(moments):
        for kind, subject_id in speaking_subjects_for_moment(ctx, moment):
            key = (kind, subject_id)
            if key not in first_speech:
                first_speech[key] = (index, moment)

    drafts: list[SuggestionDraft] = []
    for (kind, subject_id), (speaking_index, speaking_moment) in first_speech.items():
        if kind == "group" and not RULE_SPEC.supports_groups:
            continue

        if kind == "character":
            if character_covered_before(ctx, speaking_moment.id, subject_id):
                continue
            name = ctx.character_names.get(subject_id, f"Character {subject_id}")
            subject = SuggestionSubject(kind="character", id=subject_id, name=name)
        else:
            if group_covered_before(ctx, speaking_moment.id, subject_id):
                continue
            name = ctx.group_names.get(subject_id, f"Group {subject_id}")
            subject = SuggestionSubject(kind="group", id=subject_id, name=name)

        anchor = _placement_anchor(moments, speaking_index)

        if kind == "character" and entrance_already_on_moment(
            anchor, character_id=subject_id
        ):
            continue
        if kind == "group" and entrance_already_on_moment(anchor, group_id=subject_id):
            continue

        # Look-ahead: only nudge when first speech is within N moments after the anchor.
        anchor_index = next(
            (i for i, moment in enumerate(moments) if moment.id == anchor.id),
            speaking_index,
        )
        if speaking_index - anchor_index > RULE_SPEC.look_ahead:
            continue

        fingerprint = make_fingerprint(
            rule_id=RULE_SPEC.id,
            scene_id=ctx.scene_id,
            subject_kind=kind,  # type: ignore[arg-type]
            subject_id=subject_id,
            anchor_moment_id=anchor.id,
        )

        action = SuggestionAction(
            kind="create_entrance",
            moment_id=anchor.id,
            character_id=subject_id if kind == "character" else None,
            group_id=subject_id if kind == "group" else None,
        )

        drafts.append(
            SuggestionDraft(
                rule_id=RULE_SPEC.id,
                severity="info",
                title=f"Add entrance for {name} here?",
                rationale=(
                    f"{name} first speaks/sings at L.{speaking_moment.sequence_number} "
                    f"but is not on stage yet."
                ),
                anchor_moment_id=anchor.id,
                speaking_moment_id=speaking_moment.id,
                scene_id=ctx.scene_id,
                subject=subject,
                actions=[action],
                fingerprint=fingerprint,
            )
        )

    drafts.sort(key=lambda draft: (draft.anchor_moment_id, draft.subject.name.lower()))
    return drafts
