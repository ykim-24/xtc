import * as monaco from 'monaco-editor';

// Map file extensions to language server names
const LANGUAGE_TO_SERVER: Record<string, string> = {
  python: 'python',
  go: 'go',
  rust: 'rust',
  c: 'cpp',
  cpp: 'cpp',
};

// Languages that have native Monaco support (no LSP needed)
const NATIVE_MONACO_LANGUAGES = [
  'typescript',
  'javascript',
  'typescriptreact',
  'javascriptreact',
  'json',
  'html',
  'css',
  'scss',
  'less',
  'markdown',
];

class LSPService {
  private initialized = false;
  private startedServers = new Set<string>();
  private projectPath: string | null = null;
  private disposables: monaco.IDisposable[] = [];

  /**
   * Initialize LSP service with project path
   */
  async initialize(projectPath: string) {
    if (this.projectPath === projectPath && this.initialized) {
      return;
    }

    this.projectPath = projectPath;
    this.initialized = true;

    // Set project path in LSP manager
    await window.electron?.lsp.setProjectPath(projectPath);

    // Register Monaco providers
    this.registerProviders();
  }

  /**
   * Register Monaco language providers that delegate to LSP
   */
  private registerProviders() {
    // Clean up previous providers
    this.disposables.forEach(d => d.dispose());
    this.disposables = [];

    // Get languages that need LSP
    const lspLanguages = Object.keys(LANGUAGE_TO_SERVER);

    for (const languageId of lspLanguages) {
      // Hover provider
      this.disposables.push(
        monaco.languages.registerHoverProvider(languageId, {
          provideHover: async (model, position) => {
            const serverName = LANGUAGE_TO_SERVER[languageId];
            if (!serverName || !this.startedServers.has(serverName)) return null;

            const uri = model.uri.toString();
            const result = await window.electron?.lsp.getHover(
              uri,
              languageId,
              position.lineNumber - 1, // Monaco is 1-indexed, LSP is 0-indexed
              position.column - 1
            );

            if (!result?.success || !result.data) return null;

            const hover = result.data as { contents: { value: string; kind?: string }; range?: { start: { line: number; character: number }; end: { line: number; character: number } } };

            if (!hover.contents) return null;

            return {
              contents: [
                {
                  value: typeof hover.contents === 'string'
                    ? hover.contents
                    : Array.isArray(hover.contents)
                      ? hover.contents.map((c: { value: string } | string) => typeof c === 'string' ? c : c.value).join('\n')
                      : (hover.contents as { value: string }).value || '',
                },
              ],
              range: hover.range
                ? new monaco.Range(
                    hover.range.start.line + 1,
                    hover.range.start.character + 1,
                    hover.range.end.line + 1,
                    hover.range.end.character + 1
                  )
                : undefined,
            };
          },
        })
      );

      // Completion provider
      this.disposables.push(
        monaco.languages.registerCompletionItemProvider(languageId, {
          triggerCharacters: ['.', ':', '<', '"', "'", '/', '@', '*'],
          provideCompletionItems: async (model, position) => {
            const serverName = LANGUAGE_TO_SERVER[languageId];
            if (!serverName || !this.startedServers.has(serverName)) return { suggestions: [] };

            const uri = model.uri.toString();
            const result = await window.electron?.lsp.getCompletions(
              uri,
              languageId,
              position.lineNumber - 1,
              position.column - 1
            );

            if (!result?.success || !result.data) return { suggestions: [] };

            const completions = result.data as { items?: unknown[]; isIncomplete?: boolean } | unknown[];
            const items = Array.isArray(completions) ? completions : completions.items || [];

            return {
              suggestions: items.map((item: unknown) => {
                const completionItem = item as {
                  label: string;
                  kind?: number;
                  detail?: string;
                  documentation?: string | { value: string };
                  insertText?: string;
                  filterText?: string;
                  sortText?: string;
                };
                return {
                  label: completionItem.label,
                  kind: this.mapCompletionKind(completionItem.kind),
                  detail: completionItem.detail,
                  documentation: typeof completionItem.documentation === 'string'
                    ? completionItem.documentation
                    : completionItem.documentation?.value,
                  insertText: completionItem.insertText || completionItem.label,
                  filterText: completionItem.filterText,
                  sortText: completionItem.sortText,
                  range: {
                    startLineNumber: position.lineNumber,
                    startColumn: position.column,
                    endLineNumber: position.lineNumber,
                    endColumn: position.column,
                  },
                };
              }),
            };
          },
        })
      );

      // Definition provider
      this.disposables.push(
        monaco.languages.registerDefinitionProvider(languageId, {
          provideDefinition: async (model, position) => {
            const serverName = LANGUAGE_TO_SERVER[languageId];
            if (!serverName || !this.startedServers.has(serverName)) return null;

            const uri = model.uri.toString();
            const result = await window.electron?.lsp.getDefinition(
              uri,
              languageId,
              position.lineNumber - 1,
              position.column - 1
            );

            if (!result?.success || !result.data) return null;

            const definitions = result.data as { uri: string; range: { start: { line: number; character: number }; end: { line: number; character: number } } }[];
            const defArray = Array.isArray(definitions) ? definitions : [definitions];

            return defArray.map(def => ({
              uri: monaco.Uri.parse(def.uri),
              range: new monaco.Range(
                def.range.start.line + 1,
                def.range.start.character + 1,
                def.range.end.line + 1,
                def.range.end.character + 1
              ),
            }));
          },
        })
      );

      // References provider
      this.disposables.push(
        monaco.languages.registerReferenceProvider(languageId, {
          provideReferences: async (model, position) => {
            const serverName = LANGUAGE_TO_SERVER[languageId];
            if (!serverName || !this.startedServers.has(serverName)) return null;

            const uri = model.uri.toString();
            const result = await window.electron?.lsp.getReferences(
              uri,
              languageId,
              position.lineNumber - 1,
              position.column - 1
            );

            if (!result?.success || !result.data) return null;

            const references = result.data as { uri: string; range: { start: { line: number; character: number }; end: { line: number; character: number } } }[];

            return references.map(ref => ({
              uri: monaco.Uri.parse(ref.uri),
              range: new monaco.Range(
                ref.range.start.line + 1,
                ref.range.start.character + 1,
                ref.range.end.line + 1,
                ref.range.end.character + 1
              ),
            }));
          },
        })
      );

      // Document formatting provider
      this.disposables.push(
        monaco.languages.registerDocumentFormattingEditProvider(languageId, {
          provideDocumentFormattingEdits: async (model) => {
            const serverName = LANGUAGE_TO_SERVER[languageId];
            if (!serverName || !this.startedServers.has(serverName)) return [];

            const uri = model.uri.toString();
            const result = await window.electron?.lsp.formatDocument(uri, languageId);

            if (!result?.success || !result.data) return [];

            const edits = result.data as { range: { start: { line: number; character: number }; end: { line: number; character: number } }; newText: string }[];

            return edits.map(edit => ({
              range: new monaco.Range(
                edit.range.start.line + 1,
                edit.range.start.character + 1,
                edit.range.end.line + 1,
                edit.range.end.character + 1
              ),
              text: edit.newText,
            }));
          },
        })
      );
    }
  }

  /**
   * Map LSP completion kind to Monaco completion kind
   */
  private mapCompletionKind(kind?: number): monaco.languages.CompletionItemKind {
    // LSP completion kinds: https://microsoft.github.io/language-server-protocol/specifications/lsp/3.17/specification/#completionItemKind
    const mapping: Record<number, monaco.languages.CompletionItemKind> = {
      1: monaco.languages.CompletionItemKind.Text,
      2: monaco.languages.CompletionItemKind.Method,
      3: monaco.languages.CompletionItemKind.Function,
      4: monaco.languages.CompletionItemKind.Constructor,
      5: monaco.languages.CompletionItemKind.Field,
      6: monaco.languages.CompletionItemKind.Variable,
      7: monaco.languages.CompletionItemKind.Class,
      8: monaco.languages.CompletionItemKind.Interface,
      9: monaco.languages.CompletionItemKind.Module,
      10: monaco.languages.CompletionItemKind.Property,
      11: monaco.languages.CompletionItemKind.Unit,
      12: monaco.languages.CompletionItemKind.Value,
      13: monaco.languages.CompletionItemKind.Enum,
      14: monaco.languages.CompletionItemKind.Keyword,
      15: monaco.languages.CompletionItemKind.Snippet,
      16: monaco.languages.CompletionItemKind.Color,
      17: monaco.languages.CompletionItemKind.File,
      18: monaco.languages.CompletionItemKind.Reference,
      19: monaco.languages.CompletionItemKind.Folder,
      20: monaco.languages.CompletionItemKind.EnumMember,
      21: monaco.languages.CompletionItemKind.Constant,
      22: monaco.languages.CompletionItemKind.Struct,
      23: monaco.languages.CompletionItemKind.Event,
      24: monaco.languages.CompletionItemKind.Operator,
      25: monaco.languages.CompletionItemKind.TypeParameter,
    };
    return kind ? mapping[kind] || monaco.languages.CompletionItemKind.Text : monaco.languages.CompletionItemKind.Text;
  }

  /**
   * Start language server for a language if needed
   */
  async ensureServerForLanguage(language: string) {
    // Skip languages with native Monaco support
    if (NATIVE_MONACO_LANGUAGES.includes(language)) {
      return;
    }

    const serverName = LANGUAGE_TO_SERVER[language];
    if (!serverName) return;

    if (this.startedServers.has(serverName)) return;

    console.log(`Starting ${serverName} language server...`);
    const result = await window.electron?.lsp.startServer(serverName);

    if (result?.success) {
      this.startedServers.add(serverName);
      console.log(`${serverName} language server started successfully`);
    } else {
      console.warn(`Failed to start ${serverName} language server. Make sure it's installed.`);
    }
  }

  /**
   * Notify server that a document was opened
   */
  async didOpen(filePath: string, language: string, content: string) {
    await this.ensureServerForLanguage(language);

    const serverName = LANGUAGE_TO_SERVER[language];
    if (!serverName || !this.startedServers.has(serverName)) return;

    const uri = `file://${filePath}`;
    await window.electron?.lsp.didOpen(uri, language, content);
  }

  /**
   * Notify server that a document changed
   */
  async didChange(filePath: string, language: string, content: string) {
    const serverName = LANGUAGE_TO_SERVER[language];
    if (!serverName || !this.startedServers.has(serverName)) return;

    const uri = `file://${filePath}`;
    await window.electron?.lsp.didChange(uri, language, content);
  }

  /**
   * Notify server that a document was closed
   */
  async didClose(filePath: string, language: string) {
    const serverName = LANGUAGE_TO_SERVER[language];
    if (!serverName || !this.startedServers.has(serverName)) return;

    const uri = `file://${filePath}`;
    await window.electron?.lsp.didClose(uri, language);
  }

  /**
   * Stop all language servers
   */
  async stopAll() {
    await window.electron?.lsp.stopAll();
    this.startedServers.clear();
    this.initialized = false;
  }

  /**
   * Get list of supported languages
   */
  getSupportedLanguages() {
    return Object.keys(LANGUAGE_TO_SERVER);
  }

  /**
   * Check if a language is supported by LSP
   */
  isSupported(language: string) {
    return language in LANGUAGE_TO_SERVER;
  }

  /**
   * Dispose all resources
   */
  dispose() {
    this.disposables.forEach(d => d.dispose());
    this.disposables = [];
  }
}

export const lspService = new LSPService();
