# -*- coding: utf-8 -*-
"""核心纯函数单元测试:分块、JSON 宽松解析、题目解析、分数换算、路径安全等。
运行: python -m unittest tests.test_core_functions
"""
import os
import tempfile
import unittest

import server


class ChunkTextTest(unittest.TestCase):
    def test_empty_and_short_text(self):
        self.assertEqual(server.chunk_text(""), [])
        self.assertEqual(server.chunk_text("   "), [])
        self.assertEqual(server.chunk_text("短文本"), ["短文本"])

    def test_splits_on_sentence_boundary_not_mid_sentence(self):
        text = "第一句。第二句！第三句？\n第四段。"
        chunks = server.chunk_text(text, chunk_size=6)
        for chunk in chunks:
            self.assertNotEqual(chunk, "第一句。第")
            self.assertTrue(chunk)
        # \n 作为切分点会被丢弃;验证拼接一致,且每个分块边界都落在句末标点处(无跨句硬切)
        self.assertEqual("".join(chunks), text.replace("\n", ""))
        for a, b in zip(chunks, chunks[1:]):
            self.assertIn(a[-1], "。！？；;", f"分块被硬切: {a!r} | {b!r}")

    def test_long_unit_without_punctuation_is_hard_cut(self):
        long_unit = "无" * 100
        chunks = server.chunk_text(long_unit, chunk_size=30)
        self.assertEqual(len(chunks), 4)
        self.assertEqual("".join(chunks), long_unit)


class ParseJsonLooseTest(unittest.TestCase):
    def test_plain_json(self):
        self.assertEqual(server._parse_json_loose('{"a": 1}'), {"a": 1})

    def test_code_block_wrapped(self):
        self.assertEqual(server._parse_json_loose('```json\n{"a": 1}\n```'), {"a": 1})

    def test_embedded_in_prose(self):
        self.assertEqual(server._parse_json_loose("以下是结果\n{ \"a\": 1 }\n完"), {"a": 1})

    def test_invalid_returns_none(self):
        self.assertIsNone(server._parse_json_loose("不是JSON"))
        self.assertIsNone(server._parse_json_loose(""))


class ParseAiQuestionsResponseTest(unittest.TestCase):
    def _question(self, qid=1):
        return {"id": qid, "question": "题干", "options": {"A": "a", "B": "b"}, "answer": "A"}

    def test_valid_list(self):
        import json
        result = server._parse_ai_questions_response(json.dumps([self._question()], ensure_ascii=False))
        self.assertEqual(len(result), 1)

    def test_extracts_array_from_prose(self):
        import json
        q = json.dumps(self._question(), ensure_ascii=False)
        result = server._parse_ai_questions_response(f"好的\n[{q}]\n以上")
        self.assertEqual(len(result), 1)

    def test_filters_invalid_entries(self):
        import json
        bad = {"id": 2, "question": "缺选项"}
        good = self._question(1)
        result = server._parse_ai_questions_response(json.dumps([bad, good], ensure_ascii=False))
        self.assertEqual(len(result), 1)
        self.assertEqual(result[0]["id"], 1)

    def test_garbage_returns_empty(self):
        self.assertEqual(server._parse_ai_questions_response("完全不是JSON"), [])


class ParseQuestionsFromTextTest(unittest.TestCase):
    def test_standard_format(self):
        text = ("1. 我国的基本经济制度是？\nA. 公有制\nB. 私有制\nC. 混合制\nD. 计划经济\n答案：A\n\n"
                "2. 第二题题干\nA. x\nB. y\nC. z\nD. w\n答案：B")
        questions = server.parse_questions_from_text(text)
        self.assertEqual(len(questions), 2)
        self.assertEqual(questions[0]["answer"], "A")
        self.assertIn("A", questions[0]["options"])

    def test_fenbi_format(self):
        # 粉笔格式:题干在题号之前、题号单独成行;需 >=5 个题号行才走该分支
        blocks = []
        for i in range(1, 6):
            blocks.append(
                f"第{i}题题干内容\n{i}.\n"
                "A. 选项A\nB. 选项B\nC. 选项C\nD. 选项D"
            )
        questions = server.parse_questions_from_text("\n\n".join(blocks))
        self.assertEqual(len(questions), 5)
        self.assertEqual(questions[0]["id"], 1)
        self.assertIn("第1题题干内容", questions[0]["question"])
        self.assertEqual(questions[0]["options"]["C"], "选项C")
        self.assertEqual(questions[4]["id"], 5)

    def test_no_questions(self):
        self.assertEqual(server.parse_questions_from_text("没有题目"), [])


class DistanceToScoreTest(unittest.TestCase):
    def test_cosine(self):
        self.assertEqual(server._distance_to_score("cosine", 0.2), 0.8)
        self.assertEqual(server._distance_to_score("cosine", 2.0), 0.0)

    def test_l2_monotonic(self):
        self.assertGreater(server._distance_to_score("l2", 0.1), server._distance_to_score("l2", 5.0))
        self.assertLessEqual(server._distance_to_score("l2", 0.0), 1.0)

    def test_invalid_input(self):
        self.assertEqual(server._distance_to_score("cosine", "abc"), 0.0)


class ResolveWithinTest(unittest.TestCase):
    def setUp(self):
        self.base = tempfile.mkdtemp()

    def test_normal(self):
        target = server._resolve_within(self.base, "a.md")
        self.assertTrue(target.endswith("a.md"))

    def test_traversal_blocked(self):
        self.assertEqual(server._resolve_within(self.base, "../secret.txt"), "")

    def test_absolute_path_outside_blocked(self):
        self.assertEqual(server._resolve_within(self.base, os.path.abspath(__file__)), "")

    def test_empty_name(self):
        self.assertIn(os.path.realpath(self.base), server._resolve_within(self.base, ""))


class UserDataPathTest(unittest.TestCase):
    def test_uid_stable_and_isolated(self):
        p1 = server._user_data_path("user-abc")
        p2 = server._user_data_path("user-abc")
        p3 = server._user_data_path("user-xyz")
        self.assertEqual(p1, p2)
        self.assertNotEqual(p1, p3)

    def test_anonymous_uses_global_file(self):
        self.assertTrue(server._user_data_path("").endswith("user_data.json"))


class SanitizeCollectionNameTest(unittest.TestCase):
    def test_valid_passthrough(self):
        self.assertEqual(server.sanitize_collection_name("shizheng_news"), "shizheng_news")

    def test_chinese_name_hashed(self):
        self.assertRegex(server.sanitize_collection_name("我的知识库"), r"^kb_[0-9a-f]{8}$")


if __name__ == "__main__":
    unittest.main()
