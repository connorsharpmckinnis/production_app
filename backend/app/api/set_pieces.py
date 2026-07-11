from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload

from app.auth.dependencies import require_authenticated, require_director_or_admin
from app.db.session import get_db
from app.models import Act, Moment, MomentSetPiece, Production, Scene, SetPiece, User
from app.schemas.set_pieces import (
    MomentSetPieceCreate,
    MomentSetPieceResponse,
    SetPieceCreate,
    SetPieceResponse,
    SetPieceUpdate,
)

router = APIRouter(prefix="/productions", tags=["set-pieces"])


def _get_production_or_404(db: Session, production_id: int) -> Production:
    production = db.query(Production).filter(Production.id == production_id).first()
    if production is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Production not found")
    return production


def _get_set_piece_or_404(db: Session, production_id: int, set_piece_id: int) -> SetPiece:
    set_piece = (
        db.query(SetPiece)
        .filter(SetPiece.id == set_piece_id, SetPiece.production_id == production_id)
        .first()
    )
    if set_piece is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Set piece not found")
    return set_piece


def _get_moment_in_production_or_404(
    db: Session,
    production_id: int,
    moment_id: int,
) -> Moment:
    moment = (
        db.query(Moment)
        .join(Scene)
        .join(Act)
        .filter(Moment.id == moment_id, Act.production_id == production_id)
        .first()
    )
    if moment is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Moment not found")
    return moment


def _moment_set_piece_response(moment_set_piece: MomentSetPiece) -> MomentSetPieceResponse:
    return MomentSetPieceResponse(
        id=moment_set_piece.id,
        set_piece_id=moment_set_piece.set_piece_id,
        set_piece_name=moment_set_piece.set_piece.name,
        notes=moment_set_piece.notes,
    )


@router.get("/{production_id}/set-pieces", response_model=list[SetPieceResponse])
def list_set_pieces(
    production_id: int,
    _user: User = Depends(require_authenticated),
    db: Session = Depends(get_db),
) -> list[SetPieceResponse]:
    _get_production_or_404(db, production_id)
    set_pieces = (
        db.query(SetPiece)
        .filter(SetPiece.production_id == production_id)
        .order_by(SetPiece.name)
        .all()
    )
    return [
        SetPieceResponse(
            id=set_piece.id,
            name=set_piece.name,
            mobile=set_piece.mobile,
            description=set_piece.description,
        )
        for set_piece in set_pieces
    ]


@router.post(
    "/{production_id}/set-pieces",
    response_model=SetPieceResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_set_piece(
    production_id: int,
    body: SetPieceCreate,
    _director: User = Depends(require_director_or_admin),
    db: Session = Depends(get_db),
) -> SetPieceResponse:
    _get_production_or_404(db, production_id)
    set_piece = SetPiece(
        production_id=production_id,
        name=body.name.strip(),
        mobile=body.mobile,
        description=body.description,
    )
    db.add(set_piece)
    db.commit()
    db.refresh(set_piece)
    return SetPieceResponse(
        id=set_piece.id,
        name=set_piece.name,
        mobile=set_piece.mobile,
        description=set_piece.description,
    )


@router.patch(
    "/{production_id}/set-pieces/{set_piece_id}",
    response_model=SetPieceResponse,
)
def update_set_piece(
    production_id: int,
    set_piece_id: int,
    body: SetPieceUpdate,
    _director: User = Depends(require_director_or_admin),
    db: Session = Depends(get_db),
) -> SetPieceResponse:
    set_piece = _get_set_piece_or_404(db, production_id, set_piece_id)
    if body.name is not None:
        set_piece.name = body.name.strip()
    if body.mobile is not None:
        set_piece.mobile = body.mobile
    if body.description is not None:
        set_piece.description = body.description
    db.commit()
    db.refresh(set_piece)
    return SetPieceResponse(
        id=set_piece.id,
        name=set_piece.name,
        mobile=set_piece.mobile,
        description=set_piece.description,
    )


@router.delete(
    "/{production_id}/set-pieces/{set_piece_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_set_piece(
    production_id: int,
    set_piece_id: int,
    _director: User = Depends(require_director_or_admin),
    db: Session = Depends(get_db),
) -> None:
    set_piece = _get_set_piece_or_404(db, production_id, set_piece_id)
    db.delete(set_piece)
    db.commit()


@router.get(
    "/{production_id}/moments/{moment_id}/set-pieces",
    response_model=list[MomentSetPieceResponse],
)
def list_moment_set_pieces(
    production_id: int,
    moment_id: int,
    _user: User = Depends(require_authenticated),
    db: Session = Depends(get_db),
) -> list[MomentSetPieceResponse]:
    _get_moment_in_production_or_404(db, production_id, moment_id)
    moment_set_pieces = (
        db.query(MomentSetPiece)
        .options(joinedload(MomentSetPiece.set_piece))
        .filter(MomentSetPiece.moment_id == moment_id)
        .order_by(MomentSetPiece.id)
        .all()
    )
    return [_moment_set_piece_response(item) for item in moment_set_pieces]


@router.post(
    "/{production_id}/moments/{moment_id}/set-pieces",
    response_model=MomentSetPieceResponse,
    status_code=status.HTTP_201_CREATED,
)
def attach_moment_set_piece(
    production_id: int,
    moment_id: int,
    body: MomentSetPieceCreate,
    _director: User = Depends(require_director_or_admin),
    db: Session = Depends(get_db),
) -> MomentSetPieceResponse:
    _get_moment_in_production_or_404(db, production_id, moment_id)
    _get_set_piece_or_404(db, production_id, body.set_piece_id)

    existing = (
        db.query(MomentSetPiece)
        .filter(
            MomentSetPiece.moment_id == moment_id,
            MomentSetPiece.set_piece_id == body.set_piece_id,
        )
        .first()
    )
    if existing is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This set piece is already attached to the moment",
        )

    moment_set_piece = MomentSetPiece(
        moment_id=moment_id,
        set_piece_id=body.set_piece_id,
        notes=body.notes,
    )
    db.add(moment_set_piece)
    db.commit()
    moment_set_piece = (
        db.query(MomentSetPiece)
        .options(joinedload(MomentSetPiece.set_piece))
        .filter(MomentSetPiece.id == moment_set_piece.id)
        .one()
    )
    return _moment_set_piece_response(moment_set_piece)


@router.delete(
    "/{production_id}/moments/{moment_id}/set-pieces/{moment_set_piece_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def detach_moment_set_piece(
    production_id: int,
    moment_id: int,
    moment_set_piece_id: int,
    _director: User = Depends(require_director_or_admin),
    db: Session = Depends(get_db),
) -> None:
    _get_moment_in_production_or_404(db, production_id, moment_id)
    moment_set_piece = (
        db.query(MomentSetPiece)
        .filter(
            MomentSetPiece.id == moment_set_piece_id,
            MomentSetPiece.moment_id == moment_id,
        )
        .first()
    )
    if moment_set_piece is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Set piece attachment not found",
        )
    db.delete(moment_set_piece)
    db.commit()
