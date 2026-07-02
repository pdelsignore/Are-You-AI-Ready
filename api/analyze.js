import { buildFrameworkPromptSection } from './skills-framework.js';

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';
const DEFAULT_MODEL = 'openai/gpt-4o';
const MAX_TOKENS = 12000;
const SYSTEM_PROMPT = 'You are a workforce skills analyst. Score profiles using the provided Skills Framework. Always respond with valid JSON only. No markdown fences. Keep string values concise. Do not use double quotes inside string values.';

function repairJsonText(text) {
  let cleaned = String(text).trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  }
  cleaned = cleaned.replace(/[\u201c\u201d]/g, '"').replace(/[\u2018\u2019]/g, "'");
  cleaned = cleaned.replace(/,(\s*[}\]])/g, '$1');
  return cleaned;
}

function parseAnalysisContent(content, finishReason) {
  if (!content || !String(content).trim()) {
    if (finishReason === 'length') {
      throw new Error('Analysis response was cut off. Try a shorter document or switch to a faster model.');
    }
    throw new Error('No analysis content returned from the model.');
  }

  const text = repairJsonText(content);
  const candidates = [text];
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start !== -1 && end > start) {
    candidates.push(text.slice(start, end + 1));
  }

  let lastError = null;
  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate);
    } catch (error) {
      lastError = error;
    }
  }

  const message = new Error('Could not parse analysis results');
  message.cause = lastError;
  throw message;
}

function parseRequestBody(req) {
  const raw = req.body;
  if (!raw) return {};
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw);
    } catch {
      return {};
    }
  }
  if (Buffer.isBuffer(raw)) {
    try {
      return JSON.parse(raw.toString('utf8'));
    } catch {
      return {};
    }
  }
  return raw;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.OPENROUTER_API_KEY;
  const model = process.env.OPENROUTER_MODEL || DEFAULT_MODEL;

  if (!apiKey) {
    console.error('OPENROUTER_API_KEY environment variable not set');
    return res.status(500).json({ error: 'Server configuration error. API key not set.' });
  }

  try {
    const { profileText } = parseRequestBody(req);

    if (!profileText || profileText.trim().length < 80) {
      return res.status(400).json({
        error: 'Could not read enough text from the document. Please upload a valid profile PDF, resume, or career document.',
      });
    }

    const prompt = buildPrompt(profileText);
    const messages = [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: prompt },
    ];

    let { content, finishReason } = await callOpenRouter(apiKey, model, messages);
    let analysis;
    try {
      analysis = parseAnalysisContent(content, finishReason);
    } catch (parseError) {
      if (!content) throw parseError;
      console.error('Initial JSON parse failed; retrying with repair prompt');
      const fixMessages = messages.concat([
        { role: 'assistant', content },
        {
          role: 'user',
          content: 'Your previous response was invalid JSON. Return ONLY a corrected JSON object matching the required schema. No markdown, no commentary.',
        },
      ]);
      ({ content, finishReason } = await callOpenRouter(apiKey, model, fixMessages));
      analysis = parseAnalysisContent(content, finishReason);
    }

    return res.status(200).json(analysis);
  } catch (error) {
    console.error('Analysis error:', error);

    if (error.message?.includes('401')) {
      return res.status(500).json({ error: 'API authentication failed. Please contact support.' });
    }
    if (error.message?.includes('429')) {
      return res.status(429).json({ error: 'Service is busy. Please try again in a moment.' });
    }
    if (error.message?.includes('parse') || error.message?.includes('delimiter') || error.message?.includes('JSON')) {
      return res.status(500).json({ error: 'Could not parse analysis results. Please try again.' });
    }

    return res.status(500).json({ error: 'An error occurred during analysis. Please try again.' });
  }
}

function buildPrompt(profileText) {
  const framework = buildFrameworkPromptSection();

  return `You are an expert workforce analyst. Analyze the professional profile below using Pearson's Skills Framework and four AI Readiness capability areas.

${framework}

The four AI readiness capability areas (use for capability field and rollup scores):
1. Functional Proficiency — AI tool use, prompting, workflow integration
2. Strategic Intelligence — spotting AI value, judgment, industry awareness
3. Ethical Stewardship — responsible, privacy-aware, fair AI use
4. Critical Human Skills — adaptability, collaboration, human-centered problem solving

Based on the profile document:
1. Provide a brief profile summary.
2. Build a skillsTable: identify 6–8 AI-relevant skills evidenced in the profile. Score EACH skill using the Skills Framework methodology above.
3. Compute the 4 capability area scores as the rounded average of skills mapped to that capability (or best evidence if fewer skills).
4. For each capability area, write a one-sentence summary and 2–3 tailored recommendations.

Keep all string values short (under 120 characters). Do not use double quotes inside string values.

Profile document:
${profileText}

Respond with valid JSON in this exact format:
{
  "profileSummary": {
    "name": "Person's name or 'Professional'",
    "currentRole": "Their current job title",
    "industry": "Their industry",
    "experience": "Brief experience summary"
  },
  "skillsTable": [
    {
      "skill": "Skill name",
      "capability": "Functional Proficiency",
      "score": 72,
      "proficiencyLevel": "Competent",
      "signalType": "Current role",
      "evidence": "Brief evidence from profile"
    }
  ],
  "functionalProficiency": {
    "score": 65,
    "summary": "One sentence overview",
    "recommendations": ["Recommendation 1", "Recommendation 2", "Recommendation 3"]
  },
  "strategicIntelligence": {
    "score": 55,
    "summary": "One sentence overview",
    "recommendations": ["Recommendation 1", "Recommendation 2", "Recommendation 3"]
  },
  "ethicalStewardship": {
    "score": 45,
    "summary": "One sentence overview",
    "recommendations": ["Recommendation 1", "Recommendation 2", "Recommendation 3"]
  },
  "criticalHumanSkills": {
    "score": 70,
    "summary": "One sentence overview",
    "recommendations": ["Recommendation 1", "Recommendation 2", "Recommendation 3"]
  }
}`;
}

async function callOpenRouter(apiKey, model, messages) {
  const siteUrl = (process.env.OPENROUTER_SITE_URL || 'https://are-you-ai-ready-blue.vercel.app').trim();
  const appTitle = (process.env.OPENROUTER_APP_TITLE || 'AI Readiness Assessment').trim();

  const response = await fetch(OPENROUTER_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
      'HTTP-Referer': siteUrl,
      'X-Title': appTitle,
    },
    body: JSON.stringify({
      model,
      max_tokens: MAX_TOKENS,
      temperature: 0,
      response_format: { type: 'json_object' },
      messages,
    }),
  });

  const data = await response.text();
  if (!response.ok) {
    throw new Error(`API error ${response.status}: ${data}`);
  }

  try {
    const parsed = JSON.parse(data);
    const choice = parsed.choices?.[0] || {};
    return {
      content: choice.message?.content,
      finishReason: choice.finish_reason,
    };
  } catch {
    throw new Error('Failed to parse API response');
  }
}
