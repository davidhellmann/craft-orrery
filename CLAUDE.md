## Working on Orrery

- Before changing the viewer (`src/viewer/`), read `docs/viewer.md`.
- The checks every change must pass are the steps in `.github/workflows/ci.yml`. Run them before you finish.

## Agent skills

### Issue tracker

Local markdown: one file per ticket under `.scratch/<feature>/issues/`. See `docs/agents/issue-tracker.md`.

### Triage labels

The five default roles (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`), recorded as a `Status:` line in each ticket. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `GLOSSARY.md` and `docs/adr/` at the repo root. See `docs/agents/domain.md`.
