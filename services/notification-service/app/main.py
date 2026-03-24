import logging
import os
from contextlib import asynccontextmanager

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("notification-service")

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
from app.routes.notifications import router


def configure_tracing() -> None:
    otlp_endpoint = os.getenv("OTLP_ENDPOINT", "http://otel-collector:4317")
    resource = Resource.create({"service.name": "notification-service"})
    provider = TracerProvider(resource=resource)
    exporter = OTLPSpanExporter(endpoint=otlp_endpoint, insecure=True)
    provider.add_span_processor(BatchSpanProcessor(exporter))
    trace.set_tracer_provider(provider)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting up Notification Service...")
    await init_db()
    logger.info("Database initialised.")
    yield
    logger.info("Shutting down Notification Service.")


configure_tracing()

app = FastAPI(
    title="OrbitCommerce Notification Service",
    description="Manages and simulates sending notifications in the OrbitCommerce platform",
    version="1.0.0",
    lifespan=lifespan,
)

_cors_origins = os.getenv("CORS_ORIGINS", "*").split(",")
if "*" in _cors_origins:
    logger.warning(
        "CORS_ORIGINS is set to wildcard '*'. Restrict this in production "
        "by setting the CORS_ORIGINS environment variable."
    )

app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount Prometheus metrics endpoint
metrics_app = make_asgi_app()
app.mount("/metrics", metrics_app)

app.include_router(router)

FastAPIInstrumentor.instrument_app(app)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("app.main:app", host="0.0.0.0", port=8005, reload=False)
