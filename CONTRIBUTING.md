# Contributing

Three roles collaborate here: core/motion (@eliks1r), frontend, and backend. The tested motion paths in [CORE_OWNERSHIP.md](./CORE_OWNERSHIP.md) require core-owner approval. Read the role guide before editing: [FRONTEND_GUIDE.md](./FRONTEND_GUIDE.md) or [BACKEND_GUIDE.md](./BACKEND_GUIDE.md).

## Branch and Pull Request workflow

`main` is the integration branch. `frontend` and `backend` may be used as team branches. Make individual changes on `frontend/<feature-name>`, `backend/<feature-name>`, or `core/<feature-name>` branches. **Do not develop directly on `main`.**

```sh
git checkout main
git pull origin main
git checkout -b frontend/new-dashboard
# or: git checkout -b backend/workout-history
```

After the change and relevant checks:

```sh
git add .
git commit -m "feat(frontend): redesign workout selection screen"
git push origin frontend/new-dashboard
```

Open a Pull Request into `main`, complete the PR template, and request review. Protected-core changes need a separate branch, an explanation, manual checks from [CORE_TESTS.md](./CORE_TESTS.md), and approval from @eliks1r before merge. Coordinate changes to shared API or state contracts with the affected teammate.

## Commit convention

Use one of `feat(frontend):`, `fix(frontend):`, `feat(backend):`, `fix(backend):`, `feat(core):`, `fix(core):`, `docs:`, or `chore:`. Examples:

```text
feat(frontend): redesign workout selection screen
feat(backend): persist workout results
fix(core): prevent duplicate squat rep
```

## Git and secret safety

Never force-push, reset a shared branch with `git reset --hard`, rewrite public history, or delete working core modules. Do not commit `node_modules`, secrets, or `.env` files. Backend credentials and signing secrets belong in environment variables. `.env.example` contains placeholders only.

## Repository protection to configure

The repository maintainer should add a GitHub ruleset or branch-protection rule for `main`: require Pull Requests, require approval from code owners, block force pushes and deletion, and add required status checks when CI exists. `CODEOWNERS` requests reviews but does not enforce approval by itself. When frontend/backend GitHub usernames are known, replace the commented examples in `.github/CODEOWNERS` with their real handles and confirm each account has appropriate repository access. Keep branch protection active for team branches if they are shared.

GitHub documents these controls under [protected branches](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches) and [rulesets](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/available-rules-for-rulesets).
