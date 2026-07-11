from pydantic import BaseModel, Field


class SetPieceCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    mobile: bool = False
    description: str | None = None


class SetPieceUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    mobile: bool | None = None
    description: str | None = None


class SetPieceResponse(BaseModel):
    id: int
    name: str
    mobile: bool
    description: str | None


class MomentSetPieceCreate(BaseModel):
    set_piece_id: int
    notes: str | None = None


class MomentSetPieceResponse(BaseModel):
    id: int
    set_piece_id: int
    set_piece_name: str
    notes: str | None
