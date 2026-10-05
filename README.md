# Studio Ermanno

Studio Ermanno is a responsive website and admin platform for a hairdresser business. The public website presents business information, services, products, availability, and feedback. The staff-facing admin supports business operations such as appointments, clients, services, hairdressers, business hours, products, inventory, and feedback moderation.

The project is organized as:

- [`web/`](./web/) — React, TypeScript, and Vite frontend.
- [`api/`](./api/) — FastAPI backend with PostgreSQL persistence and Supabase authentication.
- [`docs/`](./docs/) — project plans, architecture notes, and verification records.

For local setup and run instructions, see the [web guide](./web/README.md) and [API guide](./api/README.md). The public site and API are also available at [studio-ermanno.pages.dev](https://studio-ermanno.pages.dev) and [studio-ermanno-api.onrender.com](https://studio-ermanno-api.onrender.com/health).

## Code formatting

Use Prettier for frontend code, CSS, HTML, JSON, YAML and Markdown, and Ruff for Python. The pinned versions and committed configuration keep editor and command-line formatting consistent. Frontend indentation is two spaces, Python indentation is four spaces, and the preferred line width is 100 characters.

```sh
cd web
npm ci
npm run format
npm run format:check
```

The frontend commands format/check supported files throughout the repository; generated output, dependencies, secrets and the npm lockfile are excluded. Python is handled separately:

```sh
cd api
.venv/bin/python -m pip install -r requirements-dev.txt
make format
make format-check
```

In VS Code, install the recommended Prettier and Ruff extensions when prompted. Workspace settings enable format on save and select the formatter for each language. Other editors can use the same project configuration and `.editorconfig`.

Keep formatting-only changes separate from functional changes. Run the normal frontend/backend checks after formatting. Ruff is configured as a formatter here; automatic lint fixes and import reordering are not enabled.
