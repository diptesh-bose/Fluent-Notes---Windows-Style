import 'dotenv/config';
import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const MODEL_NAME = 'gemini-4-hydrogen';

function getAiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    throw new Error(
      'GEMINI_API_KEY is not configured. Please add your Gemini API key in Settings > Secrets.'
    );
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

async function withRetry<T>(fn: () => Promise<T>, maxAttempts = 3): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err: unknown) {
      lastError = err;
      const status =
        typeof err === 'object' && err !== null && 'status' in err
          ? Number((err as { status?: unknown }).status)
          : 0;
      const isRetryable = status === 429 || (status >= 500 && status < 600);
      if (!isRetryable || attempt === maxAttempts - 1) {
        throw err;
      }
      const delayMs = 400 * Math.pow(2, attempt);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  throw lastError;
}

function formatError(err: unknown): { status: number; message: string } {
  if (err instanceof Error) {
    const anyErr = err as Error & { status?: number };
    const status = typeof anyErr.status === 'number' && anyErr.status >= 400 ? anyErr.status : 500;
    if (anyErr.message.includes('PERMISSION_DENIED') || status === 403) {
      return {
        status: 403,
        message: 'Gemini API permission denied. Please verify your API key in Settings > Secrets.',
      };
    }
    if (anyErr.message.includes('API_KEY_INVALID') || status === 400) {
      return {
        status: 400,
        message: anyErr.message || 'Invalid request or API key. Check Settings > Secrets.',
      };
    }
    if (anyErr.message.includes('RESOURCE_EXHAUSTED') || status === 429) {
      return {
        status: 429,
        message: 'Gemini API rate limit reached. Please try again in a few moments.',
      };
    }
    return { status, message: anyErr.message };
  }
  return { status: 500, message: 'An unexpected server error occurred while calling Gemini.' };
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  // 1. Analyze note & return structured proactive AI suggestions
  app.post('/api/ai/analyze', async (req, res) => {
    try {
      const { title = '', content = '', notebook = 'Work' } = req.body ?? {};
      const trimmed = String(content).trim();
      if (!trimmed && !String(title).trim()) {
        res.status(400).json({ error: 'Write a few words in your note before analyzing.' });
        return;
      }

      const ai = getAiClient();
      const response = await withRetry(() =>
        ai.models.generateContent({
          model: MODEL_NAME,
          contents: `Current Notebook: ${notebook}\nTitle: ${title || '(Untitled)'}\n\nNote Content:\n${trimmed}`,
          config: {
            thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
            systemInstruction:
              'You are an insightful, concise writing & productivity assistant inside a Windows 11 note-taking app. Analyze the user note and produce structured suggestions: a sharper title, a crisp 1-2 sentence summary, the best matching notebook ("Work", "Personal", "Ideas", or "Journal"), 3 concrete, specific writing/thinking suggestions tailored directly to the note content, any concrete action items implied by the text (up to 5, empty array if none), and 2 to 4 concise topic themes.',
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                suggestedTitle: {
                  type: Type.STRING,
                  description: 'A clear, concise title for this note.',
                },
                summary: {
                  type: Type.STRING,
                  description: 'A 1-2 sentence summary of the note.',
                },
                recommendedNotebook: {
                  type: Type.STRING,
                  description: 'One of: Work, Personal, Ideas, Journal',
                },
                writingSuggestions: {
                  type: Type.ARRAY,
                  description: 'Exactly 3 specific suggestions to expand, clarify, or improve this note.',
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      label: {
                        type: Type.STRING,
                        description: 'Short 3-6 word suggestion title.',
                      },
                      rationale: {
                        type: Type.STRING,
                        description: 'One concise sentence explaining why this helps.',
                      },
                      promptHint: {
                        type: Type.STRING,
                        description: 'Instruction used if the user clicks Draft to generate this addition.',
                      },
                    },
                  },
                },
                actionItems: {
                  type: Type.ARRAY,
                  description: 'Up to 5 actionable next steps found or implied in the note.',
                  items: { type: Type.STRING },
                },
                keyThemes: {
                  type: Type.ARRAY,
                  description: '2 to 4 short 1-2 word topic keywords.',
                  items: { type: Type.STRING },
                },
              },
            },
          },
        })
      );

      const raw = (response.text ?? '{}').trim();
      const parsed = JSON.parse(raw);
      res.json(parsed);
    } catch (err) {
      const { status, message } = formatError(err);
      res.status(status).json({ error: message });
    }
  });

  // 2. Transform / rewrite / continue / extract from note or selection
  app.post('/api/ai/transform', async (req, res) => {
    try {
      const {
        title = '',
        content = '',
        selectedText = '',
        action = 'summarize',
        targetLanguage = 'Spanish',
        customInstruction = '',
      } = req.body ?? {};

      const targetText = String(selectedText || content).trim();
      if (!targetText && !String(title).trim()) {
        res.status(400).json({ error: 'The note is empty. Add some text first.' });
        return;
      }

      const instructionMap: Record<string, string> = {
        summarize:
          'Summarize the provided text clearly in 2-4 concise sentences or tight Markdown bullet points. Output only the summary.',
        continue:
          'Continue writing seamlessly from the end of the note, matching its exact tone, voice, and Markdown formatting. Provide 1-2 helpful paragraphs or list items. Do not repeat existing text.',
        polish:
          'Fix grammar, spelling, punctuation, and awkward phrasing while preserving the author voice and Markdown structure. Output only the polished text.',
        concise:
          'Make the text noticeably more concise and direct without losing key facts or action items. Preserve Markdown formatting. Output only the tightened text.',
        actions:
          'Extract every explicit or implied task into clean Markdown checklist items (`- [ ] Task`). If none exist, suggest 2-3 logical next steps as `- [ ]` items. Output only the checklist.',
        bullets:
          'Restructure the text into clear, scannable Markdown bullet points grouped logically. Output only the formatted list.',
        outline:
          'Create a structured Markdown outline (`##` sections and `-` sub-bullets) based on the note topic and content. Output only the outline.',
        professional:
          'Rewrite the text in a crisp, clear, professional executive tone suitable for sharing with stakeholders. Output only the rewritten text.',
        casual:
          'Rewrite the text in a warm, natural, conversational tone while keeping all key information. Output only the rewritten text.',
        translate: `Translate the text accurately and naturally into ${String(targetLanguage || 'Spanish')}, preserving Markdown formatting. Output only the translation.`,
        expand_suggestion: `Based on the note context, draft a helpful new section or paragraph addressing this specific instruction: ${String(customInstruction)}. Match the note's Markdown style. Output only the new draft content.`,
      };

      const taskInstruction =
        instructionMap[action] ??
        'Improve and clarify the provided note text. Output only the result.';

      const ai = getAiClient();
      const response = await withRetry(() =>
        ai.models.generateContent({
          model: MODEL_NAME,
          contents: `Note Title: ${title || '(Untitled)'}\n\nTarget Text:\n${targetText || title}`,
          config: {
            thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
            systemInstruction: `You are a precision writing assistant in a desktop note-taking app. ${taskInstruction} Do not wrap the entire output in triple backticks unless it is code.`,
          },
        })
      );

      res.json({ result: (response.text ?? '').trim() });
    } catch (err) {
      const { status, message } = formatError(err);
      res.status(status).json({ error: message });
    }
  });

  // 3. Inline ghost-text autocomplete suggestion
  app.post('/api/ai/autocomplete', async (req, res) => {
    try {
      const { title = '', contentBeforeCursor = '' } = req.body ?? {};
      const context = String(contentBeforeCursor);
      if (context.trim().length < 12) {
        res.json({ suggestion: '' });
        return;
      }

      const tail = context.slice(-1200);
      const endsWithSpaceOrPunct = /[\s\n.,!?;:]$/.test(tail);

      const ai = getAiClient();
      const response = await withRetry(() =>
        ai.models.generateContent({
          model: MODEL_NAME,
          contents: `Note Title: ${title || '(Untitled)'}\n\nText written so far:\n${tail}`,
          config: {
            thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
            systemInstruction:
              'You provide subtle inline autocomplete continuations for a desktop notes editor. Output ONLY the immediate next few words or completion of the current sentence/bullet (6 to 18 words max). Never repeat words already at the end of the input. Never include quotes, explanations, or markdown fences. If the input ends mid-word, complete the word and phrase smoothly; if it ends with whitespace or newline, start the next natural phrase.',
          },
        })
      );

      let suggestion = (response.text ?? '').replace(/\r?\n/g, ' ').trim();
      if (!suggestion) {
        res.json({ suggestion: '' });
        return;
      }
      if (endsWithSpaceOrPunct && suggestion.startsWith(' ')) {
        suggestion = suggestion.trimStart();
      } else if (!endsWithSpaceOrPunct && !suggestion.startsWith(' ')) {
        // Keep leading space if the cursor didn't end with space/punctuation and suggestion starts a new word
        const lastChar = tail.slice(-1);
        if (/[a-zA-Z0-9)]/.test(lastChar) && /^[a-zA-Z0-9(]/.test(suggestion)) {
          suggestion = ' ' + suggestion;
        }
      }

      res.json({ suggestion });
    } catch (err) {
      const { status, message } = formatError(err);
      res.status(status).json({ error: message });
    }
  });

  // 4. Contextual Q&A / freeform prompt about the current note
  app.post('/api/ai/ask', async (req, res) => {
    try {
      const { title = '', content = '', question = '', history = [] } = req.body ?? {};
      const q = String(question).trim();
      if (!q) {
        res.status(400).json({ error: 'Please enter a question or instruction.' });
        return;
      }

      const ai = getAiClient();
      const safeHistory = Array.isArray(history)
        ? history
            .slice(-8)
            .filter(
              (m): m is { role: 'user' | 'model'; text: string } =>
                Boolean(m) &&
                (m.role === 'user' || m.role === 'model') &&
                typeof m.text === 'string'
            )
            .map((m) => ({
              role: m.role,
              parts: [{ text: m.text }],
            }))
        : [];

      const chat = ai.chats.create({
        model: MODEL_NAME,
        history: safeHistory,
        config: {
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          systemInstruction: `You are Gemini Assistant embedded inside Fluent Notes, a Windows 11 desktop note-taking app. The user is currently editing a note titled "${title || 'Untitled'}".\n\nCurrent Note Content:\n"""\n${String(content).slice(0, 12000)}\n"""\n\nHelp the user brainstorm, answer questions, draft sections, or transform this note concisely using clean Markdown.`,
        },
      });

      const response = await withRetry(() => chat.sendMessage({ message: q }));
      res.json({ answer: (response.text ?? '').trim() });
    } catch (err) {
      const { status, message } = formatError(err);
      res.status(status).json({ error: message });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      const indexHtml = path.join(distPath, 'index.html');
      if (fs.existsSync(indexHtml)) {
        res.sendFile(indexHtml);
      } else {
        res.status(404).send('Build output not found.');
      }
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Fluent Notes server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
