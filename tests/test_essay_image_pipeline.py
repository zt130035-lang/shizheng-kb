import os
import tempfile
import unittest
from unittest.mock import patch

import server


class _VisionResponse:
    status_code = 200

    def json(self):
        return {
            "choices": [
                {
                    "message": {
                        "content": (
                            "## 识别原文\n基层治理需要坚持以人民为中心。\n\n"
                            "## 批改意见\n论证需要更具体。"
                        )
                    }
                }
            ]
        }


class _VisionOcrResponse:
    status_code = 200

    def json(self):
        return {
            "choices": [
                {
                    "message": {
                        "content": "## 识别原文\n基层治理需要坚持以人民为中心。"
                    }
                }
            ]
        }


class EssayImagePipelineTest(unittest.TestCase):
    def test_image_review_uses_one_vision_call_with_kb_context(self):
        captured = {}

        def fake_vision_post(url, headers=None, json=None, timeout=None):
            captured["prompt"] = json["messages"][1]["content"][0]["text"]
            return _VisionResponse()

        fd, image_path = tempfile.mkstemp(suffix=".png")
        try:
            with os.fdopen(fd, "wb") as image:
                image.write(b"test image")
            with patch.object(server.requests, "post", side_effect=fake_vision_post):
                with patch.object(server, "_search_kb_for_essay", return_value="规则和素材") as search:
                    with patch.object(server, "call_deepseek") as deepseek:
                        result = server._call_vision_essay_review(image_path, topic="基层治理")
        finally:
            os.unlink(image_path)

        self.assertIn("规则和素材", captured["prompt"])
        self.assertIn("批改并润色", captured["prompt"])
        search.assert_called_once()
        deepseek.assert_not_called()
        self.assertTrue(result["has_kb_materials"])
        self.assertIn("## 批改意见", result["answer"])

    def test_deep_mode_runs_second_review_with_post_ocr_kb_context(self):
        captured = {}
        final_answer = "## 总体评分\n80分\n\n" + ("深度批改结果" * 20)

        def fake_vision_post(url, headers=None, json=None, timeout=None):
            captured["prompt"] = json["messages"][1]["content"][0]["text"]
            return _VisionOcrResponse()

        fd, image_path = tempfile.mkstemp(suffix=".png")
        try:
            with os.fdopen(fd, "wb") as image:
                image.write(b"test image")
            with patch.object(server.requests, "post", side_effect=fake_vision_post):
                with patch.object(server, "_search_kb_for_essay", return_value="深度规则和素材") as search:
                    with patch.object(server, "call_deepseek", return_value=final_answer) as deepseek:
                        result = server._call_vision_essay_review(image_path, topic="基层治理", mode="deep")
        finally:
            os.unlink(image_path)

        self.assertIn("只负责准确识别", captured["prompt"])
        search.assert_called_once()
        deepseek.assert_called_once()
        self.assertIn("基层治理需要坚持以人民为中心", deepseek.call_args.args[0])
        self.assertIn("深度规则和素材", deepseek.call_args.args[0])
        self.assertEqual(result["answer"], final_answer)


if __name__ == "__main__":
    unittest.main()
