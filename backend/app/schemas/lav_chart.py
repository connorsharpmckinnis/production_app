from pydantic import BaseModel, Field


class LavChartSceneColumn(BaseModel):
    id: int
    act_id: int
    act_number: int
    act_title: str | None
    scene_number: int
    scene_title: str | None


class LavChartRow(BaseModel):
    row_key: str
    user_id: int | None
    character_id: int | None
    label: str
    character_ids: list[int]
    character_names: list[str]
    need_scene_ids: list[int]


class LavWireCell(BaseModel):
    row_key: str
    scene_id: int
    wire_id: int | None = None


class LavPackCell(BaseModel):
    row_key: str
    scene_id: int
    pack_id: int | None = None


class LavChartIssue(BaseModel):
    code: str
    severity: str
    message: str
    row_key: str | None = None
    scene_id: int | None = None
    asset_id: int | None = None


class LavChartCatalogItem(BaseModel):
    id: int
    identifier: str
    notes: str | None


class LavChartResponse(BaseModel):
    scenes: list[LavChartSceneColumn]
    rows: list[LavChartRow]
    wires: list[LavChartCatalogItem]
    packs: list[LavChartCatalogItem]
    wire_cells: list[LavWireCell]
    pack_cells: list[LavPackCell]
    issues: list[LavChartIssue]
    rules: list[str]


class LavChartSaveRequest(BaseModel):
    wire_cells: list[LavWireCell] = Field(default_factory=list)
    pack_cells: list[LavPackCell] = Field(default_factory=list)


class LavChartProposeRequest(BaseModel):
    sheets: list[str] = Field(default_factory=lambda: ["wires", "packs"])
