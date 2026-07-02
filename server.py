#!/usr/bin/env python3
"""
Local development server for AI Readiness profile analysis.
Run with: python3 server.py
Requires OPENROUTER_API_KEY in environment or .env file.
"""

import http.server
import json
import os
import re
import urllib.request
import urllib.error
from pathlib import Path

PORT = 8080
OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions'
DEFAULT_MODEL = 'openai/gpt-4o'
MAX_TOKENS = 12000
SYSTEM_PROMPT = (
    'You are a workforce skills analyst. Score profiles using the provided Skills Framework. '
    'Always respond with valid JSON only. No markdown fences. '
    'Keep string values concise. Do not use double quotes inside string values.'
)

API_KEY = os.environ.get('OPENROUTER_API_KEY', '')
MODEL = os.environ.get('OPENROUTER_MODEL', DEFAULT_MODEL)
SITE_URL = os.environ.get('OPENROUTER_SITE_URL', 'http://localhost:8080')
APP_TITLE = os.environ.get('OPENROUTER_APP_TITLE', 'AI Readiness Assessment')


def load_env_file():
    global API_KEY, MODEL, SITE_URL, APP_TITLE
    env_path = Path(__file__).parent / '.env'
    if not env_path.exists():
        return
    for line in env_path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith('#') or line.startswith('/*') or line.startswith('*/'):
            continue
        if '=' not in line:
            continue
        key, _, val = line.partition('=')
        key = key.strip()
        val = val.strip().strip('"').strip("'")
        if key == 'OPENROUTER_API_KEY' and val:
            API_KEY = val
        elif key == 'OPENROUTER_MODEL' and val:
            MODEL = val
        elif key == 'OPENROUTER_SITE_URL' and val:
            SITE_URL = val
        elif key == 'OPENROUTER_APP_TITLE' and val:
            APP_TITLE = val


load_env_file()


def repair_json_text(text):
    text = str(text).strip()
    if text.startswith('```'):
        text = re.sub(r'^```(?:json)?\s*', '', text, flags=re.IGNORECASE)
        text = re.sub(r'\s*```$', '', text).strip()
    text = text.replace('\u201c', '"').replace('\u201d', '"')
    text = text.replace('\u2018', "'").replace('\u2019', "'")
    text = re.sub(r',(\s*[}\]])', r'\1', text)
    return text


def parse_analysis_content(content, finish_reason=None):
    if not content or not str(content).strip():
        if finish_reason == 'length':
            raise Exception('Analysis response was cut off. Try a shorter document or switch to a faster model.')
        raise Exception('No analysis content returned from the model.')

    text = repair_json_text(content)
    candidates = [text]
    start = text.find('{')
    end = text.rfind('}')
    if start != -1 and end > start:
        candidates.append(text[start:end + 1])

    last_error = None
    for candidate in candidates:
        try:
            return json.loads(candidate)
        except json.JSONDecodeError as exc:
            last_error = exc

    raise Exception('Could not parse analysis results') from last_error


def load_framework_prompt():
    path = Path(__file__).parent / 'source' / 'skills-framework-prompt.txt'
    return path.read_text()


def build_prompt(profile_text):
    framework = load_framework_prompt()
    return f'''You are an expert workforce analyst. Analyze the professional profile below using Pearson's Skills Framework and four AI Readiness capability areas.

{framework}

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
{profile_text}

Respond with valid JSON in this exact format:
{{
  "profileSummary": {{
    "name": "Person's name or 'Professional'",
    "currentRole": "Their current job title",
    "industry": "Their industry",
    "experience": "Brief experience summary"
  }},
  "skillsTable": [
    {{
      "skill": "Skill name",
      "capability": "Functional Proficiency",
      "score": 72,
      "proficiencyLevel": "Competent",
      "signalType": "Current role",
      "evidence": "Brief evidence from profile"
    }}
  ],
  "functionalProficiency": {{
    "score": 65,
    "summary": "One sentence overview",
    "recommendations": ["Recommendation 1", "Recommendation 2", "Recommendation 3"]
  }},
  "strategicIntelligence": {{
    "score": 55,
    "summary": "One sentence overview",
    "recommendations": ["Recommendation 1", "Recommendation 2", "Recommendation 3"]
  }},
  "ethicalStewardship": {{
    "score": 45,
    "summary": "One sentence overview",
    "recommendations": ["Recommendation 1", "Recommendation 2", "Recommendation 3"]
  }},
  "criticalHumanSkills": {{
    "score": 70,
    "summary": "One sentence overview",
    "recommendations": ["Recommendation 1", "Recommendation 2", "Recommendation 3"]
  }}
}}'''


class RequestHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(Path(__file__).parent), **kwargs)

    def do_POST(self):
        if self.path == '/api/analyze':
            self.handle_analyze()
        else:
            self.send_error(404, 'Not Found')

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

    def handle_analyze(self):
        if not API_KEY:
            self.send_json_error(500, 'OPENROUTER_API_KEY not set. Create a .env file with your API key.')
            return

        try:
            content_length = int(self.headers['Content-Length'])
            body = self.rfile.read(content_length)
            data = json.loads(body)
            profile_text = data.get('profileText', '')

            if len(profile_text.strip()) < 80:
                self.send_json_error(400, 'Could not read enough text from the document. Please upload a valid profile PDF, resume, or career document.')
                return

            analysis = self.call_openrouter_api(profile_text)
            self.send_json_response(analysis)

        except urllib.error.HTTPError as e:
            error_body = e.read().decode()
            print(f"OpenRouter API error: {e.code} - {error_body}")
            if e.code == 401:
                self.send_json_error(500, 'API authentication failed. Check your OPENROUTER_API_KEY.')
            elif e.code == 429:
                self.send_json_error(429, 'Rate limit exceeded. Please wait a moment.')
            else:
                self.send_json_error(500, 'Analysis service error. Please try again.')
        except Exception as e:
            print(f"Error: {e}")
            message = str(e)
            if isinstance(e, json.JSONDecodeError) or 'parse' in message.lower() or 'delimiter' in message.lower():
                message = 'Could not parse analysis results. Please try again.'
            elif not message.startswith('Analysis response') and not message.startswith('No analysis'):
                message = f'Server error: {message}'
            self.send_json_error(500, message)

    def openrouter_chat(self, messages):
        request_data = json.dumps({
            'model': MODEL,
            'max_tokens': MAX_TOKENS,
            'temperature': 0,
            'response_format': {'type': 'json_object'},
            'messages': messages,
        }).encode()

        req = urllib.request.Request(
            OPENROUTER_API_URL,
            data=request_data,
            headers={
                'Content-Type': 'application/json',
                'Authorization': f'Bearer {API_KEY}',
                'HTTP-Referer': SITE_URL,
                'X-Title': APP_TITLE,
            },
        )

        with urllib.request.urlopen(req) as response:
            result = json.loads(response.read().decode())
            choice = result.get('choices', [{}])[0]
            content = choice.get('message', {}).get('content')
            finish_reason = choice.get('finish_reason')
            return content, finish_reason

    def call_openrouter_api(self, profile_text):
        prompt = build_prompt(profile_text)
        messages = [
            {'role': 'system', 'content': SYSTEM_PROMPT},
            {'role': 'user', 'content': prompt},
        ]

        content, finish_reason = self.openrouter_chat(messages)
        try:
            return parse_analysis_content(content, finish_reason)
        except Exception:
            if not content:
                raise

            print('Initial JSON parse failed; retrying with repair prompt')
            fix_messages = messages + [
                {'role': 'assistant', 'content': content},
                {
                    'role': 'user',
                    'content': (
                        'Your previous response was invalid JSON. Return ONLY a corrected JSON object '
                        'matching the required schema. No markdown, no commentary.'
                    ),
                },
            ]
            fixed_content, _ = self.openrouter_chat(fix_messages)
            return parse_analysis_content(fixed_content, None)

    def send_json_response(self, data):
        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        self.wfile.write(json.dumps(data).encode())

    def send_json_error(self, code, message):
        self.send_response(code)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        self.wfile.write(json.dumps({'error': message}).encode())

    def log_message(self, format, *args):
        print(f"[{self.log_date_time_string()}] {args[0]}")


def main():
    if not API_KEY:
        print("\n⚠️  WARNING: OPENROUTER_API_KEY not found!")
        print("   Create a .env file in this directory with:")
        print("   OPENROUTER_API_KEY=sk-or-v1-your-key-here")
        print("   OPENROUTER_MODEL=openai/gpt-4o\n")
    else:
        print(f"✓ OpenRouter API key loaded (ends with ...{API_KEY[-4:]})")
        print(f"✓ Model: {MODEL}")

    print(f"\n🚀 Server running — open in your browser:\n")
    print(f"   http://localhost:{PORT}\n")
    print("   Press Ctrl+C to stop\n", flush=True)

    server = http.server.HTTPServer(('127.0.0.1', PORT), RequestHandler)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n\nServer stopped.")
        server.shutdown()


if __name__ == '__main__':
    main()
