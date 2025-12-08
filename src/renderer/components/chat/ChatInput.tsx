import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { Paperclip, X, FileText } from 'lucide-react';
import { IconButton } from '@/components/ui';
import { useProjectStore, useContextStore, ProjectFile } from '@/stores';

interface PastedContent {
  id: string;
  preview: string;
  fullText: string;
  lineCount: number;
}

interface ChatInputProps {
  onSend: (message: string, fileMappings: Map<string, string>) => void;
  disabled?: boolean;
}

// Flatten file tree to get all files
const flattenFiles = (files: ProjectFile[], basePath = ''): { path: string; name: string }[] => {
  const result: { path: string; name: string }[] = [];
  for (const file of files) {
    if (file.type === 'file') {
      result.push({ path: file.path, name: file.name });
    }
    if (file.children) {
      result.push(...flattenFiles(file.children, file.path));
    }
  }
  return result;
};

export function ChatInput({ onSend, disabled }: ChatInputProps) {
  const [input, setInput] = useState('');
  const [showMentions, setShowMentions] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionIndex, setMentionIndex] = useState(0);
  const [mentionStart, setMentionStart] = useState(0);
  const [pastedContents, setPastedContents] = useState<PastedContent[]>([]);
  const editorRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { fileTree, activeFilePath, openFiles } = useProjectStore();
  const { addContextFile, removeContextFile } = useContextStore();

  // Track files explicitly referenced with @ (these should persist)
  const referencedFilesRef = useRef<Set<string>>(new Set());
  // Track the current active file added to context
  const activeContextFileRef = useRef<string | null>(null);

  // Get all files flattened
  const allFiles = useMemo(() => flattenFiles(fileTree), [fileTree]);

  // Filter files based on query
  const filteredFiles = useMemo(() => {
    if (!mentionQuery) return allFiles.slice(0, 10);
    const query = mentionQuery.toLowerCase();
    return allFiles
      .filter((f) => f.name.toLowerCase().includes(query) || f.path.toLowerCase().includes(query))
      .slice(0, 10);
  }, [allFiles, mentionQuery]);

  const handleSubmit = () => {
    if ((input.trim() || pastedContents.length > 0) && !disabled) {
      // Build the full message including pasted content
      let fullMessage = input.trim();
      if (pastedContents.length > 0) {
        const pastedTexts = pastedContents.map(p => p.fullText).join('\n\n');
        fullMessage = fullMessage ? `${fullMessage}\n\n${pastedTexts}` : pastedTexts;
      }
      onSend(fullMessage, mentionedFilePaths);
      setInput('');
      setPastedContents([]);
      setMentionedFilePaths(new Map());
      setShowMentions(false);
      if (editorRef.current) {
        editorRef.current.textContent = '';
      }
    }
  };

  // Handle paste events for multi-line text
  const handlePaste = (e: React.ClipboardEvent) => {
    const text = e.clipboardData.getData('text');
    const lines = text.split('\n');

    // If it's multi-line (more than 2 lines), create a chip
    if (lines.length > 2) {
      e.preventDefault();
      const preview = lines[0].slice(0, 30) + (lines[0].length > 30 ? '...' : '');
      const newPasted: PastedContent = {
        id: Date.now().toString(),
        preview,
        fullText: text,
        lineCount: lines.length,
      };
      setPastedContents(prev => [...prev, newPasted]);
    }
    // Otherwise, let the default paste behavior handle it
  };

  const removePastedContent = (id: string) => {
    setPastedContents(prev => prev.filter(p => p.id !== id));
  };

  // Get cursor position in contenteditable
  const getCursorPosition = (): number => {
    const selection = window.getSelection();
    if (!selection || !editorRef.current) return 0;

    const range = selection.getRangeAt(0);
    const preCaretRange = range.cloneRange();
    preCaretRange.selectNodeContents(editorRef.current);
    preCaretRange.setEnd(range.endContainer, range.endOffset);
    return preCaretRange.toString().length;
  };

  // Set cursor position in contenteditable
  const setCursorPosition = (pos: number) => {
    const editor = editorRef.current;
    if (!editor) return;

    const selection = window.getSelection();
    if (!selection) return;

    let currentPos = 0;
    const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT, null);
    let node: Text | null;

    while ((node = walker.nextNode() as Text | null)) {
      const nodeLength = node.length;
      if (currentPos + nodeLength >= pos) {
        const range = document.createRange();
        range.setStart(node, pos - currentPos);
        range.collapse(true);
        selection.removeAllRanges();
        selection.addRange(range);
        return;
      }
      currentPos += nodeLength;
    }

    // If position is at the end
    const range = document.createRange();
    range.selectNodeContents(editor);
    range.collapse(false);
    selection.removeAllRanges();
    selection.addRange(range);
  };

  // Handle input in contenteditable
  const handleInput = () => {
    const editor = editorRef.current;
    if (!editor) return;

    const text = editor.textContent || '';
    const cursorPos = getCursorPosition();

    setInput(text);

    // Find @ symbol before cursor
    const textBeforeCursor = text.slice(0, cursorPos);
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');

    if (lastAtIndex !== -1) {
      const textAfterAt = textBeforeCursor.slice(lastAtIndex + 1);
      if (!textAfterAt.includes(' ') && !textAfterAt.includes('\n')) {
        setShowMentions(true);
        setMentionQuery(textAfterAt);
        setMentionStart(lastAtIndex);
        setMentionIndex(0);
        return;
      }
    }
    setShowMentions(false);
  };

  // Track file path mappings for mentions (filename -> full path)
  const [mentionedFilePaths, setMentionedFilePaths] = useState<Map<string, string>>(new Map());

  // Add file to context panel (with optional reference flag)
  const addFileToContext = useCallback(async (filePath: string, isReference = false) => {
    if (isReference) {
      referencedFilesRef.current.add(filePath);
    }

    const currentFiles = useContextStore.getState().contextFiles;
    if (currentFiles.some((f) => f.path === filePath)) return;

    try {
      const result = await window.electron?.readFile(filePath);
      if (result?.success && result.content) {
        const fileName = filePath.split('/').pop() || filePath;
        addContextFile({ path: filePath, name: fileName, content: result.content });
      }
    } catch {
      // File not found or unreadable, skip
    }
  }, [addContextFile]);

  // Insert selected file reference
  const insertMention = (file: { path: string; name: string }) => {
    const before = input.slice(0, mentionStart);
    const after = input.slice(mentionStart + mentionQuery.length + 1);
    const newInput = `${before}@${file.name} ${after}`;
    setInput(newInput);
    setMentionedFilePaths((prev) => new Map(prev).set(file.name, file.path));
    setShowMentions(false);

    // Update editor content and cursor
    if (editorRef.current) {
      // Apply highlighting immediately
      const highlighted = newInput.replace(
        /(@\S+)/g,
        '<span class="text-purple-400">$1</span>'
      );
      editorRef.current.innerHTML = highlighted;

      // Set cursor after the space (@ + filename + space)
      const newCursorPos = mentionStart + file.name.length + 2;
      setTimeout(() => {
        setCursorPosition(newCursorPos);
        editorRef.current?.focus();
      }, 10);
    }

    addFileToContext(file.path, true);
  };

  // Debounced effect to detect @ mentions and add/remove files from context
  useEffect(() => {
    const timer = setTimeout(() => {
      const mentionRegex = /@(\S+)/g;
      const currentMentions = new Set<string>();
      let match;

      while ((match = mentionRegex.exec(input)) !== null) {
        const name = match[1];
        const storedPath = mentionedFilePaths.get(name);
        if (storedPath) {
          currentMentions.add(storedPath);
          addFileToContext(storedPath, true);
        } else {
          const foundFile = allFiles.find((f) => f.name === name || f.path.endsWith(name));
          if (foundFile) {
            currentMentions.add(foundFile.path);
            setMentionedFilePaths((prev) => new Map(prev).set(name, foundFile.path));
            addFileToContext(foundFile.path, true);
          }
        }
      }

      const referencedToRemove: string[] = [];
      referencedFilesRef.current.forEach((path) => {
        if (!currentMentions.has(path)) {
          referencedToRemove.push(path);
        }
      });

      for (const path of referencedToRemove) {
        referencedFilesRef.current.delete(path);
        if (path !== activeContextFileRef.current) {
          removeContextFile(path);
        }
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [input, mentionedFilePaths, allFiles, addFileToContext, removeContextFile]);

  // Add currently viewed file to context when it changes
  useEffect(() => {
    const prevActiveFile = activeContextFileRef.current;

    if (prevActiveFile && prevActiveFile !== activeFilePath) {
      if (!referencedFilesRef.current.has(prevActiveFile)) {
        removeContextFile(prevActiveFile);
      }
    }

    if (!activeFilePath) {
      activeContextFileRef.current = null;
      return;
    }

    const activeFile = openFiles.find((f) => f.path === activeFilePath);
    if (activeFile && activeFile.content) {
      const fileName = activeFilePath.split('/').pop() || activeFilePath;
      const currentFiles = useContextStore.getState().contextFiles;
      if (!currentFiles.some((f) => f.path === activeFilePath)) {
        addContextFile({ path: activeFilePath, name: fileName, content: activeFile.content });
      }
      activeContextFileRef.current = activeFilePath;
    }
  }, [activeFilePath, openFiles, addContextFile, removeContextFile]);

  const handleAttachFile = async () => {
    if (!window.electron?.dialog) return;

    const result = await window.electron.dialog.openFile({
      multiple: false,
      filters: [{ name: 'All Files', extensions: ['*'] }],
    });

    if (result?.filePaths && result.filePaths.length > 0) {
      const filePath = result.filePaths[0];
      const fileName = filePath.split('/').pop() || filePath;

      await addFileToContext(filePath, true);
      setMentionedFilePaths((prev) => new Map(prev).set(fileName, filePath));

      const cursorPos = getCursorPosition();
      const before = input.slice(0, cursorPos);
      const after = input.slice(cursorPos);
      const mention = `@${fileName} `;
      const newInput = before + mention + after;
      setInput(newInput);

      if (editorRef.current) {
        editorRef.current.textContent = newInput;
        setTimeout(() => {
          setCursorPosition(cursorPos + mention.length);
          editorRef.current?.focus();
        }, 0);
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (showMentions && filteredFiles.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setMentionIndex((i) => (i + 1) % filteredFiles.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setMentionIndex((i) => (i - 1 + filteredFiles.length) % filteredFiles.length);
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        insertMention(filteredFiles[mentionIndex]);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setShowMentions(false);
        return;
      }
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  // Apply syntax highlighting to contenteditable
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;

    // Only update if text content differs
    const currentText = editor.textContent || '';
    if (currentText !== input) return;

    // Check if we need to apply highlighting
    if (!input.includes('@')) return;

    // Save cursor position
    const pos = getCursorPosition();

    // Apply highlighting by replacing text with styled HTML
    const highlighted = input.replace(
      /(@\S+)/g,
      '<span class="text-purple-400">$1</span>'
    );

    if (editor.innerHTML !== highlighted) {
      editor.innerHTML = highlighted;
      // Restore cursor
      setTimeout(() => setCursorPosition(pos), 0);
    }
  }, [input]);

  return (
    <div className="px-3 pt-2 pb-1 bg-bg-primary">
      {/* Pasted content chips */}
      {pastedContents.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {pastedContents.map((pasted) => (
            <div
              key={pasted.id}
              className="flex items-center gap-1.5 px-2 py-1 bg-bg-tertiary rounded text-xs text-text-secondary border border-border-primary"
            >
              <FileText className="w-3 h-3 text-text-muted" />
              <span className="truncate max-w-[150px]">{pasted.preview}</span>
              <span className="text-text-muted">+{pasted.lineCount - 1}</span>
              <button
                onClick={() => removePastedContent(pasted.id)}
                className="p-0.5 hover:bg-bg-hover rounded"
              >
                <X className="w-3 h-3 text-text-muted hover:text-text-primary" />
              </button>
            </div>
          ))}
        </div>
      )}
      <div className="flex items-start gap-2">
        <span className="text-accent-primary font-mono text-sm py-1 select-none">&gt;</span>
        <div className="flex-1 relative">
          <div
            ref={editorRef}
            contentEditable={!disabled}
            onInput={handleInput}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            data-placeholder="Type a message..."
            className="w-full py-1 pr-10 text-sm font-mono bg-transparent text-text-primary focus:outline-none disabled:opacity-50 whitespace-pre-wrap break-words max-h-[40px] overflow-y-auto empty:before:content-[attr(data-placeholder)] empty:before:text-text-muted"
            style={{ minHeight: '20px' }}
          />

          {/* @ Mention Dropdown */}
          {showMentions && filteredFiles.length > 0 && (
            <div
              ref={dropdownRef}
              className="absolute bottom-full left-0 mb-1 w-full max-h-48 overflow-y-auto bg-bg-secondary border border-border-primary rounded shadow-lg z-50"
            >
              {filteredFiles.map((file, index) => (
                <button
                  key={file.path}
                  onClick={() => insertMention(file)}
                  className={`w-full flex items-center gap-2 px-3 py-1.5 text-left text-xs font-mono hover:bg-bg-tertiary ${
                    index === mentionIndex ? 'bg-bg-tertiary' : ''
                  }`}
                >
                  <span className="text-text-muted shrink-0">&gt;</span>
                  <span className="truncate text-text-primary">{file.name}</span>
                  <span className="truncate text-text-muted ml-auto">{file.path}</span>
                </button>
              ))}
            </div>
          )}

          <IconButton
            size="sm"
            title="Attach file"
            onClick={handleAttachFile}
            className="absolute right-2 top-0.5"
          >
            <Paperclip className="w-3.5 h-3.5" />
          </IconButton>
        </div>
      </div>
    </div>
  );
}
