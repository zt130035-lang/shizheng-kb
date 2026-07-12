import io
import json
import os
from unittest.mock import patch

import server


def _ai_report():
    return json.dumps({
        "overview": {
            "total_score": 62,
            "total_score_max": 100,
            "overall": "要点覆盖一般，表达基本清楚。",
            "scoring_note": "未提供官方评分细则，本分数为估算分。",
            "priority_fixes": ["补足材料要点", "加强对策的主体和路径"],
        },
        "questions": [{
            "id": "1",
            "type": "概括归纳",
            "task": "概括问题",
            "score": 6,
            "max_score": 10,
            "score_reason": "命中两个要点，遗漏一个要点。",
            "key_points": [{
                "point": "基层服务供给不足",
                "status": "部分命中",
                "evidence": "材料第2段",
                "comment": "答案提到服务不足，但未写明具体表现。",
            }],
            "answer_evaluation": "方向正确，但概括不够具体。",
            "problems": ["遗漏具体表现"],
            "modification": "补充问题主体和表现。",
            "suggested_answer": "基层服务供给不足，具体表现为……",
        }],
    }, ensure_ascii=False)


def test_full_review_from_text_returns_structured_result():
    client = server.app.test_client()
    with patch.object(server, "_search_kb_for_essay", return_value="申论规则") as search, \
         patch.object(server, "call_deepseek", return_value=_ai_report()) as call:
        response = client.post("/api/essay/full-review", json={
            "topic": "某省公务员考试",
            "paper_text": "材料一……\n第1题：概括问题。",
            "answers": "第1题：基层服务不足。",
            "reference_text": "第1题参考答案：基层服务供给不足（10分）。",
        })

    assert response.status_code == 200
    body = response.get_json()
    assert body["report"]["questions"][0]["key_points"][0]["status"] == "部分命中"
    assert "材料要点核对" in body["answer"]
    search.assert_called_once()
    prompt = call.call_args.args[0]
    assert "材料一" in prompt
    assert "基层服务不足" in prompt
    assert "申论规则" in prompt
    assert "官方参考答案与分值" in prompt
    assert body["has_reference"] is True


def test_full_review_accepts_uploaded_document():
    client = server.app.test_client()
    with patch.object(server, "extract_document_text", return_value="材料文本\n第1题：概括问题。"), \
         patch.object(server, "_search_kb_for_essay", return_value=""), \
         patch.object(server, "call_deepseek", return_value=_ai_report()), \
         patch("werkzeug.datastructures.FileStorage.save"):
        response = client.post(
            "/api/essay/full-review",
            data={
                "answers": "第1题：基层服务不足。",
                "topic": "整套试卷",
                "file": (io.BytesIO(b"paper"), "paper.txt"),
            },
            content_type="multipart/form-data",
        )

    assert response.status_code == 200
    assert response.get_json()["source"] == "file"


def test_full_review_requires_paper_and_answers():
    client = server.app.test_client()
    response = client.post("/api/essay/full-review", json={})
    assert response.status_code == 400
    assert "材料与题目" in response.get_json()["error"]


def test_full_review_without_answers_generates_reference_mode():
    client = server.app.test_client()
    with patch.object(server, "_search_kb_for_essay", return_value="申论规则") as search, \
         patch.object(server, "call_deepseek", return_value=_ai_report()) as call:
        response = client.post("/api/essay/full-review", json={
            "paper_text": "材料一……\n第1题：概括问题。",
        })

    assert response.status_code == 200
    body = response.get_json()
    assert body["mode"] == "reference"
    assert body["has_answers"] is False
    assert "未提供考生作答" in call.call_args.args[0]
    assert search.called


def test_answer_ocr_endpoint_returns_text():
    client = server.app.test_client()
    with patch.object(server, "_call_vision_essay_ocr", return_value={
        "text": "第1题：基层服务不足。",
        "page": 2,
        "model": "test-model",
    }), patch("werkzeug.datastructures.FileStorage.save"):
        response = client.post(
            "/api/essay/ocr-image",
            data={"page": "2", "file": (io.BytesIO(b"image"), "answer.png")},
            content_type="multipart/form-data",
        )

    assert response.status_code == 200
    assert response.get_json()["text"] == "第1题：基层服务不足。"
    assert response.get_json()["page"] == 2


def test_local_paper_upload_token_can_feed_full_review():
    client = server.app.test_client()
    with patch.object(server, "extract_document_text", return_value="本地材料文本\n第1题：概括问题。"), \
         patch("werkzeug.datastructures.FileStorage.save"):
        upload = client.post(
            "/api/essay/paper-upload",
            data={"file": (io.BytesIO(b"paper"), "local.pdf")},
            content_type="multipart/form-data",
        )

    assert upload.status_code == 200
    paper_id = upload.get_json()["paper_id"]
    try:
        with patch.object(server, "_search_kb_for_essay", return_value=""), \
             patch.object(server, "call_deepseek", return_value=_ai_report()):
            response = client.post("/api/essay/full-review", json={
                "paper_id": paper_id,
                "answers": "第1题：基层服务不足。",
            })
        assert response.status_code == 200
        assert response.get_json()["source"] == "local_file"
    finally:
        temp_path = server._essay_temp_paper_path(paper_id)
        if temp_path and os.path.exists(temp_path):
            os.remove(temp_path)
