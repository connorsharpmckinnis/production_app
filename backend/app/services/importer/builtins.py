"""
Built-in collective labels recognized by the importer.

ALL and ENSEMBLE are always valid singer names in song blocks, even before
any dialogue line introduces them. On import they default to Groups (empty
membership) when speaker_kinds is omitted; the wizard can override.

Catalog APIs historically hid Character rows with these names; after the
group-attribution migration those fake Characters are remapped to Groups.
"""

# Always treated as known singers during song-block classification.
BUILTIN_SINGER_NAMES: frozenset[str] = frozenset({"ALL", "ENSEMBLE"})

# Labels the import wizard recommends classifying as Groups (case-insensitive).
RECOMMENDED_GROUP_NAMES: frozenset[str] = frozenset({"all", "ensemble"})

# Deprecated alias: no longer seeded as Characters. Kept for readiness/lav
# filters that still exclude leftover names if any remain in old DBs.
BUILTIN_CHARACTER_NAMES: tuple[str, ...] = ("ALL", "ENSEMBLE")
