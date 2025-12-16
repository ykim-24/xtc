# ET Roadmap

## Planned Features

### GitHub Integration

**Complexity: Medium | Priority: High**

- Use `gh` CLI for GitHub operations (like we use `claude` CLI)
- PR list panel showing open PRs
- Create PR modal with title/description
- Diff viewer for PR reviews (reuse edit approval diff viewer)
- Comment on PRs directly from IDE
- Issue tracking integration

**AI-Assisted PR Review Mode:**

- View other people's PRs within the IDE
- Claude analyzes the diff and suggests review comments
- Review Claude's suggestions before posting (approve/edit/reject each)
- Add your own comments alongside AI suggestions
- Batch approve/post comments
- Learn from your edits to improve future suggestions

### Testing Visualization

**Complexity: Medium | Priority: Medium**

**Supported Test Runners:**

- JavaScript/TypeScript: Jest, Vitest, Mocha
- E2E/Browser: Playwright, Cypress
- Python: pytest, unittest
- Go: go test
- Rust: cargo test
- Java/Kotlin: JUnit

**Features:**

- Parse JSON/structured output from test runners
- Tree view of tests with pass/fail status
- Click to jump to failing line in editor
- Monaco integration for highlighting error locations
- Stack trace visualization with clickable paths
- Re-run failed tests / re-run single test
- Watch mode integration
- Screenshot/video viewing for E2E failures (Playwright/Cypress)

### Parallelization

**Complexity: High | Priority: Medium**

- Git worktrees for multiple branches checked out simultaneously
- Separate Claude conversation contexts per worktree
- Workspace tabs UI to switch between parallel work
- Independent terminal sessions per branch
- Shared file explorer with branch indicator
- Sync/merge helpers between worktrees
