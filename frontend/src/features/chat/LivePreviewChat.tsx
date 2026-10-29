import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Agent, Message, Citation } from '../../types';
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
  Bot
} from 'lucide-react';

interface LivePreviewChatProps {
  agent: Agent;
  isExpanded: boolean;
  onToggleExpand: () => void;
}

export const LivePreviewChat: React.FC<LivePreviewChatProps> = ({
  agent,
  isExpanded,
  onToggleExpand,
}) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [conversationId, setConversationId] = useState<number | undefined>(undefined);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [expandedCitations, setExpandedCitations] = useState<Record<number, boolean>>({});

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isGenerating]);

  useEffect(() => {
    const loadDemoChat = async () => {
      if (!agent.id) return;
      try {
        const convs = await api.getConversations(agent.id, true);
        if (convs.length > 0) {
          setConversationId(convs[0].id);
          setMessages(convs[0].messages || []);
        } else {
          setConversationId(undefined);
          setMessages([]);
        }
      } catch {
        // demo reset
      }
    };
    loadDemoChat();
  }, [agent.id]);

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
        }
      } catch (err: any) {
        setErrorBanner(err.message || 'Error communicating with provider.');
        setMessages((prev) => prev.slice(0, -1));
      } finally {
        setIsGenerating(false);
      }
    } else {
      try {
        const response = await api.sendChat(agent.id, text, conversationId, true);
        setConversationId(response.conversation_id);
        setMessages((prev) => [...prev, response.message]);
      } catch (err: any) {
        setErrorBanner(err.message || 'Error communicating with provider.');
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
      <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 bg-slate-50/80">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
            Demo Mode
          </span>
          <span className="text-[11px] text-slate-500">
            • {agent.base_model_name || 'No model chosen'}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          {messages.length > 0 && (
            <button
              onClick={handleResetChat}
              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-200 transition-colors"
              title="Reset Chat"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          )}

          <button
            onClick={onToggleExpand}
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-200 transition-colors"
            title={isExpanded ? 'Collapse' : 'Expand'}
          >
            {isExpanded ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

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
      <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 bg-[#FAFCFF] bg-studio-dots-subtle">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center max-w-sm mx-auto my-auto py-8 select-none">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 shadow-md flex items-center justify-center mb-3">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            <h3 className="text-sm font-bold text-slate-900">{agent.name || 'AGENT.STUDIO'}</h3>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              {agent.description ||
                'Precision-built AI agent with multi-gateway routing and vector RAG grounding.'}
            </p>

            {(agent.conversation_starters || []).length > 0 && (
              <div className="w-full mt-6 space-y-1.5">
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block text-left">
                  Sample Prompts
                </span>
                <div className="flex flex-col gap-1.5">
                  {agent.conversation_starters.map((starter, i) => (
                    <button
                      key={i}
                      onClick={() => handleSendMessage(starter)}
                      className="text-left text-xs p-2.5 rounded-xl bg-white hover:bg-blue-50 border border-slate-200 hover:border-blue-300 text-slate-700 hover:text-blue-900 transition-all shadow-xs"
                    >
                      <span className="text-blue-600 font-bold mr-1.5">›</span>
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
                  <div className="w-7 h-7 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center flex-shrink-0 mt-0.5 shadow-xs">
                    <Bot className="w-3.5 h-3.5 text-white" />
                  </div>
                )}

                <div
                  className={`rounded-2xl px-4 py-2.5 text-xs sm:text-sm leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-[#0F172A] text-white rounded-tr-sm shadow-sm'
                      : 'bg-white border border-slate-200 text-slate-800 rounded-tl-sm shadow-sm'
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

                  {/* Grounded RAG Citations */}
                  {msg.citations && msg.citations.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() => toggleCitation(idx)}
                        className="flex items-center gap-1.5 text-[10px] font-semibold text-blue-600 hover:text-blue-700"
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
                              className="rounded-lg bg-blue-50/70 border border-blue-100 p-2 text-[10px] text-slate-600"
                            >
                              <div className="flex items-center justify-between text-blue-900 font-semibold">
                                <span>
                                  📄 {cit.source} (Page {cit.page})
                                </span>
                                <span className="text-[9px] text-blue-600">
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

      {/* Composer at Bottom */}
      <div className="p-3 border-t border-slate-200 bg-white">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
          className="flex items-end rounded-xl bg-slate-50 border border-slate-200 focus-within:border-blue-500 focus-within:bg-white p-2 transition-all shadow-xs"
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
            placeholder="Ask agent a question... (Enter to send, Shift+Enter for newline)"
            disabled={isGenerating}
            className="flex-1 max-h-28 bg-transparent text-xs sm:text-sm text-slate-900 placeholder-slate-400 focus:outline-none resize-none px-2 py-1 leading-relaxed"
          />

          <button
            type="submit"
            disabled={isGenerating || !inputValue.trim()}
            className="p-2 rounded-lg bg-[#0F172A] hover:bg-[#1E293B] text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-sm flex-shrink-0"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </form>
      </div>
    </div>
  );
};
