# Claude Goodies - Agent Guide

## Verification

Always verify after making changes. But only verify what needs it (e.g. what you changed or could have affected indirectly)

For plugin changes run [check.sh](./scripts/check.sh) against the plugins you modified. e.g `./scripts/check.sh plugins/pixels`

Before commiting, always run `check.sh` with no args to check all plugins.

## Style

Make sure you have read @STYLE.md before making changes. Only apply to what you are changing, don't cleanup other code unless asked.