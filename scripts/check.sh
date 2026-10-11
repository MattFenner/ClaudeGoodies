#!/usr/bin/env bash
# Validates, tests and type-checks every plugin (or the ones named).
#   scripts/check.sh              # all plugins
#   scripts/check.sh todo         # one plugin
#   scripts/check.sh --skip-tsc   # skip the type-check (CI: only an interactive session writes the types)
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
skip_tsc=false
if [[ "${1:-}" == "--skip-tsc" ]]; then skip_tsc=true; shift; fi

plugins=("$@")
if [[ ${#plugins[@]} -eq 0 ]]; then
  for dir in "$root"/plugins/*/; do plugins+=("$(basename "$dir")"); done
fi

for plugin in "${plugins[@]}"; do
  dir="$root/plugins/$plugin"
  echo "== $plugin"

  # Claude Code writes the types and this tsconfig when it loads the plugin in an interactive session.
  if ! $skip_tsc && [[ ! -f "$dir/tsconfig.json" ]]; then
    echo "missing plugins/$plugin/tsconfig.json: run 'claude --plugin-dir ./plugins/$plugin' once from the repo root" >&2
    exit 1
  fi

  claude plugin validate "$dir"
  if compgen -G "$dir/tests/*.test.ts*" >/dev/null; then
    claude plugin test "$dir"
  fi
  if ! $skip_tsc; then
    npx -y -p typescript@5.6.3 tsc -p "$dir/tsconfig.json"
  fi
done

echo "all checks passed"
