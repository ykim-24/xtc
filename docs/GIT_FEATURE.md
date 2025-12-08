# Git Integration Feature

## Overview

A comprehensive Git integration for XTC that allows users to manage branches, commits, and PRs without leaving the app. The killer feature is **Git Worktrees support** - enabling work on multiple branches simultaneously.

## Core Features

### 1. Git Status Panel
- Show current branch
- Display remote info (origin URL, org/repo)
- List changed files (modified, staged, untracked)
- Sync status (commits ahead/behind remote)

### 2. Basic Git Operations
- Stage/unstage files
- Commit with message
- Push to remote
- Pull from remote
- Create/switch branches

### 3. PR Creation Flow
- Create PR directly from app using `gh` CLI
- Select base branch
- Enter title and description
- View PR status after creation

### 4. Git Worktrees (Multi-branch workflow)
- Work on multiple branches simultaneously
- Each worktree is a separate directory sharing the same git history
- Switch between worktrees instantly
- Conductor-style parallel development

## Technical Implementation

### Git Worktrees Explained

Git worktrees allow multiple working directories from a single repository:

```bash
# Main repo
/Users/ykim/junior (main branch)

# Create worktree for feature branch
git worktree add ../junior-feature-x feature-x

# Result: Two directories, same repo
/Users/ykim/junior           → main branch
/Users/ykim/junior-feature-x → feature-x branch
```

**Key commands:**
```bash
git worktree list                           # List all worktrees
git worktree add <path> <branch>            # Create new worktree
git worktree add <path> -b <new-branch>     # Create worktree with new branch
git worktree remove <path>                  # Remove worktree
git worktree prune                          # Clean up stale worktrees
```

### Architecture

#### Backend (Electron Main Process)

New IPC handlers in `src/electron/main.ts`:

```typescript
// Git status
ipcMain.handle('git:status', async (_, projectPath) => {
  // Returns: { isRepo, branch, remote, changes[], ahead, behind }
});

ipcMain.handle('git:branch', async (_, projectPath) => {
  // Returns: { current, all[], remotes[] }
});

ipcMain.handle('git:stage', async (_, projectPath, files) => {
  // git add <files>
});

ipcMain.handle('git:unstage', async (_, projectPath, files) => {
  // git reset HEAD <files>
});

ipcMain.handle('git:commit', async (_, projectPath, message) => {
  // git commit -m <message>
});

ipcMain.handle('git:push', async (_, projectPath, branch?) => {
  // git push origin <branch>
});

ipcMain.handle('git:pull', async (_, projectPath) => {
  // git pull
});

// Worktrees
ipcMain.handle('git:worktree:list', async (_, projectPath) => {
  // Returns: [{ path, branch, isMain }]
});

ipcMain.handle('git:worktree:add', async (_, projectPath, name, branch, createBranch?) => {
  // git worktree add <path> <branch>
});

ipcMain.handle('git:worktree:remove', async (_, worktreePath) => {
  // git worktree remove <path>
});

// PR operations (using gh CLI)
ipcMain.handle('git:pr:create', async (_, projectPath, { title, body, base }) => {
  // gh pr create --title <title> --body <body> --base <base>
});

ipcMain.handle('git:pr:list', async (_, projectPath) => {
  // gh pr list --json number,title,state,headRefName
});
```

#### Frontend Store

New store: `src/renderer/stores/gitStore.ts`

```typescript
interface GitState {
  // Status
  isRepo: boolean;
  currentBranch: string | null;
  remote: { url: string; owner: string; repo: string } | null;
  changes: GitChange[];
  ahead: number;
  behind: number;

  // Worktrees
  worktrees: Worktree[];
  activeWorktree: string | null;

  // Loading states
  isLoading: boolean;

  // Actions
  refreshStatus: (projectPath: string) => Promise<void>;
  stageFiles: (files: string[]) => Promise<void>;
  unstageFiles: (files: string[]) => Promise<void>;
  commit: (message: string) => Promise<void>;
  push: () => Promise<void>;
  pull: () => Promise<void>;

  // Worktree actions
  listWorktrees: () => Promise<void>;
  addWorktree: (name: string, branch: string, createBranch?: boolean) => Promise<void>;
  removeWorktree: (path: string) => Promise<void>;
  switchWorktree: (path: string) => void; // Updates projectPath in projectStore
}

interface GitChange {
  path: string;
  status: 'modified' | 'added' | 'deleted' | 'untracked' | 'renamed';
  staged: boolean;
}

interface Worktree {
  path: string;
  branch: string;
  isMain: boolean;
  isCurrent: boolean;
}
```

#### UI Components

```
src/renderer/components/git/
├── GitPanel.tsx           # Main git panel (shown when git tab selected)
├── GitStatusHeader.tsx    # Branch, remote info, sync status
├── GitChangesList.tsx     # List of changed files with stage/unstage
├── GitCommitBox.tsx       # Commit message input + commit button
├── GitActions.tsx         # Push, Pull, Create PR buttons
├── WorktreeList.tsx       # List of worktrees (in git panel)
├── WorktreeSwitcher.tsx   # Dropdown in file explorer header
├── CreatePRModal.tsx      # Modal for creating PR
└── CreateWorktreeModal.tsx # Modal for creating new worktree
```

## UX Design

### Hybrid Worktree Access

**Quick switcher** in File Explorer header:
```
┌─ File Explorer Header ────────┐
│ junior                        │
│ ⎇ main ▾           [⟳] [+]   │  ← Click to switch worktree/branch
├───────────────────────────────┤
│ 📁 src                        │
```

**Full management** in Git Panel:
```
┌─ Git Panel ───────────────────┐
│ Worktrees              [+ New]│
│ ● junior/main (current)       │
│   └─ 3 changes                │
│ ○ junior/feature-auth         │
│   └─ clean                    │
├───────────────────────────────┤
│ Changes (3)                   │
│ ☑ M src/app.tsx        [±]   │
│ ☐ M src/utils.ts       [±]   │
│ ☐ + src/new.ts         [±]   │
├───────────────────────────────┤
│ Commit message...             │
│ [Commit] [Push] [Create PR]   │
└───────────────────────────────┘
```

### Worktree Switching Flow

When user switches worktree:
1. Update `projectStore.projectPath` to worktree path
2. File explorer refreshes to show that directory
3. Git panel updates to show that branch's status
4. Editor tabs remain but files reload from new worktree
5. Terminal cwd updates (optional)

## Implementation Steps

### Phase 1: Basic Git Status (Start Here)
- [ ] Add IPC handlers for `git:status`, `git:branch`, `git:remote`
- [ ] Create `gitStore.ts` with basic state
- [ ] Create `GitPanel.tsx` showing current branch and changes
- [ ] Add Git icon to sidebar (below Tests)
- [ ] Wire up auto-refresh on file changes

### Phase 2: Stage & Commit
- [ ] Add IPC handlers for `git:stage`, `git:unstage`, `git:commit`
- [ ] Create `GitChangesList.tsx` with checkboxes
- [ ] Create `GitCommitBox.tsx` with message input
- [ ] Add keyboard shortcut (Cmd+Enter to commit)

### Phase 3: Push & Pull
- [ ] Add IPC handlers for `git:push`, `git:pull`
- [ ] Add push/pull buttons to panel
- [ ] Show ahead/behind count
- [ ] Handle authentication errors gracefully

### Phase 4: Worktrees
- [ ] Add IPC handlers for worktree operations
- [ ] Create `WorktreeList.tsx` in git panel
- [ ] Create `WorktreeSwitcher.tsx` for explorer header
- [ ] Handle worktree switching (update projectPath)
- [ ] Create `CreateWorktreeModal.tsx`

### Phase 5: PR Creation
- [ ] Check for `gh` CLI availability
- [ ] Add IPC handler for `git:pr:create`
- [ ] Create `CreatePRModal.tsx` with title/body/base inputs
- [ ] Show PR link after creation
- [ ] Optionally list existing PRs

## File Locations

When implementing, create/modify these files:

```
src/
├── electron/
│   └── main.ts              # Add git IPC handlers
├── renderer/
│   ├── stores/
│   │   └── gitStore.ts      # New store
│   ├── components/
│   │   ├── git/             # New folder
│   │   │   └── ...          # Git components
│   │   ├── layout/
│   │   │   └── Sidebar.tsx  # Add git icon
│   │   └── explorer/
│   │       └── FileExplorer.tsx  # Add worktree switcher
│   └── vite-env.d.ts        # Add git types
```

## Dependencies

- Git CLI (required, should be installed on dev machines)
- GitHub CLI (`gh`) for PR operations (optional but recommended)

## Error Handling

- Not a git repo → Show "Initialize repository?" option
- No remote → Show "Add remote" option
- gh not installed → Show "Install GitHub CLI for PR features"
- Auth errors → Guide to `gh auth login`

## Current Status

**Status: NOT STARTED**

Next step: Begin Phase 1 - Basic Git Status
