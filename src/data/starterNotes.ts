import type { NoteItem } from '../types/notes';

const now = Date.now();
const min = 60 * 1000;
const hour = 60 * min;

export const STARTER_NOTES: NoteItem[] = [
  {
    id: 'note-launch-sync',
    title: 'Q4 Desktop Release & Onboarding Sync',
    notebook: 'Work',
    pinned: true,
    createdAt: now - 3 * hour,
    updatedAt: now - 14 * min,
    content: `## Meeting Highlights
Reviewed rollout readiness for the Windows 11 desktop client with design and engineering leads. Focus for this sprint is reducing cold-start latency and tightening keyboard shortcuts across the editor.

- Confirmed keyboard shortcut parity: Ctrl+N for new note, Ctrl+K for quick search, Tab to accept inline AI writing suggestions.
- Finalized Mica translucency contrast checks for both Light and Dark system themes.
- Need to confirm telemetry opt-in copy with legal before Friday afternoon.

## Next Steps
- [ ] Share updated keyboard shortcut sheet with beta testers
- [ ] Benchmark startup memory footprint on 8GB laptops
- [ ] Draft release changelog for early-access cohort`,
  },
  {
    id: 'note-fluent-architecture',
    title: 'Local-First Notes & AI Suggestion Patterns',
    notebook: 'Ideas',
    pinned: false,
    createdAt: now - 26 * hour,
    updatedAt: now - 4 * hour,
    content: `## Core Principle
AI assistance inside a note editor should feel quiet, optional, and instantaneous—never interrupting a train of thought with modal popups.

### Three Useful Touchpoints
1. **Ghost Inline Completion**: Offer the next few words only when the writer pauses at a natural boundary. Tab accepts, Esc dismisses, continuing to type ignores it effortlessly.
2. **Proactive Side Analysis**: On demand, extract hidden tasks, suggest sharper titles, and surface angles the writer may not have considered yet.
3. **One-Click Restructure**: Turn messy meeting scratchpads into clean checklists or executive summaries without leaving the document.`,
  },
  {
    id: 'note-mountain-weekend',
    title: 'Cascade Loop Weekend Packing & Route',
    notebook: 'Personal',
    pinned: false,
    createdAt: now - 48 * hour,
    updatedAt: now - 19 * hour,
    content: `Leaving Saturday at 6:30 AM to beat highway traffic before the pass. Forecast calls for crisp 42°F mornings and clear skies along the ridge.

- [ ] Pack insulated shell, wool mid-layer, and waterproof gloves
- [ ] Download offline trail maps before losing cell reception
- [ ] Charge camera batteries and pack 35mm prime lens
- [ ] Pick up espresso beans and trail snacks on Friday evening

Stop at the overlook bakery around 9:15 AM for breakfast before starting the upper loop trail.`,
  },
  {
    id: 'note-daily-reflection',
    title: 'Weekly Focus & Reading Notes',
    notebook: 'Journal',
    pinned: false,
    createdAt: now - 72 * hour,
    updatedAt: now - 36 * hour,
    content: `Finished reading the chapter on calm software interfaces this morning. The best desktop tools stay predictable under pressure: clear visual hierarchy, crisp spacing, and zero visual noise competing with your own words.

For next week, protect two uninterrupted 90-minute mornings for deep writing before checking messages.`,
  },
];

export function formatRelativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp;
  if (diff < 60_000) return 'Just now';
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(timestamp).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

export function getWordStats(text: string): { words: number; chars: number; readMins: number } {
  const trimmed = text.trim();
  const words = trimmed ? trimmed.split(/\s+/).length : 0;
  const chars = text.length;
  const readMins = Math.max(1, Math.ceil(words / 200));
  return { words, chars, readMins };
}
