import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.main import app
from app.db.session import Base, get_db
from app.db.init_db import init_db
from app.core.security import create_access_token
from app.models.user import User

# In-memory SQLite database for tests
SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

@pytest.fixture(scope="session", autouse=True)
def setup_test_db():
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    init_db(db)
    yield
    Base.metadata.drop_all(bind=engine)

@pytest.fixture
def db_session():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()

@pytest.fixture
def client(db_session):
    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()

@pytest.fixture
def admin_headers(db_session):
    admin = db_session.query(User).filter(User.role == "admin").first()
    token = create_access_token(subject=admin.id)
    return {"Authorization": f"Bearer {token}"}

@pytest.fixture
def creator_headers(db_session):
    from app.core.security import get_password_hash
    creator = db_session.query(User).filter(User.email == "creator@agent.studio").first()
    if not creator:
        creator = User(
            email="creator@agent.studio",
            full_name="Creator User",
            hashed_password=get_password_hash("CreatorPass123!"),
            role="creator",
            is_active=True
        )
        db_session.add(creator)
        db_session.commit()
        db_session.refresh(creator)
    token = create_access_token(subject=creator.id)
    return {"Authorization": f"Bearer {token}"}
