# Changelog

All notable changes to this project will be documented in this file.

## [0.2.4] - 2025-12-16

### Added

- PR creation with auto-generated descriptions from Claude
- Auto-rebuild native modules after publish (fixes dev mode on Apple Silicon)
- `npm run rebuild` command for manual native module rebuilding

### Fixed

- Terminal positioning issues
- Welcome screen display bugs
- Auto-updater logging improvements
- Worktree bugs and review fix suggestions

## [0.2.2] - 2025-12-15

### Fixed

- Use `app.isPackaged` instead of `NODE_ENV` for dev detection (fixes blank screen in production builds)

## [0.2.1] - 2025-12-15

### Fixed

- Correct renderer path for production build (`../../renderer` instead of `../renderer`)

## [0.2.0] - 2025-12-15

### Added

- Auto-update functionality with custom in-app update notifications
- Spinning 3D cube animation in update dialog
- Changelog display in update notification (pulled from GitHub releases)
- Welcome screen with wavy dot grid animation
- Questions modal for Linear workflow integration
- Confirm modal component for user confirmations
- New pixel icons (Archive, Trash)
- Publish script (`npm run release`) for release management
- Branch deletion support in worktree management
- Expandable edits store for tracking file changes
- Electron-builder configuration for macOS/Windows/Linux builds
- GitHub Releases integration for auto-updates

### Changed

- Improved settings modal with API key visibility toggle
- Enhanced welcome screen with refined UI
- Better session management with improved state handling
- Updated worktree node panel with delete confirmation flow
- Refined minimized session indicators
- Improved start work panel with questions integration
- Enhanced Git panel with additional operations

### Fixed

- Session manager error handling improvements
- Worktree store state management fixes

## [0.1.0] - 2025-12-14

### Added

- Initial release
- Basic IDE layout with resizable panels
- Worktree management for git branches
- Linear integration for task management
- Git operations panel (status, commit, push, pull)
- Settings management with persistent storage
- Chat panel with Claude CLI integration
- Terminal integration with node-pty
- Monaco editor with syntax highlighting
- File explorer with tree view
