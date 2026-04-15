import os

from celery import Celery

redis_url = os.getenv("REDIS_URL", "redis://redis:6379/0")

app = Celery(
    "reginspector",
    broker=redis_url,
    backend=redis_url,
)

app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="Asia/Riyadh",
    enable_utc=True,
    task_routes={
        "worker.tasks.*": {"queue": "ingestion"},
    },
    task_track_started=True,
    task_acks_late=True,
    worker_prefetch_multiplier=1,
)

# Auto-discover tasks
app.autodiscover_tasks(["worker.tasks"])
