import re

# Ignored lines
RE_END_OF_SCENE = re.compile(r"^##\s+End of Scene\s+\w+\s*$")
RE_END_OF_ACT = re.compile(r"^#\s+End of Act\s+\w+\s*$")
RE_FOOTNOTE_DEF = re.compile(r"^\[\^\d+\]:\s+")

# Title page
RE_TITLE = re.compile(r"^#\s+Title:\s*(.+)$")
RE_AUTHOR = re.compile(r"^##\s+Author:\s*(.+)$")

# Structure
WORD_NUMBERS = r"One|Two|Three|Four|Five|Six|Seven|Eight|Nine|Ten"
RE_ACT = re.compile(rf"^#\s+Act\s+({WORD_NUMBERS}|\d+)\s*$")
RE_SCENE = re.compile(
    rf"^##\s+Scene\s+({WORD_NUMBERS}|\d+)\s+\\?-\s+(.+)$",
)

# Songs
RE_SONG_HEADER = re.compile(r"^###\s+\[(.+?)\]\([^)]+\)\s*$")
RE_H4 = re.compile(r"^####\s+(.+)$")

# Performer names in song blocks (legacy regex; classification uses dialogue + built-in names).
RE_PERFORMER = re.compile(
    r"^(ALL|[A-Z][A-Z0-9' ]+(?:\s*&\s*[A-Z][A-Z0-9' ]+)*(?:,\s*[A-Z][A-Z0-9' ]+)*)$",
)

# Plain ALL CAPS lines (lyrics / performers without #### prefix)
RE_ALL_CAPS_LINE = re.compile(
    r"^[A-Z0-9' &,…\.\-]+(?:\s+[A-Z0-9' &,…\.\-]+)*\s*$",
)

# Stage direction and dialogue
RE_STAGE_DIRECTION = re.compile(r"^\*(.+)\*\s*$")
RE_DIALOGUE = re.compile(r"^([A-Z][A-Z0-9' ,&-]+):\s*(.*)$")

# Author notes
RE_AUTHOR_NOTE = re.compile(r"^Note:\s*(.+)$")
RE_AUTHOR_NOTE_H4 = re.compile(r"^####\s+Note:\s*(.+)$")

# Italic stage direction wrapped in H4 during song blocks
RE_H4_ITALIC = re.compile(r"^\*(.+)\*$")

# Action parentheticals in dialogue
RE_PARENTHETICAL = re.compile(r"\([^)]+\)")

# Character names in stage direction text
RE_CAPS_NAME = re.compile(r"\b[A-Z][A-Z0-9' ]{1,}\b")
