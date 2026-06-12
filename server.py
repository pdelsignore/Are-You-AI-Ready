#!/usr/bin/env python3
"""
Local development server for AI Readiness profile analysis.
Run with: python3 server.py
Requires OPENAI_API_KEY in environment or .env file.
"""

import http.server
import json
import os
import re
import urllib.request
import urllib.error
from pathlib import Path

PORT = 8080
API_KEY = os.environ.get('OPENAI_API_KEY', '')

env_path = Path(__file__).parent / '.env'
if env_path.exists():
    with open(env_path) as f:
        for line in f:
            line = line.strip()
            if line.startswith('OPENAI_API_KEY=') and not API_KEY:
                API_KEY = line.split('=', 1)[1].strip().strip('"').strip("'")


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
2. Build a skillsTable: identify 6–12 AI-relevant skills evidenced in the profile. Score EACH skill using the Skills Framework methodology above.
3. Compute the 4 capability area scores as the rounded average of skills mapped to that capability (or best evidence if fewer skills).
4. For each capability area, write a one-sentence summary and 2–3 tailored recommendations.

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
            self.send_json_error(500, 'OPENAI_API_KEY not set. Create a .env file with your API key.')
            return

        try:
            content_length = int(self.headers['Content-Length'])
            body = self.rfile.read(content_length)
            data = json.loads(body)
            profile_text = data.get('profileText', '')

            if len(profile_text.strip()) < 80:
                self.send_json_error(400, 'Could not read enough text from the document. Please upload a valid profile PDF, resume, or career document.')
                return

            analysis = self.call_openai_api(profile_text)
            self.send_json_response(analysis)

        except urllib.error.HTTPError as e:
            error_body = e.read().decode()
            print(f"OpenAI API error: {e.code} - {error_body}")
            if e.code == 401:
                self.send_json_error(500, 'API authentication failed. Check your OPENAI_API_KEY.')
            elif e.code == 429:
                self.send_json_error(429, 'Rate limit exceeded. Please wait a moment.')
            else:
                self.send_json_error(500, 'Analysis service error. Please try again.')
        except Exception as e:
            print(f"Error: {e}")
            self.send_json_error(500, f'Server error: {str(e)}')

    def call_openai_api(self, profile_text):
        prompt = build_prompt(profile_text)
        request_data = json.dumps({
            'model': 'gpt-4o',
            'max_tokens': 4000,
            'response_format': {'type': 'json_object'},
            'messages': [
                {'role': 'system', 'content': 'You are a workforce skills analyst. Score profiles using the provided Skills Framework. Always respond with valid JSON only.'},
                {'role': 'user', 'content': prompt},
            ],
        }).encode()

        req = urllib.request.Request(
            'https://api.openai.com/v1/chat/completions',
            data=request_data,
            headers={
                'Content-Type': 'application/json',
                'Authorization': f'Bearer {API_KEY}',
            },
        )

        with urllib.request.urlopen(req) as response:
            result = json.loads(response.read().decode())
            content = result['choices'][0]['message']['content']
            json_match = re.search(r'\{[\s\S]*\}', content)
            if json_match:
                return json.loads(json_match.group())
            raise Exception('Could not parse analysis results')

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
        print("\n⚠️  WARNING: OPENAI_API_KEY not found!")
        print("   Create a .env file in this directory with:")
        print("   OPENAI_API_KEY=sk-your-key-here\n")
    else:
        print(f"✓ API key loaded (ends with ...{API_KEY[-4:]})")

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
