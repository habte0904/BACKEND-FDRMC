Summary
=======

Issue: `react-router` version 7.1.5 had a known vulnerability reported by a security scanner. This repository used `react-router` directly in the frontend.

What I changed
---------------
- Bumped `react-router` in `frontend/package.json` from `^7.1.5` to `^7.9.6` (latest 7.x stable at the time of the change).
- Updated `package-lock.json` and reinstalled dependencies (ran `npm install`).

Verification steps you can run locally
--------------------------------------
From `frontend` run:

```powershell
# Install dependencies and update lockfile
npm install

# Run npm audit and view results
npm audit
# or write JSON output
npm audit --json > audit.json
```

Notes on results
----------------
- After the upgrade I ran `npm audit`; the audit report shows 8 vulnerabilities (3 low, 5 moderate). None are directly tied to `react-router`.
- Remaining advisories are in dev dependencies (ESLint, Vite, Babel helpers, etc.). Many have fixes available via `npm audit fix` or upgrading the affected packages.

Next recommended steps
----------------------
- Run `npm audit fix` to apply available non-breaking fixes.
- Update `vite` to the latest 6.x patch (or a secure supported version) to address several moderate Vite advisories.
- Consider upgrading dev dependencies (`eslint`, `@babel/*`, `esbuild`) or their parents, then rerun `npm audit`.
- For longer-term maintenance, consider migrating to `react-router` v6+ and use `react-router-dom` for web-based routing. v6+ has a different API (but many improvements). Migration is non-trivial and requires code changes in imports and route structure.

If you want, I can:
- Run `npm audit fix` and verify results.
- Perform a migration path to `react-router` v6/`react-router-dom` v6+ (I will create a migration plan and update imports/usages).