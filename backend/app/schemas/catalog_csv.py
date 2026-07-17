from pydantic import BaseModel, Field


class CatalogImportRowError(BaseModel):
    row: int
    message: str


class CatalogImportResult(BaseModel):
    created: int = 0
    skipped: int = 0
    errors: list[CatalogImportRowError] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)
