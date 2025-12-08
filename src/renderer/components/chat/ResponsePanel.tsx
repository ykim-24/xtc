import { useRef, useEffect, useCallback } from 'react';
import { Trash2 } from 'lucide-react';
import { useProjectStore } from '@/stores';
import hljs from 'highlight.js/lib/core';
// Import common languages
import typescript from 'highlight.js/lib/languages/typescript';
import javascript from 'highlight.js/lib/languages/javascript';
import python from 'highlight.js/lib/languages/python';
import bash from 'highlight.js/lib/languages/bash';
import json from 'highlight.js/lib/languages/json';
import css from 'highlight.js/lib/languages/css';
import xml from 'highlight.js/lib/languages/xml';
import rust from 'highlight.js/lib/languages/rust';
import go from 'highlight.js/lib/languages/go';
import sql from 'highlight.js/lib/languages/sql';
import yaml from 'highlight.js/lib/languages/yaml';
import markdown from 'highlight.js/lib/languages/markdown';
import { Panel, IconButton } from '@/components/ui';
import { useChatStore } from '@/stores';

// Register languages
hljs.registerLanguage('typescript', typescript);
hljs.registerLanguage('ts', typescript);
hljs.registerLanguage('tsx', typescript);
hljs.registerLanguage('javascript', javascript);
hljs.registerLanguage('js', javascript);
hljs.registerLanguage('jsx', javascript);
hljs.registerLanguage('python', python);
hljs.registerLanguage('py', python);
hljs.registerLanguage('bash', bash);
hljs.registerLanguage('sh', bash);
hljs.registerLanguage('shell', bash);
hljs.registerLanguage('zsh', bash);
hljs.registerLanguage('json', json);
hljs.registerLanguage('css', css);
hljs.registerLanguage('html', xml);
hljs.registerLanguage('xml', xml);
hljs.registerLanguage('rust', rust);
hljs.registerLanguage('rs', rust);
hljs.registerLanguage('go', go);
hljs.registerLanguage('golang', go);
hljs.registerLanguage('sql', sql);
hljs.registerLanguage('yaml', yaml);
hljs.registerLanguage('yml', yaml);
hljs.registerLanguage('markdown', markdown);
hljs.registerLanguage('md', markdown);
// Plain text - no highlighting
hljs.registerLanguage('text', () => ({ contains: [] }));
hljs.registerLanguage('txt', () => ({ contains: [] }));
hljs.registerLanguage('plaintext', () => ({ contains: [] }));

const formatTime = (timestamp: number) => {
  const date = new Date(timestamp);
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
};

// Highlight code with language
const highlightCode = (code: string, language: string): string => {
  try {
    if (language && hljs.getLanguage(language)) {
      return hljs.highlight(code, { language }).value;
    }
    return hljs.highlightAuto(code).value;
  } catch {
    return code.replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
};

// Parse markdown and extract code blocks
const parseMarkdown = (text: string): Array<{ type: 'text' | 'code'; content: string; language?: string; filePath?: string }> => {
  const parts: Array<{ type: 'text' | 'code'; content: string; language?: string; filePath?: string }> = [];
  // Match ```language:filepath or ```language or just ```
  const codeBlockRegex = /```(\w*)(?::([^\n`]+))?\n([\s\S]*?)```/g;
  let lastIndex = 0;
  let match;

  while ((match = codeBlockRegex.exec(text)) !== null) {
    // Add text before code block
    if (match.index > lastIndex) {
      parts.push({ type: 'text', content: text.slice(lastIndex, match.index) });
    }
    // Add code block with optional file path
    const language = match[1] || undefined;
    const filePath = match[2] || undefined;
    const content = match[3];
    parts.push({ type: 'code', content, language, filePath });
    lastIndex = match.index + match[0].length;
  }

  // Add remaining text
  if (lastIndex < text.length) {
    parts.push({ type: 'text', content: text.slice(lastIndex) });
  }

  return parts;
};

// Terminal-style markdown renderer for text parts
const renderTextMarkdown = (text: string) => {
  const lines = text.split('\n');

  return lines.map((line, lineIndex) => {
    // Headers (check longer prefixes first)
    if (line.startsWith('### ')) {
      return (
        <div key={lineIndex} className="text-yellow-400 font-semibold mt-2 mb-1">
          {'>'} {line.slice(4)}
        </div>
      );
    }
    if (line.startsWith('## ')) {
      return (
        <div key={lineIndex} className="text-yellow-400 font-bold mt-2 mb-1">
          {'>'} {line.slice(3)}
        </div>
      );
    }
    if (line.startsWith('# ')) {
      return (
        <div key={lineIndex} className="text-yellow-400 font-bold mt-2 mb-1">
          {'#'} {line.slice(2)}
        </div>
      );
    }

    // Numbered lists
    const numberedMatch = line.match(/^(\d+)\.\s+(.*)$/);
    if (numberedMatch) {
      return (
        <div key={lineIndex} className="ml-2">
          <span className="text-cyan-400">{numberedMatch[1]}.</span>{' '}
          {renderInline(numberedMatch[2])}
        </div>
      );
    }

    // Bullet lists (-, *, •)
    if (line.startsWith('- ') || line.startsWith('* ') || line.startsWith('• ')) {
      return (
        <div key={lineIndex} className="ml-2">
          <span className="text-cyan-400">•</span> {renderInline(line.slice(2))}
        </div>
      );
    }

    // Indented bullet lists
    const indentedBulletMatch = line.match(/^(\s+)[-*•]\s+(.*)$/);
    if (indentedBulletMatch) {
      const indent = indentedBulletMatch[1].length;
      return (
        <div key={lineIndex} style={{ marginLeft: `${indent * 8 + 8}px` }}>
          <span className="text-cyan-400">◦</span> {renderInline(indentedBulletMatch[2])}
        </div>
      );
    }

    // Empty lines
    if (line.trim() === '') {
      return <div key={lineIndex} className="h-2" />;
    }

    // Regular text
    return <div key={lineIndex}>{renderInline(line)}</div>;
  });
};

// Render inline elements (bold, code, etc.)
const renderInline = (text: string) => {
  const parts: React.ReactNode[] = [];
  let remaining = text;
  let key = 0;

  while (remaining.length > 0) {
    // Bold **text**
    const boldMatch = remaining.match(/\*\*(.+?)\*\*/);
    // Code `text`
    const codeMatch = remaining.match(/`([^`]+)`/);

    // Find earliest match
    const boldIndex = boldMatch ? remaining.indexOf(boldMatch[0]) : -1;
    const codeIndex = codeMatch ? remaining.indexOf(codeMatch[0]) : -1;

    let earliest = -1;
    let matchType = '';
    let match: RegExpMatchArray | null = null;

    if (boldIndex !== -1 && (codeIndex === -1 || boldIndex < codeIndex)) {
      earliest = boldIndex;
      matchType = 'bold';
      match = boldMatch;
    } else if (codeIndex !== -1) {
      earliest = codeIndex;
      matchType = 'code';
      match = codeMatch;
    }

    if (earliest === -1 || !match) {
      parts.push(<span key={key++}>{remaining}</span>);
      break;
    }

    // Add text before match
    if (earliest > 0) {
      parts.push(<span key={key++}>{remaining.slice(0, earliest)}</span>);
    }

    // Add matched element
    if (matchType === 'bold') {
      parts.push(
        <span key={key++} className="text-green-400 font-semibold">
          {match[1]}
        </span>
      );
    } else if (matchType === 'code') {
      parts.push(
        <span key={key++} className="text-orange-400 bg-bg-tertiary px-1 rounded">
          {match[1]}
        </span>
      );
    }

    remaining = remaining.slice(earliest + match[0].length);
  }

  return parts;
};

export function ResponsePanel() {
  const {
    messages,
    isLoading,
    clearMessages,
  } = useChatStore();

  const { projectPath } = useProjectStore();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Clear both UI messages and backend conversation state
  const handleClearChat = useCallback(() => {
    clearMessages();
    window.electron?.claude?.clearConversation(projectPath);
  }, [clearMessages, projectPath]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Show all messages that have content and are done streaming
  const displayMessages = messages.filter(
    (m) => m.content && !m.isStreaming
  );

  // Render a single message with code blocks
  const renderMessageContent = (content: string) => {
    const parts = parseMarkdown(content.replace(/\n\n+/g, '\n'));

    return parts.map((part, index) => {
      if (part.type === 'code') {
        const highlighted = highlightCode(part.content.trim(), part.language || '');
        const label = part.filePath
          ? `${part.language || 'file'}:${part.filePath}`
          : part.language;
        return (
          <div key={index} className="my-2 rounded bg-bg-tertiary overflow-hidden">
            {label && (
              <div className="px-2 py-1 text-[10px] bg-bg-secondary border-b border-border-primary flex items-center gap-2">
                <span className="text-text-muted">{part.language || 'file'}</span>
                {part.filePath && (
                  <span className="text-accent-primary">{part.filePath}</span>
                )}
              </div>
            )}
            <pre className="p-2 overflow-x-auto">
              <code
                className="hljs text-xs"
                dangerouslySetInnerHTML={{ __html: highlighted }}
              />
            </pre>
          </div>
        );
      }
      return <div key={index}>{renderTextMarkdown(part.content)}</div>;
    });
  };

  return (
    <Panel
      title="Chat"
      className="h-full border-l border-border-primary"
      actions={
        <IconButton size="sm" onClick={handleClearChat} title="Clear chat">
          <Trash2 className="w-3.5 h-3.5" />
        </IconButton>
      }
    >
      <div className="flex-1 overflow-y-auto h-full p-2 font-mono text-xs leading-relaxed">
        {displayMessages.map((message) => (
          <div key={message.id} className="mb-3">
            <div className="text-text-secondary">
              {message.role === 'user' ? (
                <>
                  [you]&nbsp;<span className="text-green-400">({formatTime(message.timestamp)})</span>
                </>
              ) : (
                <>
                  [claude]&nbsp;<span className="text-purple-400">({formatTime(message.timestamp)})</span>
                </>
              )}
            </div>
            <div className="text-text-primary mt-1">
              {message.role === 'user' ? (
                <div className="text-text-secondary">{message.content}</div>
              ) : (
                renderMessageContent(message.content)
              )}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>
    </Panel>
  );
}
