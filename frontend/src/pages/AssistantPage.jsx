import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Bot,
  Send,
  Sparkles,
  User,
  ArrowRight,
  RotateCcw,
  Cpu,
  ShieldAlert,
  Database,
  AlertTriangle,
} from 'lucide-react';
import { api } from '../services/api';
import { useDataSource } from '../context/DataSourceContext';

const DEFAULT_SUGGESTIONS = [
  'Which sectors have the highest cost variance?',
  'Which projects require attention?',
  'How many projects are delayed?',
  'What are the main risk drivers?',
  'What information is missing for risk prediction?',
];

/** Minimal markdown: bold, bullets, blank lines. Anything else renders literally. */
function renderLine(line, key) {
  const isBullet = /^\s*[-*\u2022]\s+/.test(line);
  const content = isBullet ? line.replace(/^\s*[-*\u2022]\s+/, '') : line;
  const parts = content.split(/(\*\*.*?\*\*)/g);

  if (!line.trim()) return <div key={key} className="h-2" />;

  return (
    <div key={key} className={isBullet ? 'pl-3 py-0.5 relative' : 'py-0.5'}>
      {isBullet && <span className="absolute left-0 text-slate-500">&bull;</span>}
      {parts.map((part, i) =>
        part.startsWith('**') && part.endsWith('**') ? (
          <strong key={i} className="font-bold text-white">
            {part.slice(2, -2)}
          </strong>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </div>
  );
}

function ModeBadge({ status }) {
  if (!status) return null;
  const isGemini = status.llm_enabled;
  return (
    <span
      className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold border flex items-center gap-1.5 ${
        isGemini
          ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
          : 'bg-slate-700/40 text-slate-300 border-slate-600/50'
      }`}
      title={status.message}
    >
      {isGemini ? <Sparkles className="w-3 h-3" /> : <Cpu className="w-3 h-3" />}
      {isGemini ? 'AI Assistant - Gemini LLM' : 'Local assistant fallback'}
    </span>
  );
}

export default function AssistantPage({ onSelectProject, onNavigateToAiRisk }) {
  const { status: dataSource, version } = useDataSource();
  const [llmStatus, setLlmStatus] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const chatEndRef = useRef(null);

  const greeting = useCallback(
    (status) => ({
      id: 1,
      sender: 'bot',
      text:
        `I am the **PAIMANA-AI Project Intelligence Assistant**.\n\n` +
        `I answer only from the active dataset: **${dataSource.label}** ` +
        `(${dataSource.active_project_count} projects). If something is not in that ` +
        `dataset I will say so rather than estimate it.\n\n` +
        (status?.llm_enabled
          ? `Running in **Gemini LLM** mode, so you can ask free-form questions.`
          : `Running in **local fallback** mode (no Gemini API key configured), so I ` +
            `understand a fixed set of question types.`),
      suggested: DEFAULT_SUGGESTIONS,
      sources: [],
      mode: status?.mode,
    }),
    [dataSource]
  );

  useEffect(() => {
    let cancelled = false;
    api
      .getAssistantStatus()
      .then((s) => {
        if (cancelled) return;
        setLlmStatus(s);
        setMessages([greeting(s)]);
      })
      .catch(() => {
        if (cancelled) return;
        setLlmStatus(null);
        setMessages([greeting(null)]);
      });
    return () => {
      cancelled = true;
    };
  }, [greeting, version]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const handleSend = async (queryText) => {
    const textToSend = (queryText || inputText).trim();
    if (!textToSend) return;

    setMessages((prev) => [...prev, { id: Date.now(), sender: 'user', text: textToSend }]);
    setInputText('');
    setLoading(true);

    try {
      const res = await api.chatAssistant(textToSend);
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          sender: 'bot',
          text: res.answer,
          suggested: res.suggested_queries || DEFAULT_SUGGESTIONS,
          sources: res.sources || [],
          mode: res.mode,
          modeLabel: res.mode_label,
          notice: res.notice,
        },
      ]);
      if (res.mode && llmStatus && res.llm_enabled !== llmStatus.llm_enabled) {
        setLlmStatus({ ...llmStatus, llm_enabled: res.llm_enabled, message: res.notice });
      }
    } catch (err) {
      // No canned answer is substituted here: fabricating a reply when the
      // backend is unreachable would be indistinguishable from a real one.
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          sender: 'bot',
          isError: true,
          text:
            `I could not reach the PAIMANA-AI backend, so I have no dataset to answer ` +
            `from.\n\nEnsure the FastAPI server is running on port 8000, then ask again. ` +
            `I will not answer from memory, because any figure I produced that way would ` +
            `not be traceable to your data.\n\n**Error:** ${err.message}`,
          suggested: [],
          sources: [],
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const clearChat = () => setMessages([greeting(llmStatus)]);

  return (
    <div className="space-y-4 pb-12 h-[calc(100vh-140px)] flex flex-col">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-xl md:text-2xl font-bold text-white tracking-tight flex items-center gap-2">
              <Bot className="w-6 h-6 text-blue-400" />
              AI Project Assistant
            </h2>
            <ModeBadge status={llmStatus} />
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Grounded in the active dataset:{' '}
            <span className={dataSource.is_synthetic ? 'text-amber-300' : 'text-emerald-300'}>
              {dataSource.label}
            </span>
          </p>
        </div>

        <button
          onClick={clearChat}
          className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer w-fit"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          Clear Conversation
        </button>
      </div>

      {/* Mode notice */}
      {llmStatus && !llmStatus.llm_enabled && (
        <div className="shrink-0 p-3 rounded-xl bg-slate-900/80 border border-slate-700 text-[11px] text-slate-300 flex items-start gap-2.5">
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-px" />
          <span className="leading-relaxed">
            <strong className="text-amber-300">
              LLM mode unavailable &mdash; using local assistant fallback.
            </strong>{' '}
            {llmStatus.message} The fallback answers from the same dataset using
            deterministic rules, so its answers remain accurate but it handles a narrower
            range of phrasings.
          </span>
        </div>
      )}

      {/* Chat container */}
      <div className="flex-1 glass-panel border border-slate-700/60 rounded-3xl flex flex-col overflow-hidden shadow-2xl">
        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
          {messages.map((msg) => {
            const isBot = msg.sender === 'bot';
            return (
              <div
                key={msg.id}
                className={`flex gap-3.5 ${isBot ? 'items-start' : 'items-start flex-row-reverse'}`}
              >
                <div
                  className={`w-8 h-8 rounded-xl shrink-0 flex items-center justify-center text-white shadow-md ${
                    msg.isError
                      ? 'bg-rose-800'
                      : isBot
                      ? 'bg-gradient-to-tr from-blue-600 to-indigo-600'
                      : 'bg-slate-700'
                  }`}
                >
                  {isBot ? <Bot className="w-4 h-4" /> : <User className="w-4 h-4" />}
                </div>

                <div className={`space-y-3 max-w-2xl ${isBot ? 'text-left' : 'text-right'}`}>
                  <div
                    className={`inline-block p-4 rounded-2xl text-xs leading-relaxed ${
                      msg.isError
                        ? 'bg-rose-950/50 border border-rose-800/60 text-rose-200'
                        : isBot
                        ? 'bg-slate-950/80 border border-slate-800 text-slate-200'
                        : 'bg-blue-600 text-white font-medium shadow-md shadow-blue-600/20'
                    }`}
                  >
                    <div className="text-left">
                      {msg.text.split('\n').map((line, idx) => renderLine(line, idx))}
                    </div>
                  </div>

                  {/* Per-message mode + notice */}
                  {isBot && msg.mode && (
                    <div className="flex items-center gap-2 text-[10px] text-slate-500">
                      <Cpu className="w-3 h-3" />
                      <span>{msg.modeLabel || msg.mode}</span>
                      {msg.notice && (
                        <span className="text-amber-400/80 truncate max-w-xs" title={msg.notice}>
                          &bull; {msg.notice}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Grounding sources */}
                  {isBot && msg.sources?.length > 0 && (
                    <div className="space-y-1.5 text-left">
                      <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold flex items-center gap-1">
                        <Database className="w-3 h-3" />
                        Grounded in
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {msg.sources.slice(0, 8).map((src, i) =>
                          src.type === 'dataset' ? (
                            <span
                              key={`ds-${i}`}
                              className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-800 text-slate-300 border border-slate-700"
                            >
                              {src.label} ({src.project_count})
                            </span>
                          ) : (
                            <button
                              key={`${src.project_id}-${i}`}
                              onClick={() => onSelectProject && onSelectProject(src.project_id)}
                              className="px-2 py-0.5 rounded text-[10px] font-mono bg-blue-950/50 text-blue-300 border border-blue-800/50 hover:border-blue-500 transition-colors cursor-pointer flex items-center gap-1"
                              title={src.project_name}
                            >
                              {src.project_id}
                              <ArrowRight className="w-2.5 h-2.5" />
                            </button>
                          )
                        )}
                      </div>
                    </div>
                  )}

                  {/* Project context shortcut */}
                  {isBot && msg.sources?.some((s) => s.type === 'project') && onNavigateToAiRisk && (
                    <button
                      onClick={() =>
                        onNavigateToAiRisk(
                          msg.sources.find((s) => s.type === 'project')?.project_id
                        )
                      }
                      className="px-2.5 py-1 rounded-lg bg-indigo-950/60 hover:bg-indigo-900 border border-indigo-700/50 text-indigo-300 hover:text-white text-[10px] font-semibold inline-flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      <ShieldAlert className="w-3 h-3" />
                      Open AI Risk Analysis
                    </button>
                  )}

                  {/* Suggestions */}
                  {isBot && msg.suggested?.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {msg.suggested.map((q, qIdx) => (
                        <button
                          key={qIdx}
                          onClick={() => handleSend(q)}
                          className="px-2.5 py-1 rounded-lg bg-slate-800/80 hover:bg-slate-800 border border-slate-700 hover:border-blue-500/50 text-[11px] text-slate-300 hover:text-blue-300 transition-all cursor-pointer flex items-center gap-1"
                        >
                          <Sparkles className="w-3 h-3 text-blue-400" />
                          <span>{q}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {loading && (
            <div className="flex gap-3.5 items-start">
              <div className="w-8 h-8 rounded-xl shrink-0 flex items-center justify-center bg-blue-600 text-white animate-pulse">
                <Bot className="w-4 h-4" />
              </div>
              <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800 text-xs text-slate-400 flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5 animate-spin text-blue-400" />
                {llmStatus?.llm_enabled
                  ? 'Building project context and querying Gemini...'
                  : 'Querying the active dataset...'}
              </div>
            </div>
          )}

          <div ref={chatEndRef} />
        </div>

        {/* Input */}
        <div className="p-3 md:p-4 border-t border-slate-800 bg-slate-950/60 space-y-2">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="flex items-center gap-2"
          >
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Ask anything about the active dataset, e.g. 'Why is PRJ-147 high risk?'"
              className="flex-1 px-4 py-2.5 rounded-xl bg-slate-950/80 border border-slate-700/80 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all shadow-inner"
            />
            <button
              type="submit"
              disabled={loading || !inputText.trim()}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-indigo-600/30 transition-all cursor-pointer hover:scale-[1.02]"
            >
              <span>Send</span>
              <Send className="w-3.5 h-3.5" />
            </button>
          </form>

          <div className="flex items-center justify-between text-[10px] text-slate-400 px-1 gap-3">
            <span className="leading-relaxed">
              Answers are constrained to the active dataset. Risk figures are PAIMANA-AI
              derived analysis, not official Government predictions.
            </span>
            <span className="font-mono text-slate-400 shrink-0">
              {llmStatus?.model || 'local'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
