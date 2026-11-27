import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Bold,
  Check,
  CheckSquare,
  Code2,
  Copy,
  CornerDownRight,
  Download,
  Eye,
  Heading2,
  Italic,
  List,
  Loader2,
  Maximize2,
  Minimize2,
  Minus,
  Moon,
  NotebookPen,
  PanelLeft,
  PanelRight,
  PenLine,
  Pin,
  PinOff,
  Square,
  Sun,
  X,
} from 'lucide-react';
import { AiAssistantPane } from './components/AiAssistantPane';
import { MarkdownPreview } from './components/MarkdownPreview';
import { NotesSidebar, type SidebarFilter } from './components/NotesSidebar';
import { Taskbar } from './components/Taskbar';
import { formatRelativeTime, getWordStats, STARTER_NOTES } from './data/starterNotes';
import {
  analyzeNote,
  askNoteAssistant,
  fetchInlineAutocomplete,
  transformNote,
} from './services/aiClient';
import type {
  ChatMessage,
  NotebookCategory,
  NoteAnalysis,
  NoteItem,
  TransformAction,
} from './types/notes';

const STORAGE_KEY_NOTES = 'fluent_notes_v1';
const STORAGE_KEY_THEME = 'fluent_notes_theme_v1';

const LIGHT_WALLPAPER = '/src/assets/images/win11_bloom_light_1795793470751.jpg';
const DARK_WALLPAPER = '/src/assets/images/win11_bloom_dark_1795793472284.jpg';

const NOTEBOOKS: NotebookCategory[] = ['Work', 'Personal', 'Ideas', 'Journal'];

function loadInitialNotes(): NoteItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_NOTES);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch {
    // Fallback to starter notes
  }
  return STARTER_NOTES;
}

function loadInitialTheme(): boolean {
  try {
    const stored = localStorage.getItem(STORAGE_KEY_THEME);
    if (stored === 'dark') return true;
    if (stored === 'light') return false;
  } catch {
    // Ignore storage error
  }
  return false;
}

export default function App() {
  const [notes, setNotes] = useState<NoteItem[]>(loadInitialNotes);
  const [activeNoteId, setActiveNoteId] = useState<string>(() => loadInitialNotes()[0]?.id ?? '');
  const [filter, setFilter] = useState<SidebarFilter>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isDark, setIsDark] = useState<boolean>(loadInitialTheme);

  // Window & Layout state
  const [windowState, setWindowState] = useState<'windowed' | 'maximized' | 'minimized' | 'closed'>(
    'windowed'
  );
  const [showSidebar, setShowSidebar] = useState<boolean>(true);
  const [showAiPane, setShowAiPane] = useState<boolean>(true);
  const [editorMode, setEditorMode] = useState<'edit' | 'preview'>('edit');

  // Selection & Inline AI Autocomplete
  const [selectedText, setSelectedText] = useState<string>('');
  const [autoCompleteEnabled, setAutoCompleteEnabled] = useState<boolean>(true);
  const [inlineSuggestion, setInlineSuggestion] = useState<string>('');
  const [loadingInline, setLoadingInline] = useState<boolean>(false);

  // Per-note AI Assistant state
  const [analysisByNote, setAnalysisByNote] = useState<Record<string, NoteAnalysis>>({});
  const [analyzing, setAnalyzing] = useState<boolean>(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  const [transformOutput, setTransformOutput] = useState<string>('');
  const [transformLabel, setTransformLabel] = useState<string>('');
  const [transforming, setTransforming] = useState<boolean>(false);
  const [transformError, setTransformError] = useState<string | null>(null);

  const [chatsByNote, setChatsByNote] = useState<Record<string, ChatMessage[]>>({});
  const [asking, setAsking] = useState<boolean>(false);
  const [askError, setAskError] = useState<string | null>(null);

  // Utility UI feedback
  const [copiedNote, setCopiedNote] = useState<boolean>(false);
  const [deletedBanner, setDeletedBanner] = useState<{ note: NoteItem } | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const autocompleteAbortRef = useRef<AbortController | null>(null);
  const deletedTimerRef = useRef<number | null>(null);

  // Sync Tailwind dark class on <html>
  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark);
    try {
      localStorage.setItem(STORAGE_KEY_THEME, isDark ? 'dark' : 'light');
    } catch {
      // Ignore storage error
    }
  }, [isDark]);

  // Persist notes
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_NOTES, JSON.stringify(notes));
    } catch {
      // Ignore storage error
    }
  }, [notes]);

  const activeNote = useMemo(
    () => notes.find((n) => n.id === activeNoteId) ?? notes[0] ?? null,
    [notes, activeNoteId]
  );

  // Filtered & sorted notes
  const filteredNotes = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return notes
      .filter((note) => {
        if (filter === 'Pinned' && !note.pinned) return false;
        if (filter !== 'All' && filter !== 'Pinned' && note.notebook !== filter) return false;
        if (!q) return true;
        return (
          note.title.toLowerCase().includes(q) ||
          note.content.toLowerCase().includes(q) ||
          note.notebook.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
        return b.updatedAt - a.updatedAt;
      });
  }, [notes, filter, searchQuery]);

  const updateNote = useCallback((id: string, patch: Partial<NoteItem>) => {
    setNotes((prev) =>
      prev.map((n) => (n.id === id ? { ...n, ...patch, updatedAt: Date.now() } : n))
    );
  }, []);

  const handleCreateNote = useCallback(
    (initialTitle = '', initialContent = '', notebookOverride?: NotebookCategory) => {
      const nb: NotebookCategory =
        notebookOverride ??
        (filter !== 'All' && filter !== 'Pinned' ? filter : 'Work');
      const now = Date.now();
      const newNote: NoteItem = {
        id: `note-${now}-${Math.random().toString(36).slice(2, 6)}`,
        title: initialTitle,
        content: initialContent,
        notebook: nb,
        pinned: false,
        createdAt: now,
        updatedAt: now,
      };
      setNotes((prev) => [newNote, ...prev]);
      setActiveNoteId(newNote.id);
      setEditorMode('edit');
      setInlineSuggestion('');
      setSelectedText('');
      if (windowState === 'minimized' || windowState === 'closed') {
        setWindowState('windowed');
      }
      requestAnimationFrame(() => {
        textareaRef.current?.focus();
      });
    },
    [filter, windowState]
  );

  const handleDuplicateNote = useCallback(
    (id: string) => {
      const target = notes.find((n) => n.id === id);
      if (!target) return;
      const now = Date.now();
      const copy: NoteItem = {
        ...target,
        id: `note-${now}-${Math.random().toString(36).slice(2, 6)}`,
        title: target.title ? `${target.title} (Copy)` : 'Untitled Note (Copy)',
        pinned: false,
        createdAt: now,
        updatedAt: now,
      };
      setNotes((prev) => [copy, ...prev]);
      setActiveNoteId(copy.id);
    },
    [notes]
  );

  const handleDeleteNote = useCallback(
    (id: string) => {
      const target = notes.find((n) => n.id === id);
      if (!target) return;

      setNotes((prev) => {
        const remaining = prev.filter((n) => n.id !== id);
        if (activeNoteId === id) {
          setActiveNoteId(remaining[0]?.id ?? '');
        }
        return remaining;
      });

      setDeletedBanner({ note: target });
      if (deletedTimerRef.current) window.clearTimeout(deletedTimerRef.current);
      deletedTimerRef.current = window.setTimeout(() => {
        setDeletedBanner(null);
      }, 6000);
    },
    [notes, activeNoteId]
  );

  const handleUndoDelete = useCallback(() => {
    if (!deletedBanner) return;
    const restored = deletedBanner.note;
    setNotes((prev) => [restored, ...prev]);
    setActiveNoteId(restored.id);
    setDeletedBanner(null);
    if (deletedTimerRef.current) window.clearTimeout(deletedTimerRef.current);
  }, [deletedBanner]);

  const handleTogglePin = useCallback(
    (id: string) => {
      const target = notes.find((n) => n.id === id);
      if (!target) return;
      updateNote(id, { pinned: !target.pinned });
    },
    [notes, updateNote]
  );

  // Trigger inline Gemini autocomplete
  const triggerAutocomplete = useCallback(
    async (note: NoteItem, cursorPos: number) => {
      if (!note.content.trim() || note.content.slice(0, cursorPos).trim().length < 15) {
        return;
      }

      if (autocompleteAbortRef.current) {
        autocompleteAbortRef.current.abort();
      }
      const controller = new AbortController();
      autocompleteAbortRef.current = controller;

      setLoadingInline(true);
      try {
        const beforeCursor = note.content.slice(0, cursorPos);
        const { suggestion } = await fetchInlineAutocomplete(
          { title: note.title, contentBeforeCursor: beforeCursor },
          controller.signal
        );
        if (!controller.signal.aborted && suggestion) {
          setInlineSuggestion(suggestion);
        }
      } catch {
        // Silent cancel/error for unobtrusive inline suggestions
      } finally {
        if (!controller.signal.aborted) {
          setLoadingInline(false);
        }
      }
    },
    []
  );

  // Debounced auto-suggestion while typing
  useEffect(() => {
    if (!autoCompleteEnabled || editorMode !== 'edit' || !activeNote) {
      return;
    }
    const el = textareaRef.current;
    if (!el || document.activeElement !== el) return;
    const cursorPos = el.selectionStart ?? activeNote.content.length;
    // Suggest smoothly when typing near the end of a line or note
    const afterCursor = activeNote.content.slice(cursorPos);
    if (afterCursor.length > 0 && !afterCursor.startsWith('\n')) return;
    if (activeNote.content.slice(0, cursorPos).trim().length < 20) return;

    const timer = window.setTimeout(() => {
      triggerAutocomplete(activeNote, cursorPos);
    }, 1250);

    return () => window.clearTimeout(timer);
  }, [activeNote?.id, activeNote?.content, autoCompleteEnabled, editorMode, triggerAutocomplete]);

  const acceptInlineSuggestion = useCallback(() => {
    if (!activeNote || !inlineSuggestion) return;
    const el = textareaRef.current;
    const pos = el ? el.selectionStart ?? activeNote.content.length : activeNote.content.length;
    const nextContent =
      activeNote.content.slice(0, pos) + inlineSuggestion + activeNote.content.slice(pos);
    updateNote(activeNote.id, { content: nextContent });
    const nextCursor = pos + inlineSuggestion.length;
    setInlineSuggestion('');
    requestAnimationFrame(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(nextCursor, nextCursor);
      }
    });
  }, [activeNote, inlineSuggestion, updateNote]);

  // Global keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setShowSidebar(true);
        requestAnimationFrame(() => searchInputRef.current?.focus());
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        handleCreateNote();
      } else if (e.altKey && e.key === '/') {
        e.preventDefault();
        if (activeNote && editorMode === 'edit') {
          const pos = textareaRef.current?.selectionStart ?? activeNote.content.length;
          triggerAutocomplete(activeNote, pos);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeNote, editorMode, handleCreateNote, triggerAutocomplete]);

  // Insert or wrap markdown formatting at cursor
  const applyMarkdownFormat = (prefix: string, suffix = '', placeholder = '') => {
    if (!activeNote) return;
    setEditorMode('edit');
    const el = textareaRef.current;
    const start = el?.selectionStart ?? activeNote.content.length;
    const end = el?.selectionEnd ?? activeNote.content.length;
    const selected = activeNote.content.slice(start, end) || placeholder;
    const next =
      activeNote.content.slice(0, start) +
      prefix +
      selected +
      suffix +
      activeNote.content.slice(end);
    updateNote(activeNote.id, { content: next });

    requestAnimationFrame(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        const newPos = start + prefix.length + selected.length + suffix.length;
        textareaRef.current.setSelectionRange(newPos, newPos);
      }
    });
  };

  // Toggle interactive Markdown checkboxes in Preview mode
  const handleToggleCheckbox = (lineIndex: number) => {
    if (!activeNote) return;
    const lines = activeNote.content.split(/\r?\n/);
    const line = lines[lineIndex];
    if (!line) return;
    if (/^(\s*-\s+\[) ([ \]])/.test(line) || /^-\s+\[[ xX]\]/.test(line.trim())) {
      lines[lineIndex] = line.replace(/-\s+\[([ xX])\]/, (_, state) =>
        state === ' ' ? '- [x]' : '- [ ]'
      );
      updateNote(activeNote.id, { content: lines.join('\n') });
    }
  };

  // Insert AI text at cursor or end of note
  const handleInsertText = (textToInsert: string) => {
    if (!activeNote) return;
    const el = textareaRef.current;
    const pos = el ? el.selectionStart ?? activeNote.content.length : activeNote.content.length;
    const before = activeNote.content.slice(0, pos);
    const after = activeNote.content.slice(pos);
    const sepBefore = before && !before.endsWith('\n') ? '\n\n' : '';
    const sepAfter = after && !after.startsWith('\n') ? '\n\n' : '';
    const next = `${before}${sepBefore}${textToInsert}${sepAfter}${after}`;
    updateNote(activeNote.id, { content: next });
    setEditorMode('edit');
  };

  const handleReplaceText = (replacement: string) => {
    if (!activeNote) return;
    const el = textareaRef.current;
    if (el && selectedText.trim() && el.selectionStart !== el.selectionEnd) {
      const start = el.selectionStart;
      const end = el.selectionEnd;
      const next =
        activeNote.content.slice(0, start) + replacement + activeNote.content.slice(end);
      updateNote(activeNote.id, { content: next });
      setSelectedText('');
    } else {
      updateNote(activeNote.id, { content: replacement });
    }
    setEditorMode('edit');
  };

  // Gemini AI Handlers
  const handleAnalyzeNote = async () => {
    if (!activeNote) return;
    setAnalyzing(true);
    setAnalysisError(null);
    try {
      const result = await analyzeNote({
        title: activeNote.title,
        content: activeNote.content,
        notebook: activeNote.notebook,
      });
      setAnalysisByNote((prev) => ({ ...prev, [activeNote.id]: result }));
    } catch (err) {
      setAnalysisError(err instanceof Error ? err.message : 'Unable to analyze note.');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleRunTransform = async (
    action: TransformAction,
    label: string,
    targetLanguage?: string,
    customInstruction?: string
  ) => {
    if (!activeNote) return;
    setTransforming(true);
    setTransformError(null);
    setTransformLabel(label);
    try {
      const { result } = await transformNote({
        title: activeNote.title,
        content: activeNote.content,
        selectedText,
        action,
        targetLanguage,
        customInstruction,
      });
      setTransformOutput(result);
    } catch (err) {
      setTransformError(err instanceof Error ? err.message : 'Transformation failed.');
    } finally {
      setTransforming(false);
    }
  };

  const handleAskSubmit = async (question: string) => {
    if (!activeNote) return;
    const noteId = activeNote.id;
    const currentHistory = chatsByNote[noteId] ?? [];
    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      text: question,
    };
    setChatsByNote((prev) => ({ ...prev, [noteId]: [...(prev[noteId] ?? []), userMsg] }));
    setAsking(true);
    setAskError(null);

    try {
      const { answer } = await askNoteAssistant({
        title: activeNote.title,
        content: activeNote.content,
        question,
        history: currentHistory.map((m) => ({ role: m.role, text: m.text })),
      });
      const modelMsg: ChatMessage = {
        id: `m-${Date.now()}`,
        role: 'model',
        text: answer,
      };
      setChatsByNote((prev) => ({ ...prev, [noteId]: [...(prev[noteId] ?? []), modelMsg] }));
    } catch (err) {
      setAskError(err instanceof Error ? err.message : 'Unable to reach Gemini assistant.');
    } finally {
      setAsking(false);
    }
  };

  const handleExportMarkdown = () => {
    if (!activeNote) return;
    const safeName = (activeNote.title.trim() || 'untitled-note')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
    const md = `# ${activeNote.title.trim() || 'Untitled Note'}\n\n${activeNote.content}`;
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${safeName || 'note'}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCopyFullNote = async () => {
    if (!activeNote) return;
    const full = `${activeNote.title ? activeNote.title + '\n\n' : ''}${activeNote.content}`;
    try {
      await navigator.clipboard.writeText(full);
      setCopiedNote(true);
      setTimeout(() => setCopiedNote(false), 1600);
    } catch {
      // Ignore clipboard failure
    }
  };

  const stats = useMemo(() => getWordStats(activeNote?.content ?? ''), [activeNote?.content]);
  const isWindowVisible = windowState === 'windowed' || windowState === 'maximized';

  return (
    <div className="relative h-screen w-screen overflow-hidden flex flex-col bg-zinc-200 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100">
      {/* Windows 11 Bloom Desktop Wallpaper */}
      <div className="absolute inset-0 pointer-events-none select-none overflow-hidden">
        <div
          className={`absolute inset-0 ${
            isDark
              ? 'bg-gradient-to-br from-[#09111E] via-[#0B172A] to-[#060B14]'
              : 'bg-gradient-to-br from-[#E6EFF8] via-[#DCE8F5] to-[#EEF3F9]'
          }`}
        />
        <img
          src={isDark ? DARK_WALLPAPER : LIGHT_WALLPAPER}
          alt=""
          referrerPolicy="no-referrer"
          className="w-full h-full object-cover transition-opacity duration-300"
        />
      </div>

      {/* Main Desktop Viewport */}
      <div
        className={`relative z-10 flex-1 min-h-0 flex items-center justify-center ${
          windowState === 'maximized' ? 'p-0' : 'p-2 sm:p-4 md:p-6'
        }`}
      >
        {/* Desktop Shortcut when minimized or closed */}
        {!isWindowVisible && (
          <div className="self-start mr-auto p-4">
            <button
              type="button"
              onClick={() => setWindowState('windowed')}
              className="group w-24 p-3 rounded-lg flex flex-col items-center gap-2 hover:bg-white/40 dark:hover:bg-black/35 backdrop-blur-sm border border-transparent hover:border-white/50 dark:hover:border-white/15 transition-colors cursor-pointer"
            >
              <div className="w-12 h-12 rounded-xl bg-white/90 dark:bg-zinc-800/90 shadow-md flex items-center justify-center border border-black/5 dark:border-white/10">
                <NotebookPen className="w-6 h-6 text-[#0067C0] dark:text-[#4CC2FF]" />
              </div>
              <span className="text-xs font-medium text-zinc-900 dark:text-zinc-100 drop-shadow-xs text-center leading-tight">
                Fluent Notes
              </span>
            </button>
          </div>
        )}

        {/* Windows 11 App Window */}
        {isWindowVisible && (
          <div
            className={`flex flex-col overflow-hidden bg-white/92 dark:bg-[#202020]/94 backdrop-blur-2xl border border-black/10 dark:border-white/12 shadow-[0_24px_64px_rgba(0,0,0,0.22)] transition-[border-radius] duration-150 ${
              windowState === 'maximized'
                ? 'w-full h-full rounded-none border-x-0 border-t-0'
                : 'w-full h-full max-w-[1440px] rounded-xl'
            }`}
          >
            {/* Windows 11 Title Bar */}
            <header className="h-10 shrink-0 px-3 flex items-center justify-between gap-4 bg-[#F3F3F3]/80 dark:bg-[#1C1C1C]/85 border-b border-zinc-200/75 dark:border-zinc-800/90 select-none">
              {/* Left: App Icon + Window Title + Active Note Name */}
              <div className="flex items-center gap-2.5 min-w-0">
                <NotebookPen className="w-4 h-4 text-[#0067C0] dark:text-[#4CC2FF] shrink-0" />
                <span className="font-display text-xs font-semibold text-zinc-900 dark:text-zinc-100 whitespace-nowrap shrink-0">
                  Fluent Notes
                </span>
                {activeNote && (
                  <span className="hidden sm:inline text-xs text-zinc-500 dark:text-zinc-400 truncate">
                    — {activeNote.title.trim() || 'Untitled Note'}
                  </span>
                )}
              </div>

              {/* Right: Pane toggles, Theme switch & Win11 Window Controls */}
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowSidebar((v) => !v)}
                  title={showSidebar ? 'Hide notes list' : 'Show notes list'}
                  aria-label="Toggle notes sidebar"
                  className={`p-1.5 rounded-md transition-colors cursor-pointer ${
                    showSidebar
                      ? 'text-zinc-900 dark:text-zinc-100 bg-black/5 dark:bg-white/10'
                      : 'text-zinc-500 dark:text-zinc-400 hover:bg-black/5 dark:hover:bg-white/10'
                  }`}
                >
                  <PanelLeft className="w-3.5 h-3.5" />
                </button>

                <button
                  type="button"
                  onClick={() => setShowAiPane((v) => !v)}
                  title={showAiPane ? 'Hide Gemini Assistant' : 'Show Gemini Assistant'}
                  aria-label="Toggle Gemini Assistant"
                  className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                    showAiPane
                      ? 'text-[#0067C0] dark:text-[#4CC2FF] bg-[#0067C0]/10 dark:bg-[#4CC2FF]/12'
                      : 'text-zinc-600 dark:text-zinc-400 hover:bg-black/5 dark:hover:bg-white/10'
                  }`}
                >
                  <PanelRight className="w-3.5 h-3.5" />
                  <span className="hidden md:inline">AI Suggestions</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsDark((v) => !v)}
                  title={isDark ? 'Switch to Light theme' : 'Switch to Dark theme'}
                  aria-label="Toggle color theme"
                  className="p-1.5 rounded-md text-zinc-600 dark:text-zinc-300 hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer"
                >
                  {isDark ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
                </button>

                <div className="w-px h-4 bg-zinc-300 dark:bg-zinc-700 mx-1" />

                {/* Windows 11 Caption Buttons: Minimize, Maximize/Restore, Close */}
                <button
                  type="button"
                  onClick={() => setWindowState('minimized')}
                  title="Minimize"
                  aria-label="Minimize window"
                  className="w-9 h-7 rounded-md flex items-center justify-center text-zinc-700 dark:text-zinc-300 hover:bg-black/6 dark:hover:bg-white/10 transition-colors cursor-pointer"
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setWindowState((prev) => (prev === 'maximized' ? 'windowed' : 'maximized'))
                  }
                  title={windowState === 'maximized' ? 'Restore Down' : 'Maximize'}
                  aria-label={windowState === 'maximized' ? 'Restore window' : 'Maximize window'}
                  className="w-9 h-7 rounded-md flex items-center justify-center text-zinc-700 dark:text-zinc-300 hover:bg-black/6 dark:hover:bg-white/10 transition-colors cursor-pointer"
                >
                  {windowState === 'maximized' ? (
                    <Minimize2 className="w-3.5 h-3.5" />
                  ) : (
                    <Square className="w-3 h-3" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setWindowState('closed')}
                  title="Close"
                  aria-label="Close window"
                  className="w-9 h-7 rounded-md flex items-center justify-center text-zinc-700 dark:text-zinc-300 hover:bg-[#C42B1C] hover:text-white transition-colors cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </header>

            {/* 3-Pane Workspace Body */}
            <div className="flex-1 min-h-0 flex relative overflow-hidden">
              {showSidebar && (
                <div className="max-md:absolute max-md:inset-y-0 max-md:left-0 max-md:z-20 max-md:shadow-2xl h-full flex">
                  <NotesSidebar
                    notes={filteredNotes}
                    activeNoteId={activeNote?.id ?? ''}
                    filter={filter}
                    searchQuery={searchQuery}
                    searchInputRef={searchInputRef}
                    onFilterChange={setFilter}
                    onSearchChange={setSearchQuery}
                    onSelectNote={(id) => {
                      setActiveNoteId(id);
                      setInlineSuggestion('');
                      setSelectedText('');
                      setTransformOutput('');
                      setTransformError(null);
                      setAnalysisError(null);
                      setAskError(null);
                    }}
                    onCreateNote={() => handleCreateNote()}
                    onTogglePin={handleTogglePin}
                    onDuplicateNote={handleDuplicateNote}
                    onDeleteNote={handleDeleteNote}
                  />
                </div>
              )}

              {/* Center Document Editor */}
              <main className="flex-1 min-w-0 h-full flex flex-col bg-white dark:bg-[#272727]">
                {activeNote ? (
                  <>
                    {/* Editor Formatting & Utility Command Bar */}
                    <div className="px-4 py-2 border-b border-zinc-200/75 dark:border-zinc-800/90 flex flex-wrap items-center justify-between gap-2 bg-[#FAFAFA]/80 dark:bg-[#242424]">
                      <div className="flex items-center gap-1 flex-wrap">
                        {/* Notebook Category */}
                        <select
                          value={activeNote.notebook}
                          onChange={(e) =>
                            updateNote(activeNote.id, {
                              notebook: e.target.value as NotebookCategory,
                            })
                          }
                          aria-label="Note notebook"
                          className="px-2 py-1 rounded-md text-xs font-medium bg-white dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700 focus:outline-none focus:border-[#0067C0] cursor-pointer mr-1"
                        >
                          {NOTEBOOKS.map((nb) => (
                            <option key={nb} value={nb}>
                              {nb}
                            </option>
                          ))}
                        </select>

                        {/* Markdown Formatting Controls */}
                        <button
                          type="button"
                          onClick={() => applyMarkdownFormat('**', '**', 'bold text')}
                          title="Bold"
                          aria-label="Bold"
                          className="p-1.5 rounded-md text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200/60 dark:hover:bg-zinc-700/70 transition-colors cursor-pointer"
                        >
                          <Bold className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => applyMarkdownFormat('*', '*', 'italic text')}
                          title="Italic"
                          aria-label="Italic"
                          className="p-1.5 rounded-md text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200/60 dark:hover:bg-zinc-700/70 transition-colors cursor-pointer"
                        >
                          <Italic className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => applyMarkdownFormat('\n## ', '', 'Section Heading')}
                          title="Heading"
                          aria-label="Heading"
                          className="p-1.5 rounded-md text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200/60 dark:hover:bg-zinc-700/70 transition-colors cursor-pointer"
                        >
                          <Heading2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => applyMarkdownFormat('\n- ', '', 'List item')}
                          title="Bullet list"
                          aria-label="Bullet list"
                          className="p-1.5 rounded-md text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200/60 dark:hover:bg-zinc-700/70 transition-colors cursor-pointer"
                        >
                          <List className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => applyMarkdownFormat('\n- [ ] ', '', 'Action item')}
                          title="Checklist item"
                          aria-label="Checklist item"
                          className="p-1.5 rounded-md text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200/60 dark:hover:bg-zinc-700/70 transition-colors cursor-pointer"
                        >
                          <CheckSquare className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => applyMarkdownFormat('`', '`', 'code')}
                          title="Inline code"
                          aria-label="Inline code"
                          className="p-1.5 rounded-md text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200/60 dark:hover:bg-zinc-700/70 transition-colors cursor-pointer"
                        >
                          <Code2 className="w-3.5 h-3.5" />
                        </button>

                        <div className="w-px h-4 bg-zinc-300 dark:bg-zinc-700 mx-1" />

                        {/* Inline Autocomplete Toggle & Trigger */}
                        <button
                          type="button"
                          onClick={() => {
                            setAutoCompleteEnabled((v) => !v);
                            setInlineSuggestion('');
                          }}
                          title="Toggle automatic inline Gemini writing suggestions"
                          className={`px-2 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                            autoCompleteEnabled
                              ? 'text-[#0067C0] dark:text-[#4CC2FF] bg-[#0067C0]/10 dark:bg-[#4CC2FF]/12'
                              : 'text-zinc-500 dark:text-zinc-400 hover:bg-zinc-200/60 dark:hover:bg-zinc-700/60'
                          }`}
                        >
                          Auto-Suggest: {autoCompleteEnabled ? 'On' : 'Off'}
                        </button>

                        {editorMode === 'edit' && (
                          <button
                            type="button"
                            disabled={loadingInline || activeNote.content.trim().length < 15}
                            onClick={() => {
                              const pos =
                                textareaRef.current?.selectionStart ?? activeNote.content.length;
                              triggerAutocomplete(activeNote, pos);
                            }}
                            title="Generate inline continuation now (Alt+/)"
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200/60 dark:hover:bg-zinc-700/60 disabled:opacity-45 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                          >
                            {loadingInline ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <CornerDownRight className="w-3 h-3 text-[#0067C0] dark:text-[#4CC2FF]" />
                            )}
                            <span>Suggest Next</span>
                          </button>
                        )}
                      </div>

                      {/* Right Toolbar: Edit/Preview + Note Actions */}
                      <div className="flex items-center gap-1.5">
                        <div className="flex items-center p-0.5 rounded-md bg-zinc-200/70 dark:bg-zinc-800">
                          <button
                            type="button"
                            onClick={() => setEditorMode('edit')}
                            className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                              editorMode === 'edit'
                                ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 shadow-xs'
                                : 'text-zinc-600 dark:text-zinc-400'
                            }`}
                          >
                            <PenLine className="w-3 h-3" />
                            <span>Edit</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditorMode('preview')}
                            className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                              editorMode === 'preview'
                                ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 shadow-xs'
                                : 'text-zinc-600 dark:text-zinc-400'
                            }`}
                          >
                            <Eye className="w-3 h-3" />
                            <span>Preview</span>
                          </button>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleTogglePin(activeNote.id)}
                          title={activeNote.pinned ? 'Unpin note' : 'Pin note'}
                          aria-label={activeNote.pinned ? 'Unpin note' : 'Pin note'}
                          className={`p-1.5 rounded-md transition-colors cursor-pointer ${
                            activeNote.pinned
                              ? 'text-[#0067C0] dark:text-[#4CC2FF] bg-[#0067C0]/10 dark:bg-[#4CC2FF]/12'
                              : 'text-zinc-500 dark:text-zinc-400 hover:bg-zinc-200/60 dark:hover:bg-zinc-700/70'
                          }`}
                        >
                          {activeNote.pinned ? (
                            <PinOff className="w-3.5 h-3.5" />
                          ) : (
                            <Pin className="w-3.5 h-3.5" />
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={handleCopyFullNote}
                          title="Copy note text"
                          aria-label="Copy note text"
                          className="p-1.5 rounded-md text-zinc-500 dark:text-zinc-400 hover:bg-zinc-200/60 dark:hover:bg-zinc-700/70 transition-colors cursor-pointer"
                        >
                          {copiedNote ? (
                            <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={handleExportMarkdown}
                          title="Export as Markdown (.md)"
                          aria-label="Export note as Markdown"
                          className="p-1.5 rounded-md text-zinc-500 dark:text-zinc-400 hover:bg-zinc-200/60 dark:hover:bg-zinc-700/70 transition-colors cursor-pointer"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Writing Canvas */}
                    <div className="flex-1 min-h-0 overflow-y-auto px-6 sm:px-10 py-7">
                      <div className="max-w-3xl mx-auto h-full flex flex-col">
                        <input
                          type="text"
                          value={activeNote.title}
                          onChange={(e) => updateNote(activeNote.id, { title: e.target.value })}
                          placeholder="Note title"
                          aria-label="Note title"
                          className="font-display text-2xl sm:text-[28px] font-semibold tracking-tight text-zinc-950 dark:text-white placeholder:text-zinc-300 dark:placeholder:text-zinc-600 bg-transparent border-0 focus:outline-none w-full"
                        />

                        {/* Clean unboxed metadata row */}
                        <div className="mt-2 pb-4 border-b border-zinc-200/70 dark:border-zinc-800 flex flex-wrap items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400 tabular-nums">
                          <span>{activeNote.notebook}</span>
                          <span aria-hidden="true">·</span>
                          <span>Edited {formatRelativeTime(activeNote.updatedAt)}</span>
                          <span aria-hidden="true">·</span>
                          <span>{stats.words} words</span>
                          <span aria-hidden="true">·</span>
                          <span>{stats.readMins} min read</span>
                        </div>

                        {/* Editor vs Markdown Preview */}
                        {editorMode === 'edit' ? (
                          <div className="flex-1 flex flex-col pt-5 min-h-[300px]">
                            <textarea
                              ref={textareaRef}
                              value={activeNote.content}
                              onChange={(e) => {
                                updateNote(activeNote.id, { content: e.target.value });
                                if (inlineSuggestion) setInlineSuggestion('');
                              }}
                              onSelect={(e) => {
                                const target = e.currentTarget;
                                const slice = target.value.slice(
                                  target.selectionStart,
                                  target.selectionEnd
                                );
                                setSelectedText(slice);
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Tab' && inlineSuggestion) {
                                  e.preventDefault();
                                  acceptInlineSuggestion();
                                } else if (e.key === 'Escape' && inlineSuggestion) {
                                  e.preventDefault();
                                  setInlineSuggestion('');
                                }
                              }}
                              placeholder="Start writing your note... Press Alt+/ anytime for an AI continuation."
                              aria-label="Note content editor"
                              className="flex-1 w-full resize-none bg-transparent text-[15px] leading-[1.7] text-zinc-800 dark:text-zinc-200 placeholder:text-zinc-400 dark:placeholder:text-zinc-600 focus:outline-none"
                            />

                            {/* Non-intrusive Inline AI Ghost Suggestion Bar */}
                            {inlineSuggestion && (
                              <div className="mt-3 p-3 rounded-lg bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700 flex items-center justify-between gap-3">
                                <div className="min-w-0 flex-1">
                                  <div className="text-[11px] font-medium text-[#0067C0] dark:text-[#4CC2FF] mb-0.5">
                                    Gemini Suggestion
                                  </div>
                                  <p className="text-[13px] text-zinc-700 dark:text-zinc-200 italic truncate">
                                    {inlineSuggestion}
                                  </p>
                                </div>
                                <div className="flex items-center gap-1.5 shrink-0">
                                  <button
                                    type="button"
                                    onClick={acceptInlineSuggestion}
                                    className="px-2.5 py-1 rounded text-xs font-medium bg-[#0067C0] hover:bg-[#005A9E] dark:bg-[#4CC2FF] dark:hover:bg-[#3CB4F0] text-white dark:text-zinc-950 transition-colors cursor-pointer whitespace-nowrap"
                                  >
                                    Insert (Tab)
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setInlineSuggestion('')}
                                    className="px-2 py-1 rounded text-xs text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 cursor-pointer whitespace-nowrap"
                                  >
                                    Dismiss
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="pt-5 pb-10">
                            <MarkdownPreview
                              content={activeNote.content}
                              onToggleCheckbox={handleToggleCheckbox}
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-3">
                    <NotebookPen className="w-10 h-10 text-zinc-300 dark:text-zinc-600" />
                    <h2 className="font-display text-lg font-semibold text-zinc-800 dark:text-zinc-200">
                      No note selected
                    </h2>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400 max-w-sm">
                      Choose a note from the sidebar or start a fresh page with Gemini AI suggestions.
                    </p>
                    <button
                      type="button"
                      onClick={() => handleCreateNote()}
                      className="px-4 py-2 rounded-md text-xs font-medium bg-[#0067C0] hover:bg-[#005A9E] dark:bg-[#4CC2FF] dark:hover:bg-[#3CB4F0] text-white dark:text-zinc-950 transition-colors cursor-pointer"
                    >
                      Create First Note
                    </button>
                  </div>
                )}
              </main>

              {/* Right Gemini AI Suggestions & Copilot Pane */}
              {showAiPane && activeNote && (
                <div className="max-lg:absolute max-lg:inset-y-0 max-lg:right-0 max-lg:z-20 max-lg:shadow-2xl h-full flex">
                  <AiAssistantPane
                    noteTitle={activeNote.title}
                    noteContent={activeNote.content}
                    selectedText={selectedText}
                    analysis={analysisByNote[activeNote.id] ?? null}
                    analyzing={analyzing}
                    analysisError={analysisError}
                    transformOutput={transformOutput}
                    transformLabel={transformLabel}
                    transforming={transforming}
                    transformError={transformError}
                    chatMessages={chatsByNote[activeNote.id] ?? []}
                    asking={asking}
                    askError={askError}
                    onAnalyze={handleAnalyzeNote}
                    onApplyTitle={(title) => updateNote(activeNote.id, { title })}
                    onApplyNotebook={(nb) => updateNote(activeNote.id, { notebook: nb })}
                    onDraftSuggestion={(hint, label) =>
                      handleRunTransform('expand_suggestion', label, undefined, hint)
                    }
                    onInsertChecklist={(items) => {
                      const checklist = items.map((item) => `- [ ] ${item}`).join('\n');
                      handleInsertText(`## Action Items\n${checklist}`);
                    }}
                    onRunTransform={(action, label, lang) =>
                      handleRunTransform(action, label, lang)
                    }
                    onInsertText={handleInsertText}
                    onReplaceText={handleReplaceText}
                    onCreateNoteFromText={(title, text) =>
                      handleCreateNote(title, text, activeNote.notebook)
                    }
                    onClearTransform={() => {
                      setTransformOutput('');
                      setTransformError(null);
                    }}
                    onAskSubmit={handleAskSubmit}
                    onClearChat={() =>
                      setChatsByNote((prev) => ({ ...prev, [activeNote.id]: [] }))
                    }
                  />
                </div>
              )}

              {/* Undo Delete Notification Banner */}
              {deletedBanner && (
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-3 px-4 py-2 rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 shadow-lg text-xs">
                  <span>
                    Deleted &ldquo;{deletedBanner.note.title.trim() || 'Untitled Note'}&rdquo;
                  </span>
                  <button
                    type="button"
                    onClick={handleUndoDelete}
                    className="font-semibold text-[#4CC2FF] dark:text-[#0067C0] hover:underline cursor-pointer"
                  >
                    Undo
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeletedBanner(null)}
                    aria-label="Dismiss"
                    className="opacity-70 hover:opacity-100 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Windows 11 Acrylic Taskbar */}
      <Taskbar
        windowState={windowState}
        isDark={isDark}
        onToggleWindow={() =>
          setWindowState((prev) =>
            prev === 'minimized' || prev === 'closed' ? 'windowed' : 'minimized'
          )
        }
        onQuickNewNote={() => handleCreateNote()}
        onQuickSearch={() => {
          if (!isWindowVisible) setWindowState('windowed');
          setShowSidebar(true);
          requestAnimationFrame(() => searchInputRef.current?.focus());
        }}
        onToggleTheme={() => setIsDark((v) => !v)}
      />
    </div>
  );
}
