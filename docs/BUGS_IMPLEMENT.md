# XTC - Bugs & Feature Requests

## Bugs

- [ ] Auto-updater not working - needs code signing for macOS

## Recently Fixed (v0.2.8)

- [x] Terminal killed when EditReview appears - now terminal persists below EditReview
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
