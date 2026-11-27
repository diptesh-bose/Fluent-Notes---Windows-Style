export type NotebookCategory = 'Work' | 'Personal' | 'Ideas' | 'Journal';

export interface NoteItem {
  id: string;
  title: string;
  content: string;
  notebook: NotebookCategory;
  pinned: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface WritingSuggestion {
  label: string;
  rationale: string;
  promptHint: string;
}

export interface NoteAnalysis {
  suggestedTitle: string;
  summary: string;
  recommendedNotebook: NotebookCategory;
  writingSuggestions: WritingSuggestion[];
  actionItems: string[];
  keyThemes: string[];
}

export type TransformAction =
  | 'summarize'
  | 'continue'
  | 'polish'
  | 'concise'
  | 'actions'
  | 'bullets'
  | 'outline'
  | 'professional'
  | 'casual'
  | 'translate'
  | 'expand_suggestion';

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
}
