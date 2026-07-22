from pydantic import BaseModel, Field


class LoginRequest(BaseModel):
    username: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class RoleResponse(BaseModel):
    name: str


class UserResponse(BaseModel):
    id: int
    username: str
    first_name: str
    last_name: str
    email: str | None
    is_active: bool
    roles: list[str]

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
