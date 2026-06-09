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


def build_prompt(profile_text):
    return f'''You are an expert in workforce AI readiness assessment. Analyze the following professional profile document (LinkedIn export, resume, CV, or similar) and evaluate the person against Pearson's four AI Readiness capability areas.

The four capability areas are:

1. **Functional Proficiency** — Using AI tools effectively in day-to-day work (prompting, tool fluency, verifying outputs, integrating AI into workflows).

2. **Strategic Intelligence** — Spotting where AI adds value, exercising judgment on AI recommendations, understanding AI's impact on their industry and role.

3. **Ethical Stewardship** — Responsible, privacy-aware, and fair use of AI; bias awareness; transparency and data handling.

4. **Critical Human Skills** — Adaptability, collaboration, creative problem-solving, and human-centered thinking that AI cannot replace.

Based on this profile document:
1. Provide a brief profile summary (name if available, current role, industry, experience estimate).
2. For EACH of the 4 capability areas, assign a readiness score from 0–100 (based on evidence in the profile — skills, roles, projects, certifications, language used), write a one-sentence summary, and provide 2–3 specific, actionable recommendations tailored to this person's background.

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
            'max_tokens': 2500,
            'response_format': {'type': 'json_object'},
            'messages': [
                {'role': 'system', 'content': 'You are a workforce AI readiness analyst. Always respond with valid JSON only.'},
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
