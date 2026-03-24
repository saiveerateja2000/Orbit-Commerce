import os
import logging
import warnings

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from prometheus_client import make_asgi_app
from opentelemetry import trace
from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
from opentelemetry.sdk.resources import Resource
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor

from app.database import init_db
from app.routes.users import router

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

OTLP_ENDPOINT = os.getenv("OTLP_ENDPOINT", "http://otel-collector:4317")
SERVICE_NAME = os.getenv("SERVICE_NAME", "user-service")

# CORS: supply a comma-separated list via CORS_ORIGINS env var for production.
_raw_origins = os.getenv("CORS_ORIGINS", "*")
CORS_ORIGINS: list[str] = [o.strip() for o in _raw_origins.split(",")]
if "*" in CORS_ORIGINS:
    warnings.warn(
        "CORS_ORIGINS is set to '*' — restrict this in production via the CORS_ORIGINS env var.",
        stacklevel=1,
    )


def setup_tracing():
    resource = Resource.create({"service.name": SERVICE_NAME})
    provider = TracerProvider(resource=resource)
    exporter = OTLPSpanExporter(endpoint=OTLP_ENDPOINT, insecure=True)
    provider.add_span_processor(BatchSpanProcessor(exporter))
    trace.set_tracer_provider(provider)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting up User Service...")
    await init_db()
    logger.info("Database initialised.")
    yield
    logger.info("Shutting down User Service.")


setup_tracing()

app = FastAPI(
    title="User Service",
    description="OrbitCommerce User Service — registration, authentication, and profile management",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Prometheus metrics sub-application mounted at /metrics
metrics_app = make_asgi_app()
app.mount("/metrics", metrics_app)

app.include_router(router, tags=["users"])

FastAPIInstrumentor.instrument_app(app)
