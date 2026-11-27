import React from 'react';
import { Copy, FilePlus2, Pin, PinOff, Search, Trash2, X } from 'lucide-react';
import type { NotebookCategory, NoteItem } from '../types/notes';
import { formatRelativeTime } from '../data/starterNotes';

export type SidebarFilter = 'All' | 'Pinned' | NotebookCategory;

interface NotesSidebarProps {
  notes: NoteItem[];
  activeNoteId: string;
  filter: SidebarFilter;
  searchQuery: string;
  searchInputRef: React.RefObject<HTMLInputElement | null>;
  onFilterChange: (filter: SidebarFilter) => void;
  onSearchChange: (q: string) => void;
  onSelectNote: (id: string) => void;
  onCreateNote: () => void;
  onTogglePin: (id: string) => void;
  onDuplicateNote: (id: string) => void;
  onDeleteNote: (id: string) => void;
}

const FILTER_OPTIONS: SidebarFilter[] = ['All', 'Pinned', 'Work', 'Personal', 'Ideas', 'Journal'];

export const NotesSidebar: React.FC<NotesSidebarProps> = ({
  notes,
  activeNoteId,
  filter,
  searchQuery,
  searchInputRef,
  onFilterChange,
  onSearchChange,
  onSelectNote,
  onCreateNote,
  onTogglePin,
  onDuplicateNote,
  onDeleteNote,
}) => {
  return (
    <aside className="w-72 shrink-0 h-full flex flex-col bg-[#F3F3F3]/85 dark:bg-[#202020]/85 border-r border-zinc-200/80 dark:border-zinc-800/90 select-none">
      {/* Top action & search */}
      <div className="p-3.5 space-y-2.5 border-b border-zinc-200/70 dark:border-zinc-800/80">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400 tabular-nums">
            {notes.length} {notes.length === 1 ? 'note' : 'notes'}
          </span>
          <button
            type="button"
            onClick={onCreateNote}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-[#0067C0] hover:bg-[#005A9E] dark:bg-[#4CC2FF] dark:hover:bg-[#3CB4F0] text-white dark:text-zinc-950 transition-colors cursor-pointer whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0067C0]"
            title="New Note (Ctrl+N)"
          >
            <FilePlus2 className="w-3.5 h-3.5" />
            <span>New Note</span>
          </button>
        </div>

        {/* Fluent Search Box */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-zinc-400 dark:text-zinc-500 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search notes (Ctrl+K)"
            aria-label="Search notes"
            className="w-full pl-8 pr-7 py-1.5 text-[13px] rounded-md bg-white/90 dark:bg-zinc-900/80 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 border border-zinc-200/90 dark:border-zinc-700/80 border-b-zinc-300 dark:border-b-zinc-600 focus:outline-none focus:border-[#0067C0] dark:focus:border-[#4CC2FF] transition-colors"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => onSearchChange('')}
              aria-label="Clear search"
              className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Notebook / View Filter Tabs */}
        <div
          className="flex items-center gap-1 overflow-x-auto pb-0.5 no-scrollbar"
          role="tablist"
          aria-label="Filter notes by notebook"
        >
          {FILTER_OPTIONS.map((item) => {
            const active = filter === item;
            return (
              <button
                key={item}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => onFilterChange(item)}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  active
                    ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-xs border border-zinc-200/80 dark:border-zinc-700/80'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 hover:bg-zinc-200/50 dark:hover:bg-zinc-800/50'
                }`}
              >
                {item}
              </button>
            );
          })}
        </div>
      </div>

      {/* Scrollable Notes List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {notes.length === 0 ? (
          <div className="px-4 py-10 text-center space-y-3">
            <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              {searchQuery ? 'No matching notes' : 'No notes in this view'}
            </p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
              {searchQuery
                ? 'Try a different keyword or clear the active filter.'
                : 'Start capturing ideas, meeting highlights, or tasks.'}
            </p>
            <button
              type="button"
              onClick={() => {
                if (searchQuery) {
                  onSearchChange('');
                  onFilterChange('All');
                } else {
                  onCreateNote();
                }
              }}
              className="px-3 py-1.5 text-xs font-medium rounded-md bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-800 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors cursor-pointer"
            >
              {searchQuery ? 'Reset Filters' : 'Create Note'}
            </button>
          </div>
        ) : (
          notes.map((note) => {
            const isSelected = note.id === activeNoteId;
            const snippet = note.content
              .replace(/^#+\s+/gm, '')
              .replace(/-\s+\[[ xX]\]\s+/g, '')
              .replace(/\*\*/g, '')
              .trim();

            return (
              <div
                key={note.id}
                className={`group relative rounded-lg p-2.5 transition-colors cursor-pointer border ${
                  isSelected
                    ? 'bg-white dark:bg-[#2B2B2B] border-zinc-200/90 dark:border-zinc-700/80 shadow-xs'
                    : 'border-transparent hover:bg-white/60 dark:hover:bg-zinc-800/50'
                }`}
                onClick={() => onSelectNote(note.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onSelectNote(note.id);
                  }
                }}
              >
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-[13px] font-semibold text-zinc-900 dark:text-zinc-100 truncate leading-snug">
                    {note.title.trim() || 'Untitled Note'}
                  </h3>
                  {note.pinned && (
                    <Pin className="w-3 h-3 text-[#0067C0] dark:text-[#4CC2FF] shrink-0 mt-0.5" />
                  )}
                </div>

                <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400 line-clamp-2 leading-relaxed">
                  {snippet || 'Empty note'}
                </p>

                <div className="mt-2 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 text-[11px] text-zinc-400 dark:text-zinc-500 tabular-nums truncate">
                    <span>{note.notebook}</span>
                    <span aria-hidden="true">·</span>
                    <span>{formatRelativeTime(note.updatedAt)}</span>
                  </div>

                  {/* Subtle row actions on hover or selected */}
                  <div
                    className={`flex items-center gap-0.5 transition-opacity ${
                      isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 focus-within:opacity-100'
                    }`}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      type="button"
                      onClick={() => onTogglePin(note.id)}
                      title={note.pinned ? 'Unpin note' : 'Pin note'}
                      aria-label={note.pinned ? 'Unpin note' : 'Pin note'}
                      className="p-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-100 cursor-pointer"
                    >
                      {note.pinned ? <PinOff className="w-3 h-3" /> : <Pin className="w-3 h-3" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => onDuplicateNote(note.id)}
                      title="Duplicate note"
                      aria-label="Duplicate note"
                      className="p-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-100 cursor-pointer"
                    >
                      <Copy className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteNote(note.id)}
                      title="Delete note"
                      aria-label="Delete note"
                      className="p-1 rounded hover:bg-red-50 dark:hover:bg-red-950/50 text-zinc-500 dark:text-zinc-400 hover:text-red-600 dark:hover:text-red-400 cursor-pointer"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </aside>
  );
};
