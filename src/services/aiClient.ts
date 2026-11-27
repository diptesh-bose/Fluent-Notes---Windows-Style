import type { ChatMessage, NoteAnalysis, TransformAction } from '../types/notes';

async function postJson<T>(url: string, body: Record<string, unknown>, signal?: AbortSignal): Promise<T> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message =
      typeof payload?.error === 'string' && payload.error.trim()
        ? payload.error
        : `Request failed with status ${response.status}`;
    throw new Error(message);
  }
  return payload as T;
}

export async function analyzeNote(params: {
  title: string;
  content: string;
  notebook: string;
}): Promise<NoteAnalysis> {
  return postJson<NoteAnalysis>('/api/ai/analyze', params);
}

export async function transformNote(params: {
  title: string;
  content: string;
  selectedText?: string;
  action: TransformAction;
  targetLanguage?: string;
  customInstruction?: string;
}): Promise<{ result: string }> {
  return postJson<{ result: string }>('/api/ai/transform', params);
}

export async function fetchInlineAutocomplete(
  params: { title: string; contentBeforeCursor: string },
  signal?: AbortSignal
): Promise<{ suggestion: string }> {
  return postJson<{ suggestion: string }>('/api/ai/autocomplete', params, signal);
}

export async function askNoteAssistant(params: {
  title: string;
  content: string;
  question: string;
  history: Array<Pick<ChatMessage, 'role' | 'text'>>;
}): Promise<{ answer: string }> {
  return postJson<{ answer: string }>('/api/ai/ask', params);
}
