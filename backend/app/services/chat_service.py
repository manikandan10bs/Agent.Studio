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

    # 6. Generate response
    start_time = time.time()
    try:
        response: LLMResponse = await adapter.generate(
            messages=llm_messages,
            system_prompt=system_prompt,
            model=model_identifier,
        )
        latency_ms = response.latency_ms or int((time.time() - start_time) * 1000)

        # 7. Save assistant message
        asst_msg_record = Message(
            conversation_id=conversation.id,
            role="assistant",
            content=response.content,
            citations_json=json.dumps(citations),
            latency_ms=latency_ms,
            token_usage=response.usage.total_tokens
        )
        db.add(asst_msg_record)

        # 8. Log usage
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

    full_response_text = ""
    start_time = time.time()
    try:
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
            content=full_response_text,
            citations_json=json.dumps(citations),
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

        yield f"data: {json.dumps({'done': True, 'message_id': asst_msg_record.id, 'type': 'done'})}\n\n"

    except Exception as e:
        yield f"data: {json.dumps({'error': str(e)})}\n\n"
