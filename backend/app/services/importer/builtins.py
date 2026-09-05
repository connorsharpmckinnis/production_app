"""
Built-in production characters recognized by the importer.

ALL and ENSEMBLE are always valid singer names in song blocks, even before
any dialogue line introduces them. ENSEMBLE is intended to map to a Character
Group in a future phase; for now it is stored as a Character like other names.

Catalog APIs (character list, casting list) hide these builtins so they do not
appear as castable roles. Readiness and lav chart also exclude them.
"""

# Always treated as known singers during song-block classification.
BUILTIN_SINGER_NAMES: frozenset[str] = frozenset({"ALL", "ENSEMBLE"})

# Created on every import so dialogue/lyrics can attach to them.
BUILTIN_CHARACTER_NAMES: tuple[str, ...] = ("ALL", "ENSEMBLE")