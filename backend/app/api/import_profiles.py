from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.auth.dependencies import require_admin
from app.db.session import get_db
from app.models import ImportProfile, User
from app.schemas.import_profiles import ImportProfileDuplicate, ImportProfileResponse
from app.services.import_profiles import apply_definition, definition_from_model
from app.services.importer.profiles import ImportProfileDefinition

router = APIRouter(prefix="/import-profiles", tags=["import profiles"])


def _visible_profile_query(db: Session, admin: User):
    return db.query(ImportProfile).filter(
        or_(
            ImportProfile.organization_id == admin.organization_id,
            ImportProfile.organization_id.is_(None),
        )
    )


def _get_visible_profile(db: Session, admin: User, profile_id: int) -> ImportProfile:
    profile = _visible_profile_query(db, admin).filter(ImportProfile.id == profile_id).first()
    if profile is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Import profile not found")
    return profile


def _response(profile: ImportProfile) -> ImportProfileResponse:
    return ImportProfileResponse(
        **definition_from_model(profile).model_dump(),
        id=profile.id,
        is_builtin=profile.is_builtin,
        created_at=profile.created_at,
        updated_at=profile.updated_at,
    )


@router.get("", response_model=list[ImportProfileResponse])
def list_import_profiles(
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> list[ImportProfileResponse]:
    profiles = (
        _visible_profile_query(db, admin)
        .order_by(ImportProfile.is_builtin.desc(), ImportProfile.name)
        .all()
    )
    return [_response(profile) for profile in profiles]


@router.get("/{profile_id}", response_model=ImportProfileResponse)
def get_import_profile(
    profile_id: int,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> ImportProfileResponse:
    return _response(_get_visible_profile(db, admin, profile_id))


@router.post("", response_model=ImportProfileResponse, status_code=status.HTTP_201_CREATED)
def create_import_profile(
    body: ImportProfileDefinition,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> ImportProfileResponse:
    profile = ImportProfile(organization_id=admin.organization_id, is_builtin=False)
    apply_definition(profile, body)
    db.add(profile)
    db.commit()
    db.refresh(profile)
    return _response(profile)


@router.put("/{profile_id}", response_model=ImportProfileResponse)
def update_import_profile(
    profile_id: int,
    body: ImportProfileDefinition,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> ImportProfileResponse:
    profile = _get_visible_profile(db, admin, profile_id)
    if profile.is_builtin:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Built-in profiles are read-only; duplicate this profile first",
        )
    apply_definition(profile, body)
    db.commit()
    db.refresh(profile)
    return _response(profile)


@router.post("/{profile_id}/duplicate", response_model=ImportProfileResponse)
def duplicate_import_profile(
    profile_id: int,
    body: ImportProfileDuplicate,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> ImportProfileResponse:
    source = _get_visible_profile(db, admin, profile_id)
    definition = definition_from_model(source)
    definition.name = body.name or f"{source.name} copy"
    duplicate = ImportProfile(organization_id=admin.organization_id, is_builtin=False)
    apply_definition(duplicate, definition)
    db.add(duplicate)
    db.commit()
    db.refresh(duplicate)
    return _response(duplicate)


@router.delete("/{profile_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_import_profile(
    profile_id: int,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> Response:
    profile = _get_visible_profile(db, admin, profile_id)
    if profile.is_builtin:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Built-in profiles cannot be deleted",
        )
    db.delete(profile)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)

