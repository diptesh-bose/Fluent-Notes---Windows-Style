import React, { useEffect, useState } from 'react';
import { FilePlus2, NotebookPen, Search, Sun, Moon } from 'lucide-react';

interface TaskbarProps {
  windowState: 'windowed' | 'maximized' | 'minimized' | 'closed';
  isDark: boolean;
  onToggleWindow: () => void;
  onQuickNewNote: () => void;
  onQuickSearch: () => void;
  onToggleTheme: () => void;
}

export const Taskbar: React.FC<TaskbarProps> = ({
  windowState,
  isDark,
  onToggleWindow,
  onQuickNewNote,
  onQuickSearch,
  onToggleTheme,
}) => {
  const [now, setNow] = useState<Date>(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 15_000);
    return () => clearInterval(timer);
  }, []);

  const timeString = now.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });
  const dateString = now.toLocaleDateString('en-US', {
    month: 'numeric',
    day: 'numeric',
    year: 'numeric',
  });

  const isAppOpen = windowState === 'windowed' || windowState === 'maximized';

  return (
    <footer className="h-11 w-full shrink-0 px-3 flex items-center justify-between bg-[#F3F3F3]/85 dark:bg-[#1C1C1C]/85 backdrop-blur-2xl border-t border-white/60 dark:border-white/10 select-none z-30">
      {/* Left spacer / quick weather-free minimalist desktop label */}
      <div className="hidden sm:flex items-center gap-2 min-w-[140px]">
        <button
          type="button"
          onClick={onToggleTheme}
          title={isDark ? 'Switch to Windows Light mode' : 'Switch to Windows Dark mode'}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs text-zinc-700 dark:text-zinc-300 hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer whitespace-nowrap shrink-0"
        >
          {isDark ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
          <span>{isDark ? 'Dark' : 'Light'}</span>
        </button>
      </div>

      {/* Centered Windows 11 Taskbar Icons */}
      <div className="flex items-center gap-1.5 mx-auto">
        {/* Windows 11 Start-inspired Emblem */}
        <button
          type="button"
          onClick={onToggleWindow}
          title="Show or restore Fluent Notes"
          aria-label="Windows Start / Restore App"
          className="w-9 h-9 rounded-md flex items-center justify-center hover:bg-black/6 dark:hover:bg-white/10 transition-colors cursor-pointer"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" aria-hidden="true">
            <rect x="2" y="2" width="9" height="9" rx="1" fill="#0078D4" />
            <rect x="13" y="2" width="9" height="9" rx="1" fill="#0078D4" />
            <rect x="2" y="13" width="9" height="9" rx="1" fill="#0078D4" />
            <rect x="13" y="13" width="9" height="9" rx="1" fill="#0078D4" />
          </svg>
        </button>

        {/* Pinned Search Trigger */}
        <button
          type="button"
          onClick={onQuickSearch}
          title="Search Notes (Ctrl+K)"
          aria-label="Search Notes"
          className="w-9 h-9 rounded-md flex items-center justify-center text-zinc-700 dark:text-zinc-200 hover:bg-black/6 dark:hover:bg-white/10 transition-colors cursor-pointer"
        >
          <Search className="w-4 h-4" />
        </button>

        {/* Fluent Notes Pinned App Button */}
        <button
          type="button"
          onClick={onToggleWindow}
          title={isAppOpen ? 'Minimize Fluent Notes' : 'Open Fluent Notes'}
          aria-label="Fluent Notes taskbar button"
          className={`relative w-9 h-9 rounded-md flex items-center justify-center transition-colors cursor-pointer ${
            isAppOpen
              ? 'bg-white/80 dark:bg-white/12 shadow-xs border border-black/5 dark:border-white/10'
              : 'hover:bg-black/6 dark:hover:bg-white/10'
          }`}
        >
          <NotebookPen className="w-4 h-4 text-[#0067C0] dark:text-[#4CC2FF]" />
          {windowState !== 'closed' && (
            <span
              className={`absolute bottom-1 rounded-full transition-all ${
                isAppOpen
                  ? 'w-4 h-[3px] bg-[#0067C0] dark:bg-[#4CC2FF]'
                  : 'w-1.5 h-[3px] bg-zinc-400 dark:bg-zinc-500'
              }`}
            />
          )}
        </button>

        {/* Quick New Note Trigger */}
        <button
          type="button"
          onClick={onQuickNewNote}
          title="Quick New Note (Ctrl+N)"
          aria-label="Quick New Note"
          className="w-9 h-9 rounded-md flex items-center justify-center text-zinc-700 dark:text-zinc-200 hover:bg-black/6 dark:hover:bg-white/10 transition-colors cursor-pointer"
        >
          <FilePlus2 className="w-4 h-4" />
        </button>
      </div>

      {/* Right System Tray Clock & Date */}
      <div className="min-w-[140px] flex items-center justify-end pr-1">
        <div className="text-right leading-tight tabular-nums px-2 py-1 rounded-md hover:bg-black/5 dark:hover:bg-white/10 transition-colors">
          <div className="text-[11px] font-medium text-zinc-800 dark:text-zinc-100">
            {timeString}
          </div>
          <div className="text-[10px] text-zinc-600 dark:text-zinc-400">{dateString}</div>
        </div>
      </div>
    </footer>
  );
};
