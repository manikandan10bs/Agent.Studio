def test_create_and_manage_agent(client, creator_headers):
    # 1. Fetch available models
    models_res = client.get("/api/models", headers=creator_headers)
    assert models_res.status_code == 200
    models = models_res.json()
    assert len(models) > 0
    model_id = models[0]["id"]

    # 2. Create agent
    create_res = client.post("/api/agents", headers=creator_headers, json={
        "name": "Finance Research Agent",
        "description": "Analyzes quarterly financial statements.",
        "base_model_id": model_id,
        "system_instructions": "You are a senior equity analyst.",
        "conversation_starters": ["Analyze Q3 revenue", "Summarize cash flow trends"],
        "capability_rag": True,
        "capability_memory": True,
        "capability_streaming": True
    })
    assert create_res.status_code == 201
    agent = create_res.json()
    agent_id = agent["id"]
    assert agent["status"] == "draft"
    assert agent["current_version"] == 1

    # 3. Test agent configuration
    test_res = client.post(f"/api/agents/{agent_id}/test", headers=creator_headers)
    assert test_res.status_code == 200
    assert test_res.json()["status"] == "tested"

    # 4. Publish agent
    pub_res = client.post(f"/api/agents/{agent_id}/publish", headers=creator_headers)
    assert pub_res.status_code == 200
    published_agent = pub_res.json()
    assert published_agent["status"] == "published"
    assert published_agent["is_public"] is True

    # 5. Public gallery visibility
    public_res = client.get("/api/public/agents")
    assert public_res.status_code == 200
    public_agents = public_res.json()
    assert any(a["slug"] == published_agent["slug"] for a in public_agents)

def test_ownership_boundary(client, creator_headers, db_session):
    # Creator 1 creates an agent
    create_res = client.post("/api/agents", headers=creator_headers, json={
        "name": "Confidential Agent",
        "description": "Internal project agent"
    })
    agent_id = create_res.json()["id"]

    # Different user attempts to access without admin
    from app.core.security import create_access_token, get_password_hash
    from app.models.user import User

    other_user = User(
        email="other_isolated@agent.studio",
        full_name="Other User",
        hashed_password=get_password_hash("Pass123!"),
        role="creator"
    )
    db_session.add(other_user)
    db_session.commit()
    db_session.refresh(other_user)
    other_token = create_access_token(other_user.id)

    other_headers = {"Authorization": f"Bearer {other_token}"}
    unauthorized_res = client.get(f"/api/agents/{agent_id}", headers=other_headers)
    assert unauthorized_res.status_code == 403
