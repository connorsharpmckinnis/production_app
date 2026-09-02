"""Built-in production roles and their initial capability matrix."""

from collections.abc import Mapping

PERMISSION_ACTIONS = ("read", "create", "update", "delete")

PRODUCTION_ROLE_DEFINITIONS = (
    ("member", "Member", "General production participant"),
    ("director", "Director", "Production preparation and leadership"),
    ("actor", "Actor", "Cast participant and rehearsal user"),
)

# These keys represent user-facing production areas, not database tables.
PRODUCTION_PERMISSION_RESOURCES = (
    "production",
    "overview",
    "timeline",
    "characters",
    "casting",
    "groups",
    "songs",
    "props",
    "costumes",
    "set_pieces",
    "lav_chart",
    "cue_categories",
    "cues",
    "notes",
    "tasks",
    "rehearse",
    "rehearsals",
    "reports",
    "announcements",
    "notifications",
    "people",
    "bookmarks",
)

_DIRECTOR_EXCLUDED_RESOURCES = frozenset(
    {"production", "overview", "reports", "rehearse", "notifications", "bookmarks"}
)
_DIRECTOR_MANAGED_RESOURCES = frozenset(
    resource
    for resource in PRODUCTION_PERMISSION_RESOURCES
    if resource not in _DIRECTOR_EXCLUDED_RESOURCES
)

# The matrix includes disabled rows as well as enabled rows. This gives future
# settings screens one stable row for every role/resource/action combination.
PRODUCTION_ROLE_ENABLED_ACTIONS: Mapping[str, Mapping[str, frozenset[str]]] = {
    "member": {
        resource: frozenset({"read"}) for resource in PRODUCTION_PERMISSION_RESOURCES
    },
    "actor": {
        resource: frozenset({"read"})
        | (
            frozenset({"create", "update", "delete"})
            if resource in {"notes", "bookmarks"}
            else frozenset()
        )
        for resource in PRODUCTION_PERMISSION_RESOURCES
    },
    "director": {
        resource: (
            frozenset({"read", "update"})
            if resource == "production"
            else frozenset({"read", "create", "update", "delete"})
            if resource in _DIRECTOR_MANAGED_RESOURCES
            else frozenset({"read", "create", "update", "delete"})
            if resource in {"notes", "bookmarks", "announcements", "rehearsals"}
            else frozenset({"read"})
        )
        for resource in PRODUCTION_PERMISSION_RESOURCES
    },
}


def enabled_actions_for(role_code: str, resource: str) -> frozenset[str]:
    """Return the default enabled actions for one role/resource pair."""

    return PRODUCTION_ROLE_ENABLED_ACTIONS[role_code][resource]
