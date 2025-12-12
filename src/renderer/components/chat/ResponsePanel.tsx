import { useRef, useEffect, useCallback, useState, memo } from 'react';
import { Trash2, Brain, ChevronRight, ChevronDown } from 'lucide-react';
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

/**
 * Clean raw Claude streaming output that may contain JSON tool results.
 * Extracts only the meaningful text content, filtering out raw JSON protocol data.
 */
const cleanClaudeOutput = (content: string | unknown): string => {
  // Handle non-string content
  if (typeof content !== 'string') {
    if (content === null || content === undefined) {
      return '';
    }
    // Try to convert to string
    return String(content);
  }

  // If content doesn't look like it has JSON tool results, return as-is
  if (!content.includes('{"type":') && !content.includes('"tool_use_id"')) {
    return content;
  }

  // Try to extract clean text by removing JSON tool result blocks
  let cleaned = content;

  // Remove JSON objects that are tool results (user messages with tool_result content)
  // Pattern: {"type":"user","message":{"role":"user","content":[{"tool_use_id":...}]}}
  cleaned = cleaned.replace(
    /\{"type":"user","message":\{"role":"user","content":\[\{"tool_use_id"[^}]*\}[^\}]*\}\}\}/g,
    ''
  );

  // Remove standalone JSON objects that look like streaming protocol messages
  cleaned = cleaned.replace(
    /\{"type":"(?:user|assistant|system|content_block_delta|result)"[^}]*(?:\{[^}]*\}[^}]*)?\}/g,
    ''
  );

  // Clean up any remaining JSON-like fragments
  cleaned = cleaned.replace(/\{"tool_use_id":[^}]+\}/g, '');
  cleaned = cleaned.replace(/"type":"tool_result"[^}]+/g, '');

  // Unescape common escape sequences
  cleaned = cleaned
    .replace(/\\n/g, '\n')
    .replace(/\\t/g, '  ')
    .replace(/\\"/g, '"')
    .replace(/\\'/g, "'");

  // Remove multiple consecutive newlines
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n');

  // Trim whitespace
  cleaned = cleaned.trim();

  return cleaned;
};

/**
 * Pre-process content to normalize code block formatting.
 * Handles cases where language tag is on separate line or code has diff prefixes.
 */
const normalizeCodeBlocks = (content: string): string => {
  let normalized = content;

  // Fix code blocks where language is on a separate line after ```
  // e.g., "```\nbash\n+code" -> "```bash\n+code"
  normalized = normalized.replace(
    /```\s*\n(bash|sh|shell|python|py|javascript|js|typescript|ts|json|yaml|yml|css|html|xml|sql|go|rust|ruby|java|c|cpp|csharp|php|swift|kotlin)\n/gi,
    (_, lang) => '```' + lang.toLowerCase() + '\n'
  );

  // Also handle "```\n\nbash\n" with extra newline
  normalized = normalized.replace(
    /```\s*\n\n(bash|sh|shell|python|py|javascript|js|typescript|ts|json|yaml|yml|css|html|xml|sql|go|rust|ruby|java|c|cpp|csharp|php|swift|kotlin)\n/gi,
    (_, lang) => '```' + lang.toLowerCase() + '\n'
  );

  // Handle standalone language identifiers that look like they should be code blocks
  // e.g., "\n\nbash\n+export FOO=bar" -> "\n\n```bash\nexport FOO=bar"
  normalized = normalized.replace(
    /\n\n(bash|sh|shell|python|py|javascript|js|typescript|ts|json|yaml|yml)\n(\+[^\n]+(?:\n\+[^\n]+)*)\n\n/gi,
    (_, lang, code) => {
      // Remove the + prefixes from diff output
      const cleanCode = code.split('\n').map((line: string) =>
        line.startsWith('+') ? line.slice(1) : line
      ).join('\n');
      return '\n\n```' + lang.toLowerCase() + '\n' + cleanCode + '\n```\n\n';
    }
  );

  // Clean up double-escaped backslashes in code blocks
  normalized = normalized.replace(/\\\\/g, '\\');

  return normalized;
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

// Parse markdown and extract code blocks and thinking blocks
const parseMarkdown = (text: string): Array<{ type: 'text' | 'code' | 'thinking'; content: string; language?: string; filePath?: string }> => {
  const parts: Array<{ type: 'text' | 'code' | 'thinking'; content: string; language?: string; filePath?: string }> = [];

  // First normalize the code blocks
  const normalizedText = normalizeCodeBlocks(text);

  // Combined regex for code blocks and thinking blocks
  // Order matters - we process matches in order of appearance
  const combinedRegex = /```(\w*)(?::([^\n`]+))?\n([\s\S]*?)```|<thinking>([\s\S]*?)<\/thinking>/g;
  let lastIndex = 0;
  let match;

  while ((match = combinedRegex.exec(normalizedText)) !== null) {
    // Add text before this match
    if (match.index > lastIndex) {
      parts.push({ type: 'text', content: normalizedText.slice(lastIndex, match.index) });
    }

    if (match[0].startsWith('<thinking>')) {
      // This is a thinking block
      const thinkingContent = match[4] || '';
      parts.push({ type: 'thinking', content: thinkingContent.trim() });
    } else {
      // This is a code block
      const language = match[1] || undefined;
      const filePath = match[2] || undefined;
      let content = match[3];

      // Clean diff prefixes (+/-) from code content
      if (content.includes('\n+') || content.startsWith('+')) {
        content = content.split('\n').map(line => {
          if (line.startsWith('+')) return line.slice(1);
          if (line.startsWith('-')) return null; // Remove deleted lines
          return line;
        }).filter(line => line !== null).join('\n');
      }

      parts.push({ type: 'code', content, language, filePath });
    }

    lastIndex = match.index + match[0].length;
  }

  // Add remaining text
  if (lastIndex < normalizedText.length) {
    parts.push({ type: 'text', content: normalizedText.slice(lastIndex) });
  }

  return parts;
};

// Terminal-style markdown renderer for text parts
const renderTextMarkdown = (text: string) => {
  const lines = text.split('\n');

  return lines.map((line, lineIndex) => {
    // Skip standalone language identifiers that weren't caught (bash, json, etc.)
    if (/^(bash|sh|shell|json|python|py|javascript|js|typescript|ts|yaml|yml|sql|html|css|xml)$/i.test(line.trim())) {
      return null;
    }

    // Headers (check longer prefixes first)
    if (line.startsWith('#### ')) {
      return (
        <div key={lineIndex} className="text-yellow-400 font-medium mt-2 mb-1">
          {'>'} {line.slice(5)}
        </div>
      );
    }
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

    // "Expected response:" type labels
    if (/^(Expected|Note|Warning|Important|Tip)(\s+response)?:/i.test(line.trim())) {
      return (
        <div key={lineIndex} className="text-purple-400 mt-1">
          {renderInline(line)}
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

    // Lines with + prefix (diff output not in code block) - show as additions
    if (line.startsWith('+') && !line.startsWith('++')) {
      return (
        <div key={lineIndex} className="text-green-400 font-mono bg-green-400/10 px-1">
          {line}
        </div>
      );
    }

    // Lines with - prefix (diff output not in code block) - show as deletions
    if (line.startsWith('-') && !line.startsWith('--')) {
      return (
        <div key={lineIndex} className="text-red-400 font-mono bg-red-400/10 px-1">
          {line}
        </div>
      );
    }

    // Empty lines
    if (line.trim() === '') {
      return <div key={lineIndex} className="h-2" />;
    }

    // Regular text
    return <div key={lineIndex}>{renderInline(line)}</div>;
  }).filter(Boolean);
};

// Track expanded thinking blocks globally to persist state across re-renders
const expandedThinkingBlocks = new Set<string>();

// Collapsible thinking block component - defined outside ResponsePanel to prevent re-creation
const ThinkingBlock = memo(({ content, blockKey }: { content: string; blockKey: string }) => {
  const [isExpanded, setIsExpanded] = useState(() => expandedThinkingBlocks.has(blockKey));

  const handleToggle = useCallback(() => {
    setIsExpanded(prev => {
      const newValue = !prev;
      if (newValue) {
        expandedThinkingBlocks.add(blockKey);
      } else {
        expandedThinkingBlocks.delete(blockKey);
      }
      return newValue;
    });
  }, [blockKey]);

  return (
    <div className="my-2 rounded border border-purple-500/30 bg-purple-500/5 overflow-hidden">
      <button
        onClick={handleToggle}
        className="w-full px-2 py-1.5 flex items-center gap-2 text-[10px] text-purple-400 hover:bg-purple-500/10 transition-colors"
      >
        {isExpanded ? (
          <ChevronDown className="w-3 h-3" />
        ) : (
          <ChevronRight className="w-3 h-3" />
        )}
        <Brain className="w-3 h-3" />
        <span>thinking...</span>
      </button>
      {isExpanded && (
        <div className="px-3 py-2 text-xs text-purple-300/70 border-t border-purple-500/20 whitespace-pre-wrap">
          {content}
        </div>
      )}
    </div>
  );
});

ThinkingBlock.displayName = 'ThinkingBlock';

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

  // Show all messages that have content (including streaming ones for real-time thinking blocks)
  const displayMessages = messages.filter((m) => m.content);

  // Render a single message with code blocks
  const renderMessageContent = (content: string | unknown, messageId: string) => {
    // Ensure content is a string
    const safeContent = typeof content === 'string' ? content : String(content || '');
    // Clean raw Claude output that may contain JSON tool results
    const cleanedContent = cleanClaudeOutput(safeContent);
    const parts = parseMarkdown(cleanedContent.replace(/\n\n+/g, '\n'));

    return parts.map((part, index) => {
      if (part.type === 'thinking') {
        // Use messageId + index as stable key to prevent state reset
        const blockKey = `${messageId}-thinking-${index}`;
        return <ThinkingBlock key={blockKey} blockKey={blockKey} content={part.content} />;
      }
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
                <div className="text-text-secondary">{typeof message.content === 'string' ? message.content : String(message.content || '')}</div>
              ) : (
                <>
                  {renderMessageContent(message.content, message.id)}
                  {message.isStreaming && (
                    <span className="inline-block animate-pulse text-purple-400">▋</span>
                  )}
                </>
              )}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>
    </Panel>
  );
}
