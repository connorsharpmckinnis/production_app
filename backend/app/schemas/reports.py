from pydantic import BaseModel, Field


class PropSheetMomentReference(BaseModel):
    moment_id: int
    sequence_number: int
    act_number: int
    scene_number: int
    scene_title: str | None
    character_name: str | None
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


class CostumeBySceneEntry(BaseModel):
    costume_id: int
    character_id: int
    character_name: str
    name: str
    description: str | None


class CostumesBySceneGroup(BaseModel):
    scene_id: int
    act_number: int
    scene_number: int
    scene_title: str | None
    costumes: list[CostumeBySceneEntry]
