from dataclasses import dataclass

import pytest
from pydantic import ValidationError

from app.services.importer.profiles import ImportProfileDefinition
from app.services.importer.rule_engine import classify_with_profile, column_band_from_profile


@dataclass(frozen=True)
class LayoutLine:
    text: str
    page: int = 5
    x0: float | None = None
    font_size: float | None = None
    is_bold: bool | None = None
    is_italic: bool | None = None


def lifehouse_profile() -> ImportProfileDefinition:
    return ImportProfileDefinition.model_validate(
        {
            "name": "Test two-column profile",
            "speakers": {
                "require_all_caps": False,
                "allow_parentheses": True,
            },
            "rules": [
                {
                    "id": "page-number",
                    "name": "Ignore page numbers",
                    "priority": 100,
                    "match": {"regex_match": r"\d+"},
                    "action": {"type": "ignore"},
                },
                {
                    "id": "act",
                    "name": "Act heading",
                    "priority": 90,
                    "match": {"regex_match": r"ACT\s+(?P<number>[IVXLC]+|\d+)"},
                    "action": {"type": "set_act", "number_capture": "number"},
                },
                {
                    "id": "scene",
                    "name": "Scene heading",
                    "priority": 90,
                    "match": {
                        "regex_match": r"SCENE\s+(?P<number>\d+):\s*(?P<title>.*)"
                    },
                    "action": {
                        "type": "set_scene",
                        "number_capture": "number",
                        "title_capture": "title",
                    },
                },
                {
                    "id": "song",
                    "name": "Song heading",
                    "priority": 85,
                    "match": {"regex_match": r'SONG:\s*["“](?P<title>.+?)["”]'},
                    "action": {"type": "song_header", "text_capture": "title"},
                },
                {
                    "id": "direction",
                    "name": "Parenthetical direction",
                    "priority": 80,
                    "match": {"is_wrapped_in_parens": True},
                    "action": {"type": "stage_direction", "strip_outer_parens": True},
                },
                {
                    "id": "speaker",
                    "name": "Speaker column",
                    "priority": 70,
                    "match": {
                        "x0_lte": 150,
                        "word_count_lte": 6,
                        "char_count_lte": 40,
                    },
                    "action": {"type": "speaker"},
                },
                {
                    "id": "lyric",
                    "name": "Lyrics in a song",
                    "priority": 65,
                    "match": {"x0_gte": 160, "inside_song_block": True},
                    "action": {"type": "lyric"},
                },
                {
                    "id": "dialogue",
                    "name": "Dialogue column",
                    "priority": 60,
                    "match": {"x0_gte": 160},
                    "action": {"type": "dialogue"},
                },
            ],
        }
    )


def test_first_matching_rule_wins_and_builds_preview_tree():
    lines = [
        LayoutLine("5", x0=300),
        LayoutLine("ACT I", x0=72, is_bold=True),
        LayoutLine("SCENE 1: LONDON TOWN SQUARE", x0=72, is_bold=True),
        LayoutLine("(As overture begins.)", x0=160, is_italic=True),
        LayoutLine("Storyteller", x0=72),
        LayoutLine("The London fog rolls in.", x0=180),
        LayoutLine('SONG: “A MERRY CHRISTMAS!”', x0=72, is_bold=True),
        LayoutLine("Carolers (A)", x0=72),
        LayoutLine("A merry Christmas to you!", x0=180),
    ]

    preview = classify_with_profile(lines, lifehouse_profile())

    assert len(preview.acts) == 1
    assert preview.acts[0].number == 1
    assert preview.acts[0].scenes[0].title == "LONDON TOWN SQUARE"
    moments = preview.acts[0].scenes[0].moments
    assert [moment.type for moment in moments] == [
        "stage_direction",
        "dialogue",
        "song_header",
        "lyric",
    ]
    assert moments[0].text == "As overture begins."
    assert moments[1].speakers == ["Storyteller"]
    assert moments[2].title == "A MERRY CHRISTMAS!"
    assert moments[3].speakers == ["Carolers (A)"]
    assert preview.unclassified == []


def test_column_band_derives_from_speaker_and_body_rules():
    band = column_band_from_profile(lifehouse_profile())
    assert band.speaker_x0_max == 150.0
    assert band.body_x0_min == 160.0


def test_lifehouse_builtin_column_band_matches_former_hardcodes():
    from app.services.import_profiles import lifehouse_profile_definition

    band = column_band_from_profile(lifehouse_profile_definition())
    assert band.speaker_x0_max == 130.0
    assert band.body_x0_min == 130.0


def test_custom_profile_changes_classification_without_backend_code():
    profile = lifehouse_profile()
    line = LayoutLine("Storyteller", x0=140)

    assert classify_with_profile([line], profile).unclassified == []

    speaker_rule = next(rule for rule in profile.rules if rule.id == "speaker")
    speaker_rule.match.x0_lte = 100
    preview = classify_with_profile([line], profile)

    assert [item.text for item in preview.unclassified] == ["Storyteller"]


def test_layout_predicate_does_not_match_when_metadata_is_missing():
    preview = classify_with_profile(
        [LayoutLine("Some line", x0=None)],
        lifehouse_profile(),
    )

    assert [item.text for item in preview.unclassified] == ["Some line"]


def test_profile_requires_unique_rule_ids():
    data = lifehouse_profile().model_dump()
    data["rules"].append(data["rules"][0])

    with pytest.raises(ValidationError, match="rule ids must be unique"):
        ImportProfileDefinition.model_validate(data)


def test_invalid_regex_capture_becomes_preview_warning():
    profile = ImportProfileDefinition.model_validate(
        {
            "name": "Bad capture",
            "rules": [
                {
                    "id": "act",
                    "name": "Act",
                    "match": {"regex_match": r"ACT (I)"},
                    "action": {"type": "set_act", "number_capture": "missing"},
                }
            ],
        }
    )

    preview = classify_with_profile([LayoutLine("ACT I")], profile)

    assert len(preview.warnings) == 1
    assert "Unknown regex capture" in preview.warnings[0].message


def _span_line(text: str, *span_specs: tuple[str, float, bool]):
    from app.services.importer.extract import ExtractedLine, LineLayout, TextSpan

    spans = tuple(
        TextSpan(
            text=span_text,
            page=5,
            x0=x0,
            x1=x0 + max(20.0, len(span_text) * 4),
            y0=100,
            y1=112,
            font_size=11,
            font_name="TimesNewRomanPSMT",
            bold=bold,
            italic=False,
        )
        for span_text, x0, bold in span_specs
    )
    layout = LineLayout(
        page=5,
        x0=min(span.x0 for span in spans),
        x1=max(span.x1 for span in spans),
        y0=100,
        y1=112,
        font_size=11,
        font_name="TimesNewRomanPSMT",
        bold=all(span.bold for span in spans),
        italic=False,
        spans=spans,
    )
    return ExtractedLine(text=text, layout=layout)


def test_inline_parenthetical_prepends_to_following_lyric():
    profile = ImportProfileDefinition.model_validate(
        {
            "name": "Inline paren",
            "speakers": {"require_all_caps": False, "allow_parentheses": True},
            "rules": [
                {
                    "id": "act",
                    "name": "Act",
                    "priority": 90,
                    "match": {"regex_match": r"ACT\s+(?P<number>\d+)"},
                    "action": {"type": "set_act", "number_capture": "number"},
                },
                {
                    "id": "scene",
                    "name": "Scene",
                    "priority": 90,
                    "match": {"regex_match": r"SCENE\s+(?P<number>\d+)"},
                    "action": {"type": "set_scene", "number_capture": "number"},
                },
                {
                    "id": "song",
                    "name": "Song",
                    "priority": 85,
                    "match": {"regex_match": r"SONG:\s*(?P<title>.+)"},
                    "action": {"type": "song_header", "text_capture": "title"},
                },
                {
                    "id": "paren",
                    "name": "Paren span",
                    "priority": 78,
                    "scope": "span",
                    "match": {"is_wrapped_in_parens": True, "x0_lte": 120},
                    "action": {"type": "stage_direction"},
                },
                {
                    "id": "speaker",
                    "name": "Speaker",
                    "priority": 70,
                    "scope": "span",
                    "match": {"x0_lte": 100, "word_count_lte": 4},
                    "action": {"type": "speaker"},
                },
                {
                    "id": "lyric",
                    "name": "Lyric",
                    "priority": 65,
                    "scope": "span",
                    "match": {"x0_gte": 200, "inside_song_block": True},
                    "action": {"type": "lyric"},
                },
            ],
        }
    )
    lines = [
        _span_line("ACT 1", ("ACT 1", 72, True)),
        _span_line("SCENE 1", ("SCENE 1", 72, True)),
        _span_line("SONG: Hello", ("SONG: Hello", 216, True)),
        _span_line(
            "Bob (with Tiny Tim) Though we are poor",
            ("Bob", 72, True),
            ("(with Tiny Tim)", 92, False),
            ("Though we are poor", 216, False),
        ),
    ]
    preview = classify_with_profile(lines, profile)
    moments = preview.acts[0].scenes[0].moments
    assert [m.type for m in moments] == ["song_header", "lyric"]
    assert moments[1].speakers == ["Bob"]
    assert moments[1].text == "(with Tiny Tim) Though we are poor"


def test_stage_direction_does_not_carry_speaker_attribution():
    profile = ImportProfileDefinition.model_validate(
        {
            "name": "Orphan direction",
            "speakers": {"require_all_caps": False, "allow_parentheses": True},
            "rules": [
                {
                    "id": "act",
                    "name": "Act",
                    "priority": 90,
                    "match": {"regex_match": r"ACT\s+(?P<number>\d+)"},
                    "action": {"type": "set_act", "number_capture": "number"},
                },
                {
                    "id": "scene",
                    "name": "Scene",
                    "priority": 90,
                    "match": {"regex_match": r"SCENE\s+(?P<number>\d+)"},
                    "action": {"type": "set_scene", "number_capture": "number"},
                },
                {
                    "id": "speaker",
                    "name": "Speaker",
                    "priority": 70,
                    "match": {"x0_lte": 100},
                    "action": {"type": "speaker"},
                },
                {
                    "id": "direction",
                    "name": "Direction",
                    "priority": 80,
                    "match": {"is_wrapped_in_parens": True},
                    "action": {"type": "stage_direction", "strip_outer_parens": True},
                },
                {
                    "id": "dialogue",
                    "name": "Dialogue",
                    "priority": 60,
                    "match": {"x0_gte": 200},
                    "action": {"type": "dialogue"},
                },
            ],
        }
    )
    lines = [
        LayoutLine("ACT 1", x0=72),
        LayoutLine("SCENE 1", x0=72),
        LayoutLine("Carolers", x0=72),
        LayoutLine(
            "(Music pauses then turns ominous, transitioning to Marley)",
            x0=216,
        ),
    ]
    preview = classify_with_profile(lines, profile)
    direction = preview.acts[0].scenes[0].moments[0]
    assert direction.type == "stage_direction"
    assert direction.speakers == []
    assert "Music pauses" in direction.text


def test_ensemble_letter_continues_previous_character_name():
    profile = ImportProfileDefinition.model_validate(
        {
            "name": "Ensemble letters",
            "speakers": {"require_all_caps": False, "allow_parentheses": True},
            "rules": [
                {
                    "id": "act",
                    "name": "Act",
                    "priority": 90,
                    "match": {"regex_match": r"ACT\s+(?P<number>\d+)"},
                    "action": {"type": "set_act", "number_capture": "number"},
                },
                {
                    "id": "scene",
                    "name": "Scene",
                    "priority": 90,
                    "match": {"regex_match": r"SCENE\s+(?P<number>\d+)"},
                    "action": {"type": "set_scene", "number_capture": "number"},
                },
                {
                    "id": "paren-span",
                    "name": "Paren span",
                    "priority": 78,
                    "scope": "span",
                    "match": {"is_wrapped_in_parens": True, "x0_lte": 120},
                    "action": {"type": "stage_direction"},
                },
                {
                    "id": "speaker",
                    "name": "Speaker",
                    "priority": 70,
                    "scope": "span",
                    "match": {"x0_lte": 120, "word_count_lte": 4},
                    "action": {"type": "speaker"},
                },
                {
                    "id": "dialogue",
                    "name": "Dialogue",
                    "priority": 60,
                    "scope": "span",
                    "match": {"x0_gte": 130},
                    "action": {"type": "dialogue"},
                },
            ],
        }
    )
    lines = [
        _span_line("ACT 1", ("ACT 1", 72, True)),
        _span_line("SCENE 1", ("SCENE 1", 72, True)),
        _span_line(
            "Carolers (A) Oh dear",
            ("Carolers (A)", 72, True),
            ("Oh dear", 144, False),
        ),
        _span_line(
            "(B) Who else",
            ("(B)", 112, True),
            ("Who else", 144, False),
        ),
    ]
    preview = classify_with_profile(lines, profile)
    moments = preview.acts[0].scenes[0].moments
    assert [m.speakers for m in moments] == [["Carolers (A)"], ["Carolers (B)"]]
    assert moments[1].type == "dialogue"
    assert moments[1].text == "Who else"


def test_lifehouse_multiline_paren_attaches_to_opening_lyric():
    """Wrapped left-column paren must not swallow right-column lyric on the same rows."""
    from app.services.import_profiles import lifehouse_profile_definition

    lines = [
        _span_line("ACT I", ("ACT I", 72, True)),
        _span_line("SCENE 1: STREET", ("SCENE 1: STREET", 72, True)),
        _span_line(
            'SONG: "A MERRY CHRISTMAS!"',
            ('SONG: "A MERRY CHRISTMAS!"', 216, True),
        ),
        _span_line(
            "Bob Skies may be gray, but I'm here to say",
            ("Bob", 72, True),
            ("Skies may be gray, but I'm here to say", 216, False),
        ),
        _span_line(
            "(lifting Tim to That Christmas shines like the Son—",
            ("(lifting Tim to ", 108, False),
            ("That Christmas shines like the Son—", 216, False),
        ),
        _span_line(
            "his shoulders) We're standing tall!",
            ("his shoulders) ", 108, False),
            ("We're standing tall!", 216, False),
        ),
        _span_line(
            "Tim God bless us all!",
            ("Tim", 72, True),
            ("God bless us all!", 216, False),
        ),
    ]
    preview = classify_with_profile(lines, lifehouse_profile_definition())
    moments = [m for m in preview.acts[0].scenes[0].moments if m.type == "lyric"]
    assert [(m.speakers, m.text) for m in moments] == [
        (["Bob"], "Skies may be gray, but I'm here to say (lifting Tim to his shoulders)"),
        (["Bob"], "That Christmas shines like the Son—"),
        (["Bob"], "We're standing tall!"),
        (["Tim"], "God bless us all!"),
    ]


def test_lifehouse_ensemble_letters_despite_stage_direction_start_rule():
    """Line-level open-paren rules must not glue (B)/(C) dialogue onto the next speaker."""
    from app.services.import_profiles import lifehouse_profile_definition

    lines = [
        _span_line("ACT I", ("ACT I", 72, True)),
        _span_line("SCENE 1: STREET", ("SCENE 1: STREET", 72, True)),
        _span_line(
            "Carolers (A) Oh, dear me, we're in for trouble—",
            ("Carolers (A)", 72, True),
            ("Oh, dear me, we're in for trouble—", 144, False),
        ),
        _span_line(
            "(B) Who else could burst our merry bubble?",
            ("(B)", 112, True),
            ("Who else could burst our merry bubble?", 144, False),
        ),
        _span_line(
            "(C) Wealthy Ebenezer Scrooge—",
            ("(C)", 112, True),
            ("Wealthy Ebenezer Scrooge—", 144, False),
        ),
        _span_line(
            "All Stocks and bonds piled to the ceiling!",
            ("All", 72, True),
            ("Stocks and bonds piled to the ceiling!", 144, False),
        ),
        _span_line(
            "Carolers (A) Oh! It is Christmas, Mr. Scrooge!",
            ("Carolers (A)", 72, True),
            ("Oh! It is Christmas, Mr. Scrooge!", 144, False),
        ),
        _span_line(
            "(B) A time for peace, some warm refuge—",
            ("  (B)", 108, True),
            ("A time for peace, some warm refuge—", 144, False),
        ),
        _span_line(
            "(E) Please Mr. Scrooge—",
            ("  (E)", 108, True),
            ("Please Mr. Scrooge—", 144, False),
        ),
        _span_line(
            'SONG: "HELP US!"',
            ('SONG: "HELP US!"', 216, True),
        ),
    ]
    preview = classify_with_profile(lines, lifehouse_profile_definition())
    moments = preview.acts[0].scenes[0].moments
    dialogue = [m for m in moments if m.type == "dialogue"]
    assert [(m.speakers[0], m.text) for m in dialogue] == [
        ("Carolers (A)", "Oh, dear me, we're in for trouble—"),
        ("Carolers (B)", "Who else could burst our merry bubble?"),
        ("Carolers (C)", "Wealthy Ebenezer Scrooge—"),
        ("All", "Stocks and bonds piled to the ceiling!"),
        ("Carolers (A)", "Oh! It is Christmas, Mr. Scrooge!"),
        ("Carolers (B)", "A time for peace, some warm refuge—"),
        ("Carolers (E)", "Please Mr. Scrooge—"),
    ]
    assert not any(
        m.type == "stage_direction" and m.text.strip().startswith("(")
        for m in moments
    )


def test_lifehouse_spoken_cue_stays_on_current_speaker():
    """Complete cues like (Spoken) prepend to this turn, not the previous lyric."""
    from app.services.import_profiles import lifehouse_profile_definition

    lines = [
        _span_line("ACT I", ("ACT I", 72, True)),
        _span_line("SCENE 1: STREET", ("SCENE 1: STREET", 72, True)),
        _span_line(
            'SONG: "HELP US!"',
            ('SONG: "HELP US!"', 216, True),
        ),
        _span_line(
            "Carolers Help us! Help!—",
            ("Carolers", 72, True),
            ("Help us! Help!—", 216, False),
        ),
        _span_line(
            "Scrooge (Spoken) No!",
            ("Scrooge", 72, True),
            ("(Spoken)", 110, False),
            ("No!", 216, False),
        ),
    ]
    preview = classify_with_profile(lines, lifehouse_profile_definition())
    lyrics = [m for m in preview.acts[0].scenes[0].moments if m.type == "lyric"]
    assert [(m.speakers, m.text) for m in lyrics] == [
        (["Carolers"], "Help us! Help!—"),
        (["Scrooge"], "(Spoken) No!"),
    ]


def test_lifehouse_trailing_body_parentheticals_fold_into_prior_lyric():
    """Right-column (Exits) / mid-line (Spoken) spans stay on the same Moment."""
    from app.services.import_profiles import lifehouse_profile_definition

    lines = [
        _span_line("ACT I", ("ACT I", 72, True)),
        _span_line("SCENE 1: STREET", ("SCENE 1: STREET", 72, True)),
        _span_line(
            'SONG: "HELP US!"',
            ('SONG: "HELP US!"', 216, True),
        ),
        _span_line(
            "Scrooge Now go! Be useful! Scram and scat! (Exits)",
            ("Scrooge", 72, True),
            ("Now go! Be useful! Scram and scat!  ", 144, False),
            ("(Exits)", 294, False),
        ),
        _span_line(
            "Carolers You'll remember this for years… (Carolers exit)",
            ("Carolers", 72, True),
            ("You'll remember this for years…  ", 144, False),
            ("(Carolers exit)", 281, False),
        ),
        _span_line(
            "Gravediggers Dead— Dead— (Spoken) — Dead!",
            ("Gravediggers", 72, True),
            ("Dead— Dead— ", 216, False),
            ("(Spoken) ", 283, False),
            ("— Dead!", 321, False),
        ),
    ]
    preview = classify_with_profile(lines, lifehouse_profile_definition())
    lyrics = [m for m in preview.acts[0].scenes[0].moments if m.type == "lyric"]
    assert [(m.speakers, m.text) for m in lyrics] == [
        (["Scrooge"], "Now go! Be useful! Scram and scat! (Exits)"),
        (["Carolers"], "You'll remember this for years… (Carolers exit)"),
        (["Gravediggers"], "Dead— Dead— (Spoken) — Dead!"),
    ]


def test_lifehouse_ampersand_speakers_split_into_two_characters():
    from app.services.import_profiles import lifehouse_profile_definition

    lines = [
        _span_line("ACT I", ("ACT I", 72, True)),
        _span_line("SCENE 1: STREET", ("SCENE 1: STREET", 72, True)),
        _span_line(
            "Liddy & Rouge We're chairmen of a fine committee",
            ("Liddy & Rouge", 72, True),
            ("We're chairmen of a fine committee", 138, False),
        ),
    ]
    preview = classify_with_profile(lines, lifehouse_profile_definition())
    moment = preview.acts[0].scenes[0].moments[0]
    assert moment.type == "dialogue"
    assert moment.speakers == ["Liddy", "Rouge"]
    assert "chairmen" in moment.text


def test_lifehouse_wrapped_and_speakers_join_then_split():
    """'Undertaker and' + next-row 'Gravediggers' become two speakers on both lyrics."""
    from app.services.import_profiles import lifehouse_profile_definition

    lines = [
        _span_line("ACT I", ("ACT I", 72, True)),
        _span_line("SCENE 1: STREET", ("SCENE 1: STREET", 72, True)),
        _span_line(
            'SONG: "MARLEY IS DEAD"',
            ('SONG: "MARLEY IS DEAD"', 216, True),
        ),
        _span_line(
            "Undertaker and The worth of the story that we shall relate",
            ("Undertaker and   ", 72, True),
            ("The worth of the story that we shall relate", 216, False),
        ),
        _span_line(
            "Gravediggers Depends upon how clearly it's known— (woe, woe, woe!)—",
            ("Gravediggers", 72, True),
            ("Depends upon how clearly it's known— (woe, woe, woe!)—", 216, False),
        ),
    ]
    preview = classify_with_profile(lines, lifehouse_profile_definition())
    lyrics = [m for m in preview.acts[0].scenes[0].moments if m.type == "lyric"]
    assert len(lyrics) == 2
    assert lyrics[0].speakers == ["Undertaker", "Gravediggers"]
    assert "worth of the story" in lyrics[0].text
    assert lyrics[1].speakers == ["Undertaker", "Gravediggers"]
    assert "clearly" in lyrics[1].text


def test_consecutive_same_speaker_dialogue_coalesces_multiline():
    from app.services.import_profiles import lifehouse_profile_definition

    lines = [
        _span_line("ACT I", ("ACT I", 72, True)),
        _span_line("SCENE 1: STREET", ("SCENE 1: STREET", 72, True)),
        _span_line(
            "Scrooge Is that a fact? So you're the son of my abysmal clerk—",
            ("Scrooge", 72, True),
            ("Is that a fact? So you're the son of my abysmal clerk—", 144, False),
        ),
        _span_line(
            "Scrooge Then I suggest you limp along— he'll be a while at work!",
            ("Scrooge", 72, True),
            ("Then I suggest you limp along— he'll be a while at work!", 144, False),
        ),
    ]
    preview = classify_with_profile(lines, lifehouse_profile_definition())
    moments = preview.acts[0].scenes[0].moments
    assert len(moments) == 1
    assert moments[0].type == "dialogue"
    assert moments[0].speakers == ["Scrooge"]
    assert moments[0].text == (
        "Is that a fact? So you're the son of my abysmal clerk—\n"
        "Then I suggest you limp along— he'll be a while at work!"
    )


def test_dialogue_coalesce_stops_at_intervening_stage_direction():
    from app.services.import_profiles import lifehouse_profile_definition

    lines = [
        _span_line("ACT I", ("ACT I", 72, True)),
        _span_line("SCENE 1: STREET", ("SCENE 1: STREET", 72, True)),
        _span_line(
            "Scrooge First line.",
            ("Scrooge", 72, True),
            ("First line.", 144, False),
        ),
        _span_line(
            "(He turns away)",
            ("(He turns away)", 144, False),
        ),
        _span_line(
            "Scrooge Second line.",
            ("Scrooge", 72, True),
            ("Second line.", 144, False),
        ),
    ]
    preview = classify_with_profile(lines, lifehouse_profile_definition())
    moments = preview.acts[0].scenes[0].moments
    assert [m.type for m in moments] == ["dialogue", "stage_direction", "dialogue"]
    assert moments[0].text == "First line."
    assert moments[2].text == "Second line."


def test_consecutive_lyrics_do_not_coalesce():
    from app.services.import_profiles import lifehouse_profile_definition

    lines = [
        _span_line("ACT I", ("ACT I", 72, True)),
        _span_line("SCENE 1: STREET", ("SCENE 1: STREET", 72, True)),
        _span_line(
            'SONG: "HELLO"',
            ('SONG: "HELLO"', 216, True),
        ),
        _span_line(
            "Bob Line one",
            ("Bob", 72, True),
            ("Line one", 216, False),
        ),
        _span_line(
            "Bob Line two",
            ("Bob", 72, True),
            ("Line two", 216, False),
        ),
    ]
    preview = classify_with_profile(lines, lifehouse_profile_definition())
    lyrics = [m for m in preview.acts[0].scenes[0].moments if m.type == "lyric"]
    assert [m.text for m in lyrics] == ["Line one", "Line two"]


def test_builtin_lifehouse_handles_reprise_finale_and_segue():
    from app.services.importer.extract import ExtractedLine, LineLayout, TextSpan
    from app.services.import_profiles import lifehouse_profile_definition

    def line(text: str, *span_specs: tuple[str, float, bool]) -> ExtractedLine:
        spans = tuple(
            TextSpan(
                text=span_text,
                page=5,
                x0=x0,
                x1=x0 + 40,
                y0=100,
                y1=112,
                font_size=11,
                font_name="TimesNewRomanPSMT",
                bold=bold,
                italic=False,
            )
            for span_text, x0, bold in span_specs
        )
        layout = LineLayout(
            page=5,
            x0=min(span.x0 for span in spans),
            x1=max(span.x1 for span in spans),
            y0=100,
            y1=112,
            font_size=11,
            font_name="TimesNewRomanPSMT",
            bold=all(span.bold for span in spans),
            italic=False,
            spans=spans,
        )
        return ExtractedLine(text=text, layout=layout)

    lines = [
        line("ACT I", ("ACT I", 72, True)),
        line("SCENE 1: BEDROOM", ("SCENE 1: BEDROOM", 72, True)),
        line(
            'SONG: "SCROOGE AT HOME" (Reprise)',
            ('SONG: "SCROOGE AT HOME" (Reprise)', 216, True),
        ),
        line(
            "Storyteller Old Scrooge was overwhelmed.",
            ("Storyteller", 72, True),
            ("Old Scrooge was overwhelmed.", 216, False),
        ),
        line(
            "(Music underscoring as lights fade)",
            ("(Music underscoring as lights fade)", 144, False),
        ),
        line("Segue to next scene", ("Segue to next scene", 144, False)),
        line(
            "Storyteller Meanwhile, back in London.",
            ("Storyteller", 72, True),
            ("Meanwhile, back in London.", 144, False),
        ),
        line("FINALE", ("FINALE", 252, True)),
        line(
            'SONG: "JOY TO THE WORLD!" (Watts/Handel/',
            ('SONG: "JOY TO THE WORLD!" (Watts/Handel/', 216, True),
        ),
        line("Traditional)", ("Traditional)", 72, False)),
        line(
            "Cast Ensemble Joy to the world!",
            ("Cast Ensemble", 72, True),
            ("Joy to the world!", 216, False),
        ),
    ]

    preview = classify_with_profile(lines, lifehouse_profile_definition())
    moments = preview.acts[0].scenes[0].moments
    types = [moment.type for moment in moments]

    assert types.count("song_header") == 2
    assert moments[types.index("song_header")].title == "SCROOGE AT HOME"
    assert any(m.type == "dialogue" and "Meanwhile" in m.text for m in moments)
    assert any(m.type == "lyric" and "Joy to the world" in m.text for m in moments)
    assert not any("no current speaker" in w.message.lower() for w in preview.warnings)
    assert preview.unclassified == []

