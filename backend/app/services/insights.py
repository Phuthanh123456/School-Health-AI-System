"""LLM selects bounded school-level observations; untrusted prose is never displayed."""

import asyncio
import json

import httpx
from fastapi import HTTPException
from pydantic import ValidationError

from app.config import settings
from app.schemas.insights import Aggregates, InsightResponse, InsightSelection

DISCLAIMER = "Thông tin do AI hỗ trợ chỉ mang tính tham khảo, không phải chẩn đoán hoặc chỉ định điều trị. Nhân viên y tế cần kiểm tra trước khi sử dụng."
RECOMMENDATIONS = {
    "checkup_planning": "Rà soát lịch và nguồn lực cho các đợt khám sức khỏe toàn trường.",
    "followup_capacity": "Rà soát năng lực xử lý các trường hợp đang chờ theo dõi với bộ phận y tế học đường.",
    "data_review": "Kiểm tra độ đầy đủ và chất lượng thống kê trước khi lập kế hoạch cấp trường.",
}
LABELS = {
    "checkups_completed": "đã hoàn thành khám",
    "followups_pending": "đang chờ theo dõi",
}
PROMPT = """You summarize one current school-wide statistical snapshot, not individuals.
There is no historical baseline: do not infer changes over time, diagnoses, causes,
treatment, medication, individual risk, or identify anyone. Counts may overlap.
Return ONLY a JSON object with keys highlights and recommendations.
highlights: 1-2 distinct metric names selected from checkups_completed,
followups_pending; select notable nonzero counts when possible.
recommendations: 1-3 distinct codes selected from checkup_planning,
followup_capacity, data_review.
Choose followup_capacity only when followups_pending is present and at least 5.
Choose highlights only from metric keys present in the input.
Choose checkup_planning only when checkups are incomplete.
Only these codes, no prose or extra fields. The server renders safe Vietnamese text
and exact supplied counts. All input is school aggregates; small nonzero cells
have already been withheld. Do not reconstruct withheld counts."""


async def generate_insights(stats: Aggregates) -> InsightResponse:
    if stats.total_students < 20 or stats.checkups_completed < 20:
        raise HTTPException(422, "Cần ít nhất 20 học sinh và 20 lượt khám để tạo nhận xét tổng hợp.")
    if not settings.llm_base_url or not settings.llm_model or not settings.llm_api_key:
        raise HTTPException(503, "Dịch vụ AI chưa được cấu hình. Vui lòng liên hệ quản trị viên.")
    # These categories overlap, so no complementary category is sent.
    safe_stats = {key: value for key, value in stats.model_dump().items() if value == 0 or value >= 5}
    conditions = {"followup_capacity": stats.followups_pending >= 5,
                  "checkup_planning": stats.checkups_completed < stats.total_students,
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
        raise HTTPException(504, "AI phản hồi quá lâu. Vui lòng thử lại.") from None
    except (httpx.HTTPError, ValidationError, ValueError, KeyError, IndexError, TypeError):
        raise HTTPException(502, "Chưa thể tạo nhận xét AI hợp lệ. Vui lòng thử lại sau.") from None
    sentences = [f"Tổng quan hiện tại: {stats.total_students} học sinh."]
    sentences += [f"{getattr(stats, key)}/{stats.total_students} học sinh {LABELS[key]}." for key in selection.highlights]
    sentences.append("Các nhóm có thể trùng nhau; chưa có dữ liệu so sánh theo thời gian.")
    return InsightResponse(summary=" ".join(sentences), recommendations=[RECOMMENDATIONS[code] for code in selection.recommendations], disclaimer=DISCLAIMER, aggregates=stats)
