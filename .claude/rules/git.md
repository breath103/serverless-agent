# Git

- Never use `git -C <path>`. Just run `git` directly — the working directory is already the project root.
- Never add `Co-Authored-By` lines to commit messages.
- Never add "Generated with Claude Code" or similar attribution to PR descriptions.
- When merging PRs, use `gh pr merge --merge` (merge commit). Never use `--squash`.
