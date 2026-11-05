# 真题库（国考行政执法卷·逐题答案）接口契约

> 本文件是「真题」新 tab 的前后端共同契约。后端与小程序页面都按此实现，不要各自改名/改字段。

## 1. 定位

- 收录 **2022–2026 国考申论（行政执法类）** 五套卷，逐题给出：题干、题型、分值、参考作答、评分要点、仿写结构、仿写提示。
- 国考申论官方从不公布标准答案。所有作答一律带来源标注：
  - `answer_kind = "official"` → 官方/真题解析（目前不会有）
  - `answer_kind = "imported"` → 用户导入的机构版答案
  - `answer_kind = "ai"` → AI 按 `essay_vault` 评分规则生成的**参照答案（非官方）**
- 小程序必须在答案区展示「AI 参照答案 · 非官方」这类标注，不能让人误以为是标准答案。

## 2. 数据存储

目录常量（`server.py`）：

```python
EXAM_BANK_DIR = os.path.join(DATA_DIR, "exam_bank")      # 运行时根目录
```

三层文件，后层覆盖前层（同 `paper_id` 合并、`questions` 按 `id` 合并）：

| 路径 | 来源 | 说明 |
|---|---|---|
| `exam_bank/<paper_id>.json` | 仓库内置（`data/exam_bank/`，随 Docker 镜像 COPY 进 `/data/exam_bank/`） | 真题题干/材料等静态种子 |
| `exam_bank/imported/<paper_id>.json` | 用户导入 | 覆盖同名种子 |
| `exam_bank/answers/<paper_id>.json` | AI 生成/用户覆盖 | 只存逐题答案字段，见下 |

试卷文件结构：

```json
{
  "id": "2025-xingzheng",
  "year": 2025,
  "paper": "行政执法",
  "title": "2025年国家公务员考试申论（行政执法类）",
  "exam_date": "2024-11-30",
  "materials": "【给定资料1】……\n\n【给定资料2】……",
  "source": "网络公开回忆版整理",
  "source_url": "https://...",
  "verified": true,
  "questions": [
    {
      "id": "1",
      "no": 1,
      "type": "归纳概括",
      "task": "根据“给定资料1”，概括……",
      "max_score": 15,
      "material_ref": "给定资料1",
      "reference_answer": "",
      "answer_kind": "",
      "answer_source": "",
      "score_points": [],
      "structure": [],
      "imitate_tips": ""
    }
  ]
}
```

答案覆盖文件（`answers/<paper_id>.json`）：

```json
{
  "paper_id": "2025-xingzheng",
  "updated_at": "2026-11-02 10:00:00",
  "answers": {
    "1": {
      "reference_answer": "……",
      "answer_kind": "ai",
      "answer_source": "AI 按申论评分规则生成（非官方）",
      "score_points": ["要点1", "要点2"],
      "structure": ["开头：……", "分论点1：……", "结尾：……"],
      "imitate_tips": "仿写时注意……"
    }
  }
}
```

`type` 取值固定集合：`归纳概括 / 综合分析 / 提出对策 / 应用文 / 大作文 / 其他`。

## 3. 接口

统一 JSON；错误 `{ "error": "中文提示" }` + 4xx/5xx。以下路径均以 `/api/exam` 为前缀，`paper_id` 形如 `2025-xingzheng`。

### 3.1 `GET /api/exam/papers`

```json
{
  "papers": [
    {
      "id": "2025-xingzheng",
      "year": 2025,
      "paper": "行政执法",
      "title": "……",
      "question_count": 5,
      "total_score": 100,
      "answered_count": 3,
      "ai_answered_count": 3,
      "has_materials": true,
      "source": "网络公开回忆版整理",
      "verified": true
    }
  ],
  "years": [2026, 2025, 2024, 2023, 2022],
  "types": ["归纳概括", "综合分析", "提出对策", "应用文", "大作文"]
}
```

按 `year` 倒序。`answered_count` = `reference_answer` 非空的题数。

### 3.2 `GET /api/exam/papers/<paper_id>`

```json
{
  "paper": { "……": "同 summary，另加 materials、source_url" },
  "questions": [
    {
      "id": "1", "no": 1, "type": "归纳概括",
      "task": "……", "max_score": 15, "material_ref": "给定资料1",
      "reference_answer": "……",
      "answer_kind": "ai",
      "answer_source": "AI 按申论评分规则生成（非官方）",
      "ai_generated": true,
      "score_points": ["……"],
      "structure": ["……"],
      "imitate_tips": "……"
    }
  ]
}
```

404 → `{"error": "试卷不存在"}`。

### 3.3 `POST /api/exam/papers/<paper_id>/questions/<qid>/answer`

请求：`{"force": false}`（可选）。

- 已有 `answer_kind in {"official","imported"}` 且非 `force` → 直接返回，`cached: true`。前端对 `imported/official` 不展示「重新生成」，避免覆盖导入答案。
- 已有 AI 答案且非 `force` → 直接返回，`cached: true`。
- 否则调 DeepSeek（`REVIEW_MODEL`），注入 `_load_essay_guidance()` + `_load_standard_for_type(type)` + 题干 + 材料（截断），要求返回严格 JSON：
  ```json
  {"reference_answer": "...", "score_points": ["..."], "structure": ["..."], "imitate_tips": "..."}
  ```
- 解析失败 → 502 `{"error": "AI 未返回可用的参考答案，请重试"}`。
- 成功写入 `answers/<paper_id>.json` 并返回：

```json
{ "question": { "……": "同 3.2 的完整题目对象" }, "cached": false }
```

### 3.4 `POST /api/exam/imitate`

请求：`{"paper_id": "...", "qid": "1", "mode": "imitate" | "outline" | "phrases"}`

- `imitate`：按该题参考答案与评分要点，生成一篇同题型、同分值的**仿写示范**（标注「仿写示范」）。
- `outline`：拆解参考答案的**结构与得分点对应关系**。
- `phrases`：提炼**可直接套用的句式/表述**（10 条以内）。

响应：`{"mode": "...", "answer": "markdown", "html": "html"}`。若该题无参考答案 → 400 `{"error": "请先生成或导入参考答案"}`。AI 失败 → 502。

### 3.5 `POST /api/exam/import`

两种提交方式：

- `multipart/form-data`：字段 `file`（pdf/docx/txt/md），可选 `year`、`paper`。
- `application/json`：`{"text": "整卷文字", "year": 2025, "paper": "行政执法"}`。

流程：取文本 → AI 拆题（同 `_full_review_prepare` 的 JSON 思路）→ 写入 `imported/<paper_id>.json` → 返回：

```json
{ "paper_id": "2025-xingzheng", "title": "……", "question_count": 5, "questions": [ {"id":"1","type":"…","task":"…","max_score":15} ] }
```

`paper_id` 规则：`{year}-{paper_slug}`，`paper` 为「行政执法」时 slug 固定 `xingzheng`。导入写入 `imported/` 层，与同名种子按 `questions` 的 `id` 合并（同 id 覆盖、新 id 追加、种子里多出的旧题保留），不会整卷替换。

小程序入口：`pages/mine` 的「真题库 → 导入整卷真题」，走 `wx.chooseMessageFile` + `uploadTo /api/exam/import`。

### 3.6 `POST /api/exam/papers/<paper_id>/generate-all`

后台批量生成整卷答案（逐题串行调 AI），立即返回任务，用轮询接口看进度。

请求：`{"force": false}`（可选）。`force=true` 只重生成 AI 答案与空答案；`answer_kind` 为 `official`/`imported` 的题目**永不覆盖**。

- 没有需要生成的题 → 200 `{"started": false, "message": "该卷答案已齐全（官方/导入答案不覆盖）"}`
- 已在跑 → 200 `{"started": false, "job": {...}, "message": "已有生成任务在进行，请稍后刷新"}`
- 成功启动 → **202** `{"started": true, "job": {"status": "running", "total": 5, "done": 0, ...}}`

任务完成后会尝试 `git_sync_to_github` 把 `data/exam_bank/` 推进仓库（失败只打日志，不影响生成结果）。

### 3.7 `GET /api/exam/papers/<paper_id>/generate-status`

```json
{"job": {"paper_id": "2025-xingzheng", "status": "running", "total": 5, "done": 2,
          "failed": 0, "current": "3", "message": "", "started_at": "...", "updated_at": "..."}}
```

`status` ∈ `idle | running | done | failed`。进度文件写在 `EXAM_BANK_DIR/jobs/<paper_id>.json`（不参与 GitHub 同步），锁文件 `<paper_id>.lock` 用 `O_EXCL` 抢占，超过 15 分钟未更新视为失联可接管，避免 gunicorn 多 worker 重复生成。

## 4. 限流

`/api/exam/` 下所有 POST 走 AI 限流桶（复用 `_enforce_rate_limit("ai", AI_RATE_LIMIT_PER_HOUR)`）。GET 不限流。

实现方式：在 `enforce_expensive_api_rate_limits` 里加一条**前缀判断**（`request.path.startswith("/api/exam/")`），不要逐条枚举。

## 5. 小程序端

- `app.json`：新增第 3 个 tab `pages/exam/exam`（文案「真题」），总 tab 数 5。
- `pages/exam/exam`：年份 + 题型筛选、卷列表、空态、下拉刷新。
- `pages/exam-detail/exam-detail`：题目切换器、题干/材料、参考作答（带来源标注）、评分要点、仿写结构、仿写提示；按钮：复制 / AI 仿写示范 / 结构拆解 / 生成 AI 参照答案 / **一键生成整卷答案**（202 + 3 秒轮询进度，可离开页面，完成后自动同步 GitHub）。
- `utils/api.js` 新增：`listExamPapers`、`getExamPaper`、`generateExamAnswer`、`imitateExam`。
- `utils/request.js` 新增 `getJson(url, params, timeout)`，与 `postJson` 同样的重试与错误文案策略。