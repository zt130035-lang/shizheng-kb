---
title: 考公时政知识库
emoji: 📚
colorFrom: blue
colorTo: purple
sdk: docker
app_port: 7860
fullWidth: true
---

# 考公时政知识库系统

一站式公务员考试时政学习平台：新闻归档、日报生成、语义搜索、PDF做题训练。

## 功能模块

| 模块 | 说明 |
|------|------|
| 📰 新闻归档 | 按日期浏览爬取的时政新闻全文，AI生成考点分析 |
| 📅 每日日报 | 查看 AI 生成的考点日报，含随堂测验 |
| 🔍 知识查询 | 输入问题，语义搜索向量知识库（BGE-M3 嵌入） |
| 📝 PDF做题 | 导入PDF → 提取/AI出题 → 答题 → AI解析 |
| ⭐ 收藏夹 | 收藏重要新闻，方便复习回顾 |
| ❌ 错题本 | 自动记录错题，针对性复习 |
| 📊 学习统计 | 追踪学习进度，数据驱动备考 |
| ⚙️ 知识库管理 | 创建/删除知识库，上传文本入库 |
| 📝 申论整套批改 | 上传整套材料与题目，逐题核对要点、估算评分并给出修改答案 |
| 📚 国考真题库 | 2022–2026 国考申论（行政执法类）逐题收录题干、参考作答、评分要点与仿写拆解 |

## 技术栈

- **后端**：Flask + Gunicorn
- **AI**：DeepSeek（分析/出题） + SiliconFlow BGE-M3（向量嵌入）
- **向量库**：ChromaDB
- **爬虫**：BeautifulSoup4（求是网、人民网、新华网）
- **PDF解析**：PyMuPDF
- **部署**：Docker on Render.com（免费版）
- **定时任务**：cron-job.org（每日9:00自动爬取）
- **保活**：UptimeRobot（5分钟心跳）
- **推送**：Bark（爬取完成推送到手机）
- **数据持久化**：爬取后自动通过 GitHub API 同步回仓库

## 本地运行

```bash
pip install -r requirements.txt
python server.py
```

浏览器打开 http://localhost:5678

本地密钥放在项目根目录 `.env`（已加入 `.gitignore`，不会提交）。`server.py` 启动时会自动加载它，**已存在的系统环境变量优先**，不会被覆盖：

```ini
# 阿里百炼 DashScope（OpenAI 兼容端点）
DEEPSEEK_API_KEY=sk-xxx
DEEPSEEK_API_URL=https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions
DEEPSEEK_MODEL=qwen-plus
REVIEW_MODEL=qwen-plus          # 批改
PREPARE_MODEL=qwen-plus         # 审题
VISION_API_KEY=sk-xxx           # 图片 OCR / 图片批改
VISION_API_URL=https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions
VISION_MODEL=qwen3-vl-plus
```

- 文本任务也可以用百炼的 `deepseek-v4.1-flash`；它是推理模型，长输出任务建议留足 `max_tokens`。
- 语义检索（`/api/query`、批改时的素材召回）仍走 SiliconFlow：未配置 `SILICONFLOW_API_KEY` 时检索自动降级为只用 `essay_vault` 规则，不影响批改和出答案。
- 云端部署仍用 Render 的环境变量，二者互不影响。

## 云端部署（Render.com）

### 环境变量

| 变量 | 说明 | 必填 |
|------|------|------|
| `DEEPSEEK_API_KEY` | DeepSeek API 密钥 | ✅ |
| `SILICONFLOW_API_KEY` | SiliconFlow 嵌入 API 密钥 | ✅ |
| `GITHUB_TOKEN` | GitHub Personal Access Token（数据自动同步） | ✅ |
| `GITHUB_REPO` | GitHub 仓库（默认 zt130035-lang/shizheng-kb） | ❌ |
| `BARK_DEVICE_KEY` | Bark 推送设备 Key，不配置则跳过推送 | ❌ |
| `BARK_SERVER` | Bark 服务地址，默认 https://api.day.app | ❌ |
| `CRON_SECRET` | 定时爬取鉴权密钥（默认 shizheng2026） | ❌ |
| `DATA_DIR` | 数据目录（默认 /data） | ❌ |
| `PORT` | 端口（默认 7860） | ❌ |

### 数据持久化机制

Render 免费版无持久磁盘，每次重启文件系统重置。本项目通过以下机制保证数据不丢失：

```
爬取/提取 → 保存到 /data → GitHub API 自动 push 到仓库
                                      ↓
下次部署 → Dockerfile COPY data/ → 数据从仓库恢复到 /data
                                      ↓
                          /api/rebuild-kb 重建向量索引
```

### API 端点

| 端点 | 说明 |
|------|------|
| `GET /api/cron/daily-crawl?secret=xxx` | 触发每日爬取（cron-job.org 调用） |
| `GET /api/rebuild-kb?secret=xxx` | 重建向量知识库 |
| `GET /api/sync-github?secret=xxx` | 手动触发数据同步到 GitHub |
| `GET /api/debug/embedding-test` | 测试嵌入 API 是否正常 |

### 部署步骤

1. Fork 或 push 代码到 GitHub
2. Render.com 创建 Web Service → 连接 GitHub 仓库
3. 配置环境变量（见上表）
4. 部署完成后访问 `/api/rebuild-kb?secret=shizheng2026` 初始化知识库
5. cron-job.org 设置每日定时请求 `/api/cron/daily-crawl?secret=shizheng2026`
6. UptimeRobot 设置 5 分钟心跳保活

## 移动端适配

支持手机浏览器访问，侧边栏自动收起为汉堡菜单。

## 申论整套批改

`POST /api/essay/full-review` 支持两种提交方式：

- `application/json`：`paper_text` 为材料与题目，`answers` 为考生作答，`topic` 可选。
- `multipart/form-data`：上传字段 `file`（PDF、DOCX、TXT、MD），另传 `answers` 和可选的 `topic`。

接口会读取 `essay_vault` 中状态为 `reviewed` 或 `published` 的评分规则和批改风格，并结合申论向量库返回结构化逐题结果。没有官方评分细则时，接口明确返回估算分，不把模型推测当成官方答案。

答案也可以通过 `POST /api/essay/ocr-image` 逐张上传图片识别。微信小程序会按图片选择顺序合并 OCR 文本，再提交给整套批改接口；单张图片不超过 7MB，最多选择 9 张。

个人小程序无法直接打开手机文件管理器。小程序改为支持材料图片、拍照、粘贴文本和微信聊天文件；PDF/Word 可先发送到文件传输助手，再从聊天文件选择。

整套批改还支持粘贴或上传官方参考答案/分值，并可将批改结果导出为 DOCX 或 PDF。临时上传文件会在启动和上传时清理过期记录。

考生答案为可选项：只提交材料与题目时，接口进入参考模式，生成题型判断、材料要点、参考答案和评分点；提交考生答案后，才进行命中、漏点、失分和修改对照。

## 国考真题库（行政执法卷）

小程序新增「真题」tab，收录 2022–2026 国考申论（行政执法类）五套卷，逐题展示题干、题型、分值、参考作答、评分要点与仿写拆解。

| 端点 | 说明 |
|------|------|
| `GET /api/exam/papers` | 试卷索引（年份、题数、已备答案数、题型集合） |
| `GET /api/exam/papers/<paper_id>` | 单套卷全文与逐题答案 |
| `POST /api/exam/papers/<paper_id>/questions/<qid>/answer` | 生成/读取某题的 AI 参照答案（`force` 可强制重生成） |
| `POST /api/exam/papers/<paper_id>/generate-all` | 后台批量生成整卷答案（202 + 轮询进度） |
| `GET /api/exam/papers/<paper_id>/generate-status` | 查询整卷生成任务进度 |
| `POST /api/exam/imitate` | 仿写示范 / 结构拆解 / 可套用句式，`mode` 三选一 |
| `POST /api/exam/import` | 导入整卷文字或 PDF/Word，AI 拆题入库 |

数据分层存放在 `DATA_DIR/exam_bank/`：内置种子（随镜像 COPY 进 `/data/exam_bank/`）→ `imported/`（用户导入，覆盖种子）→ `answers/`（答案覆盖，只合并答案字段）。三层都会通过 `git_sync_to_github` 增量推回仓库（`jobs/` 任务进度除外），Render 重启后答案与导入卷可恢复。

**答案来源**：国考申论官方从不公布标准答案。页面里的答案按 `answer_kind` 标注 —— `ai` 为「AI 参照答案 · 非官方」（按 `essay_vault` 评分规则生成），`imported` 为用户导入的机构版答案，`official` 保留给真实官方来源。题干与材料带 `verified` 标记，未核对的卷会显示「题干待核对」。
