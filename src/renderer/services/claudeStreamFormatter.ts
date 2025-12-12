/**
 * Formats raw Claude streaming output into human-readable text.
 * Handles JSON tool results, escaped characters, and extracts meaningful content.
 */

interface StreamChunk {
  type: string;
  message?: {
    role: string;
    content: Array<{
      type: string;
      tool_use_id?: string;
      content?: string;
      text?: string;
      name?: string;
      input?: unknown;
    }>;
  };
  result?: {
    type: string;
    content?: string;
  };
}

interface FormattedLine {
  type: 'text' | 'file-read' | 'file-edit' | 'file-write' | 'command' | 'thinking' | 'tool' | 'error';
  content: string;
  file?: string;
}

/**
 * Unescape common escape sequences in strings
 */
function unescapeString(str: string): string {
  return str
    .replace(/\\\\n/g, '\n')   // Double-escaped newlines
    .replace(/\\n/g, '\n')     // Single-escaped newlines
    .replace(/\\\\t/g, '  ')   // Double-escaped tabs
    .replace(/\\t/g, '  ')     // Single-escaped tabs
    .replace(/\\"/g, '"')      // Escaped double quotes
    .replace(/\\'/g, "'")      // Escaped single quotes
    .replace(/\\\\/g, '\\');   // Escaped backslashes
}

/**
 * Try to extract a filename from a path or tool result
 */
function extractFilename(path: string): string {
  const parts = path.split('/');
  return parts[parts.length - 1] || path;
}

/**
 * Parse a single JSON chunk from Claude's streaming output
 */
function parseChunk(jsonStr: string): StreamChunk | null {
  try {
    return JSON.parse(jsonStr);
  } catch {
    return null;
  }
}

/**
 * Format raw Claude streaming output for display
 * Returns formatted lines that can be displayed progressively
 */
export function formatClaudeStream(rawOutput: string): FormattedLine[] {
  const lines: FormattedLine[] = [];

  // Try to parse as JSON first
  const jsonMatches = rawOutput.match(/\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/g) || [];

  let hasProcessedJson = false;

  for (const jsonStr of jsonMatches) {
    const chunk = parseChunk(jsonStr);
    if (!chunk) continue;

    hasProcessedJson = true;

    // Handle different chunk types
    if (chunk.type === 'assistant' && chunk.message?.content) {
      for (const item of chunk.message.content) {
        if (item.type === 'text' && item.text) {
          const text = unescapeString(item.text);
          lines.push({ type: 'text', content: text });
        } else if (item.type === 'tool_use' && item.name) {
          const toolName = item.name;

          if (toolName === 'Read' || toolName === 'read_file') {
            const filePath = (item.input as { file_path?: string })?.file_path || 'file';
            lines.push({
              type: 'file-read',
              content: `Reading ${extractFilename(filePath)}...`,
              file: filePath
            });
          } else if (toolName === 'Edit' || toolName === 'edit_file') {
            const filePath = (item.input as { file_path?: string })?.file_path || 'file';
            lines.push({
              type: 'file-edit',
              content: `Editing ${extractFilename(filePath)}...`,
              file: filePath
            });
          } else if (toolName === 'Write' || toolName === 'write_file') {
            const filePath = (item.input as { file_path?: string })?.file_path || 'file';
            lines.push({
              type: 'file-write',
              content: `Writing ${extractFilename(filePath)}...`,
              file: filePath
            });
          } else if (toolName === 'Bash' || toolName === 'execute_bash') {
            const cmd = (item.input as { command?: string })?.command || '';
            const shortCmd = cmd.length > 50 ? cmd.slice(0, 50) + '...' : cmd;
            lines.push({
              type: 'command',
              content: `Running: ${shortCmd}`
            });
          } else if (toolName === 'Glob' || toolName === 'glob') {
            const pattern = (item.input as { pattern?: string })?.pattern || '';
            lines.push({
              type: 'tool',
              content: `Searching for ${pattern}...`
            });
          } else if (toolName === 'Grep' || toolName === 'grep') {
            const pattern = (item.input as { pattern?: string })?.pattern || '';
            lines.push({
              type: 'tool',
              content: `Searching for "${pattern}"...`
            });
          } else {
            lines.push({
              type: 'tool',
              content: `Using ${toolName}...`
            });
          }
        }
      }
    } else if (chunk.type === 'user' && chunk.message?.content) {
      // Tool results from user messages (tool_result type)
      for (const item of chunk.message.content) {
        if (item.type === 'tool_result') {
          // Don't show the raw tool result content - it's usually file contents
          // Just indicate the tool completed
          continue;
        }
      }
    } else if (chunk.result?.type === 'success') {
      // Success result
      lines.push({ type: 'text', content: '✓ Operation completed' });
    } else if (chunk.result?.type === 'error') {
      lines.push({ type: 'error', content: chunk.result.content || 'Error occurred' });
    }
  }

  // If no JSON was parsed, try to extract readable text
  if (!hasProcessedJson && rawOutput.trim()) {
    // Look for text content in JSON-like structures
    const textMatches = rawOutput.match(/"text"\s*:\s*"((?:[^"\\]|\\.)*)"/g);
    if (textMatches) {
      for (const match of textMatches) {
        const textMatch = match.match(/"text"\s*:\s*"((?:[^"\\]|\\.)*)"/);
        if (textMatch && textMatch[1]) {
          const text = unescapeString(textMatch[1]);
          if (text.length > 5 && !text.includes('tool_use_id')) {
            lines.push({ type: 'text', content: text });
          }
        }
      }
    }

    // Look for tool_use names to show activity
    const toolUseMatches = rawOutput.match(/"name"\s*:\s*"(\w+)"/g);
    if (toolUseMatches && lines.length === 0) {
      const seenTools = new Set<string>();
      for (const match of toolUseMatches) {
        const nameMatch = match.match(/"name"\s*:\s*"(\w+)"/);
        if (nameMatch && nameMatch[1] && !seenTools.has(nameMatch[1])) {
          seenTools.add(nameMatch[1]);
          lines.push({ type: 'tool', content: `Using ${nameMatch[1]}...` });
        }
      }
    }
  }

  return lines;
}

/**
 * Create a compact single-line status from streaming output
 * Useful for showing current activity
 */
export function getStreamStatus(rawOutput: string): string {
  const lines = formatClaudeStream(rawOutput);

  // Get the last meaningful activity
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i];
    if (line.type !== 'text' || line.content.trim().length > 0) {
      return line.content;
    }
  }

  return 'Processing...';
}

/**
 * Format streaming output as a simple activity log
 */
export function formatStreamAsLog(rawOutput: string): string {
  const lines = formatClaudeStream(rawOutput);

  // Deduplicate consecutive similar entries
  const deduped: FormattedLine[] = [];
  let lastContent = '';

  for (const line of lines) {
    const normalizedContent = line.content.toLowerCase().trim();
    if (normalizedContent !== lastContent) {
      deduped.push(line);
      lastContent = normalizedContent;
    }
  }

  // Format for display
  return deduped.map(line => {
    const prefix = getLinePrefix(line.type);
    return prefix ? `${prefix} ${line.content}` : line.content;
  }).join('\n');
}

function getLinePrefix(type: FormattedLine['type']): string {
  switch (type) {
    case 'file-read': return '📖';
    case 'file-edit': return '✏️';
    case 'file-write': return '📝';
    case 'command': return '⚡';
    case 'tool': return '🔧';
    case 'error': return '❌';
    case 'thinking': return '💭';
    default: return '';
  }
}
