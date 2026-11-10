# Smart University Attendance Management System

## Run locally

Prerequisite: Node.js 22.12 or newer and npm. This workspace also contains a Bun lockfile; use one package manager consistently and do not mix lockfiles.

```sh
npm install
npm run dev
```

Open http://localhost:3000. The development server runs the Express API and Vite frontend together. The campus simulator is available only in development.

## Production build

```sh
npm run build
npm start
```

The build creates the frontend in `dist/` and bundles the API server as `server.js`.

## Publish a protected demo on Render

1. Push this project to a GitHub repository, including `render.yaml`.
2. In Render, choose **New > Blueprint**, connect the repository, and apply the blueprint.
3. Enter values for `DEMO_ACCESS_USER` and `DEMO_ACCESS_PASSWORD` when prompted. Use a unique password with at least 16 characters; never commit it or share it in chat.
4. Open the deployed HTTPS URL. The browser will ask for the demo username and password.

The free demo uses temporary storage; data can reset after a restart or redeploy. The access gate is shared by all visitors and does not provide individual staff roles. Do not use real student, location, or biometric data. A real university deployment still needs institution-managed authentication, authorization, a production database, and privacy/security review.

## Demo data and limitations

The app loads seed data on first run and saves changes to `data/attendance-state.json`; set `ATTENDANCE_DATA_FILE` to use another local path. Selfie images are not written to this file. Use the Admin dashboard's reset action to restore the seed data.

This is a demonstration, not a production attendance service. Production mode requires a shared access gate, but it does not provide individual user accounts or role authorization. It also has no production database, verified face matching, or tamper-resistant location proof. Do not use real student/biometric data. A real deployment requires institution-approved authentication, role checks on every protected API, a production database, privacy/retention controls, and security testing. GPS coordinates from a browser are not proof of physical presence.

Gemini API credentials are not required; the current implementation makes no Gemini API calls.
