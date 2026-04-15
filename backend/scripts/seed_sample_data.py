"""Seed script: creates a default admin user and sample topic taxonomy.

Usage:
    python scripts/seed_sample_data.py

Requires DATABASE_URL_SYNC environment variable.
"""

import os
import sys
import uuid

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session

from app.config import settings
from app.database import Base
from app.models.user import User, UserRole
from app.models.topic import Topic
from app.services.auth_service import hash_password


def seed():
    engine = create_engine(settings.DATABASE_URL_SYNC)
    Base.metadata.create_all(engine)

    with Session(engine) as session:
        # Create admin user
        existing = session.execute(
            select(User).where(User.email == "admin@reginspector.local")
        ).scalar_one_or_none()

        if not existing:
            admin = User(
                email="admin@reginspector.local",
                password_hash=hash_password("admin123!@#"),
                name="System Admin",
                role=UserRole.ADMIN,
                preferred_language="en",
            )
            session.add(admin)
            print("Created admin user: admin@reginspector.local / admin123!@#")
        else:
            print("Admin user already exists")

        # Create topic taxonomy
        topics = [
            {"name_en": "Credit Cards", "name_ar": "بطاقات الائتمان"},
            {"name_en": "Anti-Money Laundering", "name_ar": "مكافحة غسل الأموال"},
            {"name_en": "Consumer Protection", "name_ar": "حماية العملاء"},
            {"name_en": "Capital Adequacy", "name_ar": "كفاية رأس المال"},
            {"name_en": "Data Privacy", "name_ar": "خصوصية البيانات"},
            {"name_en": "Corporate Governance", "name_ar": "حوكمة الشركات"},
            {"name_en": "Risk Management", "name_ar": "إدارة المخاطر"},
            {"name_en": "Digital Banking", "name_ar": "الخدمات المصرفية الرقمية"},
            {"name_en": "Insurance", "name_ar": "التأمين"},
            {"name_en": "Foreign Exchange", "name_ar": "الصرف الأجنبي"},
        ]

        existing_topics = session.execute(select(Topic)).scalars().all()
        if not existing_topics:
            for t in topics:
                session.add(
                    Topic(name_en=t["name_en"], name_ar=t["name_ar"])
                )
            print(f"Created {len(topics)} topics")
        else:
            print(f"Topics already exist ({len(existing_topics)})")

        session.commit()
        print("Seed complete.")


if __name__ == "__main__":
    seed()
