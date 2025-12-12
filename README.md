# XTC

An AI-first IDE wrapper for Claude Code.

## Features

### Integrations
- **Linear** - View assigned issues, start work flow with worktrees, update ticket status
- **Git** - Branch management, worktrees, commit, push, PR creation and review
- **Claude AI** - Chat with context, code generation, edit review system
- **LSP** - Code completions, hover info, go to definition, references

### Editor
- **Monaco Editor** - Full-featured code editor with syntax highlighting
- **Tab Management** - Multi-file editing with tab support
- **File Explorer** - Browse and manage project files
- **Integrated Terminal** - PTY terminal with xterm.js

### AI Features
- **Context Awareness** - Include files in Claude requests via @mentions
- **Edit Review** - Accept/reject AI-suggested code changes with diff view
- **Rules System** - Define code constraints Claude must follow
- **Skills Detection** - Auto-detect project technologies for better context

### Testing
- **Framework Detection** - Jest, Vitest, Mocha, Playwright, Cypress
- **Test Tree** - Hierarchical view with pass/fail status
- **Run Tests** - Execute all or individual tests

## Tech Stack

- Electron
- React
- Vite
- TypeScript
- Monaco Editor
- Tailwind CSS
- Zustand

## Getting Started

### Prerequisites

- Node.js 18+
- npm

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

### Build

```bash
npm run build
```

## License

MIT
