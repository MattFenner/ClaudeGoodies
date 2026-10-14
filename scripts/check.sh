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

# Ensure typescript files
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

  echo "checking typescript..."
  (cd "$dir" && npx -y -p typescript@5.6.3 tsc -p tsconfig.json)

  echo "lint..."
  (cd "$root" && npm run lint)

  echo "claude validate..."
  (cd "$dir" && claude plugin validate .)

  echo "claude test..."
  (cd "$dir" && claude plugin test . | sed '/^(pass)/d')
done

echo "all checks passed"
