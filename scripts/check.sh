#!/usr/bin/env bash
# Validates, tests and type-checks every plugin (or the ones named), then lints the repo.
#   scripts/check.sh              # all plugins
#   scripts/check.sh todo         # one plugin
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"

plugins=("$@")
if [[ ${#plugins[@]} -eq 0 ]]; then
  for dir in "$root"/plugins/*/; do plugins+=("$(basename "$dir")"); done
fi

# Each tool runs from the plugin folder with "." or a relative path, so the same
# commands work whatever the OS, and whatever kind of path the shell uses.
for plugin in "${plugins[@]}"; do
  dir="$root/plugins/$plugin"
  echo "=== plugin: $plugin ==="

  # Claude Code writes the types and this tsconfig when it loads the plugin in an interactive session.
  # The types are gitignored, so check for them rather than for the tracked tsconfig.json.
  if [[ ! -d "$dir/.claude-plugin/types/claude-code" ]]; then
    # generate types. see https://github.com/anthropics/claude-code/issues/100736
    (cd "$dir" && claude --plugin-dir . -p hi)
    if [[ ! -d "$dir/.claude-plugin/types/claude-code" ]]; then
      echo "Missing plugins/$plugin/.claude-plugin/types/claude-code" >&2
      exit 1
    fi
  fi

  (cd "$dir" && claude plugin validate .)
  if compgen -G "$dir/tests/*.test.ts*" >/dev/null; then
    (cd "$dir" && claude plugin test . | sed '/^(pass)/d')
  fi

  (cd "$dir" && npx -y -p typescript@5.6.3 tsc -p tsconfig.json)
done

# Lint covers the whole repo, so it runs once rather than once per plugin.
echo "=== lint ==="
(cd "$root" && npm run lint)

echo "all checks passed"
