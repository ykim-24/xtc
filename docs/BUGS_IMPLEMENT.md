# XTC - Bugs & Feature Requests

## Implement

_(No pending features)_

## Bugs

- [ ] Auto-updater not working - code signing configured but needs Apple Developer credentials:
  - Set `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID` env vars
  - Set `CSC_LINK` (path to .p12 cert) and `CSC_KEY_PASSWORD`
  - See scripts/notarize.js for details

## Recently Fixed (v0.2.9)

- [x] Terminal killed when EditReview appears - terminal now always stays mounted, visibility controlled by flex layout
- [x] Terminal in root directory when starting worktree session - now correctly changes to project directory when terminal becomes available
- [x] Add PID viewer and killer - added CPU icon in terminal header to view running terminals with PIDs and kill them
- [x] File search switches to editor tab - now switches to home mode when opening files from Cmd+P
- [x] Cmd+P with file:line format - supports file.tsx:54, file.tsx:54:46, file.tsx(54,46) formats to go to specific line

## Recently Fixed (v0.2.8)

- [x] Session icon missing during implementation phase - now shows in bottom-right
- [x] Worktree animation - added traveling dash border animation
- [x] EditReview navigation - added sidebar with file grouping and line ranges
- [x] Global search - added Cmd+Shift+F content search
- [x] Stop/clear session - added stop button to worktree panel and context menu
- [x] Pre-queue messages to Claude - can queue prompts while Claude is responding
- [x] Allow interruptions - can stop Claude mid-response in main chat
- [x] Question modal parsing - handles numbered sub-items correctly
- [x] Zoom in/out - proper event listener cleanup
- [x] Token usage persistence - saves to .xtc/token-usage files, loads after refresh
