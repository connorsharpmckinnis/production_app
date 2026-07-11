from pydantic import BaseModel, ConfigDict


class AppSettingsResponse(BaseModel):
    show_original_text: bool
    show_parsed_text: bool

    model_config = ConfigDict(from_attributes=True)


class AppSettingsUpdate(BaseModel):
    show_original_text: bool | None = None
    show_parsed_text: bool | None = None

    model_config = ConfigDict(extra="forbid")
