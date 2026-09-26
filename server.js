require('dotenv').config();
const express = require('express');
const path = require('path');

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.disable('x-powered-by');
app.use(express.json({ limit: '128kb' }));

const clamp = (value, min = 0, max = 100) => Math.min(max, Math.max(min, value));

function sanitizeMessage(input = '') {
  const substitutions = [
    [/\b(you always|you never)\b/gi, 'I feel like this keeps happening'],
    [/\b(i hate you|hate you)\b/gi, 'I am very upset right now'],
    [/\b(urgent|answer me now|reply now)\b/gi, 'when you have time, please reply'],
    [/\b(wtf|f+u+c+k+|damn)\b/gi, ''],
    [/!{2,}/g, '.'],
    [/\?{2,}/g, '?'],
  ];
  let output = String(input).trim();
  substitutions.forEach(([pattern, replacement]) => { output = output.replace(pattern, replacement); });
  output = output.replace(/\s{2,}/g, ' ').replace(/\s+([.,!?])/g, '$1');
  if (output && !/[.!?]$/.test(output)) output += '.';
  return output;
}

function calculateEvaluation(payload = {}) {
  const scenario = String(payload.scenario || '').toLowerCase();
  const emotional = Number(payload.emotional || 3);
  const horizon = payload.horizon || '6m';
  const signals = {
    impulse: /(right now|tonight|immediately|can't wait|urgent|fomo|must have|send it)/i,
    financial: /(buy|purchase|loan|debt|invest|quit|salary|money|crypto|bet)/i,
    irreversible: /(resign|quit|marry|divorce|tattoo|publish|delete|sign|move|surgery)/i,
    social: /(message|text|post|email|boss|partner|friend|public|announce)/i,
  };
  const values = {
    impulse: clamp(18 + emotional * 11 + (signals.impulse.test(scenario) ? 23 : 0)),
    financial: clamp(12 + (signals.financial.test(scenario) ? 55 : 0) + (horizon === '5y' ? 12 : 0)),
    irreversible: clamp(14 + (signals.irreversible.test(scenario) ? 62 : 0) + (horizon === '24h' ? 8 : 0)),
    opportunity: clamp(16 + (horizon === '5y' ? 46 : horizon === '6m' ? 25 : 8) + (scenario.length > 180 ? 12 : 0)),
    social: clamp(10 + (signals.social.test(scenario) ? 45 : 0) + emotional * 5),
  };
  const score = Math.round(values.impulse * .28 + values.financial * .2 + values.irreversible * .27 + values.opportunity * .17 + values.social * .08);
  const hazard = score >= 70 ? 'CRITICAL HAZARD' : score >= 36 ? 'CAUTIOUS BET' : 'SAFE BET';
  return { score, hazard, vectors: values };
}

app.get('/api/health', (_req, res) => res.json({ ok: true, service: 'regret-meter', version: '2.4.0' }));
app.post('/api/evaluate', (req, res) => res.json(calculateEvaluation(req.body)));
app.post('/api/sanitize', (req, res) => {
  const message = String(req.body?.message || '');
  if (!message.trim()) return res.status(400).json({ error: 'A draft message is required.' });
  return res.json({ original: message, sanitized: sanitizeMessage(message) });
});
app.post('/api/export', (req, res) => {
  const format = req.query.format === 'text' ? 'text' : 'json';
  const audit = req.body || {};
  res.setHeader('Content-Disposition', `attachment; filename="regret-meter-audit-${Date.now()}.${format === 'text' ? 'txt' : 'json'}"`);
  if (format === 'text') {
    res.type('text/plain').send(`REGRET METER AUDIT\nScore: ${audit.score ?? '—'}\nHazard: ${audit.hazard ?? '—'}\nScenario: ${audit.scenario ?? '—'}\n`);
  } else {
    res.type('application/json').send(JSON.stringify(audit, null, 2));
  }
});

app.get(['/','/index.html','/regretmeter_web_application.html'], (_req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get('/app.js', (_req, res) => res.type('application/javascript').sendFile(path.join(__dirname, 'app.js')));
app.get('/styles.css', (_req, res) => res.type('text/css').sendFile(path.join(__dirname, 'styles.css')));
app.get(/.*/, (_req, res) => res.sendFile(path.join(__dirname, 'index.html')));

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Regret Meter running on http://localhost:${PORT}`);
});

module.exports = { app, calculateEvaluation, sanitizeMessage };
