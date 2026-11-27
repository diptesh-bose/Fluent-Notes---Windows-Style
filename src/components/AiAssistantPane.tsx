import React, { useState } from 'react';
import {
  ArrowRight,
  Check,
  Copy,
  FilePlus2,
  ListChecks,
  Loader2,
  MessageSquare,
  RefreshCw,
  Send,
  Wand2,
  X,
} from 'lucide-react';
import type { ChatMessage, NotebookCategory, NoteAnalysis, TransformAction } from '../types/notes';

type AssistantTab = 'suggestions' | 'actions' | 'ask';

interface AiAssistantPaneProps {
  noteTitle: string;
  noteContent: string;
  selectedText: string;
  analysis: NoteAnalysis | null;
  analyzing: boolean;
  analysisError: string | null;
  transformOutput: string;
  transformLabel: string;
  transforming: boolean;
  transformError: string | null;
  chatMessages: ChatMessage[];
  asking: boolean;
  askError: string | null;
  onAnalyze: () => void;
  onApplyTitle: (title: string) => void;
  onApplyNotebook: (nb: NotebookCategory) => void;
  onDraftSuggestion: (promptHint: string, label: string) => void;
  onInsertChecklist: (items: string[]) => void;
  onRunTransform: (action: TransformAction, label: string, targetLanguage?: string) => void;
  onInsertText: (text: string) => void;
  onReplaceText: (text: string) => void;
  onCreateNoteFromText: (title: string, text: string) => void;
  onClearTransform: () => void;
  onAskSubmit: (question: string) => void;
  onClearChat: () => void;
}

const ACTION_BUTTONS: Array<{ action: TransformAction; label: string; desc: string }> = [
  { action: 'summarize', label: 'Summarize', desc: 'Crisp key takeaway' },
  { action: 'continue', label: 'Continue Writing', desc: 'Draft next paragraph' },
  { action: 'polish', label: 'Fix & Polish', desc: 'Grammar and clarity' },
  { action: 'concise', label: 'Make Concise', desc: 'Tighten wording' },
  { action: 'actions', label: 'Extract Tasks', desc: 'Convert to checklist' },
  { action: 'bullets', label: 'Bullet Points', desc: 'Scannable structure' },
  { action: 'outline', label: 'Build Outline', desc: 'Headings & sections' },
  { action: 'professional', label: 'Executive Tone', desc: 'Clear business style' },
];

const LANGUAGES = ['Spanish', 'French', 'German', 'Japanese', 'Portuguese', 'Hindi'];

export const AiAssistantPane: React.FC<AiAssistantPaneProps> = ({
  noteTitle,
  noteContent,
  selectedText,
  analysis,
  analyzing,
  analysisError,
  transformOutput,
  transformLabel,
  transforming,
  transformError,
  chatMessages,
  asking,
  askError,
  onAnalyze,
  onApplyTitle,
  onApplyNotebook,
  onDraftSuggestion,
  onInsertChecklist,
  onRunTransform,
  onInsertText,
  onReplaceText,
  onCreateNoteFromText,
  onClearTransform,
  onAskSubmit,
  onClearChat,
}) => {
  const [activeTab, setActiveTab] = useState<AssistantTab>('suggestions');
  const [targetLang, setTargetLang] = useState<string>('Spanish');
  const [questionInput, setQuestionInput] = useState<string>('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopy = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1600);
    } catch {
      // Ignore clipboard failures in restricted environments
    }
  };

  const handleAskForm = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = questionInput.trim();
    if (!trimmed || asking) return;
    setQuestionInput('');
    onAskSubmit(trimmed);
  };

  const hasContent = Boolean(noteContent.trim() || noteTitle.trim());

  return (
    <aside className="w-[340px] shrink-0 h-full flex flex-col bg-[#F6F6F6]/90 dark:bg-[#1E1E1E]/90 border-l border-zinc-200/80 dark:border-zinc-800/90">
      {/* Header & Sub-navigation */}
      <div className="px-4 pt-3.5 pb-3 border-b border-zinc-200/70 dark:border-zinc-800/80 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Wand2 className="w-4 h-4 text-[#0067C0] dark:text-[#4CC2FF] shrink-0" />
            <h2 className="font-display text-sm font-semibold text-zinc-900 dark:text-zinc-100 truncate">
              Gemini Assistant
            </h2>
          </div>
          {selectedText.trim() && (
            <span className="text-[11px] font-medium text-[#0067C0] dark:text-[#4CC2FF] whitespace-nowrap shrink-0">
              Selection active
            </span>
          )}
        </div>

        {/* Segmented Control */}
        <div
          className="grid grid-cols-3 gap-1 p-1 rounded-lg bg-zinc-200/70 dark:bg-zinc-900/80"
          role="tablist"
          aria-label="Gemini AI tools"
        >
          {(
            [
              { id: 'suggestions', label: 'Suggestions' },
              { id: 'actions', label: 'Transform' },
              { id: 'ask', label: 'Ask Note' },
            ] as const
          ).map((tab) => {
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setActiveTab(tab.id)}
                className={`px-2 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  active
                    ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-xs'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {activeTab === 'suggestions' && (
          <div className="space-y-5">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
                Get tailored writing suggestions, title ideas, and extracted tasks for this note.
              </p>
              <button
                type="button"
                onClick={onAnalyze}
                disabled={analyzing || !hasContent}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-[#0067C0] hover:bg-[#005A9E] disabled:opacity-50 dark:bg-[#4CC2FF] dark:hover:bg-[#3CB4F0] text-white dark:text-zinc-950 transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                {analyzing ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="w-3.5 h-3.5" />
                )}
                <span>{analysis ? 'Refresh' : 'Analyze'}</span>
              </button>
            </div>

            {analysisError && (
              <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/70 text-xs text-red-700 dark:text-red-300">
                {analysisError}
              </div>
            )}

            {analyzing && !analysis && (
              <div className="space-y-3 animate-pulse">
                <div className="h-4 w-2/3 rounded bg-zinc-200 dark:bg-zinc-800" />
                <div className="h-14 w-full rounded bg-zinc-200 dark:bg-zinc-800" />
                <div className="h-20 w-full rounded bg-zinc-200 dark:bg-zinc-800" />
              </div>
            )}

            {!analyzing && !analysis && !analysisError && (
              <div className="py-6 border-t border-zinc-200/70 dark:border-zinc-800 space-y-2">
                <p className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                  Ready to review your note
                </p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                  Click Analyze to surface next-step ideas, a concise summary, and actionable checklist items.
                </p>
              </div>
            )}

            {analysis && (
              <div className="space-y-5">
                {/* Suggested Title & Notebook */}
                <div className="space-y-2 pb-4 border-b border-zinc-200/70 dark:border-zinc-800">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                      Suggested Title
                    </span>
                    <button
                      type="button"
                      onClick={() => onApplyTitle(analysis.suggestedTitle)}
                      className="text-xs font-medium text-[#0067C0] dark:text-[#4CC2FF] hover:underline cursor-pointer whitespace-nowrap shrink-0"
                    >
                      Apply Title
                    </button>
                  </div>
                  <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 leading-snug">
                    {analysis.suggestedTitle}
                  </p>
                  <div className="flex items-center justify-between gap-2 pt-1 text-xs text-zinc-500 dark:text-zinc-400">
                    <span className="truncate">
                      {analysis.keyThemes?.slice(0, 3).join(' · ') || analysis.recommendedNotebook}
                    </span>
                    <button
                      type="button"
                      onClick={() => onApplyNotebook(analysis.recommendedNotebook)}
                      className="text-xs text-zinc-700 dark:text-zinc-300 hover:text-[#0067C0] dark:hover:text-[#4CC2FF] cursor-pointer whitespace-nowrap shrink-0"
                    >
                      Move to {analysis.recommendedNotebook}
                    </button>
                  </div>
                </div>

                {/* Executive Summary */}
                <div className="space-y-1.5 pb-4 border-b border-zinc-200/70 dark:border-zinc-800">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                      Summary
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopy(analysis.summary, 'summary')}
                      className="text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 inline-flex items-center gap-1 cursor-pointer"
                    >
                      {copiedId === 'summary' ? (
                        <>
                          <Check className="w-3 h-3" />
                          <span>Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          <span>Copy</span>
                        </>
                      )}
                    </button>
                  </div>
                  <p className="text-[13px] text-zinc-700 dark:text-zinc-300 leading-relaxed">
                    {analysis.summary}
                  </p>
                </div>

                {/* Tailored Writing Suggestions */}
                <div className="space-y-2.5">
                  <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400 block">
                    Suggested Next Additions
                  </span>
                  <div className="space-y-2">
                    {analysis.writingSuggestions?.map((item, idx) => (
                      <div
                        key={idx}
                        className="p-3 rounded-lg bg-white dark:bg-[#272727] border border-zinc-200/80 dark:border-zinc-700/80 space-y-1.5"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <h4 className="text-[13px] font-semibold text-zinc-900 dark:text-zinc-100 leading-snug">
                            {item.label}
                          </h4>
                          <button
                            type="button"
                            disabled={transforming}
                            onClick={() => {
                              setActiveTab('actions');
                              onDraftSuggestion(item.promptHint, item.label);
                            }}
                            className="inline-flex items-center gap-1 text-xs font-medium text-[#0067C0] dark:text-[#4CC2FF] hover:underline cursor-pointer whitespace-nowrap shrink-0"
                          >
                            <span>Draft</span>
                            <ArrowRight className="w-3 h-3" />
                          </button>
                        </div>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                          {item.rationale}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Extracted Action Items */}
                {analysis.actionItems && analysis.actionItems.length > 0 && (
                  <div className="space-y-2 pt-2 border-t border-zinc-200/70 dark:border-zinc-800">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                        Detected Action Items
                      </span>
                      <button
                        type="button"
                        onClick={() => onInsertChecklist(analysis.actionItems)}
                        className="inline-flex items-center gap-1 text-xs font-medium text-[#0067C0] dark:text-[#4CC2FF] hover:underline cursor-pointer whitespace-nowrap shrink-0"
                      >
                        <ListChecks className="w-3.5 h-3.5" />
                        <span>Insert Checklist</span>
                      </button>
                    </div>
                    <ul className="space-y-1.5">
                      {analysis.actionItems.map((task, idx) => (
                        <li
                          key={idx}
                          className="text-xs text-zinc-700 dark:text-zinc-300 flex items-start gap-2 leading-relaxed"
                        >
                          <span className="text-zinc-400 dark:text-zinc-500 mt-0.5">-</span>
                          <span>{task}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === 'actions' && (
          <div className="space-y-4">
            <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
              {selectedText.trim()
                ? 'Actions will apply to your currently highlighted text selection.'
                : 'Actions will apply to the full note. Highlight text in the editor to target a specific passage.'}
            </p>

            {/* 2-Column Transform Grid */}
            <div className="grid grid-cols-2 gap-2">
              {ACTION_BUTTONS.map((btn) => (
                <button
                  key={btn.action}
                  type="button"
                  disabled={transforming || !hasContent}
                  onClick={() => onRunTransform(btn.action, btn.label)}
                  className="text-left p-2.5 rounded-lg bg-white dark:bg-[#272727] border border-zinc-200/80 dark:border-zinc-700/80 hover:border-[#0067C0]/60 dark:hover:border-[#4CC2FF]/60 disabled:opacity-50 transition-colors cursor-pointer"
                >
                  <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                    {btn.label}
                  </div>
                  <div className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate mt-0.5">
                    {btn.desc}
                  </div>
                </button>
              ))}
            </div>

            {/* Quick Translate Row */}
            <div className="flex items-center gap-2 pt-1">
              <select
                value={targetLang}
                onChange={(e) => setTargetLang(e.target.value)}
                aria-label="Target translation language"
                className="flex-1 px-2.5 py-1.5 rounded-md text-xs bg-white dark:bg-[#272727] text-zinc-900 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-700 focus:outline-none focus:border-[#0067C0]"
              >
                {LANGUAGES.map((lang) => (
                  <option key={lang} value={lang}>
                    {lang}
                  </option>
                ))}
              </select>
              <button
                type="button"
                disabled={transforming || !hasContent}
                onClick={() => onRunTransform('translate', `Translate (${targetLang})`, targetLang)}
                className="px-3 py-1.5 rounded-md text-xs font-medium bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200 disabled:opacity-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                Translate
              </button>
            </div>

            {/* Transform Result Area */}
            {transformError && (
              <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/70 text-xs text-red-700 dark:text-red-300">
                {transformError}
              </div>
            )}

            {transforming && (
              <div className="p-4 rounded-lg bg-white dark:bg-[#272727] border border-zinc-200 dark:border-zinc-700 flex items-center gap-2.5 text-xs text-zinc-600 dark:text-zinc-300">
                <Loader2 className="w-4 h-4 animate-spin text-[#0067C0] dark:text-[#4CC2FF]" />
                <span>Generating {transformLabel || 'response'}...</span>
              </div>
            )}

            {!transforming && transformOutput && (
              <div className="rounded-lg bg-white dark:bg-[#272727] border border-zinc-200/90 dark:border-zinc-700/80 overflow-hidden">
                <div className="px-3 py-2 border-b border-zinc-200/70 dark:border-zinc-700/70 flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 truncate">
                    {transformLabel}
                  </span>
                  <button
                    type="button"
                    onClick={onClearTransform}
                    aria-label="Dismiss result"
                    className="p-0.5 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="p-3 max-h-60 overflow-y-auto text-[13px] leading-relaxed text-zinc-800 dark:text-zinc-200 whitespace-pre-wrap">
                  {transformOutput}
                </div>
                <div className="px-3 py-2 border-t border-zinc-200/70 dark:border-zinc-700/70 flex flex-wrap items-center gap-1.5 bg-zinc-50/70 dark:bg-zinc-900/40">
                  <button
                    type="button"
                    onClick={() => onInsertText(transformOutput)}
                    className="px-2.5 py-1 rounded text-xs font-medium bg-[#0067C0] hover:bg-[#005A9E] dark:bg-[#4CC2FF] dark:hover:bg-[#3CB4F0] text-white dark:text-zinc-950 transition-colors cursor-pointer"
                  >
                    Insert
                  </button>
                  <button
                    type="button"
                    onClick={() => onReplaceText(transformOutput)}
                    className="px-2.5 py-1 rounded text-xs font-medium bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors cursor-pointer"
                  >
                    {selectedText.trim() ? 'Replace Selection' : 'Replace Note'}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleCopy(transformOutput, 'transform')}
                    className="px-2 py-1 rounded text-xs text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 inline-flex items-center gap-1 cursor-pointer"
                  >
                    {copiedId === 'transform' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedId === 'transform' ? 'Copied' : 'Copy'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      onCreateNoteFromText(`${noteTitle || 'Note'} — ${transformLabel}`, transformOutput)
                    }
                    className="px-2 py-1 rounded text-xs text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 inline-flex items-center gap-1 cursor-pointer"
                    title="Save output as a new note"
                  >
                    <FilePlus2 className="w-3 h-3" />
                    <span>New Note</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'ask' && (
          <div className="flex flex-col h-full min-h-[340px]">
            <div className="flex items-center justify-between gap-2 pb-3">
              <span className="text-xs text-zinc-500 dark:text-zinc-400">
                Ask questions or request custom edits
              </span>
              {chatMessages.length > 0 && (
                <button
                  type="button"
                  onClick={onClearChat}
                  className="text-xs text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 cursor-pointer"
                >
                  Clear
                </button>
              )}
            </div>

            <div className="flex-1 space-y-3 overflow-y-auto pb-3">
              {chatMessages.length === 0 ? (
                <div className="space-y-2 py-4">
                  <div className="flex items-center gap-2 text-xs font-medium text-zinc-700 dark:text-zinc-300">
                    <MessageSquare className="w-3.5 h-3.5 text-[#0067C0] dark:text-[#4CC2FF]" />
                    <span>Try asking Gemini about this note</span>
                  </div>
                  <div className="space-y-1.5 pt-1">
                    {[
                      'Turn this note into a short follow-up email',
                      'What questions or risks am I overlooking?',
                      'Give me 3 concrete next steps based on this',
                    ].map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        disabled={asking}
                        onClick={() => onAskSubmit(preset)}
                        className="w-full text-left px-3 py-2 rounded-lg text-xs text-zinc-700 dark:text-zinc-300 bg-white dark:bg-[#272727] border border-zinc-200/80 dark:border-zinc-700/80 hover:border-[#0067C0]/60 dark:hover:border-[#4CC2FF]/60 transition-colors cursor-pointer"
                      >
                        {preset}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                chatMessages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`rounded-lg p-3 text-[13px] leading-relaxed ${
                      msg.role === 'user'
                        ? 'bg-[#0067C0]/10 dark:bg-[#4CC2FF]/12 text-zinc-900 dark:text-zinc-100 ml-5'
                        : 'bg-white dark:bg-[#272727] border border-zinc-200/80 dark:border-zinc-700/80 text-zinc-800 dark:text-zinc-200 mr-2'
                    }`}
                  >
                    <div className="whitespace-pre-wrap">{msg.text}</div>
                    {msg.role === 'model' && (
                      <div className="mt-2 pt-2 border-t border-zinc-100 dark:border-zinc-700/60 flex items-center gap-3 text-xs">
                        <button
                          type="button"
                          onClick={() => onInsertText(msg.text)}
                          className="font-medium text-[#0067C0] dark:text-[#4CC2FF] hover:underline cursor-pointer"
                        >
                          Insert into Note
                        </button>
                        <button
                          type="button"
                          onClick={() => handleCopy(msg.text, msg.id)}
                          className="text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 cursor-pointer"
                        >
                          {copiedId === msg.id ? 'Copied' : 'Copy'}
                        </button>
                      </div>
                    )}
                  </div>
                ))
              )}

              {asking && (
                <div className="p-3 rounded-lg bg-white dark:bg-[#272727] border border-zinc-200/80 dark:border-zinc-700/80 flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-[#0067C0] dark:text-[#4CC2FF]" />
                  <span>Thinking...</span>
                </div>
              )}

              {askError && (
                <div className="p-2.5 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/70 text-xs text-red-700 dark:text-red-300">
                  {askError}
                </div>
              )}
            </div>

            <form onSubmit={handleAskForm} className="pt-2 border-t border-zinc-200/70 dark:border-zinc-800">
              <div className="flex items-center gap-1.5">
                <input
                  type="text"
                  value={questionInput}
                  onChange={(e) => setQuestionInput(e.target.value)}
                  placeholder="Ask about this note..."
                  aria-label="Ask Gemini about this note"
                  className="flex-1 px-3 py-2 rounded-md text-xs bg-white dark:bg-[#272727] text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 border border-zinc-200 dark:border-zinc-700 focus:outline-none focus:border-[#0067C0] dark:focus:border-[#4CC2FF]"
                />
                <button
                  type="submit"
                  disabled={asking || !questionInput.trim()}
                  aria-label="Send prompt"
                  className="p-2 rounded-md bg-[#0067C0] hover:bg-[#005A9E] disabled:opacity-50 dark:bg-[#4CC2FF] dark:hover:bg-[#3CB4F0] text-white dark:text-zinc-950 transition-colors cursor-pointer shrink-0"
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </aside>
  );
};
