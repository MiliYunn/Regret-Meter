# Regret Meter workspace

- Keep the client dependency-light: HTML, Tailwind CDN, custom CSS, and vanilla JavaScript.
- Preserve `navigateTo(viewId)` as the single-page navigation contract.
- Call `lucide.createIcons()` after every view or dynamically rendered panel update.
- Store evaluation history and active impulse locks in browser `localStorage`.
- Keep REST responses JSON unless an export endpoint explicitly returns text.
- Run `npm run check` before completing material JavaScript changes.
