# Web frontend

The web app is a React + TypeScript application built with Vite. It provides the public Studio Ermanno website and the staff admin interface.

## Requirements

- Node.js 22.12 or later
- npm
- A Supabase project for sign-in and data-backed pages

## Configure

From this directory, install dependencies and create the local environment file:

```sh
npm ci
cp .env.example .env.local
```

Edit `.env.local`:

```dotenv
VITE_API_BASE_URL=http://localhost:8000
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-public-publishable-or-anon-key
DEPLOYMENT_ENV=development
```

Use the project URL and public publishable/anon key from your Supabase project settings. Never put a database password, Supabase secret key, or service-role key in a `VITE_` variable; frontend variables are exposed to the browser.

## Run locally

Start the API separately using the [API setup guide](../api/README.md), then run the web app from `web/`:

```sh
npm run dev
```

Open [http://localhost:5173](http://localhost:5173). The Vite server uses port 5173 and fails if that port is already occupied. Restart it after changing `.env.local`.

## Checks

```sh
npm run typecheck
npm test
npm run build
```

The production build validates deployment environment settings. See `.env.example` and `deployment/config.ts` for the supported deployment configuration.

## Formatting

Prettier formats TypeScript, TSX, JavaScript, CSS, HTML, JSON, YAML and Markdown. It uses two-space indentation, single quotes, no semicolons, and a preferred line width of 100 characters.

From `web/`, install the pinned formatter with the project dependencies:

```sh
npm ci
```

Format files or check them without editing:

```sh
npm run format
npm run format:check
```

These commands cover supported files throughout the repository, including documentation. They exclude dependencies, build output, virtual environments, environment files, and the npm lockfile. Python files use [the API's Ruff workflow](../api/README.md#formatting).

To format a single file from `web/`:

```sh
npx prettier --write src/routes/availability.tsx
```

Configuration lives in the repository root: [`.prettierrc.json`](../.prettierrc.json), [`.prettierignore`](../.prettierignore), and [`.editorconfig`](../.editorconfig). Change those files when updating the shared conventions.

For VS Code, open the repository root and install the recommended **Prettier – Code formatter** extension (`esbenp.prettier-vscode`). The committed [workspace settings](../.vscode/settings.json) enable format on save for frontend files. Other editors can use the same Prettier and EditorConfig configuration.

Before completing an update, run `npm run format:check`, `npm run typecheck`, `npm test`, and `npm run build`. Keep broad formatting changes in a separate commit from feature changes.
