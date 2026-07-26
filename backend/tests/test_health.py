from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_health_check_endpoint():
    """Test health check API route returns expected structure."""
    # Since we are not running MongoDB and Redis in unit tests,
    # the health check will return "degraded" or connect to mock,
    # but the API endpoint itself should respond with a 200.
    response = client.get("/api/v1/health")
    assert response.status_code == 200
    json_data = response.json()
    assert json_data["success"] is True
    assert "status" in json_data["data"]
    assert "services" in json_data["data"]
