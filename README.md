# Serenity Itinerary

A responsive itinerary and event planner built with Next.js and Firebase.

## Run locally

```powershell
npm.cmd install
npm.cmd run dev
```

Open `http://127.0.0.1:3000`.

## Available features

- Local-first itinerary creation with offline `localStorage` fallback.
- Persistent email/password accounts and optional anonymous guest mode.
- Firestore workspace sync with owner-based Security Rules.
- Editable rundown, budget, checklist, trip details, search, and filters.
- WebP photo compression up to 300 KB and Firestore photo sync.
- Print/PDF, budget CSV, checklist CSV, and ICS calendar export.
- Server-side adapters for DeepSeek, OpenAI, and Gemini.
- AI keys stay only in React memory and are never persisted.

## Security

The browser sends an AI key only to `/api/ai/generate`. The server route forwards it to the selected provider and never logs or stores it. Production deployment must support Next.js server routes; a static-only Firebase Hosting deployment cannot run the AI endpoint.

Firebase CLI commands in this workspace target `serenity-itinerary-0727`. Firestore Rules and indexes are deployed separately with `npm.cmd run firebase:deploy`.
