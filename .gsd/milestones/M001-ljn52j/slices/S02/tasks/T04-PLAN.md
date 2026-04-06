---
estimated_steps: 4
estimated_files: 2
skills_used: []
---

# T04: Package rename to gsd-pi-acp

Rename package from pi-acp to gsd-pi-acp:

1. `package.json`: name='gsd-pi-acp', bin={'gsd-pi-acp': 'dist/index.js'}
2. `README.md`: Update title and description to reflect dual backend support, add instructions for PI_ACP_PI_COMMAND override

Keep backward compat note explaining pi backend still works.

## Inputs

- `package.json`
- `README.md`

## Expected Output

- `package.json`
- `README.md`

## Verification

grep -q 'gsd-pi-acp' package.json && grep -c 'gsd' README.md >= 3
