# Changelog

All notable changes to this project will be documented in this file.

## [0.2.3] - 2025-12-16

### Added
- PR creation modal with auto-generated titles and descriptions using Claude
- Base branch detection using GitHub CLI for more accurate PR targeting
- `git:mergeBase` IPC handler for finding the branch fork point
- Worktree navigation from branch dropdown - clicking a branch with an existing worktree switches to that directory

### Changed
- ConfirmModal buttons now use text-link styling for consistency
- Explorer header has improved spacing and minimum height

### Fixed
- Base branch names are now properly cleaned (removes `origin/` prefixes) when creating PRs

## [0.2.2] - 2025-12-16

### Fixed
- Use `app.isPackaged` instead of `NODE_ENV` for dev detection in Electron main process

## [0.2.1] - 2025-12-16

### Fixed
- Correct renderer path resolution for production builds

## [0.2.0] - 2025-12-15

### Added
- Auto-update functionality with in-app update notifications
- Questions modal for Linear workflow integration
- Confirm modal component for user confirmations
- Update notification component showing download progress
- New pixel icons (Archive, Trash)
- Publish script for release management
- Branch deletion support in worktree management
- Expandable edits store for tracking file changes

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
- Welcome screen with wavy dot animation
- Electron-builder configuration
- Basic worktree management
- Linear integration
- Git operations panel
- Settings management
- Chat panel with Claude integration
