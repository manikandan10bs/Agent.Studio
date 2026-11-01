import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Agent, Message, Citation, Conversation } from '../../types';
import { api } from '../../services/api';
import {
  Send,
  Sparkles,
  RotateCcw,
  Copy,
  Check,
  Maximize2,
  Minimize2,
  BookOpen,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Loader2,
  Bot,
  Wrench,
  Download,
  History,
  Plus,
  Trash2,
  Clock,
  Mic,
  X
} from 'lucide-react';

interface LivePreviewChatProps {
  agent: Agent;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
  onClose?: () => void;
}

export const LivePreviewChat: React.FC<LivePreviewChatProps> = ({
  agent,
  isExpanded = false,
  onToggleExpand,
  onClose,
}) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [conversationId, setConversationId] = useState<number | undefined>(undefined);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [expandedCitations, setExpandedCitations] = useState<Record<number, boolean>>({});
  
  // Conversation Memory state
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isGenerating]);

  const loadConversations = async () => {
    if (!agent.id) return;
    try {
      const convs = await api.getConversations(agent.id, true);
      setConversations(convs);
      if (agent.capability_memory && convs.length > 0 && !conversationId) {
        setConversationId(convs[0].id);
        setMessages(convs[0].messages || []);
      } else if (!agent.capability_memory) {
        setConversationId(undefined);
        setMessages([]);
      }
    } catch {
      // demo reset
    }
  };

  useEffect(() => {
    loadConversations();
  }, [agent.id, agent.capability_memory]);

  const handleStartNewChat = () => {
    setConversationId(undefined);
    setMessages([]);
    setShowHistory(false);
    setErrorBanner(null);
  };

  const handleSelectConversation = (conv: Conversation) => {
    setConversationId(conv.id);
    setMessages(conv.messages || []);
    setShowHistory(false);
  };

  const handleDeleteConversation = async (e: React.MouseEvent, cId: number) => {
    e.stopPropagation();
    try {
      await api.deleteConversation(cId);
      const remaining = conversations.filter((c) => c.id !== cId);
      setConversations(remaining);
      if (conversationId === cId) {
        if (remaining.length > 0) {
          setConversationId(remaining[0].id);
          setMessages(remaining[0].messages || []);
        } else {
          setConversationId(undefined);
          setMessages([]);
        }
      }
    } catch (err: any) {
      alert(`Could not delete conversation: ${err.message}`);
    }
  };

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputValue).trim();
    if (!text || isGenerating) return;

    if (!agent.base_model_id) {
      setErrorBanner('Please select a Model Client and Base Model in the Model tab before testing.');
      return;
    }

    setErrorBanner(null);
    setInputValue('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }

    const userMsg: Message = {
      role: 'user',
      content: text,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setIsGenerating(true);

    if (agent.capability_streaming) {
      try {
        const token = localStorage.getItem('agent_studio_token');
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
        };
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const res = await fetch(`/api/agents/${agent.id}/chat?is_demo=true`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            message: text,
            conversation_id: conversationId,
            stream: true,
          }),
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.detail || `Server error: ${res.status}`);
        }

        const reader = res.body?.getReader();
        const decoder = new TextDecoder();
        let assistantContent = '';
        let citations: Citation[] = [];

        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: '',
            created_at: new Date().toISOString(),
          },
        ]);

        if (reader) {
          let buffer = '';
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
              if (line.startsWith('data: ')) {
                const dataStr = line.slice(6).trim();
                if (!dataStr) continue;
                try {
                  const parsed = JSON.parse(dataStr);
                  if (parsed.error) {
                    throw new Error(parsed.error);
                  }
                  if (parsed.conversation_id) {
                    setConversationId(parsed.conversation_id);
                  }
                  if (parsed.citations) {
                    citations = parsed.citations;
                  }
                  if (parsed.delta) {
                    assistantContent += parsed.delta;
                    setMessages((prev) => {
                      const updated = [...prev];
                      const lastIdx = updated.length - 1;
                      if (lastIdx >= 0 && updated[lastIdx].role === 'assistant') {
                        updated[lastIdx] = {
                          ...updated[lastIdx],
                          content: assistantContent,
                          citations: citations,
                        };
                      }
                      return updated;
                    });
                  }
                } catch (e: any) {
                  if (e.message && !e.message.includes('Unexpected token')) {
                    throw e;
                  }
                }
              }
            }
          }
          loadConversations();
        }
      } catch (err: any) {
        let errMsg = err.message || 'Error communicating with provider.';
        if (errMsg.includes('11001') || errMsg.includes('getaddrinfo')) {
          errMsg = 'AI inference connection timed out. Please check your network connection or model configuration in Admin panel.';
        }
        setErrorBanner(errMsg);
        setMessages((prev) => prev.slice(0, -1));
      } finally {
        setIsGenerating(false);
      }
    } else {
      try {
        const response = await api.sendChat(agent.id, text, conversationId, true);
        setConversationId(response.conversation_id);
        setMessages((prev) => [...prev, response.message]);
        loadConversations();
      } catch (err: any) {
        let errMsg = err.message || 'Error communicating with provider.';
        if (errMsg.includes('11001') || errMsg.includes('getaddrinfo')) {
          errMsg = 'AI inference connection timed out. Please check your network connection or model configuration in Admin panel.';
        }
        setErrorBanner(errMsg);
      } finally {
        setIsGenerating(false);
      }
    }
  };

  const handleCopy = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const handleResetChat = async () => {
    if (conversationId) {
      try {
        await api.deleteConversation(conversationId);
      } catch {
        // ignore
      }
    }
    setConversationId(undefined);
    setMessages([]);
    setErrorBanner(null);
    loadConversations();
  };

  const toggleCitation = (idx: number) => {
    setExpandedCitations((prev) => ({
      ...prev,
      [idx]: !prev[idx],
    }));
  };

  return (
    <div className="flex flex-col h-full rounded-2xl bg-white border border-slate-200 shadow-sm overflow-hidden relative">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200/90 bg-white/95 backdrop-blur-xs flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-slate-900 tracking-tight">
            Quick Playground
          </span>
          {agent.capability_memory ? (
            <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold border bg-emerald-50 text-emerald-700 border-emerald-200">
              Memory On
            </span>
          ) : (
            <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold border bg-slate-100 text-slate-500 border-slate-200">
              Memory Off
            </span>
          )}
          <span className="text-[11px] text-slate-400 hidden sm:inline">
            • {agent.base_model_name || 'Autonomous Agent'}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          {/* History Button - Always accessible when Conversation Memory is on */}
          {agent.capability_memory && (
            <button
              type="button"
              onClick={() => setShowHistory(!showHistory)}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all shadow-2xs ${
                showHistory
                  ? 'bg-indigo-600 text-white'
                  : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
              }`}
              title="View Conversation Memory & Chat History"
            >
              <History className="w-3.5 h-3.5" />
              <span>History ({conversations.length})</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleStartNewChat}
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
            title="Start New Conversation"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={handleResetChat}
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
            title="Reset Chat"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>

          {onToggleExpand && (
            <button
              type="button"
              onClick={onToggleExpand}
              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
              title={isExpanded ? 'Collapse' : 'Expand'}
            >
              {isExpanded ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
            </button>
          )}

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
              title="Close Quick Playground"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Slide-down Conversation History Panel */}
      {showHistory && (
        <div className="border-b border-slate-200 bg-white p-3.5 shadow-sm space-y-2 animate-in slide-in-from-top-2 max-h-56 overflow-y-auto">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <History className="w-3.5 h-3.5 text-blue-600" />
              Conversation Memory ({conversations.length})
            </span>
            <button
              type="button"
              onClick={handleStartNewChat}
              className="text-xs text-blue-600 hover:text-blue-700 font-semibold flex items-center gap-1"
            >
              <Plus className="w-3 h-3" />
              <span>New Thread</span>
            </button>
          </div>

          {conversations.length === 0 ? (
            <p className="text-xs text-slate-400 py-3 text-center">
              No previous conversation memory recorded for this agent yet.
            </p>
          ) : (
            <div className="space-y-1.5">
              {conversations.map((conv) => {
                const isCurrent = conv.id === conversationId;
                const firstMsg = conv.messages && conv.messages[0]?.content;
                return (
                  <div
                    key={conv.id}
                    onClick={() => handleSelectConversation(conv)}
                    className={`flex items-center justify-between p-2 rounded-xl text-xs cursor-pointer transition-all ${
                      isCurrent
                        ? 'bg-blue-50 border border-blue-200 font-semibold text-blue-900 shadow-2xs'
                        : 'hover:bg-slate-50 border border-transparent text-slate-700'
                    }`}
                  >
                    <div className="min-w-0 flex-1 pr-2">
                      <p className="truncate font-medium">
                        {firstMsg ? firstMsg.slice(0, 45) + '...' : `Conversation #${conv.id}`}
                      </p>
                      <span className="text-[10px] text-slate-400">
                        {new Date(conv.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {conv.messages?.length || 0} msgs
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => handleDeleteConversation(e, conv.id)}
                      className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                      title="Delete thread"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Error Notice Banner */}
      {errorBanner && (
        <div className="mx-4 mt-3 p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-2 shadow-sm animate-in fade-in">
          <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1 font-medium">{errorBanner}</div>
          <button onClick={() => setErrorBanner(null)} className="text-amber-600 hover:text-amber-800">
            ✕
          </button>
        </div>
      )}

      {/* Chat Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 bg-white">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center max-w-md mx-auto my-auto py-8 px-4 select-none animate-in fade-in">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-indigo-500 to-violet-500 text-white flex items-center justify-center mb-4 shadow-md shadow-indigo-500/20">
              <Sparkles className="w-5 h-5 fill-white" />
            </div>
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">
              Agent.Studio Playground
            </h2>
            <p className="text-xs text-slate-500 mt-2 leading-relaxed max-w-sm">
              Interact directly with {agent.name || 'this agent'}. Verify instructions, function calling, and RAG document grounding in real-time.
            </p>

            {(agent.conversation_starters || []).length > 0 && (
              <div className="w-full mt-6 space-y-1.5 max-w-xs">
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block text-left">
                  Sample Prompts
                </span>
                <div className="flex flex-col gap-1.5">
                  {agent.conversation_starters.map((starter, i) => (
                    <button
                      key={i}
                      onClick={() => handleSendMessage(starter)}
                      className="text-left text-xs p-2.5 rounded-xl bg-slate-50 hover:bg-indigo-50/60 border border-slate-200 hover:border-indigo-300 text-slate-700 hover:text-indigo-900 transition-all shadow-2xs"
                    >
                      <span className="text-indigo-600 font-bold mr-1.5">›</span>
                      {starter}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          messages.map((msg, idx) => (
            <div
              key={idx}
              className={`flex flex-col ${
                msg.role === 'user' ? 'items-end' : 'items-start'
              } space-y-1`}
            >
              <div className="flex items-start gap-2.5 max-w-[88%] sm:max-w-[82%]">
                {msg.role === 'assistant' && (
                  <div className="w-7 h-7 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-violet-600 flex items-center justify-center flex-shrink-0 mt-0.5 shadow-xs">
                    <Bot className="w-3.5 h-3.5 text-white" />
                  </div>
                )}

                <div
                  className={`rounded-2xl px-4 py-2.5 text-xs sm:text-sm leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-gradient-to-r from-slate-900 to-indigo-950 text-white rounded-tr-sm shadow-sm'
                      : 'bg-white border border-slate-200/90 text-slate-800 rounded-tl-sm shadow-sm'
                  }`}
                >
                  {msg.role === 'assistant' ? (
                    <div className="prose prose-xs max-w-none break-words text-slate-800">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {msg.content || '...'}
                      </ReactMarkdown>
                    </div>
                  ) : (
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                  )}

                  {/* Executed Tools Badges */}
                  {msg.tools && msg.tools.length > 0 && (
                    <div className="mt-2.5 pt-2 border-t border-slate-100 space-y-1.5">
                      <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                        <Wrench className="w-3 h-3 text-indigo-500" />
                        <span>Executed Tools ({msg.tools.length})</span>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {msg.tools.map((t, tIdx) => (
                          <div
                            key={tIdx}
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-mono border ${
                              t.success
                                ? 'bg-emerald-50/70 border-emerald-200 text-emerald-800'
                                : 'bg-rose-50/70 border-rose-200 text-rose-800'
                            }`}
                          >
                            <span className="font-semibold">{t.tool_name || t.tool_id}</span>
                            <span className="text-[9px] text-slate-400">({t.execution_time_ms}ms)</span>
                            {t.download_url && (
                              <a
                                href={t.download_url}
                                target="_blank"
                                rel="noreferrer"
                                className="ml-1 text-indigo-600 hover:text-indigo-800 font-bold underline inline-flex items-center gap-0.5"
                              >
                                <Download className="w-2.5 h-2.5" />
                                <span>Output</span>
                              </a>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Grounded RAG Citations */}
                  {msg.citations && msg.citations.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() => toggleCitation(idx)}
                        className="flex items-center gap-1.5 text-[10px] font-semibold text-indigo-600 hover:text-indigo-700"
                      >
                        <BookOpen className="w-3 h-3" />
                        <span>{msg.citations.length} Grounded Sources</span>
                        {expandedCitations[idx] ? (
                          <ChevronUp className="w-3 h-3" />
                        ) : (
                          <ChevronDown className="w-3 h-3" />
                        )}
                      </button>

                      {expandedCitations[idx] && (
                        <div className="mt-2 space-y-1">
                          {msg.citations.map((cit, cIdx) => (
                            <div
                              key={cIdx}
                              className="rounded-lg bg-indigo-50/50 border border-indigo-100 p-2 text-[10px] text-slate-600"
                            >
                              <div className="flex items-center justify-between text-indigo-950 font-semibold">
                                <span>
                                  📄 {cit.source} (Page {cit.page})
                                </span>
                                <span className="text-[9px] text-indigo-600">
                                  Score: {cit.score}
                                </span>
                              </div>
                              <p className="italic text-slate-600 mt-0.5">{cit.snippet}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {msg.role === 'assistant' && (
                <div className="flex items-center gap-2 pl-9 text-[10px] text-slate-400">
                  <button
                    onClick={() => handleCopy(msg.content, idx)}
                    className="hover:text-slate-700 flex items-center gap-1"
                  >
                    {copiedIndex === idx ? (
                      <Check className="w-3 h-3 text-emerald-600" />
                    ) : (
                      <Copy className="w-3 h-3" />
                    )}
                    <span>{copiedIndex === idx ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
              )}
            </div>
          ))
        )}

        {isGenerating && (
          <div className="flex items-center gap-2 pl-2 text-xs text-blue-600 animate-pulse font-medium">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            <span>Generating precision response...</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Composer Console */}
      <div className="p-3 border-t border-slate-100 bg-white">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
          className="rounded-2xl bg-white border border-slate-200/90 shadow-sm focus-within:border-indigo-400 focus-within:ring-2 focus-within:ring-indigo-500/10 p-2.5 transition-all flex flex-col justify-between"
        >
          <textarea
            ref={textareaRef}
            rows={1}
            value={inputValue}
            onChange={(e) => {
              setInputValue(e.target.value);
              e.target.style.height = 'auto';
              e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage();
              }
            }}
            placeholder={`Message ${agent.name || 'Agent'}...`}
            disabled={isGenerating}
            className="w-full bg-transparent text-xs sm:text-sm text-slate-900 placeholder-slate-400 focus:outline-none resize-none px-1.5 py-1 leading-relaxed min-h-[36px]"
          />

          <div className="flex items-center justify-between pt-1 mt-1 border-t border-slate-100/60">
            {/* Left controls: Plus button + Agent pill */}
            <div className="flex items-center gap-2">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-slate-700 transition-colors">
                <Bot className="w-3.5 h-3.5 text-indigo-600" />
                <span className="truncate max-w-[120px]">{agent.name || 'Agent'}</span>
              </div>
            </div>

            {/* Right controls: Mic + Send */}
            <div className="flex items-center gap-2">
              <button
                type="submit"
                disabled={isGenerating || !inputValue.trim()}
                className="p-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-sm flex items-center justify-center flex-shrink-0"
                title="Send message"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
