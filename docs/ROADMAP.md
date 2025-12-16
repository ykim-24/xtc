# ET Roadmap

## Planned Features

### Linear Sub-Issue Parallel Workflow

**Complexity: High | Priority: High**

When starting work on an issue that has sub-issues:
- Parent issue creates a separate branch (becomes the base branch)
- Each sub-issue spawns its own worktree branching FROM the parent branch
- All sub-issue implementations run in parallel (multiple Claude sessions)
- Session indicators shown in bottom-right as multiple square boxes
- Each session independently plans and implements its sub-issue
- Merge sub-issue branches back into parent branch when complete

### GitHub Integration Enhancements

**Complexity: Medium | Priority: Medium**

- PR list panel showing open PRs
- Comment on PRs directly from IDE
- Issue tracking integration

### PR Review Enhancements

**Complexity: Medium | Priority: Medium**

- Include code suggestions in review comments (not just text feedback)
- Self-PR mode: implement suggestions directly during review phase
- Reply to review comments to add context when addressing warnings/issues
- Thread conversations on specific review points

### Reusable Component Library

**Complexity: Medium | Priority: Medium**

Refactor common UI patterns into reusable components:
- `[ search 4 ... ]` inline search input
- `[ action ]` monospace button style
- Dropdown menus with consistent styling
- Collapsible sections/panels
- Status indicators (icons, spinners)
- Tree view component (used in tests, explorer, etc.)
- Modal/dialog patterns

### Testing Visualization

**Complexity: Medium | Priority: Medium**

**Additional Test Runners to Support:**

- Python: pytest, unittest
- Go: go test
- Rust: cargo test
- Java/Kotlin: JUnit

**Features:**

- Click to jump to failing line in editor
- Monaco integration for highlighting error locations
- Stack trace visualization with clickable paths
- Watch mode integration
- Screenshot/video viewing for E2E failures (Playwright/Cypress)
- Playwright `--headed` mode: embed live browser content into test panel
- Search within test output to find specific results/errors
