# ET IDE - Feature Documentation

This document provides comprehensive documentation of all features in the ET IDE for LLM context.

## Architecture Overview

ET is an Electron-based IDE with:
- **Main Process** (`src/electron/main.ts`) - Node.js backend handling file system, spawning processes, IPC
- **Preload** (`src/electron/preload.ts`) - Bridge between main and renderer with secure API exposure
- **Renderer** (`src/renderer/`) - React frontend with Zustand state management

## Directory Structure

```
src/
├── electron/
│   ├── main.ts          # Electron main process, IPC handlers
│   └── preload.ts       # Context bridge API
├── renderer/
│   ├── components/      # React components organized by feature
│   ├── stores/          # Zustand state stores
│   ├── App.tsx          # Root component
│   └── main.tsx         # Entry point
```

---

## Feature Categories

### 1. Editor & File Management

#### File Explorer (`src/renderer/components/explorer/`)
- Hierarchical project file tree with folder expansion/collapse
- File type icons based on extension
- Right-click context menu for file operations
- Create, rename, delete files and directories
- Reveal in system finder

#### Editor Tabs (`src/renderer/components/editor/`)
- Multi-file editing with tab interface
- Dirty state indicators (unsaved changes)
- Close individual tabs or all tabs
- Recently closed files recovery

#### Monaco Editor Integration
- Full-featured code editor with syntax highlighting
- Support for TypeScript, JavaScript, Python, and more
- Configurable settings (font, theme, line numbers, etc.)
- Auto-formatting on save/paste
- Bracket pair colorization
- Minimap toggle

#### File Operations (IPC handlers in `main.ts`)
- `file:read` - Read file contents
- `file:write` - Write file contents
- `file:delete` - Delete file
- `file:rename` - Rename/move file
- `file:readDir` - List directory contents
- `file:watch` / `file:unwatch` - File system watching
- `file:revealInFinder` - Open in system file manager

---

### 2. Claude AI Integration (`src/renderer/components/chat/`)

#### Chat Interface
- Send prompts to Claude CLI with streaming responses
- Real-time streaming display with visual animation
- Conversation history within session

#### Context Awareness
- Include active file in requests
- Add multiple context files via @mentions
- Autocomplete for file references
- Token estimation for context (~4 chars per token)

#### Edit Review System (`src/renderer/components/chat/EditReviewPanel.tsx`)
- Claude suggests code edits parsed from responses
- Side-by-side diff view of changes
- Accept/reject individual edits
- Batch accept/reject all edits
- Auto-approve mode option
- Edit descriptions from Claude

#### Pending Edits Store (`src/renderer/stores/editStore.ts`)
- Tracks suggested edits with original/new content
- Edit status management (pending, approved, rejected)

---

### 3. Testing (`src/renderer/components/testing/`)

#### Framework Detection
Automatically detects installed test frameworks:
- Jest
- Vitest
- Mocha
- Playwright
- Cypress

Detection checks `package.json` dependencies and config files.

#### Test Framework Selector (`TestFrameworkSelector.tsx`)
- Grid UI with framework icons
- Select which framework to use
- Shows only detected frameworks

#### Test Tree (`TestTree.tsx`)
- Hierarchical view: Files → Describe blocks → Tests
- Expandable/collapsible nodes
- Status icons (passed/failed/skipped/pending)
- Click to view test details
- Run individual describe blocks

#### Test Execution
- Run all tests or specific files
- JSON reporter output parsing
- Duration tracking
- Error message and stack trace display

#### Test Panel (`TestPanel.tsx`)
- Summary bar with pass/fail/skip counts
- Error display with dismiss
- Split view: tree + details

---

### 4. Rules System (`src/renderer/components/rules/`)

#### Rule Management (`RulesPanel.tsx`)
- Create custom code rules/constraints
- Three severity levels:
  - **Error** - Must never violate
  - **Warning** - Strongly avoid
  - **Suggestion** - Prefer when possible
- Toggle rules on/off
- Edit/delete rules

#### Learned Rules
- Auto-create rules from edit rejection reasons
- Similarity detection prevents duplicates
- Source tracking (user vs AI-learned)

#### Rule Store (`src/renderer/stores/rulesStore.ts`)
- Persistence to `.xtc/rules.json`
- Rules included in Claude prompts when active

---

### 5. Skills & Project Context (`src/renderer/components/skills/`)

#### Skill Detection
Auto-detects project technologies:
- Languages (TypeScript, Python, etc.)
- Frameworks (React, Next.js, Express, etc.)
- Tooling (ESLint, Prettier, etc.)
- Testing frameworks
- Deployment tools

#### Skill Categories
- Languages
- Frameworks
- Tooling
- Testing
- Deployment
- Custom

#### Confidence Levels
- High / Medium / Low based on detection certainty

#### Skills Store (`src/renderer/stores/skillsStore.ts`)
- Persistence to `.xtc/skills.json`
- Active skills included in Claude context

---

### 6. Code Patterns (`src/renderer/stores/patternsStore.ts`)

- Save coding patterns and architectural guidelines
- Categories: naming, architecture, error-handling, styling, testing, other
- Toggle patterns on/off
- Persistence to `.xtc/patterns.json`

---

### 7. Context Panel (`src/renderer/components/context/`)

- Select files to include in Claude requests
- Token count estimation
- Add/remove context files
- Clear all context
- Visual token usage indicator

---

### 8. Terminal (`src/renderer/components/terminal/`)

#### Integrated Terminal
- Full PTY terminal emulation via `node-pty`
- xterm.js frontend rendering
- Multiple terminal sessions
- Dynamic resize support
- Process lifecycle management

#### IPC Handlers
- `terminal:create` - Spawn new terminal
- `terminal:write` - Send input
- `terminal:resize` - Update dimensions
- `terminal:kill` - Close terminal

---

### 9. Language Server Protocol (LSP)

#### LSP Integration (`main.ts`)
- Language server support for code intelligence
- Server lifecycle management per language

#### Features
- Code completions
- Hover information (types, docs)
- Go to definition
- Find all references
- Document formatting

#### IPC Handlers
- `lsp:startServer` / `lsp:stopServer`
- `lsp:getCompletions`
- `lsp:getHover`
- `lsp:getDefinition`
- `lsp:getReferences`
- `lsp:formatDocument`

---

### 10. Settings (`src/renderer/stores/settingsStore.ts`)

#### Editor Settings
- Theme (dark mode)
- Font family, size, line height
- Line numbers, minimap, word wrap
- Cursor style and blinking
- Whitespace rendering
- Format on save/paste
- Auto-closing brackets

#### Panel Visibility
- Explorer, context, chat, terminal, debug toggles
- Panel width configuration

#### Persistence
- Zustand persist middleware to localStorage

---

### 11. Interaction Logging (`src/renderer/stores/interactionStore.ts`)

- Track prompts and outcomes
- Session-based grouping
- Rejection statistics
- History retention (last 500)
- Metrics: files modified, edits suggested, actions taken

---

### 12. Window & System (`src/electron/main.ts`)

#### Custom Window
- Frameless window with custom title bar
- Minimize, maximize, close controls
- macOS traffic light positioning

#### System Integration
- Open folder dialog
- File reveal in finder
- Extended PATH for homebrew/package managers

---

## State Management

All state is managed with Zustand stores in `src/renderer/stores/`:

| Store | Purpose |
|-------|---------|
| `editorStore.ts` | Open files, active tab, dirty state |
| `projectStore.ts` | Project path, file tree |
| `settingsStore.ts` | Editor and panel settings |
| `chatStore.ts` | Chat messages, streaming state |
| `editStore.ts` | Pending edits from Claude |
| `contextStore.ts` | Context files for Claude |
| `rulesStore.ts` | Code rules and constraints |
| `skillsStore.ts` | Detected project skills |
| `patternsStore.ts` | Code patterns |
| `testStore.ts` | Test framework, files, results |
| `interactionStore.ts` | Usage logging |

---

## IPC Communication

Communication between renderer and main process uses Electron IPC:

- **Renderer → Main**: `ipcRenderer.invoke()` for async operations
- **Main → Renderer**: `webContents.send()` for events/streaming
- **Preload Bridge**: `contextBridge.exposeInMainWorld()` exposes safe API

---

## Project Configuration

Project-specific settings stored in `.xtc/` directory:
- `rules.json` - Code rules
- `skills.json` - Detected skills
- `patterns.json` - Code patterns

---

### 13. Git Integration (`src/renderer/components/git/`)

#### Git Panel (`GitPanel.tsx`)
- Current branch display with branch switcher
- Changed files list (modified, staged, untracked)
- Stage/unstage files
- Commit with message
- Push/pull to/from remote
- Create PR with auto-generated descriptions using Claude
- Base branch detection using GitHub CLI

#### Git Worktrees
- Work on multiple branches simultaneously
- Each worktree is a separate directory sharing git history
- Switch between worktrees from branch dropdown
- Worktree navigation integrated with file explorer

#### PR Creation
- Create PR modal with title and description
- Auto-generate PR descriptions using Claude
- Select base branch with smart defaults
- Uses `gh` CLI for GitHub operations

---

### 14. AI-Assisted PR Review (`src/renderer/components/git/ReviewPanel.tsx`)

- View PRs within the IDE
- Claude analyzes diff and suggests review comments
- Review Claude's suggestions before posting (approve/edit/reject each)
- Suggested fix field with fix button to apply changes via Claude
- Batch approve/post comments

---

### 15. Linear Integration (`src/renderer/components/linear/`)

#### Linear Panel (`LinearPanel.tsx`)
- Connect to Linear workspace
- View assigned issues
- Issue details and status

#### Start Work Flow (`StartWorkPanel.tsx`)
- Start work on Linear issues
- Create branch from issue
- Session management with minimized indicators
- Questions modal for clarifications

---

## Planned Features

- [ ] Explorer file organization (grouping, filtering)
- [ ] Datadog integration for logs and dashboards
