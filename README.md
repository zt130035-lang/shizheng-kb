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

## 云端部署（Render.com）

### 环境变量

| 变量 | 说明 | 必填 |
|------|------|------|
| `DEEPSEEK_API_KEY` | DeepSeek API 密钥 | ✅ |
| `SILICONFLOW_API_KEY` | SiliconFlow 嵌入 API 密钥 | ✅ |
| `GITHUB_TOKEN` | GitHub Personal Access Token（数据自动同步） | ✅ |
| `GITHUB_REPO` | GitHub 仓库（默认 zt130035-lang/shizheng-kb） | ❌ |
| `BARK_DEVICE_KEY` | Bark 推送设备 Key | ❌ |
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

小程序选择整套试卷时提供“手机本地文件”和“微信聊天文件”两种入口。手机本地文件通过 `/mobile-upload` 网页选择器上传解析，再以短期 `paper_id` 交给整套批改接口，临时记录保留约 30 分钟。
