# Regret Meter

Behavioral decision auditing and impulse intervention suite built for the LabLab hackathon.

## Run locally

```bash
npm install
npm start
```

Open `http://localhost:3000`.

## Docker

```bash
docker build -t regret-meter .
docker run --rm -p 3000:3000 regret-meter
```

User sessions, audit history, Bob AI Co-Pilot conversations, pricing choices, overall percentages, and Bob's four-step thinking pathway stay in the current browser via `localStorage`. Authentication is intentionally mocked for the hackathon demo; no credentials or private scenarios are stored by the server.

See [BOB_ASSISTANCE.md](BOB_ASSISTANCE.md) for the IBM Bob Ask, Plan, and Agent workflow breakdown.
