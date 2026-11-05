# -*- coding: utf-8 -*-
"""真题库接口测试:三层数据合并、路径安全、AI 答案生成/仿写/整卷导入。

AI 一律 patch 掉,不联网。运行: python -m pytest tests/test_exam_bank.py -q
"""

import io
import json
import os
import shutil
import tempfile
import unittest
from unittest.mock import patch

import server


def _write_json(path, payload):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as fh:
        json.dump(payload, fh, ensure_ascii=False)


def _paper_payload(paper_id="2025-xingzheng", year=2025, **overrides):
    """构造一份含两道题的种子试卷。"""
    payload = {
        "id": paper_id,
        "year": year,
        "paper": "行政执法",
        "title": f"{year}年国家公务员考试申论（行政执法类）",
        "exam_date": "2024-11-30",
        "materials": "【给定资料1】基层治理……",
        "source": "网络公开回忆版整理",
        "source_url": "https://example.com/paper",
        "verified": True,
        "questions": [
            {
                "id": "1",
                "no": 1,
                "type": "归纳概括",
                "task": "根据给定资料1，概括……",
                "max_score": 15,
                "material_ref": "给定资料1",
                "reference_answer": "",
                "answer_kind": "",
                "answer_source": "",
                "score_points": [],
                "structure": [],
                "imitate_tips": "",
            },
            {
                "id": "2",
                "no": 2,
                "type": "提出对策",
                "task": "根据给定资料2，提出……",
                "max_score": 25,
                "material_ref": "给定资料2",
            },
        ],
    }
    payload.update(overrides)
    return payload


def _ai_answer_json():
    return json.dumps({
        "reference_answer": "一是完善制度；二是加强监管。",
        "score_points": ["完善制度", "加强监管"],
        "structure": ["开头：点明问题", "分论点1：制度", "结尾：总结"],
        "imitate_tips": "仿写时先概括问题再分条提对策。",
    }, ensure_ascii=False)


def _ai_import_json():
    return json.dumps({
        "title": "2025年国家公务员考试申论（行政执法类）",
        "year": 2025,
        "paper": "行政执法",
        "exam_date": "2024-11-30",
        "source": "用户导入",
        "questions": [
            {
                "id": "1",
                "no": 1,
                "type": "归纳概括",
                "task": "概括给定资料1中的问题。",
                "max_score": 15,
                "material_ref": "给定资料1",
            },
            {
                "id": "2",
                "no": 2,
                "type": "提出对策",
                "task": "针对问题提出对策。",
                "max_score": 25,
                "material_ref": "给定资料2",
            },
        ],
    }, ensure_ascii=False)


class ExamBankTestBase(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.mkdtemp(prefix="exam_bank_test_")
        self._old_exam_dir = server.EXAM_BANK_DIR
        self._old_ai_limit = server.AI_RATE_LIMIT_PER_HOUR
        server.EXAM_BANK_DIR = self.temp_dir
        # 单元测试关闭限流计数,避免用例间互相消耗桶容量
        server.AI_RATE_LIMIT_PER_HOUR = 0
        self.client = server.app.test_client()

    def tearDown(self):
        server.EXAM_BANK_DIR = self._old_exam_dir
        server.AI_RATE_LIMIT_PER_HOUR = self._old_ai_limit
        shutil.rmtree(self.temp_dir, ignore_errors=True)

    def write_layer(self, layer, paper_id, payload):
        directory = os.path.join(self.temp_dir, layer) if layer else self.temp_dir
        path = os.path.join(directory, f"{paper_id}.json")
        _write_json(path, payload)
        return path

    def answers_path(self, paper_id="2025-xingzheng"):
        return os.path.join(self.temp_dir, "answers", f"{paper_id}.json")

    def imported_path(self, paper_id="2025-xingzheng"):
        return os.path.join(self.temp_dir, "imported", f"{paper_id}.json")


class ExamIndexTest(ExamBankTestBase):
    def test_empty_bank_returns_empty_index_with_filters(self):
        response = self.client.get("/api/exam/papers")
        self.assertEqual(response.status_code, 200)
        body = response.get_json()
        self.assertEqual(body["papers"], [])
        self.assertEqual(body["years"], [])
        self.assertEqual(body["types"], list(server._EXAM_FILTER_TYPES))

    def test_three_layer_merge_and_summary(self):
        self.write_layer("", "2025-xingzheng", _paper_payload())
        self.write_layer("", "2024-xingzheng", _paper_payload(
            "2024-xingzheng", 2024, title="2024年卷", materials="",
        ))
        # imported 层:覆盖标题、改分值、追加第 3 题
        self.write_layer("imported", "2025-xingzheng", {
            "id": "2025-xingzheng",
            "title": "导入覆盖标题",
            "questions": [
                {"id": "1", "max_score": 20},
                {"id": "3", "no": 3, "type": "大作文", "task": "写一篇文章。", "max_score": 35},
            ],
        })
        # answers 层:只给答案
        self.write_layer("answers", "2025-xingzheng", {
            "paper_id": "2025-xingzheng",
            "updated_at": "2026-11-02 10:00:00",
            "answers": {
                "1": {"reference_answer": "AI答案", "answer_kind": "ai", "score_points": ["要点1"]},
                "2": {"reference_answer": "导入答案", "answer_kind": "imported"},
            },
        })

        body = self.client.get("/api/exam/papers").get_json()
        self.assertEqual(
            [item["id"] for item in body["papers"]],
            ["2025-xingzheng", "2024-xingzheng"],
        )
        first, second = body["papers"]
        self.assertEqual(first["title"], "导入覆盖标题")
        self.assertEqual(first["question_count"], 3)
        self.assertEqual(first["total_score"], 80)  # 20 + 25 + 35
        self.assertEqual(first["answered_count"], 2)
        self.assertEqual(first["ai_answered_count"], 1)
        self.assertTrue(first["has_materials"])
        self.assertTrue(first["verified"])
        self.assertEqual(second["title"], "2024年卷")
        self.assertFalse(second["has_materials"])
        self.assertEqual(body["years"], [2025, 2024])


class ExamPaperDetailTest(ExamBankTestBase):
    def test_detail_merges_questions_and_answers_only_override_answer_fields(self):
        self.write_layer("", "2025-xingzheng", _paper_payload())
        self.write_layer("imported", "2025-xingzheng", {
            "id": "2025-xingzheng",
            "title": "导入版标题",
            "questions": [{"id": "1", "task": "导入后的题干", "max_score": 20}],
        })
        self.write_layer("answers", "2025-xingzheng", {
            "answers": {
                "1": {
                    "reference_answer": "参考答案正文",
                    "answer_kind": "ai",
                    "answer_source": "AI 按申论评分规则生成（非官方）",
                    "score_points": ["要点1", "要点2"],
                    "structure": ["开头", "结尾"],
                    "imitate_tips": "仿写提示",
                    # 非答案字段即便写在 answers 里也不能生效
                    "task": "不应生效的题干",
                    "type": "大作文",
                },
                "99": {"reference_answer": "不存在的题"},
            },
        })

        response = self.client.get("/api/exam/papers/2025-xingzheng")
        self.assertEqual(response.status_code, 200)
        body = response.get_json()
        paper = body["paper"]
        self.assertEqual(paper["id"], "2025-xingzheng")
        self.assertEqual(paper["title"], "导入版标题")
        self.assertTrue(paper["has_materials"])
        self.assertEqual(paper["materials"], _paper_payload()["materials"])
        self.assertIn("source_url", paper)
        self.assertEqual(paper["answered_count"], 1)

        questions = {item["id"]: item for item in body["questions"]}
        self.assertEqual(len(questions), 2)  # answers 里的 99 不能凭空造题
        question = questions["1"]
        self.assertEqual(question["task"], "导入后的题干")
        self.assertEqual(question["type"], "归纳概括")
        self.assertEqual(question["max_score"], 20)
        self.assertEqual(question["reference_answer"], "参考答案正文")
        self.assertEqual(question["answer_kind"], "ai")
        self.assertTrue(question["ai_generated"])
        self.assertEqual(question["score_points"], ["要点1", "要点2"])
        self.assertEqual(question["structure"], ["开头", "结尾"])
        self.assertEqual(question["imitate_tips"], "仿写提示")

    def test_unknown_paper_404_and_invalid_id_400(self):
        missing = self.client.get("/api/exam/papers/2099-xingzheng")
        self.assertEqual(missing.status_code, 404)
        self.assertEqual(missing.get_json()["error"], "试卷不存在")
        for bad_id in ("bad.id", "a" * 65, "点"):
            response = self.client.get(f"/api/exam/papers/{bad_id}")
            self.assertEqual(response.status_code, 400, bad_id)
            self.assertTrue(response.get_json()["error"])


class ExamPathSafetyTest(ExamBankTestBase):
    def test_layer_paths_block_traversal(self):
        self.assertEqual(server._exam_bank_file("answers", "../evil"), "")
        self.assertEqual(server._exam_bank_file("answers", "/etc/passwd"), "")
        self.assertEqual(server._exam_bank_file("answers", "a/b"), "")
        self.assertEqual(server._exam_bank_file("answers", "a" * 65), "")
        self.assertEqual(server._exam_bank_file("unknown", "2025-xingzheng"), "")
        self.assertEqual(
            server._exam_bank_file("answers", "2025-xingzheng"),
            os.path.join(self.temp_dir, "answers", "2025-xingzheng.json"),
        )

    def test_routes_reject_traversal_ids(self):
        response = self.client.post("/api/exam/imitate", json={"paper_id": "../x", "qid": "1"})
        self.assertEqual(response.status_code, 400)
        self.assertTrue(response.get_json()["error"])
        response = self.client.post(
            "/api/exam/papers/bad.id/questions/1/answer", json={},
        )
        self.assertEqual(response.status_code, 400)


class ExamAnswerGenerationTest(ExamBankTestBase):
    def setUp(self):
        super().setUp()
        self.write_layer("", "2025-xingzheng", _paper_payload())

    def test_generates_and_persists_ai_answer(self):
        with patch.object(server, "_load_essay_guidance", return_value="申论规则指导"), \
             patch.object(server, "_load_standard_for_type", return_value="归纳概括评分标准"), \
             patch.object(server, "call_deepseek", return_value=_ai_answer_json()) as deepseek:
            response = self.client.post(
                "/api/exam/papers/2025-xingzheng/questions/1/answer", json={},
            )

        self.assertEqual(response.status_code, 200)
        body = response.get_json()
        self.assertFalse(body["cached"])
        question = body["question"]
        self.assertEqual(question["id"], "1")
        self.assertEqual(question["task"], "根据给定资料1，概括……")
        self.assertEqual(question["reference_answer"], "一是完善制度；二是加强监管。")
        self.assertEqual(question["answer_kind"], "ai")
        self.assertEqual(question["answer_source"], "AI 按申论评分规则生成（非官方）")
        self.assertTrue(question["ai_generated"])
        self.assertEqual(len(question["score_points"]), 2)
        self.assertEqual(len(question["structure"]), 3)

        prompt = deepseek.call_args.args[0]
        self.assertIn("根据给定资料1", prompt)  # 题干
        self.assertIn("基层治理", prompt)        # 材料
        self.assertIn("申论规则指导", prompt)     # _load_essay_guidance
        self.assertIn("归纳概括评分标准", prompt)  # _load_standard_for_type
        self.assertEqual(deepseek.call_args.kwargs.get("model"), server.REVIEW_MODEL)

        with open(self.answers_path(), encoding="utf-8") as fh:
            stored = json.load(fh)
        self.assertEqual(stored["paper_id"], "2025-xingzheng")
        self.assertIn("updated_at", stored)
        self.assertEqual(stored["answers"]["1"]["answer_kind"], "ai")
        self.assertEqual(stored["answers"]["1"]["reference_answer"], "一是完善制度；二是加强监管。")

    def test_existing_answer_returns_cached_without_ai(self):
        self.write_layer("answers", "2025-xingzheng", {
            "answers": {"1": {"reference_answer": "已有答案", "answer_kind": "ai"}},
        })
        with patch.object(server, "call_deepseek") as deepseek:
            response = self.client.post(
                "/api/exam/papers/2025-xingzheng/questions/1/answer", json={},
            )
        self.assertEqual(response.status_code, 200)
        body = response.get_json()
        self.assertTrue(body["cached"])
        self.assertEqual(body["question"]["reference_answer"], "已有答案")
        deepseek.assert_not_called()

    def test_force_regenerates_existing_answer(self):
        self.write_layer("answers", "2025-xingzheng", {
            "answers": {"1": {"reference_answer": "旧答案", "answer_kind": "ai"}},
        })
        with patch.object(server, "call_deepseek", return_value=_ai_answer_json()) as deepseek:
            response = self.client.post(
                "/api/exam/papers/2025-xingzheng/questions/1/answer",
                json={"force": True},
            )
        self.assertEqual(response.status_code, 200)
        self.assertFalse(response.get_json()["cached"])
        deepseek.assert_called_once()
        with open(self.answers_path(), encoding="utf-8") as fh:
            stored = json.load(fh)
        self.assertEqual(
            stored["answers"]["1"]["reference_answer"], "一是完善制度；二是加强监管。",
        )

    def test_unparsable_ai_json_returns_502(self):
        with patch.object(server, "call_deepseek", return_value="这不是 JSON"):
            response = self.client.post(
                "/api/exam/papers/2025-xingzheng/questions/1/answer", json={},
            )
        self.assertEqual(response.status_code, 502)
        self.assertIn("参考答案", response.get_json()["error"])
        self.assertFalse(os.path.exists(self.answers_path()))

    def test_ai_service_error_returns_502(self):
        with patch.object(server, "call_deepseek", return_value="AI调用失败: HTTP 500 timeout"):
            response = self.client.post(
                "/api/exam/papers/2025-xingzheng/questions/1/answer", json={},
            )
        self.assertEqual(response.status_code, 502)

    def test_ai_json_without_reference_answer_returns_502(self):
        with patch.object(server, "call_deepseek", return_value='{"score_points": ["要点"]}'):
            response = self.client.post(
                "/api/exam/papers/2025-xingzheng/questions/1/answer", json={},
            )
        self.assertEqual(response.status_code, 502)
        self.assertFalse(os.path.exists(self.answers_path()))

    def test_answer_route_404s(self):
        self.assertEqual(self.client.post(
            "/api/exam/papers/2099-xingzheng/questions/1/answer", json={},
        ).status_code, 404)
        self.assertEqual(self.client.post(
            "/api/exam/papers/2025-xingzheng/questions/99/answer", json={},
        ).status_code, 404)


class ExamImitateTest(ExamBankTestBase):
    def setUp(self):
        super().setUp()
        self.write_layer("", "2025-xingzheng", _paper_payload())
        self.write_layer("answers", "2025-xingzheng", {
            "answers": {
                "1": {
                    "reference_answer": "参考答案正文",
                    "answer_kind": "ai",
                    "score_points": ["要点1"],
                    "structure": ["开头", "结尾"],
                },
            },
        })

    def test_requires_reference_answer(self):
        with patch.object(server, "call_deepseek") as deepseek:
            response = self.client.post("/api/exam/imitate", json={
                "paper_id": "2025-xingzheng", "qid": "2", "mode": "imitate",
            })
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.get_json()["error"], "请先生成或导入参考答案")
        deepseek.assert_not_called()

    def test_modes_return_markdown_and_html(self):
        for mode in ("imitate", "outline", "phrases"):
            with patch.object(
                server, "call_deepseek", return_value=f"## 结果\n- {mode}",
            ) as deepseek:
                response = self.client.post("/api/exam/imitate", json={
                    "paper_id": "2025-xingzheng", "qid": "1", "mode": mode,
                })
            self.assertEqual(response.status_code, 200, mode)
            body = response.get_json()
            self.assertEqual(body["mode"], mode)
            self.assertIn(mode, body["answer"])
            self.assertIn("<h2>", body["html"])
            self.assertIn("参考答案正文", deepseek.call_args.args[0])

    def test_invalid_mode_returns_400(self):
        response = self.client.post("/api/exam/imitate", json={
            "paper_id": "2025-xingzheng", "qid": "1", "mode": "unknown",
        })
        self.assertEqual(response.status_code, 400)

    def test_ai_failure_returns_502(self):
        with patch.object(server, "call_deepseek", return_value="AI调用失败: HTTP 500"):
            response = self.client.post("/api/exam/imitate", json={
                "paper_id": "2025-xingzheng", "qid": "1", "mode": "imitate",
            })
        self.assertEqual(response.status_code, 502)
        self.assertTrue(response.get_json()["error"])


class ExamImportTest(ExamBankTestBase):
    def test_json_import_writes_imported_paper_and_overrides_seed(self):
        self.write_layer("", "2025-xingzheng", _paper_payload())
        with patch.object(
            server, "call_deepseek", return_value=_ai_import_json(),
        ) as deepseek:
            response = self.client.post("/api/exam/import", json={
                "text": "材料一……\n第1题……\n第2题……",
                "year": 2025,
                "paper": "行政执法",
            })

        self.assertEqual(response.status_code, 200)
        body = response.get_json()
        self.assertEqual(body["paper_id"], "2025-xingzheng")
        self.assertEqual(body["question_count"], 2)
        self.assertEqual([item["id"] for item in body["questions"]], ["1", "2"])
        self.assertIn("材料一", deepseek.call_args.args[0])

        imported = self.imported_path()
        self.assertTrue(os.path.exists(imported))
        with open(imported, encoding="utf-8") as fh:
            stored = json.load(fh)
        self.assertEqual(stored["title"], "2025年国家公务员考试申论（行政执法类）")
        self.assertEqual(stored["source"], "用户导入")
        self.assertFalse(stored["verified"])
        self.assertEqual(len(stored["questions"]), 2)

        listed = {
            item["id"]: item
            for item in self.client.get("/api/exam/papers").get_json()["papers"]
        }
        self.assertIn("2025-xingzheng", listed)
        self.assertEqual(listed["2025-xingzheng"]["question_count"], 2)
        self.assertEqual(listed["2025-xingzheng"]["answered_count"], 0)

    def test_json_import_requires_text(self):
        with patch.object(server, "call_deepseek") as deepseek:
            response = self.client.post("/api/exam/import", json={})
        self.assertEqual(response.status_code, 400)
        self.assertIn("请上传试卷文件或粘贴整卷文字", response.get_json()["error"])
        deepseek.assert_not_called()

    def test_import_returns_502_when_ai_unparsable(self):
        with patch.object(server, "call_deepseek", return_value="抱歉，我无法识别这份试卷"):
            response = self.client.post("/api/exam/import", json={"text": "材料一……"})
        self.assertEqual(response.status_code, 502)
        self.assertFalse(os.path.exists(self.imported_path()))

    def test_multipart_import_uses_extracted_text(self):
        captured = {}

        def fake_extract(path, filename=""):
            captured["filename"] = filename
            return "材料一……\n第1题：概括问题。"

        with patch.object(server, "extract_document_text", side_effect=fake_extract), \
             patch("werkzeug.datastructures.FileStorage.save"), \
             patch.object(server, "call_deepseek", return_value=_ai_import_json()) as deepseek:
            response = self.client.post(
                "/api/exam/import",
                data={
                    "year": "2025",
                    "paper": "行政执法",
                    "file": (io.BytesIO(b"paper"), "paper.txt"),
                },
                content_type="multipart/form-data",
            )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json()["paper_id"], "2025-xingzheng")
        self.assertEqual(captured["filename"], "paper.txt")
        self.assertIn("材料一", deepseek.call_args.args[0])


class ExamRateLimitTest(ExamBankTestBase):
    def test_exam_post_uses_ai_rate_limit_bucket(self):
        with patch.object(server, "_enforce_rate_limit", return_value=None) as enforce:
            self.client.post("/api/exam/imitate", json={
                "paper_id": "2025-xingzheng", "qid": "1",
            })
        enforce.assert_called_once_with("ai", server.AI_RATE_LIMIT_PER_HOUR)

    def test_exam_get_is_not_rate_limited(self):
        with patch.object(server, "_enforce_rate_limit", return_value=None) as enforce:
            self.client.get("/api/exam/papers")
        enforce.assert_not_called()


if __name__ == "__main__":
    unittest.main()