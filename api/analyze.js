import https from 'https';

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
  return `You are an expert in workforce AI readiness assessment. Analyze the following professional profile document (LinkedIn export, resume, CV, or similar) and evaluate the person against Pearson's four AI Readiness capability areas.

The four capability areas are:

1. **Functional Proficiency** — Using AI tools effectively in day-to-day work (prompting, tool fluency, verifying outputs, integrating AI into workflows).

2. **Strategic Intelligence** — Spotting where AI adds value, exercising judgment on AI recommendations, understanding AI's impact on their industry and role.

3. **Ethical Stewardship** — Responsible, privacy-aware, and fair use of AI; bias awareness; transparency and data handling.

4. **Critical Human Skills** — Adaptability, collaboration, creative problem-solving, and human-centered thinking that AI cannot replace.

Based on this profile document:
1. Provide a brief profile summary (name if available, current role, industry, experience estimate).
2. For EACH of the 4 capability areas, assign a readiness score from 0–100 (based on evidence in the profile — skills, roles, projects, certifications, language used), write a one-sentence summary, and provide 2–3 specific, actionable recommendations tailored to this person's background.

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
      max_tokens: 2500,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: 'You are a workforce AI readiness analyst. Always respond with valid JSON only.' },
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
