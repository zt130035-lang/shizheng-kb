# -*- coding: utf-8 -*-
"""真题库整卷批量生成 + GitHub 同步收集测试。

AI 调用与 GitHub 接口一律 patch,不联网。
运行: python -m pytest tests/test_exam_batch_job.py -q
"""

import json
import os
import shutil
import tempfile
import time
import unittest
from unittest.mock import patch

import server


AI_ANSWER_JSON = json.dumps({
    "reference_answer": "一是完善制度；二是加强监管。",
    "score_points": ["完善制度", "加强监管"],
    "structure": ["开头：点明问题", "分论点：制度与监管", "结尾：总结"],
    "imitate_tips": "先概括问题再分条提对策。",
}, ensure_ascii=False)


def _write_json(path, payload):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as fh:
        json.dump(payload, fh, ensure_ascii=False)


def _paper_payload(paper_id="2025-xingzheng", questions=None):
    return {
        "id": paper_id,
        "year": 2025,
        "paper": "行政执法",
        "title": "2025年国家公务员考试申论（行政执法类）",
        "materials": "【给定资料1】基层治理……",
        "source": "测试",
        "source_url": "https://example.com/paper",
        "verified": True,
        "questions": questions if questions is not None else [
            {
                "id": "1", "no": 1, "type": "归纳概括", "task": "概括问题。",
                "max_score": 15, "material_ref": "给定资料1",
            },
            {
                "id": "2", "no": 2, "type": "提出对策", "task": "提出对策。",
                "max_score": 25, "material_ref": "给定资料2",
            },
        ],
    }


class ExamBatchJobTest(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.mkdtemp(prefix="exam_jobs_test_")
        self._old_exam_dir = server.EXAM_BANK_DIR
        self._old_ai_limit = server.AI_RATE_LIMIT_PER_HOUR
        server.EXAM_BANK_DIR = self.temp_dir
        server.AI_RATE_LIMIT_PER_HOUR = 0
        self.client = server.app.test_client()

    def tearDown(self):
        server.EXAM_BANK_DIR = self._old_exam_dir
        server.AI_RATE_LIMIT_PER_HOUR = self._old_ai_limit
        shutil.rmtree(self.temp_dir, ignore_errors=True)

    def seed(self, payload=None, questions=None, paper_id="2025-xingzheng"):
        if payload is None:
            payload = _paper_payload(paper_id=paper_id, questions=questions)
        _write_json(os.path.join(self.temp_dir, f"{paper_id}.json"), payload)
        return paper_id

    def answers(self, paper_id="2025-xingzheng"):
        path = os.path.join(self.temp_dir, "answers", f"{paper_id}.json")
        with open(path, "r", encoding="utf-8") as fh:
            return json.load(fh)["answers"]

    def wait_job(self, paper_id="2025-xingzheng", timeout=5.0):
        deadline = time.time() + timeout
        while time.time() < deadline:
            job = server._exam_job_payload(paper_id)
            if job["status"] != "running":
                return job
            time.sleep(0.05)
        return server._exam_job_payload(paper_id)

    def test_generate_all_starts_job_and_writes_answers(self):
        self.seed()
        with patch.object(server, "call_deepseek", return_value=AI_ANSWER_JSON) as call, \
             patch.object(server, "git_sync_to_github", return_value=True) as sync:
            response = self.client.post("/api/exam/papers/2025-xingzheng/generate-all", json={})
            self.assertEqual(response.status_code, 202)
            body = response.get_json()
            self.assertTrue(body["started"])
            self.assertEqual(body["job"]["status"], "running")

            job = self.wait_job()
            self.assertEqual(job["status"], "done", job)
            self.assertEqual(job["done"], 2)
            self.assertEqual(job["failed"], 0)
            self.assertEqual(call.call_count, 2)
            answers = self.answers()
            self.assertIn("1", answers)
            self.assertIn("2", answers)
            self.assertEqual(answers["1"]["answer_kind"], "ai")
            sync.assert_called_once()

    def test_generate_all_never_overwrites_imported_answer(self):
        questions = _paper_payload()["questions"]
        questions[0].update({
            "reference_answer": "机构版答案",
            "answer_kind": "imported",
            "answer_source": "用户导入",
        })
        self.seed(questions=questions)
        with patch.object(server, "call_deepseek", return_value=AI_ANSWER_JSON), \
             patch.object(server, "git_sync_to_github", return_value=True):
            server._claim_exam_job("2025-xingzheng")
            server._run_exam_generate_job("2025-xingzheng", force=True)

        # imported 的题不被覆盖,只有空答案的题被生成
        paper = server._load_exam_paper("2025-xingzheng")
        first = server._find_exam_question(paper, "1")
        self.assertEqual(first["reference_answer"], "机构版答案")
        self.assertEqual(first["answer_kind"], "imported")
        self.assertEqual(server._exam_job_payload("2025-xingzheng")["done"], 1)

    def test_force_only_regenerates_ai_answers(self):
        questions = _paper_payload()["questions"]
        questions[0].update({
            "reference_answer": "旧的 AI 答案",
            "answer_kind": "ai",
            "answer_source": "AI 按申论评分规则生成（非官方）",
        })
        questions[1].update({
            "reference_answer": "机构版答案",
            "answer_kind": "imported",
        })
        paper = server._normalize_exam_paper(_paper_payload(questions=questions), "2025-xingzheng")
        targets = server._exam_job_targets(paper, force=True)
        self.assertEqual([item["id"] for item in targets], ["1"])

    def test_duplicate_start_reuses_running_job(self):
        self.seed()
        with patch.object(server, "_claim_exam_job", return_value=False):
            response = self.client.post("/api/exam/papers/2025-xingzheng/generate-all", json={})
        self.assertEqual(response.status_code, 200)
        body = response.get_json()
        self.assertFalse(body["started"])
        self.assertIn("已有生成任务", body["message"])

    def test_generate_all_reports_nothing_to_do(self):
        questions = _paper_payload()["questions"]
        for index, question in enumerate(questions, 1):
            question.update({"reference_answer": f"答案{index}", "answer_kind": "imported"})
        self.seed(questions=questions)
        response = self.client.post("/api/exam/papers/2025-xingzheng/generate-all", json={"force": True})
        self.assertEqual(response.status_code, 200)
        body = response.get_json()
        self.assertFalse(body["started"])
        self.assertIn("已齐全", body["message"])

    def test_status_idle_and_invalid_paper_id(self):
        self.seed()
        idle = self.client.get("/api/exam/papers/2025-xingzheng/generate-status").get_json()
        self.assertEqual(idle["job"]["status"], "idle")
        bad = self.client.get("/api/exam/papers/bad.id/generate-status")
        self.assertEqual(bad.status_code, 400)
        bad_start = self.client.post("/api/exam/papers/bad.id/generate-all", json={})
        self.assertEqual(bad_start.status_code, 400)

    def test_job_lock_prevents_concurrent_claims(self):
        self.seed()
        self.assertTrue(server._claim_exam_job("2025-xingzheng"))
        self.assertFalse(server._claim_exam_job("2025-xingzheng"))
        server._release_exam_job("2025-xingzheng")
        self.assertTrue(server._claim_exam_job("2025-xingzheng"))
        server._release_exam_job("2025-xingzheng")

    def test_collect_sync_files_includes_exam_layers_but_not_jobs(self):
        self.seed()
        _write_json(os.path.join(self.temp_dir, "imported", "2024-xingzheng.json"), {"id": "2024-xingzheng"})
        _write_json(os.path.join(self.temp_dir, "answers", "2024-xingzheng.json"), {"answers": {}})
        _write_json(os.path.join(self.temp_dir, "jobs", "2024-xingzheng.json"), {"status": "done"})

        repo_paths = [repo_path for _local, repo_path in server._collect_sync_files()]
        self.assertIn("data/exam_bank/2025-xingzheng.json", repo_paths)
        self.assertIn("data/exam_bank/imported/2024-xingzheng.json", repo_paths)
        self.assertIn("data/exam_bank/answers/2024-xingzheng.json", repo_paths)
        self.assertFalse([path for path in repo_paths if "/jobs/" in path])

    def test_git_sync_pushes_exam_bank_tree(self):
        """GitHub 同步真实走一遍(网络全部 mock):真题库文件出现在 tree 里。"""
        self.seed()
        state_file = os.path.join(self.temp_dir, ".sync_state.json")
        empty_dir = os.path.join(self.temp_dir, "empty")
        os.makedirs(empty_dir, exist_ok=True)

        class _Resp:
            def __init__(self, status_code, payload=None, text=""):
                self.status_code = status_code
                self._payload = payload or {}
                self.text = text

            def json(self):
                return self._payload

        class _FakeGitHub:
            def __init__(self):
                self.blobs = []
                self.tree = None

            def get(self, url, headers=None, timeout=None):
                if url.endswith("/git/ref/heads/main"):
                    return _Resp(200, {"object": {"sha": "commit1"}})
                if "/git/commits/commit1" in url:
                    return _Resp(200, {"tree": {"sha": "tree1"}})
                return _Resp(404)

            def post(self, url, headers=None, json=None, timeout=None):
                if url.endswith("/git/blobs"):
                    self.blobs.append(json)
                    return _Resp(201, {"sha": f"blob{len(self.blobs)}"})
                if url.endswith("/git/trees"):
                    self.tree = json
                    return _Resp(201, {"sha": "tree2"})
                if url.endswith("/git/commits"):
                    return _Resp(201, {"sha": "commit2"})
                return _Resp(404)

            def patch(self, url, headers=None, json=None, timeout=None):
                return _Resp(200, {"ok": True})

        fake = _FakeGitHub()
        with patch.object(server, "GITHUB_TOKEN", "test-token"), \
             patch.object(server, "SYNC_STATE_FILE", state_file), \
             patch.object(server, "NEWS_ARCHIVE_DIR", empty_dir), \
             patch.object(server, "DAILY_REPORTS_DIR", empty_dir), \
             patch.object(server, "TOPICS_DIR", empty_dir), \
             patch.object(server, "MORNING_CARDS_DIR", empty_dir), \
             patch.object(server, "DATA_DIR", empty_dir), \
             patch.object(server.requests, "get", fake.get), \
             patch.object(server.requests, "post", fake.post), \
             patch.object(server.requests, "patch", fake.patch):
            self.assertTrue(server.git_sync_to_github("test: exam bank sync"))

        paths = [item["path"] for item in (fake.tree or {}).get("tree", [])]
        self.assertIn("data/exam_bank/2025-xingzheng.json", paths)
        with open(state_file, "r", encoding="utf-8") as fh:
            state = json.load(fh)
        self.assertIn("data/exam_bank/2025-xingzheng.json", state)


if __name__ == "__main__":
    unittest.main()