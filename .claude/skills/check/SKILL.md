---
name: check
description: Run scripts/check.sh to validate, test and type-check the plugins. Pass plugin names to check only those.
disable-model-invocation: true
allowed-tools: Bash(bash scripts/check.sh*)
---

Run `bash scripts/check.sh $ARGUMENTS` from the repo root and report the result.

If it fails, summarise the errors by file. Do not fix anything unless asked.
If there are errors, ignore any warnings until the errors are sorted. This is to reduce the mental overload of the user.

Anytime you reference a file or line, use a link. This makes it easier for the user to go to it.