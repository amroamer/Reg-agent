#!/usr/bin/env bash
# Initialize the database: create tables and seed data
set -euo pipefail

echo "Waiting for PostgreSQL to be ready..."
until docker exec ri-postgres pg_isready -U reginspector -d reginspector > /dev/null 2>&1; do
    sleep 2
done
echo "PostgreSQL is ready."

echo "Creating database tables..."
docker exec ri-backend python -c "
from app.database import Base
from sqlalchemy import create_engine
from app.config import settings
from app.models import *

engine = create_engine(settings.DATABASE_URL_SYNC)
Base.metadata.create_all(engine)
print('All tables created.')
engine.dispose()
"

echo "Seeding initial data..."
docker exec ri-backend python scripts/seed_sample_data.py

echo ""
echo "Database initialized successfully."
echo "  Admin login: admin@reginspector.local / admin123!@#"
echo "  IMPORTANT: Change the admin password after first login!"
