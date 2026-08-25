from pydantic import BaseModel, Field


class PropSheetMomentReference(BaseModel):
    moment_id: int
    sequence_number: int
    act_number: int
    scene_number: int
    scene_title: str | None
    kind: str
    character_name: str | None
    user_display_name: str | None
    notes: str | None


class PropSheetEntry(BaseModel):
    prop_id: int
    prop_name: str
    description: str | None
    moments: list[PropSheetMomentReference]


class CueSheetMomentReference(BaseModel):
    moment_id: int
    sequence_number: int
    act_number: int
    scene_number: int
    scene_title: str | None
    cue_id: int
    title: str
    notes: str | None
    payload: dict | None


class CueSheetCategory(BaseModel):
    cue_category_id: int
    cue_category_name: str
    cues: list[CueSheetMomentReference]


class CostumeChangeEntry(BaseModel):
    moment_id: int
    sequence_number: int
    act_number: int
    scene_number: int
    scene_title: str | None
    character_id: int
    character_name: str
    kind: str
    costume_id: int | None
    costume_name: str | None
    notes: str | None


class EntranceExitSheetRow(BaseModel):
    moment_id: int
    sequence_number: int
    movement_type: str
    character_id: int
    character_name: str
    notes: str | None


class EntranceExitSheetGroup(BaseModel):
    scene_id: int
    act_number: int
    scene_number: int
    scene_title: str | None
    rows: list[EntranceExitSheetRow]


class BlockingSheetEntry(BaseModel):
    moment_id: int
    sequence_number: int
    act_number: int
    scene_number: int
    scene_title: str | None
    character_id: int | None = None
    character_name: str | None = None
    user_id: int | None = None
    user_display_name: str | None = None
    group_id: int | None = None
    group_name: str | None = None
    notes: str


class OnStageChartMomentRef(BaseModel):
    moment_id: int
    sequence_number: int
    act_number: int
    scene_number: int
    scene_title: str | None = None


class OnStageChartInterval(BaseModel):
    start_index: int
    end_index: int
    entrance: OnStageChartMomentRef
    entrance_notes: str | None = None
    exit: OnStageChartMomentRef | None = None
    exit_notes: str | None = None
    ends_at_scene_boundary: bool = False


class OnStageChartCharacterRow(BaseModel):
    character_id: int
    character_name: str
    intervals: list[OnStageChartInterval]


class OnStageChartSceneBand(BaseModel):
    scene_id: int
    act_number: int
    scene_number: int
    scene_title: str | None = None
    start_index: int
    moment_count: int


class OnStageChartActBand(BaseModel):
    act_id: int
    act_number: int
    act_title: str | None = None
    start_index: int
    moment_count: int


class OnStageChartReport(BaseModel):
    moment_count: int
    acts: list[OnStageChartActBand]
    scenes: list[OnStageChartSceneBand]
    characters: list[OnStageChartCharacterRow]
