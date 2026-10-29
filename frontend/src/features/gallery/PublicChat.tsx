import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Logo } from '../../components/common/Logo';
import { api } from '../../services/api';
import { PublicAgent, Message, Citation } from '../../types';
import {
  Send,
  Sparkles,
  Bot,
  BookOpen,
  ChevronDown,
  ChevronUp,
  ArrowLeft,
  Loader2,
  Copy,
  Check
} from 'lucide-react';

export const PublicChat: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();

  const [agent, setAgent] = useState<PublicAgent | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [conversationId, setConversationId] = useState<number | undefined>(undefined);
  const [loadingAgent, setLoadingAgent] = useState(true);
  const [expandedCitations, setExpandedCitations] = useState<Record<number, boolean>>({});
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!slug) return;
    const fetchAgent = async () => {
      try {
        const ag = await api.getPublicAgent(slug);
        setAgent(ag);
      } catch (err) {
        console.error('Failed to load agent:', err);
      } finally {
        setLoadingAgent(false);
      }
    };
    fetchAgent();
  }, [slug]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isGenerating]);

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputValue).trim();
    if (!text || isGenerating || !slug) return;

    setInputValue('');
    const userMsg: Message = {
      role: 'user',
      content: text,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setIsGenerating(true);

    try {
      const response = await api.sendPublicChat(slug, text, conversationId);
      setConversationId(response.conversation_id);
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: response.message.content,
          citations: response.citations,
          created_at: new Date().toISOString(),
        },
      ]);
    } catch (err: any) {
      alert(`Chat error: ${err.message}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopy = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  if (loadingAgent) {
    return (
      <div className="min-h-screen bg-[#F4F7FB] text-slate-800 flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-blue-600 mr-2" />
        <span className="text-sm font-semibold">Connecting to agent...</span>
      </div>
    );
  }

  if (!agent) {
    return (
      <div className="min-h-screen bg-[#F4F7FB] text-slate-800 flex flex-col items-center justify-center p-6 text-center">
        <h2 className="text-xl font-bold text-slate-900 mb-2">Agent Not Found</h2>
        <p className="text-xs sm:text-sm text-slate-500 mb-4">
          This agent may be private or unpublished by its creator.
        </p>
        <button
          onClick={() => navigate('/explore')}
          className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 shadow-sm"
        >
          Back to Public Gallery
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen w-screen bg-[#F4F7FB] bg-studio-dots text-slate-800">
      {/* Top Header */}
      <header className="border-b border-slate-200 bg-white/95 backdrop-blur-md px-6 py-3 flex items-center justify-between flex-shrink-0 z-20 shadow-xs">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/explore')}
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
            title="Back to Gallery"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shadow-xs">
              <Bot className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                {agent.name}
                <span className="text-[10px] px-2 py-0.2 rounded-full font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                  Verified Agent
                </span>
              </h2>
              <p className="text-[11px] text-slate-500 font-mono">
                {agent.model_name || 'Multi-Gateway LLM'}
              </p>
            </div>
          </div>
        </div>

        <Logo size="sm" />
      </header>

      {/* Main Chat Container */}
      <div className="flex-1 max-w-4xl w-full mx-auto flex flex-col p-4 sm:p-6 overflow-hidden">
        <div className="flex-1 overflow-y-auto space-y-4 pr-1">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center max-w-md mx-auto my-auto py-12 select-none">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 shadow-md flex items-center justify-center mb-4">
                <Sparkles className="w-7 h-7 text-white" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 tracking-tight">{agent.name}</h3>
              <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                {agent.description ||
                  'Hello! I am a verified AI agent built with AGENT.STUDIO. How can I assist you today?'}
              </p>

              {agent.conversation_starters.length > 0 && (
                <div className="w-full mt-8 space-y-2">
                  <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block text-left">
                    Conversation Starters
                  </span>
                  <div className="flex flex-col gap-2">
                    {agent.conversation_starters.map((starter, i) => (
                      <button
                        key={i}
                        onClick={() => handleSendMessage(starter)}
                        className="text-left text-xs p-3 rounded-xl bg-white hover:bg-blue-50 border border-slate-200 hover:border-blue-300 text-slate-700 hover:text-blue-900 transition-all shadow-xs"
                      >
                        <span className="text-blue-600 font-bold mr-2">›</span>
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
                <div className="flex items-start gap-2.5 max-w-[85%]">
                  {msg.role === 'assistant' && (
                    <div className="w-7 h-7 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center flex-shrink-0 mt-0.5 shadow-xs">
                      <Sparkles className="w-3.5 h-3.5 text-white" />
                    </div>
                  )}

                  <div
                    className={`rounded-2xl px-4 py-3 text-xs sm:text-sm leading-relaxed ${
                      msg.role === 'user'
                        ? 'bg-[#0F172A] text-white rounded-tr-sm shadow-sm'
                        : 'bg-white border border-slate-200 text-slate-800 rounded-tl-sm shadow-sm'
                    }`}
                  >
                    {msg.role === 'assistant' ? (
                      <div className="prose prose-xs max-w-none break-words text-slate-800">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {msg.content}
                        </ReactMarkdown>
                      </div>
                    ) : (
                      <p className="whitespace-pre-wrap">{msg.content}</p>
                    )}

                    {/* Citations */}
                    {msg.citations && msg.citations.length > 0 && (
                      <div className="mt-2.5 pt-2 border-t border-slate-100">
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedCitations((prev) => ({
                              ...prev,
                              [idx]: !prev[idx],
                            }))
                          }
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
                            {msg.citations.map((c, ci) => (
                              <div
                                key={ci}
                                className="rounded-lg bg-blue-50/70 border border-blue-100 p-2 text-[10px] text-slate-600"
                              >
                                <span className="text-blue-950 font-semibold block">
                                  📄 {c.source} (Page {c.page})
                                </span>
                                <p className="italic text-slate-600 mt-0.5">{c.snippet}</p>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {msg.role === 'assistant' && (
                  <div className="pl-9 flex items-center gap-2 text-[10px] text-slate-400">
                    <button
                      onClick={() => handleCopy(msg.content, idx)}
                      className="hover:text-slate-700 transition-colors flex items-center gap-1"
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
              <span>Generating response...</span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Bar */}
        <div className="mt-3 pt-3 border-t border-slate-200">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="flex items-center gap-2 rounded-2xl bg-white border border-slate-200 p-2 focus-within:border-blue-500 shadow-sm transition-colors"
          >
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Ask a question or enter prompt..."
              disabled={isGenerating}
              className="flex-1 bg-transparent px-3 py-1.5 text-xs sm:text-sm text-slate-900 placeholder-slate-400 focus:outline-none"
            />
            <button
              type="submit"
              disabled={isGenerating || !inputValue.trim()}
              className="p-2.5 rounded-xl bg-[#0F172A] hover:bg-[#1E293B] text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-xs"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
