import { useState, useEffect } from 'react';
import { Eye, Code, FileText } from 'lucide-react';

interface MarkdownViewerProps {
  filePath: string;
  content: string;
  onContentChange?: (content: string) => void;
}

export function isMarkdownFile(filePath: string): boolean {
  const ext = filePath.toLowerCase().slice(filePath.lastIndexOf('.'));
  return ['.md', '.markdown', '.mdx'].includes(ext);
}

export function MarkdownViewer({ filePath, content, onContentChange }: MarkdownViewerProps) {
  const [viewMode, setViewMode] = useState<'preview' | 'source'>('preview');

  const fileName = filePath.split('/').pop() || filePath;

  // Parse and render markdown
  const renderMarkdown = (text: string) => {
    const lines = text.split('\n');
    const elements: React.ReactNode[] = [];
    let i = 0;
    let key = 0;

    while (i < lines.length) {
      const line = lines[i];

      // Code blocks
      if (line.startsWith('```')) {
        const lang = line.slice(3).trim();
        const codeLines: string[] = [];
        i++;
        while (i < lines.length && !lines[i].startsWith('```')) {
          codeLines.push(lines[i]);
          i++;
        }
        elements.push(
          <div key={key++} className="my-3 rounded-lg overflow-hidden bg-bg-tertiary border border-border-primary">
            {lang && (
              <div className="px-3 py-1 text-[10px] text-text-muted bg-bg-secondary border-b border-border-primary">
                {lang}
              </div>
            )}
            <pre className="p-3 overflow-x-auto">
              <code className="text-sm font-mono text-text-primary">
                {codeLines.join('\n')}
              </code>
            </pre>
          </div>
        );
        i++;
        continue;
      }

      // Headers
      if (line.startsWith('######')) {
        elements.push(<h6 key={key++} className="text-sm font-semibold text-text-primary mt-4 mb-2">{renderInline(line.slice(6).trim())}</h6>);
        i++;
        continue;
      }
      if (line.startsWith('#####')) {
        elements.push(<h5 key={key++} className="text-sm font-semibold text-text-primary mt-4 mb-2">{renderInline(line.slice(5).trim())}</h5>);
        i++;
        continue;
      }
      if (line.startsWith('####')) {
        elements.push(<h4 key={key++} className="text-base font-semibold text-text-primary mt-4 mb-2">{renderInline(line.slice(4).trim())}</h4>);
        i++;
        continue;
      }
      if (line.startsWith('###')) {
        elements.push(<h3 key={key++} className="text-lg font-semibold text-text-primary mt-5 mb-2">{renderInline(line.slice(3).trim())}</h3>);
        i++;
        continue;
      }
      if (line.startsWith('##')) {
        elements.push(<h2 key={key++} className="text-xl font-bold text-text-primary mt-6 mb-3 pb-1 border-b border-border-primary">{renderInline(line.slice(2).trim())}</h2>);
        i++;
        continue;
      }
      if (line.startsWith('#')) {
        elements.push(<h1 key={key++} className="text-2xl font-bold text-text-primary mt-6 mb-4">{renderInline(line.slice(1).trim())}</h1>);
        i++;
        continue;
      }

      // Horizontal rule
      if (/^(-{3,}|\*{3,}|_{3,})$/.test(line.trim())) {
        elements.push(<hr key={key++} className="my-6 border-border-primary" />);
        i++;
        continue;
      }

      // Blockquote
      if (line.startsWith('>')) {
        const quoteLines: string[] = [];
        while (i < lines.length && lines[i].startsWith('>')) {
          quoteLines.push(lines[i].slice(1).trim());
          i++;
        }
        elements.push(
          <blockquote key={key++} className="my-3 pl-4 border-l-4 border-accent-primary text-text-secondary italic">
            {quoteLines.map((l, idx) => <p key={idx}>{renderInline(l)}</p>)}
          </blockquote>
        );
        continue;
      }

      // Unordered list
      if (/^[-*+]\s/.test(line)) {
        const listItems: string[] = [];
        while (i < lines.length && /^[-*+]\s/.test(lines[i])) {
          listItems.push(lines[i].replace(/^[-*+]\s/, ''));
          i++;
        }
        elements.push(
          <ul key={key++} className="my-3 ml-6 list-disc space-y-1">
            {listItems.map((item, idx) => (
              <li key={idx} className="text-text-primary">{renderInline(item)}</li>
            ))}
          </ul>
        );
        continue;
      }

      // Ordered list
      if (/^\d+\.\s/.test(line)) {
        const listItems: string[] = [];
        while (i < lines.length && /^\d+\.\s/.test(lines[i])) {
          listItems.push(lines[i].replace(/^\d+\.\s/, ''));
          i++;
        }
        elements.push(
          <ol key={key++} className="my-3 ml-6 list-decimal space-y-1">
            {listItems.map((item, idx) => (
              <li key={idx} className="text-text-primary">{renderInline(item)}</li>
            ))}
          </ol>
        );
        continue;
      }

      // Empty line
      if (line.trim() === '') {
        elements.push(<div key={key++} className="h-2" />);
        i++;
        continue;
      }

      // Regular paragraph
      elements.push(
        <p key={key++} className="my-2 text-text-primary leading-relaxed">
          {renderInline(line)}
        </p>
      );
      i++;
    }

    return elements;
  };

  // Render inline elements (bold, italic, code, links, images)
  const renderInline = (text: string): React.ReactNode => {
    const parts: React.ReactNode[] = [];
    let remaining = text;
    let key = 0;

    while (remaining.length > 0) {
      // Image ![alt](url)
      const imgMatch = remaining.match(/!\[([^\]]*)\]\(([^)]+)\)/);
      // Link [text](url)
      const linkMatch = remaining.match(/\[([^\]]+)\]\(([^)]+)\)/);
      // Bold **text** or __text__
      const boldMatch = remaining.match(/\*\*(.+?)\*\*|__(.+?)__/);
      // Italic *text* or _text_
      const italicMatch = remaining.match(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)|(?<!_)_(?!_)(.+?)(?<!_)_(?!_)/);
      // Strikethrough ~~text~~
      const strikeMatch = remaining.match(/~~(.+?)~~/);
      // Code `text`
      const codeMatch = remaining.match(/`([^`]+)`/);

      // Find earliest match
      const matches = [
        { match: imgMatch, type: 'img', index: imgMatch ? remaining.indexOf(imgMatch[0]) : -1 },
        { match: linkMatch, type: 'link', index: linkMatch ? remaining.indexOf(linkMatch[0]) : -1 },
        { match: boldMatch, type: 'bold', index: boldMatch ? remaining.indexOf(boldMatch[0]) : -1 },
        { match: italicMatch, type: 'italic', index: italicMatch ? remaining.indexOf(italicMatch[0]) : -1 },
        { match: strikeMatch, type: 'strike', index: strikeMatch ? remaining.indexOf(strikeMatch[0]) : -1 },
        { match: codeMatch, type: 'code', index: codeMatch ? remaining.indexOf(codeMatch[0]) : -1 },
      ].filter(m => m.index !== -1).sort((a, b) => a.index - b.index);

      if (matches.length === 0) {
        parts.push(<span key={key++}>{remaining}</span>);
        break;
      }

      const earliest = matches[0];

      // Add text before match
      if (earliest.index > 0) {
        parts.push(<span key={key++}>{remaining.slice(0, earliest.index)}</span>);
      }

      // Add matched element
      switch (earliest.type) {
        case 'img':
          parts.push(
            <img
              key={key++}
              src={earliest.match![2]}
              alt={earliest.match![1]}
              className="max-w-full my-2 rounded"
            />
          );
          break;
        case 'link':
          parts.push(
            <a
              key={key++}
              href={earliest.match![2]}
              className="text-accent-primary hover:underline"
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => {
                e.preventDefault();
                window.electron?.openExternal?.(earliest.match![2]);
              }}
            >
              {earliest.match![1]}
            </a>
          );
          break;
        case 'bold':
          parts.push(
            <strong key={key++} className="font-bold">
              {earliest.match![1] || earliest.match![2]}
            </strong>
          );
          break;
        case 'italic':
          parts.push(
            <em key={key++} className="italic">
              {earliest.match![1] || earliest.match![2]}
            </em>
          );
          break;
        case 'strike':
          parts.push(
            <del key={key++} className="line-through text-text-muted">
              {earliest.match![1]}
            </del>
          );
          break;
        case 'code':
          parts.push(
            <code key={key++} className="px-1.5 py-0.5 rounded bg-bg-tertiary text-orange-400 text-sm font-mono">
              {earliest.match![1]}
            </code>
          );
          break;
      }

      remaining = remaining.slice(earliest.index + earliest.match![0].length);
    }

    return parts;
  };

  return (
    <div className="h-full flex flex-col bg-bg-primary">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border-primary bg-bg-secondary">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-text-muted" />
          <span className="text-sm font-mono text-text-primary">{fileName}</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setViewMode('preview')}
            className={`p-1.5 rounded transition-colors flex items-center gap-1.5 text-xs ${
              viewMode === 'preview'
                ? 'bg-bg-tertiary text-accent-primary'
                : 'hover:bg-bg-hover text-text-muted hover:text-text-primary'
            }`}
            title="Preview"
          >
            <Eye className="w-4 h-4" />
            Preview
          </button>
          <button
            onClick={() => setViewMode('source')}
            className={`p-1.5 rounded transition-colors flex items-center gap-1.5 text-xs ${
              viewMode === 'source'
                ? 'bg-bg-tertiary text-accent-primary'
                : 'hover:bg-bg-hover text-text-muted hover:text-text-primary'
            }`}
            title="Source"
          >
            <Code className="w-4 h-4" />
            Source
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {viewMode === 'preview' ? (
          <div className="p-6 max-w-4xl mx-auto">
            {renderMarkdown(content)}
          </div>
        ) : (
          <textarea
            value={content}
            onChange={(e) => onContentChange?.(e.target.value)}
            className="w-full h-full p-4 font-mono text-sm text-text-primary bg-transparent resize-none outline-none"
            spellCheck={false}
          />
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-1 border-t border-border-primary bg-bg-secondary text-xs text-text-muted font-mono flex justify-between">
        <span className="truncate">{filePath}</span>
        <span className="text-text-muted/50 ml-4 flex-shrink-0">
          {content.split('\n').length} lines
        </span>
      </div>
    </div>
  );
}
