import pytest
from unittest.mock import AsyncMock, patch


@pytest.mark.asyncio
async def test_health_endpoint(client):
    """Test that /api/health returns 200."""
    with patch("app.routers.health.get_db") as mock_get_db:
        mock_session = AsyncMock()
        mock_session.execute = AsyncMock()
        mock_get_db.return_value = mock_session

        response = await client.get("/api/health")
        assert response.status_code == 200
        data = response.json()
        assert "status" in data
