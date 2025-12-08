import { PendingEdit } from '@/stores/editsStore';

/**
 * Parse Claude's output to detect file edit intentions
 *
 * Claude typically outputs edits in formats like:
 * - "I'll create/write/update file.ts:" followed by code block
 * - "```typescript:path/to/file.ts" (labeled code blocks)
 * - File path followed by code block
 */

interface ParsedEdit {
  filePath: string;
  content: string;
  action: 'create' | 'update' | 'replace';
  description: string;
}

// Pattern to match file paths in various formats
const FILE_PATH_PATTERN = /(?:^|\s)([\/\w\-\.]+\.[a-zA-Z]{1,10})(?:\s|$|:|\`)/;

// Pattern to match code blocks with optional language/path label
// Matches: ```lang:path or ```path or just ```
const CODE_BLOCK_PATTERN = /```(\w+)?(?::([^\n`]+))?\n([\s\S]*?)```/g;

// Patterns that indicate file creation/modification intent
const EDIT_INTENT_PATTERNS = [
  /(?:I'll|I will|Let me|Going to)\s+(?:create|write|make|add|update|modify|edit|change)\s+(?:the\s+)?(?:file\s+)?[`"]?([\/\w\-\.]+\.[a-zA-Z]{1,10})[`"]?/i,
  /(?:Create|Write|Update|Modify|Edit|Save)\s+(?:the\s+)?(?:file\s+)?[`"]?([\/\w\-\.]+\.[a-zA-Z]{1,10})[`"]?/i,
  /(?:Here's|Here is)\s+(?:the\s+)?(?:updated?|new|modified)?\s*[`"]?([\/\w\-\.]+\.[a-zA-Z]{1,10})[`"]?/i,
  /^([\/\w\-\.]+\.[a-zA-Z]{1,10}):$/m,
];

// File extensions we recognize
const VALID_EXTENSIONS = [
  'ts', 'tsx', 'js', 'jsx', 'mjs', 'cjs',
  'json', 'yaml', 'yml', 'toml',
  'md', 'mdx', 'txt',
  'css', 'scss', 'less', 'sass',
  'html', 'htm', 'xml', 'svg',
  'py', 'rb', 'go', 'rs', 'java', 'kt', 'swift',
  'c', 'cpp', 'h', 'hpp', 'cs',
  'sh', 'bash', 'zsh', 'fish',
  'sql', 'graphql', 'prisma',
  'vue', 'svelte',
  'env', 'gitignore', 'dockerignore',
];

function isValidFilePath(path: string): boolean {
  if (!path || path.length < 3) return false;
  const ext = path.split('.').pop()?.toLowerCase();
  if (!ext) return false;
  return VALID_EXTENSIONS.includes(ext) || path.includes('/');
}

function extractFilePathFromContext(text: string, codeBlockIndex: number): string | null {
  // Look at the 200 chars before the code block for file path hints
  const contextStart = Math.max(0, codeBlockIndex - 200);
  const context = text.slice(contextStart, codeBlockIndex);

  for (const pattern of EDIT_INTENT_PATTERNS) {
    const match = context.match(pattern);
    if (match && match[1] && isValidFilePath(match[1])) {
      return match[1];
    }
  }

  return null;
}

function getLanguageExtension(lang: string): string {
  const langMap: Record<string, string> = {
    typescript: 'ts',
    javascript: 'js',
    typescriptreact: 'tsx',
    javascriptreact: 'jsx',
    python: 'py',
    ruby: 'rb',
    rust: 'rs',
    golang: 'go',
    shell: 'sh',
    bash: 'sh',
    yaml: 'yml',
    markdown: 'md',
  };
  return langMap[lang.toLowerCase()] || lang.toLowerCase();
}

export function parseEditsFromResponse(
  response: string,
  projectPath: string | null
): ParsedEdit[] {
  const edits: ParsedEdit[] = [];
  const seenPaths = new Set<string>();

  // Reset the regex
  CODE_BLOCK_PATTERN.lastIndex = 0;

  let match;
  while ((match = CODE_BLOCK_PATTERN.exec(response)) !== null) {
    const [fullMatch, language, pathInLabel, content] = match;
    const matchIndex = match.index;

    let filePath: string | null = null;
    let action: 'create' | 'update' | 'replace' = 'create';

    // Priority 1: Path in code block label (```ts:src/file.ts)
    if (pathInLabel && isValidFilePath(pathInLabel)) {
      filePath = pathInLabel;
    }

    // Priority 2: Look for file path in surrounding context
    if (!filePath) {
      filePath = extractFilePathFromContext(response, matchIndex);
    }

    // Skip if no file path found or content is too short (likely just an example)
    if (!filePath || content.trim().length < 10) {
      continue;
    }

    // Skip if we've already seen this path (take first occurrence)
    if (seenPaths.has(filePath)) {
      continue;
    }
    seenPaths.add(filePath);

    // Determine if it's a create or update based on context
    const contextBefore = response.slice(Math.max(0, matchIndex - 100), matchIndex).toLowerCase();
    if (contextBefore.includes('update') || contextBefore.includes('modify') || contextBefore.includes('change') || contextBefore.includes('edit')) {
      action = 'update';
    }

    // Normalize path
    let normalizedPath = filePath;
    if (!filePath.startsWith('/') && projectPath) {
      normalizedPath = `${projectPath}/${filePath}`;
    }

    edits.push({
      filePath: normalizedPath,
      content: content.trim(),
      action,
      description: `${action === 'create' ? 'Create' : 'Update'} ${filePath}`,
    });
  }

  return edits;
}

export async function createPendingEditsFromParsed(
  parsedEdits: ParsedEdit[],
  readFile: (path: string) => Promise<{ success: boolean; content?: string }>
): Promise<PendingEdit[]> {
  const pendingEdits: PendingEdit[] = [];

  for (const parsed of parsedEdits) {
    // Try to read existing file content
    let originalContent = '';
    try {
      const result = await readFile(parsed.filePath);
      if (result.success && result.content !== undefined) {
        originalContent = result.content;
      }
    } catch {
      // File doesn't exist, that's fine for creates
    }

    pendingEdits.push({
      id: crypto.randomUUID(),
      filePath: parsed.filePath,
      originalContent,
      newContent: parsed.content,
      description: parsed.description,
    });
  }

  return pendingEdits;
}
