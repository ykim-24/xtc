import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useProjectStore } from '@/stores';
import { FileIcon } from '@/utils/fileIcons';

// File extension to language mapping
const FILE_EXTENSIONS_TO_LANGUAGE: Record<string, string> = {
  '.ts': 'typescript',
  '.tsx': 'typescriptreact',
  '.js': 'javascript',
  '.jsx': 'javascriptreact',
  '.mjs': 'javascript',
  '.cjs': 'javascript',
  '.json': 'json',
  '.md': 'markdown',
  '.css': 'css',
  '.scss': 'scss',
  '.less': 'less',
  '.html': 'html',
  '.xml': 'xml',
  '.yaml': 'yaml',
  '.yml': 'yaml',
  '.py': 'python',
  '.rb': 'ruby',
  '.go': 'go',
  '.rs': 'rust',
  '.java': 'java',
  '.c': 'c',
  '.cpp': 'cpp',
  '.h': 'c',
  '.hpp': 'cpp',
  '.sh': 'shell',
  '.bash': 'shell',
  '.zsh': 'shell',
  '.sql': 'sql',
  '.graphql': 'graphql',
  '.vue': 'vue',
  '.svelte': 'svelte',
};

function getLanguageFromPath(filePath: string): string {
  const ext = '.' + filePath.split('.').pop();
  return FILE_EXTENSIONS_TO_LANGUAGE[ext] || 'plaintext';
}

interface FileSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// Simple fuzzy match - checks if query chars appear in order
function fuzzyMatch(query: string, text: string): { match: boolean; score: number } {
  const lowerQuery = query.toLowerCase();
  const lowerText = text.toLowerCase();

  if (!query) return { match: true, score: 0 };

  let queryIndex = 0;
  let score = 0;
  let consecutiveBonus = 0;

  for (let i = 0; i < lowerText.length && queryIndex < lowerQuery.length; i++) {
    if (lowerText[i] === lowerQuery[queryIndex]) {
      score += 1 + consecutiveBonus;
      consecutiveBonus += 0.5;
      queryIndex++;
    } else {
      consecutiveBonus = 0;
    }
  }

  // Bonus for matching at start
  if (lowerText.startsWith(lowerQuery)) {
    score += 10;
  }

  // Bonus for exact match
  if (lowerText === lowerQuery) {
    score += 20;
  }

  return {
    match: queryIndex === lowerQuery.length,
    score,
  };
}

export function FileSearchModal({ isOpen, onClose }: FileSearchModalProps) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [allFiles, setAllFiles] = useState<{ path: string; name: string }[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const { openFile, projectPath, revealInExplorer } = useProjectStore();

  // Load all files when modal opens
  const loadAllFiles = useCallback(async () => {
    if (!projectPath) return;

    setIsLoading(true);
    try {
      const result = await window.electron?.listAllFiles(projectPath);
      if (result?.success && result.files) {
        setAllFiles(result.files);
      }
    } catch (error) {
      console.error('Failed to load files:', error);
    } finally {
      setIsLoading(false);
    }
  }, [projectPath]);

  // Filter and sort by match score
  const filteredFiles = useMemo(() => {
    if (!query.trim()) {
      return allFiles.slice(0, 50); // Show first 50 when no query
    }

    return allFiles
      .map(file => {
        const nameMatch = fuzzyMatch(query, file.name);
        const pathMatch = fuzzyMatch(query, file.path);
        return {
          ...file,
          score: Math.max(nameMatch.score * 2, pathMatch.score), // Weight name matches higher
          match: nameMatch.match || pathMatch.match,
        };
      })
      .filter(f => f.match)
      .sort((a, b) => b.score - a.score)
      .slice(0, 50);
  }, [allFiles, query]);

  // Reset state and load files when opening
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      loadAllFiles();
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [isOpen, loadAllFiles]);

  // Scroll selected item into view
  useEffect(() => {
    if (listRef.current) {
      const selected = listRef.current.children[selectedIndex] as HTMLElement;
      if (selected) {
        selected.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [selectedIndex]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(i => Math.min(i + 1, filteredFiles.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(i => Math.max(i - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (filteredFiles[selectedIndex]) {
          handleSelect(filteredFiles[selectedIndex].path);
        }
        break;
      case 'Escape':
        e.preventDefault();
        onClose();
        break;
    }
  };

  const handleSelect = async (filePath: string) => {
    const result = await window.electron?.readFile(filePath);
    if (result?.success && result.content !== undefined) {
      const fileName = filePath.split('/').pop() || 'untitled';
      openFile({
        path: filePath,
        name: fileName,
        content: result.content,
        language: getLanguageFromPath(filePath),
        isDirty: false,
      });
      // Reveal the file in explorer
      revealInExplorer(filePath);
    }
    onClose();
  };

  // Get relative path for display
  const getRelativePath = (fullPath: string) => {
    if (projectPath && fullPath.startsWith(projectPath)) {
      return fullPath.slice(projectPath.length + 1);
    }
    return fullPath;
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" />

      {/* Modal */}
      <div
        className="relative w-[500px] max-w-[90vw] bg-bg-secondary border border-border-primary rounded shadow-xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Search input */}
        <div className="flex items-center px-3 py-2 border-b border-border-primary">
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleKeyDown}
            placeholder="Search files..."
            className="flex-1 bg-transparent text-sm text-text-primary placeholder-text-muted outline-none"
          />
        </div>

        {/* Results */}
        <div
          ref={listRef}
          className="max-h-[300px] overflow-y-auto"
        >
          {isLoading ? (
            <div className="px-3 py-4 text-center text-text-muted text-xs">
              Loading files...
            </div>
          ) : filteredFiles.length === 0 ? (
            <div className="px-3 py-4 text-center text-text-muted text-xs">
              {query ? 'No files found' : 'No files in project'}
            </div>
          ) : (
            filteredFiles.map((file, index) => (
              <button
                key={file.path}
                className={`w-full flex items-center gap-2 px-3 py-1.5 text-left transition-colors ${
                  index === selectedIndex
                    ? 'bg-accent-primary/20 text-text-primary'
                    : 'text-text-secondary hover:bg-bg-hover'
                }`}
                onClick={() => handleSelect(file.path)}
                onMouseEnter={() => setSelectedIndex(index)}
              >
                <FileIcon fileName={file.name} className="w-4 h-4 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-xs truncate">{file.name}</div>
                  <div className="text-[10px] text-text-muted truncate">
                    {getRelativePath(file.path)}
                  </div>
                </div>
              </button>
            ))
          )}
        </div>

        {/* Footer hint */}
        <div className="px-3 py-1.5 border-t border-border-primary text-[10px] text-text-muted">
          ↑↓ navigate • ↵ open • esc close
        </div>
      </div>
    </div>
  );
}
