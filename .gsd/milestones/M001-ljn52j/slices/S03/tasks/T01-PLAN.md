---
estimated_steps: 1
estimated_files: 3
skills_used: []
---

# T01: Create CI workflow for typecheck + lint + test

Create GitHub Actions workflow triggered on push and pull_request that runs typecheck, lint, and test jobs. Each job runs independently for faster feedback. Follow npm-publish workflow pattern with Node.js 24.x and npm ci.

## Inputs

- `package.json`

## Expected Output

- `.github/workflows/ci.yml`

## Verification

npm run typecheck && npm run lint && npm test

## Observability Impact

CI job failures surface via GitHub Actions UI and gh CLI
