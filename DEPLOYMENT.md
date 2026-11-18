# DeftAI deployment notes

## Required production storage

DeftAI can use PostgreSQL through the `DATABASE_URL` environment variable. On startup it creates the `deftai_kv` table and migrates any JSON records it can still read from its local data file.

1. Create a PostgreSQL database (a free Supabase project is suitable for development/testing).
2. Copy its PostgreSQL connection string from the provider dashboard. Keep it private.
3. In Render → DeftLLM → Environment, add:
   - Key: `DATABASE_URL`
   - Value: the private PostgreSQL connection string
4. Set the Render build command to `npm install` and the start command to `npm start`.
5. Deploy, then open `/health`. A healthy persistent setup reports `storage: "postgres"` and `durableStorage: true`.

The app intentionally blocks new account creation on Render when neither PostgreSQL nor a mounted persistent disk is available. This prevents new accounts from appearing to work and then disappearing after a redeploy.

A free Supabase project has a 500 MB database allowance and may pause after a week of inactivity. Treat it as a development tier, not a guaranteed always-on production database.

## AI provider configuration

- `GEMINI_API_KEY`: Google AI Studio API key for Gemini chat and Gemini image generation.
- `GEMINI_MODEL`: optional; defaults to `gemini-3.8-flash`.
- `GEMINI_IMAGE_MODEL`: optional; defaults to `gemini-nano-banana-2.1`.
- `OPENAI_API_KEY`: optional key for ChatGPT models.
- `GROQ_API_KEY`: optional key for Groq models.

Never commit provider keys to GitHub or paste them into chat. Store them only in Render Environment.

## Billing status

Plan requests are currently manual-review requests. DeftAI does not collect card or UPI payments and does not run automatic subscriptions. Do not advertise paid checkout as live until a payment provider, server-side verification, refunds, and adult/guardian-reviewed business setup are completed.
