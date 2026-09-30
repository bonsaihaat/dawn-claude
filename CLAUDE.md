# CLAUDE.md

## Git workflow

- `dev` is the base branch. Start every change from the latest `dev`
  (`git fetch origin dev && git checkout -B dev origin/dev`).
- Commit and push all changes to the `dev` branch only (`git push -u origin dev`),
  even if the session assigns a different working branch.
  Do not push to `main` or create other feature branches unless explicitly asked.
- Pull requests go from `dev` into `main`.
