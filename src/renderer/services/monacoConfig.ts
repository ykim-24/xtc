import * as monaco from 'monaco-editor';

/**
 * Configure Monaco's built-in TypeScript/JavaScript language support
 * This gives us IntelliSense, diagnostics, hover info without external LSP
 */
export function configureMonacoLanguages() {
  console.log('[Monaco] Configuring TypeScript/JavaScript language support...');

  // TypeScript compiler options
  const compilerOptions: monaco.languages.typescript.CompilerOptions = {
    target: monaco.languages.typescript.ScriptTarget.ESNext,
    module: monaco.languages.typescript.ModuleKind.ESNext,
    moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
    allowNonTsExtensions: true,
    allowJs: true,
    checkJs: true,
    strict: true,
    noEmit: true,
    esModuleInterop: true,
    skipLibCheck: true,
    jsx: monaco.languages.typescript.JsxEmit.React,
    jsxFactory: 'React.createElement',
    jsxFragmentFactory: 'React.Fragment',
    lib: ['ESNext', 'DOM', 'DOM.Iterable'],
    resolveJsonModule: true,
    isolatedModules: true,
  };

  // Apply to TypeScript
  monaco.languages.typescript.typescriptDefaults.setCompilerOptions(compilerOptions);

  // Apply to JavaScript
  monaco.languages.typescript.javascriptDefaults.setCompilerOptions({
    ...compilerOptions,
    allowJs: true,
    checkJs: true,
  });

  console.log('[Monaco] TypeScript compiler options set');

  // Enable diagnostics
  monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({
    noSemanticValidation: false,
    noSyntaxValidation: false,
    noSuggestionDiagnostics: false,
  });

  monaco.languages.typescript.javascriptDefaults.setDiagnosticsOptions({
    noSemanticValidation: false,
    noSyntaxValidation: false,
    noSuggestionDiagnostics: false,
  });

  // Enable eager model sync for better IntelliSense across files
  monaco.languages.typescript.typescriptDefaults.setEagerModelSync(true);
  monaco.languages.typescript.javascriptDefaults.setEagerModelSync(true);

  // Add common type definitions
  addReactTypes();
  addNodeTypes();
}

/**
 * Add React type definitions for JSX support
 */
function addReactTypes() {
  const reactTypes = `
declare namespace React {
  type ReactNode =
    | React.ReactElement
    | string
    | number
    | boolean
    | null
    | undefined
    | Iterable<ReactNode>;

  interface ReactElement<P = any> {
    type: any;
    props: P;
    key: string | null;
  }

  type FC<P = {}> = (props: P) => ReactElement | null;
  type FunctionComponent<P = {}> = FC<P>;

  function useState<T>(initialState: T | (() => T)): [T, (value: T | ((prev: T) => T)) => void];
  function useEffect(effect: () => void | (() => void), deps?: readonly any[]): void;
  function useCallback<T extends (...args: any[]) => any>(callback: T, deps: readonly any[]): T;
  function useMemo<T>(factory: () => T, deps: readonly any[]): T;
  function useRef<T>(initialValue: T): { current: T };
  function useContext<T>(context: React.Context<T>): T;

  interface Context<T> {
    Provider: any;
    Consumer: any;
  }
  function createContext<T>(defaultValue: T): Context<T>;
}

declare namespace JSX {
  interface Element extends React.ReactElement<any, any> {}
  interface IntrinsicElements {
    [elemName: string]: any;
  }
}
`;

  monaco.languages.typescript.typescriptDefaults.addExtraLib(reactTypes, 'file:///node_modules/@types/react/index.d.ts');
  monaco.languages.typescript.javascriptDefaults.addExtraLib(reactTypes, 'file:///node_modules/@types/react/index.d.ts');
}

/**
 * Add Node.js type definitions
 */
function addNodeTypes() {
  const nodeTypes = `
declare var process: {
  env: { [key: string]: string | undefined };
  cwd(): string;
  platform: string;
};

declare var __dirname: string;
declare var __filename: string;

declare function require(id: string): any;

declare var module: {
  exports: any;
};

declare var exports: any;

declare var console: {
  log(...args: any[]): void;
  error(...args: any[]): void;
  warn(...args: any[]): void;
  info(...args: any[]): void;
  debug(...args: any[]): void;
};

declare function setTimeout(callback: () => void, ms?: number): number;
declare function clearTimeout(id: number): void;
declare function setInterval(callback: () => void, ms?: number): number;
declare function clearInterval(id: number): void;

// Buffer
declare class Buffer extends Uint8Array {
  static from(data: string | ArrayBuffer | Array<number>, encoding?: string): Buffer;
  static alloc(size: number, fill?: number): Buffer;
  static isBuffer(obj: any): obj is Buffer;
  toString(encoding?: string): string;
}

// Path module
declare module 'path' {
  export function join(...paths: string[]): string;
  export function resolve(...paths: string[]): string;
  export function dirname(path: string): string;
  export function basename(path: string, ext?: string): string;
  export function extname(path: string): string;
  export function relative(from: string, to: string): string;
  export function isAbsolute(path: string): boolean;
  export function normalize(path: string): string;
  export function parse(path: string): { root: string; dir: string; base: string; ext: string; name: string };
  export const sep: string;
  export const delimiter: string;
}

// FS module
declare module 'fs' {
  export function readFileSync(path: string, encoding?: string): string | Buffer;
  export function writeFileSync(path: string, data: string | Buffer, encoding?: string): void;
  export function existsSync(path: string): boolean;
  export function mkdirSync(path: string, options?: { recursive?: boolean }): void;
  export function readdirSync(path: string): string[];
  export function statSync(path: string): { isDirectory(): boolean; isFile(): boolean };
  export function unlinkSync(path: string): void;
  export function rmdirSync(path: string, options?: { recursive?: boolean }): void;
  export function copyFileSync(src: string, dest: string): void;
  export function renameSync(oldPath: string, newPath: string): void;
}

declare module 'fs/promises' {
  export function readFile(path: string, encoding?: string): Promise<string | Buffer>;
  export function writeFile(path: string, data: string | Buffer, encoding?: string): Promise<void>;
  export function mkdir(path: string, options?: { recursive?: boolean }): Promise<void>;
  export function readdir(path: string): Promise<string[]>;
  export function stat(path: string): Promise<{ isDirectory(): boolean; isFile(): boolean }>;
  export function unlink(path: string): Promise<void>;
  export function rm(path: string, options?: { recursive?: boolean; force?: boolean }): Promise<void>;
  export function copyFile(src: string, dest: string): Promise<void>;
  export function rename(oldPath: string, newPath: string): Promise<void>;
  export function access(path: string): Promise<void>;
}

// Assert module
declare module 'assert' {
  function assert(value: unknown, message?: string | Error): asserts value;
  namespace assert {
    function ok(value: unknown, message?: string | Error): asserts value;
    function equal(actual: unknown, expected: unknown, message?: string | Error): void;
    function notEqual(actual: unknown, expected: unknown, message?: string | Error): void;
    function strictEqual<T>(actual: unknown, expected: T, message?: string | Error): asserts actual is T;
    function notStrictEqual(actual: unknown, expected: unknown, message?: string | Error): void;
    function deepEqual(actual: unknown, expected: unknown, message?: string | Error): void;
    function notDeepEqual(actual: unknown, expected: unknown, message?: string | Error): void;
    function deepStrictEqual(actual: unknown, expected: unknown, message?: string | Error): void;
    function notDeepStrictEqual(actual: unknown, expected: unknown, message?: string | Error): void;
    function throws(block: () => unknown, message?: string | Error): void;
    function throws(block: () => unknown, error: Function | RegExp | Object, message?: string | Error): void;
    function doesNotThrow(block: () => unknown, message?: string | Error): void;
    function rejects(asyncFn: () => Promise<unknown>, message?: string | Error): Promise<void>;
    function doesNotReject(asyncFn: () => Promise<unknown>, message?: string | Error): Promise<void>;
    function fail(message?: string | Error): never;
    function match(value: string, regExp: RegExp, message?: string | Error): void;
    function doesNotMatch(value: string, regExp: RegExp, message?: string | Error): void;
    class AssertionError extends Error {
      actual: unknown;
      expected: unknown;
      operator: string;
      generatedMessage: boolean;
      code: 'ERR_ASSERTION';
    }
  }
  export = assert;
}

declare module 'node:assert' {
  export * from 'assert';
  import assert = require('assert');
  export = assert;
}

// Util module
declare module 'util' {
  export function promisify<T extends (...args: any[]) => any>(fn: T): (...args: Parameters<T>) => Promise<any>;
  export function format(format: string, ...args: any[]): string;
  export function inspect(obj: any, options?: { depth?: number; colors?: boolean }): string;
}

// Events module
declare module 'events' {
  export class EventEmitter {
    on(event: string, listener: (...args: any[]) => void): this;
    once(event: string, listener: (...args: any[]) => void): this;
    off(event: string, listener: (...args: any[]) => void): this;
    emit(event: string, ...args: any[]): boolean;
    removeAllListeners(event?: string): this;
    listeners(event: string): Function[];
  }
}

// Child process module
declare module 'child_process' {
  import { EventEmitter } from 'events';
  export interface ChildProcess extends EventEmitter {
    stdin: NodeJS.WritableStream | null;
    stdout: NodeJS.ReadableStream | null;
    stderr: NodeJS.ReadableStream | null;
    pid?: number;
    kill(signal?: string): boolean;
  }
  export function spawn(command: string, args?: string[], options?: any): ChildProcess;
  export function exec(command: string, callback?: (error: Error | null, stdout: string, stderr: string) => void): ChildProcess;
  export function execSync(command: string, options?: any): string | Buffer;
  export function fork(modulePath: string, args?: string[], options?: any): ChildProcess;
}

// OS module
declare module 'os' {
  export function platform(): string;
  export function homedir(): string;
  export function tmpdir(): string;
  export function hostname(): string;
  export function cpus(): Array<{ model: string; speed: number }>;
  export function totalmem(): number;
  export function freemem(): number;
  export const EOL: string;
}

// Crypto module
declare module 'crypto' {
  export function createHash(algorithm: string): Hash;
  export function randomBytes(size: number): Buffer;
  export function randomUUID(): string;
  interface Hash {
    update(data: string | Buffer): Hash;
    digest(encoding?: string): string | Buffer;
  }
}

// URL module
declare module 'url' {
  export function parse(urlString: string): { protocol?: string; host?: string; pathname?: string; search?: string; hash?: string };
  export function format(urlObject: any): string;
  export class URL {
    constructor(input: string, base?: string);
    href: string;
    protocol: string;
    host: string;
    hostname: string;
    port: string;
    pathname: string;
    search: string;
    hash: string;
    searchParams: URLSearchParams;
  }
  export class URLSearchParams {
    constructor(init?: string | Record<string, string>);
    get(name: string): string | null;
    set(name: string, value: string): void;
    has(name: string): boolean;
    delete(name: string): void;
    toString(): string;
  }
}

// HTTP module
declare module 'http' {
  import { EventEmitter } from 'events';
  export interface IncomingMessage extends EventEmitter {
    url?: string;
    method?: string;
    headers: Record<string, string | string[] | undefined>;
    statusCode?: number;
  }
  export interface ServerResponse extends EventEmitter {
    statusCode: number;
    setHeader(name: string, value: string | number): void;
    end(data?: string | Buffer): void;
    write(data: string | Buffer): boolean;
  }
  export function createServer(requestListener?: (req: IncomingMessage, res: ServerResponse) => void): any;
  export function request(options: any, callback?: (res: IncomingMessage) => void): any;
  export function get(url: string, callback?: (res: IncomingMessage) => void): any;
}

// Stream module
declare module 'stream' {
  import { EventEmitter } from 'events';
  export class Readable extends EventEmitter {
    read(size?: number): any;
    pipe<T extends NodeJS.WritableStream>(destination: T): T;
  }
  export class Writable extends EventEmitter {
    write(chunk: any, encoding?: string, callback?: () => void): boolean;
    end(chunk?: any, encoding?: string, callback?: () => void): void;
  }
  export class Transform extends EventEmitter {
    read(size?: number): any;
    write(chunk: any, encoding?: string, callback?: () => void): boolean;
  }
  export class Duplex extends EventEmitter {}
}

// NodeJS namespace
declare namespace NodeJS {
  interface WritableStream {
    write(data: string | Buffer): boolean;
    end(): void;
  }
  interface ReadableStream {
    read(): any;
    on(event: string, listener: (...args: any[]) => void): this;
  }
}
`;

  monaco.languages.typescript.typescriptDefaults.addExtraLib(nodeTypes, 'file:///node_modules/@types/node/index.d.ts');
  monaco.languages.typescript.javascriptDefaults.addExtraLib(nodeTypes, 'file:///node_modules/@types/node/index.d.ts');

  // Add Jest globals
  const jestTypes = `
declare module '@jest/globals' {
  export function describe(name: string, fn: () => void): void;
  export function it(name: string, fn: () => void | Promise<void>): void;
  export function test(name: string, fn: () => void | Promise<void>): void;
  export function expect<T>(actual: T): {
    toBe(expected: T): void;
    toEqual(expected: any): void;
    toBeTruthy(): void;
    toBeFalsy(): void;
    toBeNull(): void;
    toBeUndefined(): void;
    toBeDefined(): void;
    toContain(item: any): void;
    toHaveLength(length: number): void;
    toThrow(error?: string | Error | RegExp): void;
    toMatch(pattern: string | RegExp): void;
    toHaveProperty(path: string, value?: any): void;
    toBeGreaterThan(n: number): void;
    toBeLessThan(n: number): void;
    toBeGreaterThanOrEqual(n: number): void;
    toBeLessThanOrEqual(n: number): void;
    toBeInstanceOf(cls: any): void;
    toHaveBeenCalled(): void;
    toHaveBeenCalledWith(...args: any[]): void;
    toHaveBeenCalledTimes(n: number): void;
    resolves: any;
    rejects: any;
    not: any;
  };
  export function beforeAll(fn: () => void | Promise<void>): void;
  export function afterAll(fn: () => void | Promise<void>): void;
  export function beforeEach(fn: () => void | Promise<void>): void;
  export function afterEach(fn: () => void | Promise<void>): void;
  export const jest: {
    fn<T extends (...args: any[]) => any>(implementation?: T): T & { mock: any };
    spyOn(object: any, method: string): any;
    mock(moduleName: string): void;
    clearAllMocks(): void;
    resetAllMocks(): void;
    restoreAllMocks(): void;
  };
}

// Global Jest functions
declare function describe(name: string, fn: () => void): void;
declare function it(name: string, fn: () => void | Promise<void>): void;
declare function test(name: string, fn: () => void | Promise<void>): void;
declare function expect<T>(actual: T): any;
declare function beforeAll(fn: () => void | Promise<void>): void;
declare function afterAll(fn: () => void | Promise<void>): void;
declare function beforeEach(fn: () => void | Promise<void>): void;
declare function afterEach(fn: () => void | Promise<void>): void;
declare const jest: any;
`;

  monaco.languages.typescript.typescriptDefaults.addExtraLib(jestTypes, 'file:///node_modules/@types/jest/index.d.ts');
  monaco.languages.typescript.javascriptDefaults.addExtraLib(jestTypes, 'file:///node_modules/@types/jest/index.d.ts');
}

// Track registered files to avoid duplicates
const registeredFiles = new Set<string>();

/**
 * Register a project's TypeScript/JavaScript files with Monaco for cross-file IntelliSense
 */
export function registerProjectFiles(files: { path: string; content: string }[]) {
  for (const file of files) {
    registerProjectFile(file.path, file.content);
  }
}

/**
 * Register a single file with Monaco
 */
export function registerProjectFile(path: string, content: string) {
  if (!path.match(/\.(ts|tsx|js|jsx|json)$/)) return;
  if (registeredFiles.has(path)) return;

  const uri = `file://${path}`;

  try {
    // Add to TypeScript language service
    monaco.languages.typescript.typescriptDefaults.addExtraLib(content, uri);

    // Also add to JavaScript for .js files
    if (path.match(/\.(js|jsx)$/)) {
      monaco.languages.typescript.javascriptDefaults.addExtraLib(content, uri);
    }

    registeredFiles.add(path);
  } catch (e) {
    // Ignore errors for invalid files
  }
}

/**
 * Clear all registered project files (e.g., when switching projects)
 */
export function clearRegisteredFiles() {
  registeredFiles.clear();
  // Note: Monaco doesn't have a way to remove individual extra libs,
  // but they get replaced on re-registration
}

/**
 * Register type definitions from a project's node_modules
 */
export function registerTypeDefinition(packageName: string, content: string) {
  const uri = `file:///node_modules/@types/${packageName}/index.d.ts`;
  monaco.languages.typescript.typescriptDefaults.addExtraLib(content, uri);
  monaco.languages.typescript.javascriptDefaults.addExtraLib(content, uri);
}

/**
 * Load and register all type definitions from a project's node_modules/@types
 */
export async function loadProjectTypes(projectPath: string): Promise<number> {
  try {
    const result = await window.electron?.loadTypes(projectPath);
    if (result?.success && result.types) {
      for (const { packageName, content } of result.types) {
        registerTypeDefinition(packageName, content);
      }
      console.log(`[Monaco] Loaded ${result.types.length} type definitions from ${projectPath}`);
      return result.types.length;
    }
  } catch (e) {
    console.error('[Monaco] Failed to load project types:', e);
  }
  return 0;
}
