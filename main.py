"""AI Readiness Assessment — FastAPI service for Cookie deployment."""

import json
import os
import re
import urllib.error
import urllib.request
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

ROOT = Path(__file__).parent
OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions"
DEFAULT_MODEL = "openai/gpt-4o"
MAX_TOKENS = 12000
SYSTEM_PROMPT = (
    "You are a workforce skills analyst. Score profiles using the provided Skills Framework. "
    "Always respond with valid JSON only. No markdown fences. "
    "Keep string values concise. Do not use double quotes inside string values."
)

API_KEY = os.environ.get("OPENROUTER_API_KEY", "")
MODEL = os.environ.get("OPENROUTER_MODEL", DEFAULT_MODEL)
SITE_URL = os.environ.get("OPENROUTER_SITE_URL", "http://localhost:8080")
APP_TITLE = os.environ.get("OPENROUTER_APP_TITLE", "AI Readiness Assessment")

app = FastAPI(title="AI Readiness Assessment")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["POST", "OPTIONS"],
    allow_headers=["Content-Type"],
)


class AnalyzeRequest(BaseModel):
    profileText: str = ""


def repair_json_text(text):
    text = str(text).strip()
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\s*", "", text, flags=re.IGNORECASE)
        text = re.sub(r"\s*```$", "", text).strip()
    text = text.replace("\u201c", '"').replace("\u201d", '"')
    text = text.replace("\u2018", "'").replace("\u2019", "'")
    text = re.sub(r",(\s*[}\]])", r"\1", text)
    return text


def parse_analysis_content(content, finish_reason=None):
    if not content or not str(content).strip():
        if finish_reason == "length":
            raise HTTPException(
                status_code=500,
                detail="Analysis response was cut off. Try a shorter document or switch to a faster model.",
            )
        raise HTTPException(status_code=500, detail="No analysis content returned from the model.")

    text = repair_json_text(content)
    candidates = [text]
    start = text.find("{")
    end = text.rfind("}")
    if start != -1 and end > start:
        candidates.append(text[start : end + 1])

    last_error = None
    for candidate in candidates:
        try:
            return json.loads(candidate)
        except json.JSONDecodeError as exc:
            last_error = exc

    raise HTTPException(status_code=500, detail="Could not parse analysis results") from last_error


def load_framework_prompt():
    return (ROOT / "source" / "skills-framework-prompt.txt").read_text()


def build_prompt(profile_text):
    framework = load_framework_prompt()
    return f"""You are an expert workforce analyst. Analyze the professional profile below using Pearson's Skills Framework and four AI Readiness capability areas.

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
}}"""


def openrouter_chat(messages):
    request_data = json.dumps(
        {
            "model": MODEL,
            "max_tokens": MAX_TOKENS,
            "temperature": 0,
            "response_format": {"type": "json_object"},
            "messages": messages,
        }
    ).encode()

    req = urllib.request.Request(
        OPENROUTER_API_URL,
        data=request_data,
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {API_KEY}",
            "HTTP-Referer": SITE_URL,
            "X-Title": APP_TITLE,
        },
    )

    try:
        with urllib.request.urlopen(req) as response:
            result = json.loads(response.read().decode())
    except urllib.error.HTTPError as exc:
        error_body = exc.read().decode()
        if exc.code == 401:
            raise HTTPException(status_code=500, detail="API authentication failed. Check OPENROUTER_API_KEY.") from exc
        if exc.code == 429:
            raise HTTPException(status_code=429, detail="Rate limit exceeded. Please wait a moment.") from exc
        raise HTTPException(status_code=500, detail="Analysis service error. Please try again.") from exc

    choice = result.get("choices", [{}])[0]
    return choice.get("message", {}).get("content"), choice.get("finish_reason")


def call_openrouter_api(profile_text):
    prompt = build_prompt(profile_text)
    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": prompt},
    ]

    content, finish_reason = openrouter_chat(messages)
    try:
        return parse_analysis_content(content, finish_reason)
    except HTTPException:
        raise
    except Exception:
        if not content:
            raise

        fix_messages = messages + [
            {"role": "assistant", "content": content},
            {
                "role": "user",
                "content": (
                    "Your previous response was invalid JSON. Return ONLY a corrected JSON object "
                    "matching the required schema. No markdown, no commentary."
                ),
            },
        ]
        fixed_content, _ = openrouter_chat(fix_messages)
        return parse_analysis_content(fixed_content, None)


@app.post("/api/analyze")
async def analyze(body: AnalyzeRequest):
    if not API_KEY:
        raise HTTPException(status_code=500, detail="OPENROUTER_API_KEY not configured.")

    profile_text = body.profileText or ""
    if len(profile_text.strip()) < 80:
        raise HTTPException(
            status_code=400,
            detail="Could not read enough text from the document. Please upload a valid profile PDF, resume, or career document.",
        )

    try:
        return call_openrouter_api(profile_text)
    except HTTPException:
        raise
    except Exception as exc:
        message = str(exc)
        if "parse" in message.lower() or "delimiter" in message.lower():
            raise HTTPException(status_code=500, detail="Could not parse analysis results. Please try again.") from exc
        raise HTTPException(status_code=500, detail=f"Server error: {message}") from exc


@app.get("/")
async def index():
    return FileResponse(ROOT / "index.html")


app.mount("/", StaticFiles(directory=ROOT, html=True), name="static")
