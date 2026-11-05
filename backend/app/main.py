import os
from pathlib import Path

from fastapi import FastAPI
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from fastapi.exception_handlers import request_validation_exception_handler
from sqlalchemy.exc import SQLAlchemyError

from app.api.router import api_router
from app.config import settings

app = FastAPI(
    title="SchoolHealth API",
    description="Backend API for SchoolHealth project",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

frontend_dist = os.getenv("FRONTEND_DIST")
if frontend_dist:
    frontend_path = Path(frontend_dist).resolve()
    if not (frontend_path / "index.html").is_file():
        raise RuntimeError("FRONTEND_DIST must contain the compiled frontend")

    def frontend_page():
        return FileResponse(frontend_path / "index.html", headers={"Cache-Control": "no-cache"})

    for page in ("/", "/home", "/login", "/nurse", "/admin", "/admin/overview", "/admin/insights", "/parent"):
        app.add_api_route(page, frontend_page, methods=["GET"], include_in_schema=False)
    for folder in ("assets", "images"):
        if (frontend_path / folder).is_dir():
            app.mount(f"/{folder}", StaticFiles(directory=frontend_path / folder), name=folder)

app.include_router(api_router)


@app.exception_handler(RequestValidationError)
async def validation_error(request, exc):
    if request.url.path.startswith(("/api/parent", "/api/admin/health-records", "/api/admin/students", "/students")):
        return JSONResponse(status_code=422, content={"detail": "Invalid request fields."}, headers={"Cache-Control": "no-store"})
    # Do not echo rejected names, notes, IDs, or raw request bodies to clients.
    if request.url.path == "/api/admin/ai-insights":
        return JSONResponse(status_code=422, content={"detail": "Invalid request data. Only the defined aggregate fields are accepted."})
    return await request_validation_exception_handler(request, exc)


@app.exception_handler(SQLAlchemyError)
async def database_error(request, exc):
    return JSONResponse(status_code=503, content={"detail": "The data service is temporarily unavailable."}, headers={"Cache-Control": "no-store"})


@app.middleware("http")
async def private_responses(request, call_next):
    response = await call_next(request)
    if request.url.path.startswith(("/api/parent", "/api/admin", "/students", "/auth")):
        response.headers["Cache-Control"] = "no-store"
    return response
