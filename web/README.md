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

Run `npm run format` to format supported files throughout the repository with Prettier, or `npm run format:check` to check without modifying files. The root `.prettierrc.json`, `.prettierignore` and `.editorconfig` define the conventions. Install the recommended VS Code extensions to enable the committed format-on-save settings. Python uses Ruff separately; see the root README.
