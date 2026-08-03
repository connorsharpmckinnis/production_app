from pydantic import BaseModel, Field


class LoginRequest(BaseModel):
    username: str
    password: str


class ActAsRequest(BaseModel):
    user_id: int


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class RoleResponse(BaseModel):
    name: str


class ImpersonationInfo(BaseModel):
    """Present on /auth/me when the session is acting as another user."""

    original_user_id: int
    original_username: str
    original_first_name: str
    original_last_name: str


class UserResponse(BaseModel):
    id: int
    username: str
    first_name: str
    last_name: str
    email: str | None
    is_active: bool
    roles: list[str]
    impersonation: ImpersonationInfo | None = None

    model_config = {"from_attributes": True}


class CreateUserRequest(BaseModel):
    username: str = Field(min_length=1, max_length=255)
    password: str = Field(min_length=8)
    first_name: str
    last_name: str
    email: str | None = None
    role_name: str = Field(description="Admin, Director, or Actor")


class ResetPasswordRequest(BaseModel):
    password: str = Field(min_length=8)
