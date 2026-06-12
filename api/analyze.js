import https from 'https';
import { buildFrameworkPromptSection } from './skills-framework.js';

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

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error('OPENAI_API_KEY environment variable not set');
    return res.status(500).json({ error: 'Server configuration error. API key not set.' });
  }

  try {
    const { profileText } = req.body;

    if (!profileText || profileText.trim().length < 80) {
      return res.status(400).json({
        error: 'Could not read enough text from the document. Please upload a valid profile PDF, resume, or career document.',
      });
    }

    const prompt = buildPrompt(profileText);
    const result = await callOpenAI(apiKey, prompt);

    const jsonMatch = result.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return res.status(500).json({ error: 'Could not parse analysis results. Please try again.' });
    }

    const analysis = JSON.parse(jsonMatch[0]);
    return res.status(200).json(analysis);
  } catch (error) {
    console.error('Analysis error:', error);

    if (error.message?.includes('401')) {
      return res.status(500).json({ error: 'API authentication failed. Please contact support.' });
    }
    if (error.message?.includes('429')) {
      return res.status(429).json({ error: 'Service is busy. Please try again in a moment.' });
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
2. Build a skillsTable: identify 6–12 AI-relevant skills evidenced in the profile. Score EACH skill using the Skills Framework methodology above.
3. Compute the 4 capability area scores as the rounded average of skills mapped to that capability (or best evidence if fewer skills).
4. For each capability area, write a one-sentence summary and 2–3 tailored recommendations.

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

function callOpenAI(apiKey, prompt) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      model: 'gpt-4o',
      max_tokens: 4000,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: 'You are a workforce skills analyst. Score profiles using the provided Skills Framework. Always respond with valid JSON only.' },
        { role: 'user', content: prompt },
      ],
    });

    const options = {
      hostname: 'api.openai.com',
      port: 443,
      path: '/v1/chat/completions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'Content-Length': Buffer.byteLength(data),
      },
    };

    const req = https.request(options, (response) => {
      let body = '';
      response.on('data', (chunk) => { body += chunk; });
      response.on('end', () => {
        if (response.statusCode !== 200) {
          reject(new Error(`API error ${response.statusCode}: ${body}`));
          return;
        }
        try {
          const parsed = JSON.parse(body);
          resolve(parsed.choices[0].message.content);
        } catch (e) {
          reject(new Error('Failed to parse API response'));
        }
      });
    });

    req.on('error', reject);
    req.write(data);
    req.end();
  });
}
