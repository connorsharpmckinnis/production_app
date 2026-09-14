from pydantic import BaseModel, ConfigDict, Field, field_validator


def _normalize_role_codes(value: list[str]) -> list[str]:
    normalized = sorted({code.strip().lower() for code in value if code.strip()})
    if not normalized:
        raise ValueError("At least one production role code is required")
    return normalized


class ProductionRoleResponse(BaseModel):
    code: str
    name: str

    model_config = ConfigDict(from_attributes=True)


class ProductionRoleDetailResponse(BaseModel):
    code: str
    name: str
    description: str | None = None
    is_active: bool
    is_system: bool

    model_config = ConfigDict(from_attributes=True)


class ProductionRoleCreateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    description: str | None = None
    code: str | None = Field(default=None, max_length=64)
    copy_from_role_code: str = Field(default="member", min_length=1, max_length=64)

    model_config = ConfigDict(extra="forbid")


class ProductionRoleUpdateRequest(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    description: str | None = None
    is_active: bool | None = None

    model_config = ConfigDict(extra="forbid")


class AssignedCharacterResponse(BaseModel):
    id: int
    name: str


class ProductionMemberResponse(BaseModel):
    user_id: int
    display_name: str
    email: str | None
    is_active: bool
    roles: list[ProductionRoleResponse]
    assigned_characters: list[AssignedCharacterResponse]


class ProductionMemberCandidateResponse(BaseModel):
    user_id: int
    display_name: str
    email: str | None
    is_active: bool


class AddProductionMemberRequest(BaseModel):
    user_id: int
    role_codes: list[str] = Field(min_length=1)

    model_config = ConfigDict(extra="forbid")

    @field_validator("role_codes")
    @classmethod
    def validate_role_codes(cls, value: list[str]) -> list[str]:
        return _normalize_role_codes(value)


class UpdateProductionMemberRolesRequest(BaseModel):
    role_codes: list[str] = Field(min_length=1)

    model_config = ConfigDict(extra="forbid")

    @field_validator("role_codes")
    @classmethod
    def validate_role_codes(cls, value: list[str]) -> list[str]:
        return _normalize_role_codes(value)


class ProductionRolePermissionResponse(BaseModel):
    role_code: str
    role_name: str
    resource: str
    action: str
    enabled: bool


class ProductionRolePermissionUpdate(BaseModel):
    role_code: str = Field(min_length=1)
    resource: str = Field(min_length=1)
    action: str = Field(min_length=1)
    enabled: bool

    model_config = ConfigDict(extra="forbid")


class ProductionRolePermissionsUpdate(BaseModel):
    permissions: list[ProductionRolePermissionUpdate]

    model_config = ConfigDict(extra="forbid")
