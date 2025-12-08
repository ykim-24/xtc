import Editor, { loader, OnMount } from '@monaco-editor/react';
import * as monaco from 'monaco-editor';
import { useRef, useEffect, useCallback } from 'react';
import { useProjectStore, useSettingsStore } from '@/stores';
import { useTheme } from '@/themes';
import { configureMonacoLanguages, registerProjectFile } from '@/services/monacoConfig';
import { lspService } from '@/services/lspService';

// Import workers
import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker';
import jsonWorker from 'monaco-editor/esm/vs/language/json/json.worker?worker';
import cssWorker from 'monaco-editor/esm/vs/language/css/css.worker?worker';
import htmlWorker from 'monaco-editor/esm/vs/language/html/html.worker?worker';
import tsWorker from 'monaco-editor/esm/vs/language/typescript/ts.worker?worker';

// Configure Monaco workers
self.MonacoEnvironment = {
  getWorker(_, label) {
    if (label === 'json') {
      return new jsonWorker();
    }
    if (label === 'css' || label === 'scss' || label === 'less') {
      return new cssWorker();
    }
    if (label === 'html' || label === 'handlebars' || label === 'razor') {
      return new htmlWorker();
    }
    if (label === 'typescript' || label === 'javascript') {
      return new tsWorker();
    }
    return new editorWorker();
  },
};

// Configure Monaco to use local files instead of CDN
loader.config({ monaco });

// Configure language support once - must happen before any models are created
let languagesConfigured = false;
loader.init().then((monacoInstance) => {
  if (!languagesConfigured) {
    console.log('[MonacoEditor] Monaco loaded, configuring languages...');
    configureMonacoLanguages();
    languagesConfigured = true;
    console.log('[MonacoEditor] Languages configured');
  }
});

// Store models per file path to preserve undo history
const fileModels = new Map<string, monaco.editor.ITextModel>();

// Get or create a model for a file
function getOrCreateModel(filePath: string, content: string, language: string): monaco.editor.ITextModel {
  let model = fileModels.get(filePath);

  if (!model || model.isDisposed()) {
    // Create URI from file path
    const uri = monaco.Uri.file(filePath);

    // Check if model already exists in Monaco (by URI)
    model = monaco.editor.getModel(uri) || undefined;

    if (!model) {
      model = monaco.editor.createModel(content, language, uri);
    }

    fileModels.set(filePath, model);
  }

  return model;
}

// Update model content without resetting undo stack
function updateModelContent(model: monaco.editor.ITextModel, content: string) {
  const currentContent = model.getValue();
  if (currentContent !== content) {
    // Only update if content is different (e.g., external change)
    // This preserves undo stack for normal edits
    model.setValue(content);
  }
}

export function MonacoEditor() {
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const currentPathRef = useRef<string | null>(null);
  const { openFiles, activeFilePath, updateFileContent, projectPath } = useProjectStore();
  const {
    fontSize,
    fontFamily,
    tabSize,
    wordWrap,
    lineNumbers,
    minimap,
    cursorBlinking,
    cursorStyle,
    renderWhitespace,
    bracketPairColorization,
    autoClosingBrackets,
    lineHeight,
    scrollBeyondLastLine,
    smoothScrolling,
  } = useSettingsStore();
  const { theme } = useTheme();

  const activeFile = openFiles.find((f) => f.path === activeFilePath);

  // Update editor options when settings change
  useEffect(() => {
    if (editorRef.current) {
      editorRef.current.updateOptions({
        fontSize,
        fontFamily,
        lineHeight,
        tabSize,
        wordWrap: wordWrap ? 'on' : 'off',
        lineNumbers,
        minimap: { enabled: minimap },
        cursorBlinking,
        cursorStyle,
        renderWhitespace,
        bracketPairColorization: { enabled: bracketPairColorization },
        autoClosingBrackets: autoClosingBrackets ? 'always' : 'never',
        scrollBeyondLastLine,
        smoothScrolling,
      });
    }
  }, [
    fontSize,
    fontFamily,
    lineHeight,
    tabSize,
    wordWrap,
    lineNumbers,
    minimap,
    cursorBlinking,
    cursorStyle,
    renderWhitespace,
    bracketPairColorization,
    autoClosingBrackets,
    scrollBeyondLastLine,
    smoothScrolling,
  ]);

  // Initialize LSP service when project path changes
  useEffect(() => {
    if (projectPath) {
      lspService.initialize(projectPath);
    }
    return () => {
      // Don't stop servers on unmount, just cleanup on project change
    };
  }, [projectPath]);

  // Switch model when active file changes
  useEffect(() => {
    if (!editorRef.current || !activeFile) return;

    // Only switch if the path actually changed
    if (currentPathRef.current === activeFile.path) return;

    const previousPath = currentPathRef.current;
    const previousFile = openFiles.find(f => f.path === previousPath);
    currentPathRef.current = activeFile.path;

    // Notify LSP that previous file was closed (if it was an LSP-supported language)
    if (previousPath && previousFile && lspService.isSupported(previousFile.language)) {
      lspService.didClose(previousPath, previousFile.language);
    }

    // Register file with Monaco for cross-file IntelliSense
    registerProjectFile(activeFile.path, activeFile.content);

    // Notify LSP that file was opened
    if (lspService.isSupported(activeFile.language)) {
      lspService.didOpen(activeFile.path, activeFile.language, activeFile.content);
    }

    const model = getOrCreateModel(activeFile.path, activeFile.content, activeFile.language);
    editorRef.current.setModel(model);
  }, [activeFile?.path, activeFile?.language, openFiles]);

  // Register all open files for IntelliSense
  useEffect(() => {
    for (const file of openFiles) {
      registerProjectFile(file.path, file.content);
    }
  }, [openFiles]);

  // Clean up models for closed files
  useEffect(() => {
    const openPaths = new Set(openFiles.map((f) => f.path));

    for (const [path, model] of fileModels.entries()) {
      if (!openPaths.has(path)) {
        model.dispose();
        fileModels.delete(path);
      }
    }
  }, [openFiles]);

  const handleEditorMount: OnMount = useCallback((editor) => {
    editorRef.current = editor;

    // Set initial model if we have an active file
    if (activeFile) {
      currentPathRef.current = activeFile.path;
      const model = getOrCreateModel(activeFile.path, activeFile.content, activeFile.language);
      editor.setModel(model);
    }
  }, [activeFile?.path, activeFile?.content, activeFile?.language]);

  const handleChange = useCallback((value: string | undefined) => {
    if (value !== undefined && activeFilePath && activeFile) {
      updateFileContent(activeFilePath, value);

      // Notify LSP of document change
      if (lspService.isSupported(activeFile.language)) {
        lspService.didChange(activeFilePath, activeFile.language, value);
      }
    }
  }, [activeFilePath, activeFile, updateFileContent]);

  if (!activeFile) {
    return null;
  }

  return (
    <Editor
      height="100%"
      // Don't pass value/language - we manage models manually
      onChange={handleChange}
      onMount={handleEditorMount}
      theme={theme === 'dark' ? 'vs-dark' : 'light'}
      options={{
        fontSize,
        fontFamily,
        lineHeight,
        tabSize,
        wordWrap: wordWrap ? 'on' : 'off',
        lineNumbers,
        minimap: { enabled: minimap },
        cursorBlinking,
        cursorStyle,
        renderWhitespace,
        bracketPairColorization: { enabled: bracketPairColorization },
        autoClosingBrackets: autoClosingBrackets ? 'always' : 'never',
        scrollBeyondLastLine,
        smoothScrolling,
        automaticLayout: true,
        renderLineHighlight: 'line',
        padding: { top: 8, bottom: 8 },
        fontLigatures: true,
      }}
    />
  );
}
