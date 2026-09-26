# IBM Bob assistance

IBM Bob supported the Regret Meter build across three workflow modes. The shipped application remains deterministic and local-first; it does not call a Bob API at runtime.

## Ask mode

- Explored the Regret Minimization Framework and Type 1 versus Type 2 doors.
- Examined affect heuristics, FOMO, action bias, and opportunity-cost signals.
- Clarified which parts of the result should remain explainable to users.

## Plan mode

- Structured the single-page view system and primary audit journey.
- Defined the local browser-storage boundary for sessions, history, and chats.
- Planned the Express server, report export paths, and Docker packaging.

## Agent mode

- Accelerated the responsive dark-glass interface scaffold.
- Assisted with scoring vectors, the animated gauge, and the risk matrix.
- Supported report persistence, interactive pricing, and project documentation.

## Runtime boundary

Regret Meter does not require a Bob API key. The Decision Co-Pilot uses transparent browser-side response rules for the hackathon demonstration. A production version could replace this layer with an approved hosted model while preserving the same privacy and authentication boundaries.
