# Tools

This directory is reserved for optional operator utilities and future deployment-management tooling.

The current Node.js CLI remains in `bin/` and `src/` because the Docker image uses it for runtime setup, migration, diagnostics, and Railway deployment helpers. Treat it as supporting infrastructure rather than the primary product surface. The intended primary user flow is:

1. Fork the repository.
2. Customize `extensions/`.
3. Deploy to Railway.
4. Run `openclaw-railway setup` in the Railway terminal.
