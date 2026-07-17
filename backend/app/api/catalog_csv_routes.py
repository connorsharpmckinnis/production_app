"""Shared FastAPI helpers for catalog CSV import endpoints."""

from __future__ import annotations

from fastapi import HTTPException, Response, UploadFile, status

from app.services.catalog_csv import CatalogCsvError, MAX_CSV_BYTES, template_csv


async def read_catalog_upload(file: UploadFile) -> bytes:
    content = await file.read()
    if len(content) > MAX_CSV_BYTES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="CSV file exceeds maximum size of 1 MiB",
        )
    return content


def catalog_csv_error_http(exc: CatalogCsvError) -> HTTPException:
    return HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


def catalog_template_response(filename: str, columns: tuple[str, ...] | list[str]) -> Response:
    return Response(
        content=template_csv(columns),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
