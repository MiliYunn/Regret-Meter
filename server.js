require('dotenv').config();
const express = require('express');
const path = require('path');
const OpenAI = require('openai');

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-5.4-mini';
const openai = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;

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
    financial: /(buy|purchase|sell|sold|loan|debt|invest|quit|salary|money|crypto|bet)/i,
    irreversible: /(resign|quit|sell|sold|give away|destroy|marry|divorce|tattoo|publish|delete|sign|move|surgery)/i,
    social: /(message|text|post|email|boss|partner|friend|mom|mother|dad|father|family|public|announce)/i,
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

function buildChatReply(payload = {}) {
  const message = String(payload.message || '').trim().slice(0, 600);
  const question = message.toLowerCase();
  const rawAudit = payload.audit && typeof payload.audit === 'object' ? payload.audit : null;
  const scenario = String(rawAudit?.scenario || '').trim().slice(0, 1200);
  const score = Number.isFinite(Number(rawAudit?.score)) ? clamp(Number(rawAudit.score)) : null;
  const vectors = rawAudit?.vectors && typeof rawAudit.vectors === 'object' ? rawAudit.vectors : {};
  const impulse = Number.isFinite(Number(vectors.impulse)) ? clamp(Number(vectors.impulse)) : null;
  const irreversible = Number.isFinite(Number(vectors.irreversible)) ? clamp(Number(vectors.irreversible)) : null;
  const hazard = String(rawAudit?.hazard || (score === null ? '' : score >= 70 ? 'CRITICAL HAZARD' : score >= 36 ? 'CAUTIOUS BET' : 'SAFE BET')).slice(0, 40);
  const context = scenario.toLowerCase();
  const history = Array.isArray(payload.history) ? payload.history.slice(-8) : [];
  const previousUser = [...history].reverse().find(item => item?.role === 'user' && String(item.text || '').trim().toLowerCase() !== question);
  const turnIndex = history.filter(item => item?.role === 'user').length;
  const repeatedQuestionCount = history.filter(item => item?.role === 'user' && String(item.text || '').trim().toLowerCase() === question).length;
  const replyVariant = repeatedQuestionCount || turnIndex;
  const auditLine = score === null ? '' : `\n\nAudit context: ${score}% regret risk${hazard ? ` (${hazard})` : ''}.`;
  const isFamilyValue = /mom|mother|dad|father|family|generation|inherit|heirloom|birthday|gift|watch/.test(context);
  const isMoney = /money|cash|sell|sold|price|pay|spend|owe|debt|loan|buy|purchase|invest/.test(context);
  const isRelationship = /friend|relationship|partner|boyfriend|girlfriend|trust|angry|mad|left me/.test(context);
  const isCareer = /quit|job|boss|career|resign|work/.test(context);
  const topVector = Object.entries(vectors).filter(([, value]) => Number.isFinite(Number(value))).sort((a, b) => Number(b[1]) - Number(a[1]))[0];

  if (/^(hi|hello|hey|yo|good (morning|afternoon|evening))[!.? ]*$/.test(question)) {
    return score === null
      ? 'Hey — Bob is online. Tell me the decision, what makes it urgent, and what you are afraid will happen if you wait.'
      : `Hey — I have your ${score}% audit in view. Ask me whether the move is impulsive, what the score means, what to do next, or how to explain it to someone involved.`;
  }
  if (/^(thanks|thank you|thx|okay thanks|got it)[!. ]*$/.test(question)) {
    return 'Anytime. Before you act, write down the next reversible step and the condition that would make you stop. Future You enjoys documentation.';
  }
  if (/am i (wrong|right)|was i (wrong|right)|did i do (wrong|the right thing)|is it my fault|blame me/.test(question)) {
    if (isFamilyValue && isMoney) return `Needing money does not make you wrong. Selling a meaningful family item quickly and below a checked value was the risky part—not proof that you are a bad person.\n\nOwn the avoidable part: you acted under pressure without enough valuation or family context. Then focus on repair: pause further sales, document exactly what happened, and speak honestly with your mom before inventing excuses.${auditLine}`;
    return `Your feeling is valid; that does not automatically make every action justified. Separate intent from impact: what were you trying to solve, who absorbed the cost, and what repair is still possible? Take responsibility for the controllable part without turning one decision into a verdict on your character.${auditLine}`;
  }
  if (/how (do|should|can) i (tell|talk|explain)|how to (tell|talk|explain)|what (do|should) i say|tell my (mom|mother|dad|father|friend|partner)/.test(question)) {
    const person = /mom|mother/.test(question) || /mom|mother/.test(context) ? 'Mom' : /dad|father/.test(question) || /dad|father/.test(context) ? 'Dad' : 'Hey';
    const detail = isFamilyValue && isMoney
      ? 'I was stressed about money and sold the watch without first understanding its family value or checking a fair price. I realize that may have hurt you. I am sorry. I want to tell you exactly what happened and discuss what I can do to repair it.'
      : 'I made a decision while I was under pressure. I want to explain what happened without defending it, hear how it affected you, and agree on a fair next step.';
    return `Try this:\n“${person}, ${detail}”\n\nSay it directly, privately, and before they discover it another way. Bring the facts you know and one realistic repair option; do not promise something you cannot deliver.${auditLine}`;
  }
  if (/what (should|can|do) i do|what next|do then|next step|give me (a )?(suggestion|advice|plan)|help me decide|any suggestion/.test(question)) {
    if (isFamilyValue && isMoney) return `Here is your next-move plan:\n1. Pause: do not sell any more family items today.\n2. Verify: record what was sold, the sale price, buyer details, ownership, and an independent value estimate.\n3. Recover if reasonable: politely ask whether the buyer would consider reversing the sale; do not threaten or misrepresent.\n4. Repair: tell your mom honestly and propose a realistic action—repayment, recovery attempt, or preserving the remaining items.\n5. Solve the original cash problem separately with options that do not spend irreplaceable value.${auditLine}`;
    if (isCareer) return `Next steps:\n1. Do not resign during the emotional spike.\n2. Calculate at least three months of essential expenses.\n3. Document the work problem and request one specific change.\n4. Quietly update your résumé and test the market.\n5. Reassess on a date you choose now.${auditLine}`;
    if (isRelationship) return `Next steps:\n1. Wait until both people are calm.\n2. State the event without guessing motive.\n3. Explain its impact on you.\n4. Ask for their understanding of the agreement.\n5. Agree on one concrete repair or boundary.${auditLine}`;
    return `Use this five-step reset:\n1. Pause the irreversible action.\n2. Write the missing fact that could change your choice.\n3. Test the smallest reversible version.\n4. Set a loss limit and review date.\n5. Ask one person who is willing to disagree with you.${auditLine}`;
  }
  if (/why.*(score|risk|percent)|explain.*(score|result)|how.*(score|calculate)|what does.*(score|result)|why (is|was) it/.test(question)) {
    const top = topVector ? `${topVector[0]} (${Math.round(Number(topVector[1]))}%)` : 'the combined risk signals';
    return `The ${score === null ? 'current' : `${score}%`} result comes from five weighted signals: impulse 28%, financial exposure 20%, irreversibility 27%, opportunity cost 17%, and social stakes 8%. Your strongest signal is ${top}.\n\nThe score is a structured warning, not a moral judgment or a prediction. Change the inputs—cooling-off time, evidence, reversibility, or loss limit—and the risk should change too.${auditLine}`;
  }
  if (/feel (guilty|bad|ashamed|regret)|i regret|i'm scared|i am scared|anxious/.test(question)) {
    return `That feeling is information, not a sentence. Use it to repair what is repairable: name the harm precisely, apologize without hiding behind the pressure you felt, and make one concrete restitution step. Then create a rule that prevents the same decision under the same conditions.${auditLine}`;
  }

  if (/impuls|fomo|urgent|rush|thinking clearly/.test(question)) {
    const urgency = /(right now|tonight|immediately|urgent|can't wait|must have|send it)/i.test(scenario);
    const signal = impulse === null ? 'not yet measured' : `${impulse}%`;
    const approaches = [
      `Impulse check: your audit's impulse signal is ${signal}${urgency ? ', and the dilemma contains urgency language' : ''}.\n\nBefore acting, separate the evidence from the emotional deadline: what fact requires action today, what changes if you wait 24 hours, and what is the smallest reversible move?`,
      `Your measured impulse signal is ${signal}. ${urgency ? 'The wording also contains a time-pressure cue, which raises the chance that urgency is steering.' : 'The text has no strong urgency phrase, so the pressure may be emotional rather than time-critical.'}\n\nRun the overnight test: would you make the same move tomorrow after sleep, food, and one outside opinion?`,
      `${impulse !== null && impulse >= 70 ? 'Yes—this audit shows a strong impulse pattern.' : 'The audit does not show extreme impulse, but it still deserves a pause.'} The useful question is not “Do I feel certain?” but “What new evidence would make me change my mind?” Write that answer before acting.`,
    ];
    return `${approaches[replyVariant % approaches.length]}${auditLine}`;
  }
  if (/type 1|type 2|door|revers/.test(question)) {
    const typeOne = irreversible !== null && irreversible >= 60;
    const reason = /sell|sold/.test(context) ? 'Once an item is sold—especially a meaningful one—recovery depends on another person.' : /quit|resign/.test(context) ? 'Leaving a job changes income and may be costly to reverse.' : /publish|post|message/.test(context) ? 'A public or sent message can be copied even if you delete it.' : 'The score reflects how costly the decision would be to undo.';
    const doorOpeners = typeOne
      ? ['This is a Type 1-ish door', 'Treat this as a mostly one-way door', 'Bob’s door verdict: slow lane, Type 1-ish']
      : ['This is a Type 2-ish door', 'This looks like a reversible door', 'Bob’s door verdict: testable, Type 2-ish'];
    return `${doorOpeners[replyVariant % doorOpeners.length]}${irreversible === null ? '' : ` with ${irreversible}% irreversibility`}. ${reason}\n\n${typeOne ? 'Pause the permanent step and test a reversible substitute first.' : 'You can run a bounded experiment: set a limit, a stop condition, and a review date.'}${auditLine}`;
  }
  if (/already (spent|paid|invested)|too (much|far) (to|into)|keep investing|waste (what|the money)|sunk cost/.test(question)) {
    return `Sunk-cost alarm: money already spent is gone whether you continue or stop. It has no vote in the next decision.\n\nAsk: “If I had invested $0 so far, would today's evidence justify putting new money into this?” Fund only the next measurable test, with a fresh budget and deadline.${auditLine}`;
  }
  if (/chill text|draft|write.*text|what.*say|message.*them/.test(question)) {
    if (isFamilyValue && isMoney) {
      const drafts = [
        '“Mom, I need to tell you something honestly. I was stressed about money and sold the watch before checking its value or understanding what it meant to our family. I am sorry. I want to explain exactly what happened and talk about what I can realistically do to repair it.”',
        '“Mom, I made a rushed decision with the watch you gave me. I sold it cheaply because I was worried about money, and I only learned afterward that it had been in our family for generations. I know this may hurt. Can we talk privately about what happened and what I can do next?”',
        '“Mom, I owe you an honest conversation. I sold the watch while I was under financial pressure without checking its history or fair value. I regret handling it that way. I am looking into whether the sale can be reversed, and I want to hear how this affected you.”',
      ];
      return `Try this:\n${drafts[replyVariant % drafts.length]}\n\nKeep the message factual. Do not minimize the sale, blame the emergency, or promise recovery until you know whether it is possible.${auditLine}`;
    }
    if (isCareer) return `Try this:\n“Could we schedule a calm conversation about what happened at work? I want to explain the impact it had on me, understand your perspective, and discuss a concrete way forward before I make a bigger decision.”${auditLine}`;
    const subject = isRelationship ? 'what happened between us' : isMoney ? 'the money decision' : 'this decision';
    const openings = ['I want to talk', 'Can we have a calm conversation', 'I would like us to compare what each of us understood'];
    return `Try this:\n“${openings[replyVariant % openings.length]} about ${subject} without assuming intent. Here is what I observed and how it affected me. Can I hear your view before we agree on a fair next step?”\n\nIt lowers the temperature while keeping the issue specific.${auditLine}`;
  }
  if (/money|cash|pay|spend|share|sharing|owe|street|found/.test(question)) {
    return `This has a money-and-fairness layer. Separate ownership, the agreement that existed before the money was spent, and the outcome you want now. Ask for the other person's version before proposing a specific split or repayment. Do not retaliate or spend more to “even it out.”${auditLine}`;
  }
  if (/friend|relationship|partner|boyfriend|girlfriend|trust|angry|mad|left me/.test(question)) {
    return `Relationship sanity check: describe the observable event, name its impact on you, and ask one genuine question before demanding a solution.\n\nTry: “When that happened, I felt left out. What did you understand our agreement to be?”${auditLine}`;
  }
  if (/quit|job|boss|career|resign/.test(question)) {
    return `Do not turn one brutal day into a permanent career door. Check your financial runway, write the minimum conditions that would make staying acceptable, and take one reversible step—update your résumé, take a day off, or schedule the conversation—before resigning.${auditLine}`;
  }
  if (/buy|purchase|crypto|invest|loan|debt/.test(question)) {
    return `Calculate the total cost, wait through one cooling-off period, and decide the maximum acceptable loss before spending. If the opportunity cannot survive 48 hours, it may be selling urgency rather than value.${auditLine}`;
  }
  if (scenario) {
    const excerpt = scenario.length > 145 ? `${scenario.slice(0, 142)}…` : scenario;
    const continuity = previousUser ? ` Your previous question was about “${String(previousUser.text).slice(0, 80)}${String(previousUser.text).length > 80 ? '…' : ''},” so I am keeping that thread in view.` : '';
    return `For your audited dilemma—“${excerpt}”—I need one sharper target from your question.${continuity}\n\nAsk me one of these: “What should I do next?”, “Am I wrong?”, “Why is the score ${score ?? 'this'}%?”, “How do I tell the person involved?”, or “What is the smallest reversible option?”${auditLine}`;
  }
  return 'Start with four checks: what fact you know, what motive you are guessing, what cannot be undone, and the smallest reversible next step. Give me the dilemma and I will pressure-test it with you.';
}

function compactAudit(rawAudit) {
  if (!rawAudit || typeof rawAudit !== 'object') return null;
  const vectors = rawAudit.vectors && typeof rawAudit.vectors === 'object'
    ? Object.fromEntries(Object.entries(rawAudit.vectors).map(([key, value]) => [key, clamp(Number(value) || 0)]))
    : {};
  return {
    scenario: String(rawAudit.scenario || '').trim().slice(0, 1200),
    score: Number.isFinite(Number(rawAudit.score)) ? clamp(Number(rawAudit.score)) : null,
    hazard: String(rawAudit.hazard || '').slice(0, 40),
    emotional: Number.isFinite(Number(rawAudit.emotional)) ? Number(rawAudit.emotional) : null,
    horizon: String(rawAudit.horizon || '').slice(0, 20),
    vectors,
  };
}

function enforceAuditAccuracy(reply, audit) {
  if (!audit) return reply;
  const measured = [audit.score, ...Object.values(audit.vectors || {})]
    .filter(value => Number.isFinite(Number(value)))
    .map(value => Math.round(Number(value)));
  const allowed = new Set(measured);
  return String(reply).replace(/\b(100|[1-9]?\d)%(?!\d)/g, (match, value) => allowed.has(Number(value)) ? match : 'an unmeasured percentage');
}

async function generateChatReply(payload = {}) {
  if (!openai) return { reply: buildChatReply(payload), source: 'local' };
  const audit = compactAudit(payload.audit);
  const message = String(payload.message || '').trim().slice(0, 600);
  const prior = Array.isArray(payload.history) ? payload.history.slice(-10) : [];
  const input = prior
    .map(item => ({
      role: item?.role === 'bot' || item?.role === 'assistant' ? 'assistant' : 'user',
      content: String(item?.text || '').trim().slice(0, 700),
    }))
    .filter(item => item.content);
  if (!input.length || input[input.length - 1].content !== message) input.push({ role: 'user', content: message });
  const auditText = audit ? JSON.stringify(audit) : 'No evaluation has been run yet.';
  const response = await openai.responses.create({
    model: OPENAI_MODEL,
    store: false,
    max_output_tokens: 500,
    instructions: `You are Bob, the RegretMeter decision co-pilot. Give a fresh, natural, conversational answer to the user's latest message. Do not use a fixed template and do not repeat an earlier answer. Infer the user's intent from the latest question while using prior chat only for continuity. Be empathetic, witty in moderation, and practical. Ask a useful follow-up question when information is missing. For requests to draft a message, write a scenario-specific draft using the people and facts actually mentioned. For next-step requests, give concrete actions tailored to the dilemma. Never invent or recalculate percentages: the audit JSON below is the only authoritative source for scores, vectors, labels, and facts. If there is no audit value, say it was not measured. Do not expose hidden chain-of-thought; provide a concise decision rationale when asked. Do not claim to be a therapist, lawyer, or financial adviser. Keep most replies under 220 words.\n\nAUTHORITATIVE AUDIT JSON:\n${auditText}`,
    input,
  });
  const reply = enforceAuditAccuracy(String(response.output_text || '').trim(), audit);
  if (!reply) throw new Error('The model returned an empty response.');
  return { reply, source: 'openai', model: OPENAI_MODEL };
}

app.get('/api/health', (_req, res) => res.json({ ok: true, service: 'regret-meter', version: '2.5.0', aiConfigured: Boolean(openai), model: openai ? OPENAI_MODEL : null }));
app.post('/api/evaluate', (req, res) => res.json(calculateEvaluation(req.body)));
app.post('/api/chat', async (req, res) => {
  try {
    const message = String(req.body?.message || '').trim();
    if (!message) return res.status(400).json({ error: 'A chat message is required.' });
    if (message.length > 600) return res.status(413).json({ error: 'Chat messages must be 600 characters or fewer.' });
    res.setHeader('Cache-Control', 'no-store');
    try {
      return res.json(await generateChatReply(req.body));
    } catch (modelError) {
      console.error('[RegretMeter OpenAI]', modelError);
      const fallback = { reply: buildChatReply(req.body), source: 'local-fallback' };
      if (process.env.NODE_ENV !== 'production') fallback.warning = modelError.message;
      return res.json(fallback);
    }
  } catch (error) {
    console.error('[RegretMeter /api/chat]', error);
    const body = { error: 'Bob could not process that message.' };
    if (process.env.NODE_ENV !== 'production') body.details = error.message;
    return res.status(500).json(body);
  }
});
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

module.exports = { app, calculateEvaluation, sanitizeMessage, buildChatReply, generateChatReply, compactAudit, enforceAuditAccuracy };
