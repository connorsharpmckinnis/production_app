"""Built-in Overview encouragement copy for readiness bands.

Used by seed startup and migration 014 so deployed and fresh DBs match.
"""

# Valid readiness bands for encouragement messages (Phase 8).
ENCOURAGEMENT_BANDS: tuple[str, ...] = (
    "0",
    "1-24",
    "25-49",
    "50-74",
    "75-89",
    "90-99",
    "100",
)

ENCOURAGEMENT_BAND_SET = frozenset(ENCOURAGEMENT_BANDS)

# Default spotlight rotation when app_settings has no override history.
DEFAULT_MESSAGE_ROTATION_SECONDS = 20

# Allowed rotation: 0 = off (show first item only); otherwise 5–300 seconds.
ROTATION_MIN_SECONDS = 5
ROTATION_MAX_SECONDS = 300

MESSAGE_KINDS = ("encouragement", "scripture", "announcement")

# One seed row per band (sort_order matches band order).
DEFAULT_ENCOURAGEMENT_MESSAGES: tuple[dict[str, object], ...] = (
    {
        "band": "0",
        "title": None,
        "body": "Blank stage — import a script and let's get rolling.",
        "sort_order": 0,
        "active": True,
    },
    {
        "band": "1-24",
        "title": None,
        "body": "Good start — the bones are there.",
        "sort_order": 1,
        "active": True,
    },
    {
        "band": "25-49",
        "title": None,
        "body": "You're building something real. Keep layering prep.",
        "sort_order": 2,
        "active": True,
    },
    {
        "band": "50-74",
        "title": None,
        "body": "Solid progress — the show is taking shape.",
        "sort_order": 3,
        "active": True,
    },
    {
        "band": "75-89",
        "title": None,
        "body": "You got it — almost at the finish line!",
        "sort_order": 4,
        "active": True,
    },
    {
        "band": "90-99",
        "title": None,
        "body": "So close — knock out the last gaps.",
        "sort_order": 5,
        "active": True,
    },
    {
        "band": "100",
        "title": None,
        "body": "Prep looks complete. Time to rehearse.",
        "sort_order": 6,
        "active": True,
    },
)


def readiness_band(readiness_percent: int | None) -> str:
    """Map overall readiness % to an encouragement band key."""
    if readiness_percent is None or readiness_percent <= 0:
        return "0"
    if readiness_percent >= 100:
        return "100"
    if readiness_percent <= 24:
        return "1-24"
    if readiness_percent <= 49:
        return "25-49"
    if readiness_percent <= 74:
        return "50-74"
    if readiness_percent <= 89:
        return "75-89"
    return "90-99"


def is_valid_rotation_seconds(value: int) -> bool:
    if value == 0:
        return True
    return ROTATION_MIN_SECONDS <= value <= ROTATION_MAX_SECONDS
