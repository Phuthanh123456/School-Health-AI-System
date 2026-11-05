"""LLM selects bounded school-level observations; untrusted prose is never displayed."""

import asyncio
import json

import httpx
from fastapi import HTTPException
from pydantic import ValidationError

from app.config import settings
from app.schemas.insights import Aggregates, InsightResponse, InsightSelection

DISCLAIMER = "AI-generated content is for general information only. It is not a diagnosis or treatment recommendation. A qualified health professional should review any follow-up decisions."
RECOMMENDATIONS = {
    "checkup_planning": "Review school-wide checkup planning and available resources.",
    "followup_capacity": "Review records marked for follow-up with school health staff before planning school-wide support.",
    "data_review": "Review the completeness and quality of the aggregate data before planning school-wide support.",
}
LABELS = {
    "checkups_completed": "completed checkups",
    "followups_pending": "follow-up records",
}
PROMPT = """You summarize one current school-wide statistical snapshot, not individuals.
Counts of checkups and follow-ups are RECORDS across all sessions, not unique students.
Records can exceed enrolled students. Never calculate student coverage from record counts.
There is no historical baseline: do not infer changes over time, diagnoses, causes,
treatment, medication, individual risk, or identify anyone. Counts may overlap.
Return ONLY a JSON object with keys highlights and recommendations.
highlights: 1-2 distinct metric names selected from checkups_completed,
followups_pending; select notable nonzero counts when possible.
recommendations: 1-3 distinct codes selected from checkup_planning,
followup_capacity, data_review.
Choose followup_capacity only when followups_pending is present and at least 5.
Choose highlights only from metric keys present in the input.
Checkup planning is general school-level resource review, not a coverage assertion.
Only these codes, no prose or extra fields. The server renders safe Vietnamese text
and exact supplied counts. All input is school aggregates; small nonzero cells
have already been withheld. Do not reconstruct withheld counts."""


async def generate_insights(stats: Aggregates) -> InsightResponse:
    if stats.total_students < 20 or stats.checkups_completed < 20:
        raise HTTPException(422, "At least 20 students and 20 saved checkup records are required to generate aggregate insights.")
    if not settings.llm_base_url or not settings.llm_model or not settings.llm_api_key:
        raise HTTPException(503, "The AI service is not configured. Please contact an administrator.")
    # These categories overlap, so no complementary category is sent.
    safe_stats = {key: value for key, value in stats.model_dump().items() if value == 0 or value >= 5}
    conditions = {"followup_capacity": stats.followups_pending >= 5,
                  "checkup_planning": True,
                  "data_review": True}
    allowed_metrics = [key for key in LABELS if key in safe_stats]
    allowed_actions = [key for key, allowed in conditions.items() if allowed]
    constraints = (
        "\nFor THIS request, highlights may ONLY use " + json.dumps(allowed_metrics)
        + "; recommendations may ONLY use " + json.dumps(allowed_actions)
        + '. Return the JSON object directly, no markdown fences. Example: '
        + '{"highlights":["checkups_completed"],"recommendations":["data_review"]}'
    )
    payload = {
        "model": settings.llm_model,
        "messages": [{"role": "system", "content": PROMPT + constraints}, {"role": "user", "content": json.dumps(safe_stats)}],
        # Ollama Cloud does not enforce JSON schemas; validate locally instead.
        "max_tokens": 4096,
        "reasoning_effort": "low",
        "temperature": 0,
    }
    try:
        async with asyncio.timeout(20):
            async with httpx.AsyncClient(timeout=18, follow_redirects=False) as client:
                response = await client.post(
                    settings.llm_base_url.rstrip("/") + "/chat/completions",
                    headers={"Authorization": f"Bearer {settings.llm_api_key}"}, json=payload,
                )
                response.raise_for_status()
                if len(response.content) > 32_768:
                    raise ValueError("Oversize output")
                selection = InsightSelection.model_validate_json(response.json()["choices"][0]["message"]["content"])
                if any(key not in safe_stats for key in selection.highlights):
                    raise ValueError("Suppressed metric selected")
                if any(not conditions[code] for code in selection.recommendations):
                    raise ValueError("Unsupported recommendation")
    except (TimeoutError, httpx.TimeoutException):
        raise HTTPException(504, "The AI service took too long to respond. Please try again.") from None
    except (httpx.HTTPError, ValidationError, ValueError, KeyError, IndexError, TypeError):
        raise HTTPException(502, "The AI service returned an invalid response. Please try again later.") from None
    sentences = [f"Current overview: {stats.total_students} students."]
    record_labels = {"checkups_completed": "saved checkup records", "followups_pending": "records marked for follow-up"}
    sentences += [f"{getattr(stats, key)} {record_labels[key]}." for key in selection.highlights]
    sentences.append("Checkups are counted as student-session records, not unique students.")
    sentences.append("Categories may overlap, and no historical comparison data is available.")
    return InsightResponse(summary=" ".join(sentences), recommendations=[RECOMMENDATIONS[code] for code in selection.recommendations], disclaimer=DISCLAIMER, aggregates=stats)
