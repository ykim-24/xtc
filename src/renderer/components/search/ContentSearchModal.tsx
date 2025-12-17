import { useState, useEffect, useCallback, useRef } from 'react';
import { Search, X, CaseSensitive, Loader2 } from 'lucide-react';
import { useProjectStore } from '@/stores';
import { FileIcon } from '@/utils/fileIcons';

interface SearchResult {
  filePath: string;
  fileName: string;
  lineNumber: number;
  lineContent: string;
  matchStart: number;
  matchEnd: number;
}

interface ContentSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ContentSearchModal({ isOpen, onClose }: ContentSearchModalProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [caseSensitive, setCaseSensitive] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsContainerRef = useRef<HTMLDivElement>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const { projectPath, setActiveFile, openFile } = useProjectStore();

  // Focus input when modal opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isOpen]);

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setQuery('');
      setResults([]);
      setSelectedIndex(0);
      setIsSearching(false);
    }
  }, [isOpen]);

  // Debounced search
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (!query.trim() || query.length < 2) {
      setResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    searchTimeoutRef.current = setTimeout(async () => {
      if (!projectPath) {
        setResults([]);
        setIsSearching(false);
        return;
      }

      try {
        const result = await window.electron?.searchContent(projectPath, query, {
          caseSensitive,
          maxResults: 100,
        });

        if (result?.success) {
          setResults(result.results || []);
        } else {
          setResults([]);
        }
      } catch (err) {
        console.error('Search failed:', err);
        setResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [query, projectPath, caseSensitive]);

  // Keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex((prev) => Math.min(prev + 1, results.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex((prev) => Math.max(prev - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (results[selectedIndex]) {
          openResult(results[selectedIndex]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        onClose();
        break;
    }
  }, [results, selectedIndex, onClose]);

  // Open selected result
  const openResult = useCallback(async (result: SearchResult) => {
    try {
      const fileResult = await window.electron?.readFile(result.filePath);
      if (fileResult?.success && fileResult.content !== undefined) {
        openFile({
          path: result.filePath,
          name: result.fileName,
          content: fileResult.content,
        });
        setActiveFile(result.filePath);
        // TODO: Could scroll to line number if editor supports it
      }
    } catch (err) {
      console.error('Failed to open file:', err);
    }
    onClose();
  }, [openFile, setActiveFile, onClose]);

  // Scroll selected item into view
  useEffect(() => {
    if (resultsContainerRef.current && results.length > 0) {
      const selectedElement = resultsContainerRef.current.children[selectedIndex] as HTMLElement;
      if (selectedElement) {
        selectedElement.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [selectedIndex, results.length]);

  // Highlight matched text in line content
  const highlightMatch = (content: string, matchStart: number, matchEnd: number) => {
    const before = content.slice(0, matchStart);
    const match = content.slice(matchStart, matchEnd);
    const after = content.slice(matchEnd);

    return (
      <>
        <span className="text-text-muted">{before}</span>
        <span className="bg-yellow-500/30 text-yellow-300 font-medium">{match}</span>
        <span className="text-text-muted">{after}</span>
      </>
    );
  };

  // Get relative path
  const getRelativePath = (filePath: string) => {
    if (!projectPath) return filePath;
    return filePath.replace(projectPath + '/', '');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh]">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-[600px] max-w-[90vw] max-h-[70vh] bg-bg-secondary border border-border-primary rounded-lg shadow-xl flex flex-col">
        {/* Search input */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border-primary">
          <Search className="w-4 h-4 text-text-muted" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleKeyDown}
            placeholder="Search in files..."
            className="flex-1 bg-transparent border-none outline-none text-sm text-text-primary placeholder-text-muted"
          />
          {/* Case sensitive toggle */}
          <button
            onClick={() => setCaseSensitive(!caseSensitive)}
            className={`p-1 rounded transition-colors ${caseSensitive ? 'bg-accent-primary/20 text-accent-primary' : 'text-text-muted hover:text-text-primary'}`}
            title="Case sensitive"
          >
            <CaseSensitive className="w-4 h-4" />
          </button>
          {isSearching && <Loader2 className="w-4 h-4 text-text-muted animate-spin" />}
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-bg-hover text-text-muted hover:text-text-primary"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Results */}
        <div ref={resultsContainerRef} className="flex-1 overflow-y-auto">
          {query.length < 2 ? (
            <div className="p-8 text-center text-text-muted text-sm">
              Type at least 2 characters to search
            </div>
          ) : results.length === 0 && !isSearching ? (
            <div className="p-8 text-center text-text-muted text-sm">
              No results found for "{query}"
            </div>
          ) : (
            <div className="divide-y divide-border-secondary">
              {results.map((result, index) => (
                  <button
                    key={`${result.filePath}-${result.lineNumber}`}
                    onClick={() => openResult(result)}
                    className={`w-full text-left px-4 py-2 hover:bg-bg-hover transition-colors ${
                      index === selectedIndex ? 'bg-accent-primary/10' : ''
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <FileIcon fileName={result.fileName} className="w-4 h-4 flex-shrink-0" />
                      <span className="text-sm text-text-primary truncate">{result.fileName}</span>
                      <span className="text-xs text-text-muted">:{result.lineNumber}</span>
                      <span className="flex-1" />
                      <span className="text-xs text-text-muted truncate max-w-[200px]">
                        {getRelativePath(result.filePath)}
                      </span>
                    </div>
                    <div className="mt-1 text-xs font-mono truncate">
                      {highlightMatch(result.lineContent.trim(), result.matchStart, result.matchEnd)}
                    </div>
                  </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        {results.length > 0 && (
          <div className="px-4 py-2 border-t border-border-primary text-xs text-text-muted flex items-center justify-between">
            <span>{results.length} result{results.length !== 1 ? 's' : ''}</span>
            <span className="flex items-center gap-2">
              <kbd className="px-1.5 py-0.5 bg-bg-tertiary rounded text-[10px]">↑↓</kbd>
              <span>to navigate</span>
              <kbd className="px-1.5 py-0.5 bg-bg-tertiary rounded text-[10px]">↵</kbd>
              <span>to open</span>
              <kbd className="px-1.5 py-0.5 bg-bg-tertiary rounded text-[10px]">esc</kbd>
              <span>to close</span>
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
