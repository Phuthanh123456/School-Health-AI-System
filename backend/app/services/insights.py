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
    "vision_education": "Cân nhắc truyền thông toàn trường về thói quen chăm sóc mắt với nội dung được nhân viên y tế duyệt.",
    "dental_education": "Cân nhắc truyền thông toàn trường về vệ sinh răng miệng với nội dung được nhân viên y tế duyệt.",
    "data_review": "Kiểm tra độ đầy đủ và chất lượng thống kê trước khi lập kế hoạch cấp trường.",
}
LABELS = {
    "checkups_completed": "đã hoàn thành khám",
    "followups_pending": "đang chờ theo dõi",
    "vision_flags": "được ghi nhận cờ thị lực",
    "dental_flags": "được ghi nhận cờ răng miệng",
}
PROMPT = """You summarize one current school-wide statistical snapshot, not individuals.
There is no historical baseline: do not infer changes over time, diagnoses, causes,
treatment, medication, individual risk, or identify anyone. Counts may overlap.
Return ONLY a JSON object with keys highlights and recommendations.
highlights: 1-3 distinct metric names selected from checkups_completed,
followups_pending, vision_flags, dental_flags; select notable nonzero counts when possible.
recommendations: 1-3 distinct codes selected from checkup_planning,
followup_capacity, vision_education, dental_education, data_review.
Choose followup_capacity/vision_education/dental_education only when the corresponding
count is nonzero. Choose checkup_planning only when checkups are incomplete.
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
    payload = {
        "model": settings.llm_model,
        "messages": [{"role": "system", "content": PROMPT}, {"role": "user", "content": json.dumps(safe_stats)}],
        # Ollama Cloud does not enforce JSON schemas; validate locally instead.
        "max_tokens": 4096,
        "reasoning_effort": "low",
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
                conditions = {"followup_capacity": stats.followups_pending >= 5,
                              "vision_education": stats.vision_flags >= 5,
                              "dental_education": stats.dental_flags >= 5,
                              "checkup_planning": stats.checkups_completed < stats.total_students}
                if any(not conditions.get(code, True) for code in selection.recommendations):
                    raise ValueError("Unsupported recommendation")
    except (TimeoutError, httpx.TimeoutException):
        raise HTTPException(504, "AI phản hồi quá lâu. Vui lòng thử lại.") from None
    except (httpx.HTTPError, ValidationError, ValueError, KeyError, IndexError, TypeError):
        raise HTTPException(502, "Chưa thể tạo nhận xét AI hợp lệ. Vui lòng thử lại sau.") from None
    sentences = [f"Tổng quan hiện tại: {stats.total_students} học sinh."]
    sentences += [f"{getattr(stats, key)}/{stats.total_students} học sinh {LABELS[key]}." for key in selection.highlights]
    sentences.append("Các nhóm có thể trùng nhau; chưa có dữ liệu so sánh theo thời gian.")
    return InsightResponse(summary=" ".join(sentences), recommendations=[RECOMMENDATIONS[code] for code in selection.recommendations], disclaimer=DISCLAIMER, aggregates=stats)
