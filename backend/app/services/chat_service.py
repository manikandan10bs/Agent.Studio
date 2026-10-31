import json
import time
from typing import List, Optional, AsyncGenerator, Dict, Any
from sqlalchemy.orm import Session
from app.models.agent import Agent
from app.models.chat import Conversation, Message
from app.models.usage import UsageEvent
from app.services.llm.base import LLMMessage, LLMResponse
from app.services.llm.factory import get_adapter_for_model
from app.services.rag.retriever import retrieve_agent_chunks
from app.services.rag.rag_service import augment_prompt_with_rag
from app.services.firestore_service import FirestoreService

async def handle_agent_chat(
    agent_id: int,
    user_message: str,
    conversation_id: Optional[int] = None,
    user_id: Optional[int] = None,
    is_demo: bool = False,
    db: Session = None,
    stream: bool = False,
) -> tuple[Conversation, Message, List[Dict[str, Any]]]:
    """
    Executes an agent chat turn (non-streaming).
    Retrieves knowledge context, formats conversation history, calls LLM, saves message.
    """
    agent = db.query(Agent).filter(Agent.id == agent_id).first()
    if not agent:
        raise ValueError(f"Agent with ID {agent_id} not found.")

    if not agent.base_model:
        raise ValueError(f"Agent '{agent.name}' does not have a configured base model.")

    # 1. Retrieve or create conversation
    if conversation_id:
        conversation = db.query(Conversation).filter(
            Conversation.id == conversation_id,
            Conversation.agent_id == agent.id
        ).first()
        if not conversation:
            raise ValueError(f"Conversation {conversation_id} not found.")
    else:
        conversation = Conversation(
            agent_id=agent.id,
            user_id=user_id,
            is_demo=is_demo,
            title=user_message[:50] + ("..." if len(user_message) > 50 else "")
        )
        db.add(conversation)
        db.commit()
        db.refresh(conversation)

    # 2. Save user message
    user_msg_record = Message(
        conversation_id=conversation.id,
        role="user",
        content=user_message
    )
    db.add(user_msg_record)
    db.commit()

    # 3. Assemble Agent Identity and System Prompt
    identity_parts = [f"You are {agent.name}."]
    if agent.description and agent.description.strip():
        identity_parts.append(agent.description.strip())
    identity_parts.append(agent.system_instructions or "Answer helpfully, politely, and accurately.")
    system_prompt = "\n\n".join(identity_parts)

    # 4. RAG Retrieval if enabled
    retrieved_chunks = []
    citations = []
    if agent.capability_rag:
        retrieved_chunks = retrieve_agent_chunks(agent.id, user_message, top_k=4, db=db)
        system_prompt, citations = augment_prompt_with_rag(system_prompt, retrieved_chunks)

    # 5. Assemble conversation messages
    llm_messages: List[LLMMessage] = []
    if agent.capability_memory:
        # Load up to last 10 messages from conversation
        history = db.query(Message).filter(
            Message.conversation_id == conversation.id,
            Message.id != user_msg_record.id
        ).order_by(Message.created_at.desc()).limit(10).all()
        history.reverse()
        for h in history:
            llm_messages.append(LLMMessage(role=h.role, content=h.content))
    
    llm_messages.append(LLMMessage(role="user", content=user_message))

    # 5. Get LLM adapter
    adapter, model_identifier = get_adapter_for_model(agent.base_model.model_identifier, db)

    # 6. Resolve Agent's Enabled Tools with Admin Permissions Check
    agent_tools = []
    if getattr(agent, "enabled_tools", None):
        try:
            agent_tools = json.loads(agent.enabled_tools)
        except Exception:
            agent_tools = []

    from app.models.tool import SystemTool, ToolExecutionLog
    from app.services.tools import registry
    from app.services.llm.gemini_adapter import GeminiAdapter

    admin_enabled = set(
        st.id for st in db.query(SystemTool.id).filter(
            SystemTool.id.in_(agent_tools),
            SystemTool.is_enabled == True
        ).all()
    )
    active_tool_ids = [t for t in agent_tools if t in admin_enabled]
    tool_declarations = registry.to_gemini_declarations(active_tool_ids) if active_tool_ids else []

    # 7. Generate response (with multi-step tool execution support for Gemini)
    start_time = time.time()
    executed_tools = []

    try:
        if isinstance(adapter, GeminiAdapter) and tool_declarations:
            # Build initial contents
            raw_contents = []
            for m in llm_messages:
                raw_contents.append({
                    "role": "user" if m.role in ("user", "system") else "model",
                    "parts": [{"text": m.content}]
                })

            response = None
            # Multi-turn tool execution loop (max 3 calls)
            for _ in range(3):
                response = await adapter.generate(
                    messages=llm_messages,
                    system_prompt=system_prompt,
                    model=model_identifier,
                    tools=tool_declarations,
                    raw_contents=raw_contents
                )

                if not response.tool_calls:
                    break

                for call in response.tool_calls:
                    call_name = call.get("name")
                    call_args = call.get("args") or {}

                    if call_name not in active_tool_ids:
                        tool_res_content = {"error": f"Tool '{call_name}' is not enabled for this agent."}
                        tool_success = False
                        tool_preview = None
                        tool_dl = None
                    else:
                        exec_context = {
                            "db": db,
                            "agent_id": agent.id,
                            "user_id": user_id,
                            "conversation_id": conversation.id
                        }
                        tool_exec = await registry.execute_tool(call_name, call_args, context=exec_context)
                        tool_success = tool_exec.success
                        tool_res_content = tool_exec.data if tool_success else {"error": tool_exec.error}
                        tool_preview = tool_exec.output_preview
                        tool_dl = tool_exec.download_url

                        # Log tool execution to database
                        tool_log = ToolExecutionLog(
                            tool_id=call_name,
                            agent_id=agent.id,
                            user_id=user_id,
                            conversation_id=conversation.id,
                            input_params_json=json.dumps(call_args, default=str)[:1000],
                            output_summary_json=json.dumps(tool_res_content, default=str)[:1000] if tool_success else None,
                            execution_time_ms=tool_exec.execution_time_ms,
                            status="success" if tool_success else "failed",
                            error_message=tool_exec.error
                        )
                        db.add(tool_log)
                        db.commit()

                    tool_obj = registry.get(call_name)
                    executed_tools.append({
                        "tool_id": call_name,
                        "tool_name": tool_obj.name if tool_obj else call_name,
                        "args": call_args,
                        "success": tool_success,
                        "output_preview": tool_preview,
                        "download_url": tool_dl
                    })

                    # Append function call and function response to conversation
                    raw_contents.append({
                        "role": "model",
                        "parts": [{"functionCall": {"name": call_name, "args": call_args}}]
                    })
                    raw_contents.append({
                        "role": "user",
                        "parts": [{
                            "functionResponse": {
                                "name": call_name,
                                "response": {"name": call_name, "content": tool_res_content}
                            }
                        }]
                    })
        else:
            response = await adapter.generate(
                messages=llm_messages,
                system_prompt=system_prompt,
                model=model_identifier,
            )

        latency_ms = response.latency_ms or int((time.time() - start_time) * 1000)

        # 8. Save assistant message with citations and executed tools
        asst_msg_record = Message(
            conversation_id=conversation.id,
            role="assistant",
            content=response.content or "Tool operation executed successfully.",
            citations_json=json.dumps(citations),
            tools_json=json.dumps(executed_tools),
            latency_ms=latency_ms,
            token_usage=response.usage.total_tokens
        )
        db.add(asst_msg_record)

        # 9. Log usage
        usage_event = UsageEvent(
            user_id=user_id,
            agent_id=agent.id,
            provider_name=agent.base_model.provider.name,
            model_identifier=model_identifier,
            prompt_tokens=response.usage.prompt_tokens,
            completion_tokens=response.usage.completion_tokens,
            total_tokens=response.usage.total_tokens,
            latency_ms=latency_ms,
            is_error=False
        )
        db.add(usage_event)
        db.commit()
        db.refresh(asst_msg_record)

        try:
            FirestoreService.record_execution(
                user_id=str(user_id or "anonymous"),
                execution_id=str(asst_msg_record.id),
                agent_id=str(agent.id),
                input_data=user_message,
                output_data=asst_msg_record.content,
                status="success",
                execution_time_ms=latency_ms
            )
        except Exception:
            pass

        return conversation, asst_msg_record, citations

    except Exception as e:
        db.rollback()
        # Log error usage event
        error_event = UsageEvent(
            user_id=user_id,
            agent_id=agent.id,
            provider_name=agent.base_model.provider.name if agent.base_model and agent.base_model.provider else "unknown",
            model_identifier=agent.base_model.model_identifier if agent.base_model else "unknown",
            latency_ms=int((time.time() - start_time) * 1000),
            is_error=True,
            error_type=str(e)[:100]
        )
        db.add(error_event)
        db.commit()
        raise e

async def stream_agent_chat_generator(
    agent_id: int,
    user_message: str,
    conversation_id: Optional[int] = None,
    user_id: Optional[int] = None,
    is_demo: bool = False,
    db: Session = None,
) -> AsyncGenerator[str, None]:
    """
    Streams an agent chat turn with Server-Sent Events (SSE).
    """
    agent = db.query(Agent).filter(Agent.id == agent_id).first()
    if not agent:
        yield f"data: {json.dumps({'error': f'Agent {agent_id} not found'})}\n\n"
        return

    if not agent.base_model:
        yield f"data: {json.dumps({'error': 'Agent has no configured base model'})}\n\n"
        return

    # Conversation management
    if conversation_id:
        conversation = db.query(Conversation).filter(
            Conversation.id == conversation_id,
            Conversation.agent_id == agent.id
        ).first()
        if not conversation:
            yield f"data: {json.dumps({'error': 'Conversation not found'})}\n\n"
            return
    else:
        conversation = Conversation(
            agent_id=agent.id,
            user_id=user_id,
            is_demo=is_demo,
            title=user_message[:50] + ("..." if len(user_message) > 50 else "")
        )
        db.add(conversation)
        db.commit()
        db.refresh(conversation)

    # Save user message
    user_msg_record = Message(
        conversation_id=conversation.id,
        role="user",
        content=user_message
    )
    db.add(user_msg_record)
    db.commit()

    # Send conversation metadata
    yield f"data: {json.dumps({'conversation_id': conversation.id, 'type': 'meta'})}\n\n"

    # Assemble Agent Identity and System Prompt
    identity_parts = [f"You are {agent.name}."]
    if agent.description and agent.description.strip():
        identity_parts.append(agent.description.strip())
    identity_parts.append(agent.system_instructions or "Answer helpfully, politely, and accurately.")
    system_prompt = "\n\n".join(identity_parts)

    # RAG Retrieval
    retrieved_chunks = []
    citations = []
    if agent.capability_rag:
        retrieved_chunks = retrieve_agent_chunks(agent.id, user_message, top_k=4, db=db)
        system_prompt, citations = augment_prompt_with_rag(system_prompt, retrieved_chunks)

    if citations:
        yield f"data: {json.dumps({'citations': citations, 'type': 'citations'})}\n\n"

    # Assemble messages
    llm_messages: List[LLMMessage] = []
    if agent.capability_memory:
        history = db.query(Message).filter(
            Message.conversation_id == conversation.id,
            Message.id != user_msg_record.id
        ).order_by(Message.created_at.desc()).limit(10).all()
        history.reverse()
        for h in history:
            llm_messages.append(LLMMessage(role=h.role, content=h.content))
    llm_messages.append(LLMMessage(role="user", content=user_message))

    try:
        adapter, model_identifier = get_adapter_for_model(agent.base_model.model_identifier, db)
    except Exception as e:
        yield f"data: {json.dumps({'error': str(e)})}\n\n"
        return

    # Tools resolution
    agent_tools = []
    if getattr(agent, "enabled_tools", None):
        try:
            agent_tools = json.loads(agent.enabled_tools)
        except Exception:
            agent_tools = []

    from app.models.tool import SystemTool, ToolExecutionLog
    from app.services.tools import registry
    from app.services.llm.gemini_adapter import GeminiAdapter

    admin_enabled = set(
        st.id for st in db.query(SystemTool.id).filter(
            SystemTool.id.in_(agent_tools),
            SystemTool.is_enabled == True
        ).all()
    )
    active_tool_ids = [t for t in agent_tools if t in admin_enabled]
    tool_declarations = registry.to_gemini_declarations(active_tool_ids) if active_tool_ids else []

    full_response_text = ""
    executed_tools = []
    start_time = time.time()

    try:
        if isinstance(adapter, GeminiAdapter) and tool_declarations:
            # Multi-turn tool execution
            raw_contents = []
            for m in llm_messages:
                raw_contents.append({
                    "role": "user" if m.role in ("user", "system") else "model",
                    "parts": [{"text": m.content}]
                })

            response = None
            for _ in range(3):
                response = await adapter.generate(
                    messages=llm_messages,
                    system_prompt=system_prompt,
                    model=model_identifier,
                    tools=tool_declarations,
                    raw_contents=raw_contents
                )

                if not response.tool_calls:
                    break

                for call in response.tool_calls:
                    call_name = call.get("name")
                    call_args = call.get("args") or {}

                    if call_name not in active_tool_ids:
                        tool_res_content = {"error": f"Tool '{call_name}' is not enabled for this agent."}
                        tool_success = False
                        tool_preview = None
                        tool_dl = None
                    else:
                        exec_context = {
                            "db": db,
                            "agent_id": agent.id,
                            "user_id": user_id,
                            "conversation_id": conversation.id
                        }
                        tool_exec = await registry.execute_tool(call_name, call_args, context=exec_context)
                        tool_success = tool_exec.success
                        tool_res_content = tool_exec.data if tool_success else {"error": tool_exec.error}
                        tool_preview = tool_exec.output_preview
                        tool_dl = tool_exec.download_url

                        # Log tool execution to database
                        tool_log = ToolExecutionLog(
                            tool_id=call_name,
                            agent_id=agent.id,
                            user_id=user_id,
                            conversation_id=conversation.id,
                            input_params_json=json.dumps(call_args, default=str)[:1000],
                            output_summary_json=json.dumps(tool_res_content, default=str)[:1000] if tool_success else None,
                            execution_time_ms=tool_exec.execution_time_ms,
                            status="success" if tool_success else "failed",
                            error_message=tool_exec.error
                        )
                        db.add(tool_log)
                        db.commit()

                    tool_obj = registry.get(call_name)
                    executed_tools.append({
                        "tool_id": call_name,
                        "tool_name": tool_obj.name if tool_obj else call_name,
                        "args": call_args,
                        "success": tool_success,
                        "output_preview": tool_preview,
                        "download_url": tool_dl
                    })

                    raw_contents.append({
                        "role": "model",
                        "parts": [{"functionCall": {"name": call_name, "args": call_args}}]
                    })
                    raw_contents.append({
                        "role": "user",
                        "parts": [{
                            "functionResponse": {
                                "name": call_name,
                                "response": {"name": call_name, "content": tool_res_content}
                            }
                        }]
                    })

            if executed_tools:
                yield f"data: {json.dumps({'tools': executed_tools, 'type': 'tools'})}\n\n"

            full_response_text = response.content if response else ""
            if full_response_text:
                yield f"data: {json.dumps({'delta': full_response_text, 'type': 'delta'})}\n\n"
        else:
            async for chunk in adapter.generate_stream(
                messages=llm_messages,
                system_prompt=system_prompt,
                model=model_identifier
            ):
                if chunk.error:
                    yield f"data: {json.dumps({'error': chunk.error})}\n\n"
                    return
                if chunk.delta:
                    full_response_text += chunk.delta
                    yield f"data: {json.dumps({'delta': chunk.delta, 'type': 'delta'})}\n\n"
                if chunk.is_done:
                    break

        latency_ms = int((time.time() - start_time) * 1000)

        # Persist full assistant response
        asst_msg_record = Message(
            conversation_id=conversation.id,
            role="assistant",
            content=full_response_text or "Operation completed.",
            citations_json=json.dumps(citations),
            tools_json=json.dumps(executed_tools),
            latency_ms=latency_ms
        )
        db.add(asst_msg_record)

        usage_event = UsageEvent(
            user_id=user_id,
            agent_id=agent.id,
            provider_name=agent.base_model.provider.name,
            model_identifier=model_identifier,
            total_tokens=len(full_response_text.split()),  # approximate when streaming
            latency_ms=latency_ms,
            is_error=False
        )
        db.add(usage_event)
        db.commit()

        try:
            FirestoreService.record_execution(
                user_id=str(user_id or "anonymous"),
                execution_id=str(asst_msg_record.id),
                agent_id=str(agent.id),
                input_data=user_message,
                output_data=full_response_text,
                status="success",
                execution_time_ms=latency_ms
            )
        except Exception:
            pass

        yield f"data: {json.dumps({'done': True, 'message_id': asst_msg_record.id, 'type': 'done'})}\n\n"

    except Exception as e:
        yield f"data: {json.dumps({'error': str(e)})}\n\n"
