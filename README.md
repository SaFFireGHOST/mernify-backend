# Simple Auth App

Minimal Node.js + Express app with MongoDB for user signup/signin.

## Setup

1. Copy `.env.example` to `.env` and update values.
2. `npm install`
3. Start MongoDB locally or provide an Atlas URI in `MONGO_URI`.
4. `npm run dev` (requires nodemon) or `npm start`.

## Endpoints

- POST /api/auth/signup  { username, password }
- POST /api/auth/signin  { username, password }
- GET  /api/protected    (Requires Authorization: Bearer <token>)

