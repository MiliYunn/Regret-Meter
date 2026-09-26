# Regret Meter

Behavioral decision auditing and impulse intervention suite built for the LabLab hackathon.

## Run locally

```bash
npm install
npm start
```

Open `http://localhost:3000`.

## Generative Bob AI Co-Pilot

Bob automatically uses the local audit-aware response engine when no external credentials are configured. For varied, open-ended ChatGPT-style replies, copy `.env.example` to `.env` and add a server-side OpenAI API key:

```env
PORT=3000
OPENAI_API_KEY=your_key_here
OPENAI_MODEL=gpt-5.4-mini
```

Restart the server after changing `.env`. Never place the key in `app.js`, `index.html`, or GitHub. The browser sends bounded audit context and recent messages to the local `/api/chat` route; only the Node server communicates with OpenAI.

## Docker

```bash
docker build -t regret-meter .
docker run --rm -p 3000:3000 regret-meter
```

User sessions, audit history, Bob AI Co-Pilot conversations, pricing choices, overall percentages, and Bob's four-step thinking pathway stay in the current browser via `localStorage`. Authentication is intentionally mocked for the hackathon demo. When generative mode is enabled, the bounded current audit and recent chat turns are sent through the server to the configured model to produce a reply.

See [BOB_ASSISTANCE.md](BOB_ASSISTANCE.md) for the IBM Bob Ask, Plan, and Agent workflow breakdown.
