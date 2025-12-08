import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';
import {
  createMessageConnection,
  MessageConnection,
  InitializeRequest,
  InitializeParams,
  InitializedNotification,
  DidOpenTextDocumentNotification,
  DidChangeTextDocumentNotification,
  DidCloseTextDocumentNotification,
  CompletionRequest,
  HoverRequest,
  DefinitionRequest,
  ReferencesRequest,
  DocumentFormattingRequest,
} from 'vscode-languageserver-protocol';
import { StreamMessageReader, StreamMessageWriter } from 'vscode-jsonrpc/node.js';

interface LanguageServerConfig {
  command: string;
  args: string[];
  languages: string[];
}

// Language server configurations
// These require the user to have the servers installed
const LANGUAGE_SERVERS: Record<string, LanguageServerConfig> = {
  python: {
    command: 'pyright-langserver',
    args: ['--stdio'],
    languages: ['python'],
  },
  go: {
    command: 'gopls',
    args: ['serve'],
    languages: ['go'],
  },
  rust: {
    command: 'rust-analyzer',
    args: [],
    languages: ['rust'],
  },
  // C/C++ - requires clangd
  cpp: {
    command: 'clangd',
    args: [],
    languages: ['c', 'cpp'],
  },
};

interface ActiveServer {
  process: ChildProcess;
  connection: MessageConnection;
  languages: string[];
  capabilities: any;
}

class LSPManager {
  private servers: Map<string, ActiveServer> = new Map();
  private projectPath: string | null = null;
  private documentVersions: Map<string, number> = new Map();

  setProjectPath(projectPath: string) {
    this.projectPath = projectPath;
  }

  /**
   * Start a language server for a specific language
   */
  async startServer(serverName: string): Promise<boolean> {
    if (this.servers.has(serverName)) {
      return true; // Already running
    }

    const config = LANGUAGE_SERVERS[serverName];
    if (!config) {
      console.error(`Unknown language server: ${serverName}`);
      return false;
    }

    try {
      // Check if the command exists
      const process = spawn(config.command, config.args, {
        stdio: ['pipe', 'pipe', 'pipe'],
        cwd: this.projectPath || undefined,
      });

      // Handle process errors
      process.on('error', (err) => {
        console.error(`Failed to start ${serverName} language server:`, err.message);
        this.servers.delete(serverName);
      });

      process.stderr?.on('data', (data) => {
        console.error(`[${serverName}] stderr:`, data.toString());
      });

      // Create JSON-RPC connection
      const connection = createMessageConnection(
        new StreamMessageReader(process.stdout!),
        new StreamMessageWriter(process.stdin!)
      );

      connection.listen();

      // Initialize the server
      const initParams: InitializeParams = {
        processId: process.pid ?? null,
        rootUri: this.projectPath ? `file://${this.projectPath}` : null,
        capabilities: {
          textDocument: {
            completion: {
              completionItem: {
                snippetSupport: true,
                documentationFormat: ['markdown', 'plaintext'],
              },
            },
            hover: {
              contentFormat: ['markdown', 'plaintext'],
            },
            definition: {},
            references: {},
            formatting: {},
            synchronization: {
              didSave: true,
              willSave: true,
              willSaveWaitUntil: true,
            },
          },
          workspace: {
            workspaceFolders: true,
          },
        },
        workspaceFolders: this.projectPath
          ? [{ uri: `file://${this.projectPath}`, name: path.basename(this.projectPath) }]
          : null,
      };

      const initResult = await connection.sendRequest(InitializeRequest.type, initParams);

      // Send initialized notification
      connection.sendNotification(InitializedNotification.type, {});

      this.servers.set(serverName, {
        process,
        connection,
        languages: config.languages,
        capabilities: initResult.capabilities,
      });

      console.log(`Started ${serverName} language server`);
      return true;
    } catch (err) {
      console.error(`Failed to start ${serverName} language server:`, err);
      return false;
    }
  }

  /**
   * Stop a language server
   */
  async stopServer(serverName: string): Promise<void> {
    const server = this.servers.get(serverName);
    if (!server) return;

    try {
      server.connection.dispose();
      server.process.kill();
    } catch (err) {
      console.error(`Error stopping ${serverName}:`, err);
    }

    this.servers.delete(serverName);
  }

  /**
   * Stop all language servers
   */
  async stopAll(): Promise<void> {
    for (const serverName of this.servers.keys()) {
      await this.stopServer(serverName);
    }
  }

  /**
   * Get server for a language
   */
  private getServerForLanguage(language: string): ActiveServer | null {
    for (const server of this.servers.values()) {
      if (server.languages.includes(language)) {
        return server;
      }
    }
    return null;
  }

  /**
   * Notify server that a document was opened
   */
  async didOpen(uri: string, language: string, content: string): Promise<void> {
    const server = this.getServerForLanguage(language);
    if (!server) return;

    this.documentVersions.set(uri, 1);

    server.connection.sendNotification(DidOpenTextDocumentNotification.type, {
      textDocument: {
        uri,
        languageId: language,
        version: 1,
        text: content,
      },
    });
  }

  /**
   * Notify server that a document changed
   */
  async didChange(uri: string, language: string, content: string): Promise<void> {
    const server = this.getServerForLanguage(language);
    if (!server) return;

    const version = (this.documentVersions.get(uri) || 0) + 1;
    this.documentVersions.set(uri, version);

    server.connection.sendNotification(DidChangeTextDocumentNotification.type, {
      textDocument: { uri, version },
      contentChanges: [{ text: content }],
    });
  }

  /**
   * Notify server that a document was closed
   */
  async didClose(uri: string, language: string): Promise<void> {
    const server = this.getServerForLanguage(language);
    if (!server) return;

    this.documentVersions.delete(uri);

    server.connection.sendNotification(DidCloseTextDocumentNotification.type, {
      textDocument: { uri },
    });
  }

  /**
   * Get completions at a position
   */
  async getCompletions(
    uri: string,
    language: string,
    line: number,
    character: number
  ): Promise<any> {
    const server = this.getServerForLanguage(language);
    if (!server) return null;

    try {
      const result = await server.connection.sendRequest(CompletionRequest.type, {
        textDocument: { uri },
        position: { line, character },
      });
      return result;
    } catch (err) {
      console.error('Completion error:', err);
      return null;
    }
  }

  /**
   * Get hover info at a position
   */
  async getHover(
    uri: string,
    language: string,
    line: number,
    character: number
  ): Promise<any> {
    const server = this.getServerForLanguage(language);
    if (!server) return null;

    try {
      const result = await server.connection.sendRequest(HoverRequest.type, {
        textDocument: { uri },
        position: { line, character },
      });
      return result;
    } catch (err) {
      console.error('Hover error:', err);
      return null;
    }
  }

  /**
   * Get definition at a position
   */
  async getDefinition(
    uri: string,
    language: string,
    line: number,
    character: number
  ): Promise<any> {
    const server = this.getServerForLanguage(language);
    if (!server) return null;

    try {
      const result = await server.connection.sendRequest(DefinitionRequest.type, {
        textDocument: { uri },
        position: { line, character },
      });
      return result;
    } catch (err) {
      console.error('Definition error:', err);
      return null;
    }
  }

  /**
   * Get references at a position
   */
  async getReferences(
    uri: string,
    language: string,
    line: number,
    character: number
  ): Promise<any> {
    const server = this.getServerForLanguage(language);
    if (!server) return null;

    try {
      const result = await server.connection.sendRequest(ReferencesRequest.type, {
        textDocument: { uri },
        position: { line, character },
        context: { includeDeclaration: true },
      });
      return result;
    } catch (err) {
      console.error('References error:', err);
      return null;
    }
  }

  /**
   * Format document
   */
  async formatDocument(uri: string, language: string): Promise<any> {
    const server = this.getServerForLanguage(language);
    if (!server) return null;

    try {
      const result = await server.connection.sendRequest(DocumentFormattingRequest.type, {
        textDocument: { uri },
        options: {
          tabSize: 2,
          insertSpaces: true,
        },
      });
      return result;
    } catch (err) {
      console.error('Format error:', err);
      return null;
    }
  }

  /**
   * Check if a server is available for a language
   */
  isServerAvailable(language: string): boolean {
    return this.getServerForLanguage(language) !== null;
  }

  /**
   * Get list of available language servers
   */
  getAvailableServers(): string[] {
    return Object.keys(LANGUAGE_SERVERS);
  }

  /**
   * Get running servers
   */
  getRunningServers(): string[] {
    return Array.from(this.servers.keys());
  }
}

export const lspManager = new LSPManager();
