# Shell Commands

- Never use `cd` to change into subdirectories. Use `-w <package>` for npm workspace commands, and run everything else from root.
- **Never use `cat`/heredoc/`echo` to write files.** Always use the Write tool.
- **Never write temp files to pass as CLI arguments.** Pass multiline strings directly in the Bash command. No `/tmp/pr-body.txt`, no `/tmp/commit-msg.txt` — just inline the content.
- **For multiline CLI arguments (commit messages, PR bodies, etc.), just use regular multiline strings.** Never use `cat <<'EOF'` heredoc wrappers — just write the string directly with literal newlines inside quotes.
- **Never append `2>&1` to commands** unless you specifically need to capture stderr. Just run the command normally.
- **Never use `$()` subcommand substitution in Bash commands.**
- **Never chain commands with `&&` or `;`.** Always run each command as a separate Bash tool call (e.g. `git add` and `git commit` must be separate calls).
