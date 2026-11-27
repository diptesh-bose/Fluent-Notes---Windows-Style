import React from 'react';
import { Check } from 'lucide-react';

interface MarkdownPreviewProps {
  content: string;
  onToggleCheckbox?: (lineIndex: number) => void;
}

function renderInline(text: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  const tokenRegex = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let keyIdx = 0;

  while ((match = tokenRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }
    const token = match[0];
    if (token.startsWith('**') && token.endsWith('**')) {
      nodes.push(
        <strong key={`b-${keyIdx++}`} className="font-semibold text-zinc-900 dark:text-zinc-50">
          {token.slice(2, -2)}
        </strong>
      );
    } else if (token.startsWith('*') && token.endsWith('*')) {
      nodes.push(
        <em key={`i-${keyIdx++}`} className="italic">
          {token.slice(1, -1)}
        </em>
      );
    } else if (token.startsWith('`') && token.endsWith('`')) {
      nodes.push(
        <code
          key={`c-${keyIdx++}`}
          className="font-mono text-[0.875em] px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 border border-zinc-200/70 dark:border-zinc-700/70"
        >
          {token.slice(1, -1)}
        </code>
      );
    }
    lastIndex = match.index + token.length;
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }
  return nodes;
}

export const MarkdownPreview: React.FC<MarkdownPreviewProps> = ({
  content,
  onToggleCheckbox,
}) => {
  if (!content.trim()) {
    return (
      <p className="text-sm text-zinc-400 dark:text-zinc-500 italic">
        Nothing written yet. Switch to Edit mode to start typing or use Gemini AI to draft an outline.
      </p>
    );
  }

  const lines = content.split(/\r?\n/);
  const elements: React.ReactNode[] = [];
  let inCodeBlock = false;
  let codeLines: string[] = [];

  for (let idx = 0; idx < lines.length; idx++) {
    const line = lines[idx];

    if (line.trim().startsWith('```')) {
      if (!inCodeBlock) {
        inCodeBlock = true;
        codeLines = [];
      } else {
        inCodeBlock = false;
        elements.push(
          <pre
            key={`code-${idx}`}
            className="my-3 p-3.5 rounded-lg bg-zinc-100/90 dark:bg-zinc-900/90 border border-zinc-200 dark:border-zinc-800 overflow-x-auto font-mono text-[13px] leading-relaxed text-zinc-800 dark:text-zinc-200"
          >
            <code>{codeLines.join('\n')}</code>
          </pre>
        );
      }
      continue;
    }

    if (inCodeBlock) {
      codeLines.push(line);
      continue;
    }

    const trimmed = line.trim();
    if (!trimmed) {
      elements.push(<div key={`sp-${idx}`} className="h-3" />);
      continue;
    }

    if (trimmed.startsWith('### ')) {
      elements.push(
        <h3
          key={`h3-${idx}`}
          className="font-display text-base font-semibold text-zinc-900 dark:text-zinc-100 mt-5 mb-1.5"
        >
          {renderInline(trimmed.slice(4))}
        </h3>
      );
      continue;
    }

    if (trimmed.startsWith('## ')) {
      elements.push(
        <h2
          key={`h2-${idx}`}
          className="font-display text-xl font-semibold text-zinc-900 dark:text-zinc-50 mt-6 mb-2 pb-1 border-b border-zinc-200/70 dark:border-zinc-800"
        >
          {renderInline(trimmed.slice(3))}
        </h2>
      );
      continue;
    }

    if (trimmed.startsWith('# ')) {
      elements.push(
        <h1
          key={`h1-${idx}`}
          className="font-display text-2xl font-bold text-zinc-950 dark:text-white mt-6 mb-2.5"
        >
          {renderInline(trimmed.slice(2))}
        </h1>
      );
      continue;
    }

    const checkMatch = /^-\s+\[([ xX])\]\s+(.*)$/.exec(trimmed);
    if (checkMatch) {
      const checked = checkMatch[1].toLowerCase() === 'x';
      const label = checkMatch[2];
      elements.push(
        <div key={`chk-${idx}`} className="flex items-start gap-2.5 py-1">
          <button
            type="button"
            onClick={() => onToggleCheckbox?.(idx)}
            aria-label={checked ? 'Mark task incomplete' : 'Mark task complete'}
            className={`mt-0.5 w-4 h-4 rounded-[4px] border flex items-center justify-center shrink-0 transition-colors cursor-pointer ${
              checked
                ? 'bg-[#0067C0] dark:bg-[#4CC2FF] border-[#0067C0] dark:border-[#4CC2FF] text-white dark:text-zinc-950'
                : 'border-zinc-400 dark:border-zinc-500 hover:border-[#0067C0] dark:hover:border-[#4CC2FF]'
            }`}
          >
            {checked && <Check className="w-3 h-3 stroke-[2.5]" />}
          </button>
          <span
            className={`text-[15px] leading-relaxed ${
              checked
                ? 'line-through text-zinc-400 dark:text-zinc-500'
                : 'text-zinc-800 dark:text-zinc-200'
            }`}
          >
            {renderInline(label)}
          </span>
        </div>
      );
      continue;
    }

    if (/^[-*]\s+/.test(trimmed)) {
      elements.push(
        <div key={`ul-${idx}`} className="flex items-start gap-2.5 py-0.5 pl-1">
          <span className="mt-2.5 w-1.5 h-1.5 rounded-full bg-zinc-400 dark:bg-zinc-500 shrink-0" />
          <p className="text-[15px] leading-relaxed text-zinc-800 dark:text-zinc-200">
            {renderInline(trimmed.replace(/^[-*]\s+/, ''))}
          </p>
        </div>
      );
      continue;
    }

    const numMatch = /^(\d+)\.\s+(.*)$/.exec(trimmed);
    if (numMatch) {
      elements.push(
        <div key={`ol-${idx}`} className="flex items-start gap-2.5 py-0.5 pl-1">
          <span className="text-[14px] font-medium tabular-nums text-zinc-500 dark:text-zinc-400 min-w-[1.25rem] mt-0.5">
            {numMatch[1]}.
          </span>
          <p className="text-[15px] leading-relaxed text-zinc-800 dark:text-zinc-200">
            {renderInline(numMatch[2])}
          </p>
        </div>
      );
      continue;
    }

    if (trimmed.startsWith('> ')) {
      elements.push(
        <blockquote
          key={`bq-${idx}`}
          className="my-2 px-3.5 py-2 rounded-lg bg-zinc-100/70 dark:bg-zinc-800/50 border border-zinc-200/80 dark:border-zinc-700/70 text-[15px] italic text-zinc-700 dark:text-zinc-300"
        >
          {renderInline(trimmed.slice(2))}
        </blockquote>
      );
      continue;
    }

    elements.push(
      <p key={`p-${idx}`} className="text-[15px] leading-[1.7] text-zinc-800 dark:text-zinc-200">
        {renderInline(line)}
      </p>
    );
  }

  return <div className="space-y-0.5">{elements}</div>;
};
