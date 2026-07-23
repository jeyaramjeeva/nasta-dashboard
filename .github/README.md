# `.github/`

GitHub Actions / workflows for CI (if present under `workflows/`).

| If | Check |
|----|-------|
| PR checks red | Actions tab → failed job log |
| Deploy from GitHub differs from CLI | GitHub only builds **committed** `main`; CLI uploads local files |

Prefer production alias https://nastazentrum.vercel.app after a successful Ready deploy.
