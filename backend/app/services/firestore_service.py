import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from app.core.firebase import get_firestore_client

logger = logging.getLogger("agent_studio.firestore")

def utcnow_iso() -> str:
    return datetime.now(timezone.utc).isoformat()

class FirestoreService:
    @staticmethod
    def is_available() -> bool:
        return get_firestore_client() is not None

    # ==========================================
    # USER PROFILES: users/{userId}
    # ==========================================
    @staticmethod
    def sync_user_profile(user_id: str, email: str, name: Optional[str] = None, role: str = "creator") -> Optional[Dict[str, Any]]:
        client = get_firestore_client()
        if not client:
            return None
        try:
            doc_ref = client.collection("users").document(str(user_id))
            doc = doc_ref.get()
            if not doc.exists:
                data = {
                    "userId": str(user_id),
                    "name": name or email.split("@")[0],
                    "email": email,
                    "role": role,
                    "subscriptionPlan": "creator",
                    "createdAt": utcnow_iso(),
                    "updatedAt": utcnow_iso()
                }
                doc_ref.set(data)
                return data
            else:
                existing = doc.to_dict() or {}
                updates = {"updatedAt": utcnow_iso()}
                if name and not existing.get("name"):
                    updates["name"] = name
                doc_ref.update(updates)
                existing.update(updates)
                return existing
        except Exception as e:
            logger.warning("Firestore sync_user_profile error: %s", e)
            return None

    @staticmethod
    def get_user_profile(user_id: str) -> Optional[Dict[str, Any]]:
        client = get_firestore_client()
        if not client:
            return None
        try:
            doc = client.collection("users").document(str(user_id)).get()
            return doc.to_dict() if doc.exists else None
        except Exception as e:
            logger.warning("Firestore get_user_profile error: %s", e)
            return None

    # ==========================================
    # AGENTS: users/{userId}/agents/{agentId}
    # ==========================================
    @staticmethod
    def save_agent(user_id: str, agent_id: str, agent_data: Dict[str, Any]) -> bool:
        client = get_firestore_client()
        if not client:
            return False
        try:
            doc_ref = client.collection("users").document(str(user_id)).collection("agents").document(str(agent_id))
            payload = {
                "agentId": str(agent_id),
                "agentName": agent_data.get("name") or agent_data.get("agentName", "Untitled Agent"),
                "description": agent_data.get("description", ""),
                "systemPrompt": agent_data.get("system_instructions") or agent_data.get("systemPrompt", ""),
                "model": agent_data.get("base_model_name") or agent_data.get("model", "Gemini 2.5 Flash"),
                "tools": agent_data.get("enabled_tools") or agent_data.get("tools", []),
                "configuration": {
                    "capability_rag": agent_data.get("capability_rag", False),
                    "capability_memory": agent_data.get("capability_memory", True),
                    "capability_streaming": agent_data.get("capability_streaming", True),
                    "tools_config": agent_data.get("tools_config", {}),
                    "conversation_starters": agent_data.get("conversation_starters", []),
                    "status": agent_data.get("status", "draft"),
                    "is_public": agent_data.get("is_public", False)
                },
                "updatedAt": utcnow_iso()
            }
            # Set createdAt if document is new
            doc = doc_ref.get()
            if not doc.exists:
                payload["createdAt"] = agent_data.get("created_at") or utcnow_iso()
            doc_ref.set(payload, merge=True)

            # If agent is public, mirror to public_agents collection
            if agent_data.get("is_public") or agent_data.get("status") == "published":
                pub_ref = client.collection("public_agents").document(str(agent_id))
                pub_data = dict(payload)
                pub_data["creatorId"] = str(user_id)
                pub_ref.set(pub_data, merge=True)
            return True
        except Exception as e:
            logger.warning("Firestore save_agent error: %s", e)
            return False

    @staticmethod
    def get_agent(user_id: str, agent_id: str) -> Optional[Dict[str, Any]]:
        client = get_firestore_client()
        if not client:
            return None
        try:
            doc = client.collection("users").document(str(user_id)).collection("agents").document(str(agent_id)).get()
            return doc.to_dict() if doc.exists else None
        except Exception as e:
            logger.warning("Firestore get_agent error: %s", e)
            return None

    @staticmethod
    def list_agents(user_id: str) -> List[Dict[str, Any]]:
        client = get_firestore_client()
        if not client:
            return []
        try:
            coll = client.collection("users").document(str(user_id)).collection("agents")
            docs = coll.order_by("updatedAt", direction=firestore.Query.DESCENDING).stream()
            return [d.to_dict() for d in docs]
        except Exception as e:
            logger.warning("Firestore list_agents error: %s", e)
            return []

    @staticmethod
    def delete_agent(user_id: str, agent_id: str) -> bool:
        client = get_firestore_client()
        if not client:
            return False
        try:
            client.collection("users").document(str(user_id)).collection("agents").document(str(agent_id)).delete()
            # Also remove from public gallery if present
            client.collection("public_agents").document(str(agent_id)).delete()
            return True
        except Exception as e:
            logger.warning("Firestore delete_agent error: %s", e)
            return False

    # ==========================================
    # WORKFLOWS: users/{userId}/workflows/{workflowId}
    # ==========================================
    @staticmethod
    def save_workflow(user_id: str, workflow_id: str, data: Dict[str, Any]) -> bool:
        client = get_firestore_client()
        if not client:
            return False
        try:
            doc_ref = client.collection("users").document(str(user_id)).collection("workflows").document(str(workflow_id))
            payload = {
                "workflowId": str(workflow_id),
                "workflowName": data.get("name") or data.get("workflowName", "Untitled Workflow"),
                "nodes": data.get("nodes", []),
                "connections": data.get("connections", []),
                "configuration": data.get("configuration", {}),
                "updatedAt": utcnow_iso()
            }
            doc = doc_ref.get()
            if not doc.exists:
                payload["createdAt"] = data.get("createdAt") or utcnow_iso()
            doc_ref.set(payload, merge=True)
            return True
        except Exception as e:
            logger.warning("Firestore save_workflow error: %s", e)
            return False

    @staticmethod
    def list_workflows(user_id: str) -> List[Dict[str, Any]]:
        client = get_firestore_client()
        if not client:
            return []
        try:
            coll = client.collection("users").document(str(user_id)).collection("workflows")
            docs = coll.order_by("updatedAt", direction=firestore.Query.DESCENDING).stream()
            return [d.to_dict() for d in docs]
        except Exception as e:
            logger.warning("Firestore list_workflows error: %s", e)
            return []

    # ==========================================
    # EXECUTIONS: users/{userId}/executions/{executionId}
    # ==========================================
    @staticmethod
    def record_execution(
        user_id: str,
        execution_id: str,
        agent_id: Optional[str],
        input_data: Any,
        output_data: Any,
        status: str = "success",
        execution_time_ms: int = 0,
        workflow_id: Optional[str] = None
    ) -> bool:
        client = get_firestore_client()
        if not client:
            return False
        try:
            doc_ref = client.collection("users").document(str(user_id)).collection("executions").document(str(execution_id))
            payload = {
                "executionId": str(execution_id),
                "agentId": str(agent_id) if agent_id else None,
                "workflowId": str(workflow_id) if workflow_id else None,
                "input": input_data,
                "output": output_data,
                "status": status,
                "executionTime": execution_time_ms,
                "createdAt": utcnow_iso()
            }
            doc_ref.set(payload)
            return True
        except Exception as e:
            logger.warning("Firestore record_execution error: %s", e)
            return False

    @staticmethod
    def list_executions(user_id: str, limit: int = 50) -> List[Dict[str, Any]]:
        client = get_firestore_client()
        if not client:
            return []
        try:
            coll = client.collection("users").document(str(user_id)).collection("executions")
            docs = coll.order_by("createdAt", direction=firestore.Query.DESCENDING).limit(limit).stream()
            return [d.to_dict() for d in docs]
        except Exception as e:
            logger.warning("Firestore list_executions error: %s", e)
            return []
