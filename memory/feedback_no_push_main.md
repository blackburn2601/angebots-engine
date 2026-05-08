---
name: Never push to main
description: Always use feature branches and PRs — never push directly to main
type: feedback
---

Never push directly to the `main` branch. Always create a feature branch and open a pull request.

**Why:** Explicit project rule set by the user.

**How to apply:** Any time a git push is about to target `main`, stop and create a branch instead.
