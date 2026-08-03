const sentenceCaseIfAllCaps = (value) => {
    const text = String(value || '').trim();
    if (!text || text !== text.toUpperCase() || !/[A-Z]/.test(text)) return text;
    return `${text.charAt(0)}${text.slice(1).toLowerCase()}`
        .replace(/\bapi\b/g, 'API')
        .replace(/\bdns\b/g, 'DNS')
        .replace(/\bhttp\b/g, 'HTTP')
        .replace(/\botel\b/g, 'OTel')
        .replace(/\btls\b/g, 'TLS');
};

const isOperationsFollowUp = (prompt) => {
    const text = String(prompt || '').trim().toLowerCase();
    return {
        remediation: /\b(?:how (?:do|can|should) (?:i|we) (?:fix|resolve|remediate)|how to (?:fix|resolve|remediate)|fix (?:it|this|that)|what (?:is|are) the (?:fix|remediation|next steps?)|what should (?:i|we) do|next steps?|remediation steps?|resolve (?:it|this|that))\b/.test(text),
        cause: /\b(?:what|which)[^?.!]*(?:cause|causing|root cause|reason)|\b(?:cause|root cause)\b[^?.!]*(?:issue|problem|failure)/.test(text),
        detail: /\b(?:detailed?|explain(?:ed|ation)?|why)\b/.test(text),
        bullets: /\b(?:bullet(?:ed)?(?:\s+points?)?|in\s+points?|list(?:\s+these|\s+the|\s+it|\s+them)?)\b/.test(text),
        nextStep: /^(?:then|and then|after that|afterwards|next|continue|go on|what(?:'s| is)? next|what should (?:i|we) do next)\s*[?.!]*$/.test(text)
    };
};

export const formatOperationsFollowUp = (prompt, investigation, history = []) => {
    if (!investigation?.target || !Array.isArray(investigation.steps) || !investigation.steps.length) return null;
    const intent = isOperationsFollowUp(prompt);
    const previousAssistant = [...history].reverse().find((message) => message?.role === 'assistant');
    const previousWasIncomplete = /(?:following|these|next) steps\s*:?\s*$/i.test(String(previousAssistant?.content || '').trim());
    if (!intent.remediation && !intent.cause && !intent.detail && !intent.bullets && !intent.nextStep && !(previousWasIncomplete && /^\?{1,4}$/.test(String(prompt || '').trim()))) return null;

    const cause = (investigation.rootCauses || [])[0];
    const confidence = cause?.confidence === 'confirmed' ? 'confirmed' : `${cause?.confidence || 'low'} confidence`;
    const causeLine = cause
        ? `The strongest supported hypothesis is **${sentenceCaseIfAllCaps(cause.title)}** (${confidence}).${cause.rationale ? ` ${sentenceCaseIfAllCaps(cause.rationale)}` : ''}`
        : 'The retained evidence does not support a specific root cause yet.';
    const currentState = investigation.target.type === 'monitor' && (investigation.impact?.status || investigation.target.status)
        ? ` The monitor is currently **${investigation.impact?.status || investigation.target.status}**, so start by determining whether the failures are active or historical.`
        : '';
    const steps = investigation.steps.map((step, index) => `${index + 1}. **${sentenceCaseIfAllCaps(step.action)}**${step.reason ? ` ${sentenceCaseIfAllCaps(step.reason)}` : ''}`).join('\n');
    const evidence = (investigation.evidence || []).filter((item) => item.summary || item.detail).slice(0, 6);
    const evidenceLines = evidence.map((item) => `- **${item.family || 'signal'}:** ${item.summary || item.detail}`).join('\n');
    const remediation = `${causeLine}${currentState}\n\nUse this investigation and remediation sequence:\n\n${steps}\n\nDo not close the incident or treat the hypothesis as proven until validation identifies the failing dependency and recovery is sustained.`;
    if (intent.nextStep) {
        const completedFollowUps = history.filter((message) => message?.role === 'user' && isOperationsFollowUp(message.content).nextStep).length;
        const nextStep = investigation.steps[completedFollowUps + 1];
        if (!nextStep) return `There are no further evidence-backed steps in this briefing. Do not resolve the incident yet. ${evidence.length ? 'Refresh the briefing after the next check or alert so it can evaluate the new evidence.' : 'Run the affected monitor, link any resulting alert or trace to the incident, and refresh the briefing so the next action can be evidence-based.'}`;
        return `Next, complete **step ${completedFollowUps + 2}: ${sentenceCaseIfAllCaps(nextStep.action)}**${nextStep.reason ? ` ${sentenceCaseIfAllCaps(nextStep.reason)}` : ''}${evidence.length ? '\n\nRecord the result before continuing, then ask “Then?” for the next step.' : '\n\nNo alert, failed check, or trace evidence is retained yet. Record the monitor result and link any resulting alert before moving to resolution.'}`;
    }
    if (intent.bullets) return [
        `- **Likely cause:** ${cause ? sentenceCaseIfAllCaps(cause.title) : 'No single root cause is confirmed.'}`,
        `- **Confidence:** ${confidence}. ${cause?.rationale || 'The retained evidence is not sufficient to confirm one cause.'}`,
        `- **Current state:** ${investigation.impact?.status || investigation.target.status || 'unknown'}${investigation.impact?.failedCheckCount !== undefined ? `, with ${investigation.impact.failedCheckCount} failed checks in the selected window` : ''}.`,
        evidence.length ? `- **Supporting evidence:**\n${evidenceLines}` : '- **Supporting evidence:** No detailed evidence item was retained for this snapshot.',
        `- **Next checks:**\n${steps}`
    ].join('\n');
    if (intent.detail) return `${causeLine}${currentState}\n\nThe evidence snapshot contains ${evidence.length} retained signal${evidence.length === 1 ? '' : 's'}. The strongest signals are:\n\n${evidenceLines || '- No detailed evidence item was retained for this snapshot.'}\n\nThe recommended validation sequence is:\n\n${steps}`;
    return remediation;
};
