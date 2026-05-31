# 考公时政知识库 - 免费云部署指南

## 方案：Render.com（完全免费）

### 第一步：安装 Git

1. 下载 Git：https://git-scm.com/download/win
2. 安装时一路默认即可
3. 安装完成后重启终端

### 第二步：注册 GitHub 账号

1. 打开 https://github.com
2. 注册账号（免费）

### 第三步：创建 GitHub 仓库并上传代码

打开 Git Bash（安装Git后桌面右键菜单里有），进入项目目录：

```bash
cd /d/下载/HTML/shizheng_kb

# 初始化仓库
git init
git add .
git commit -m "初始提交：考公时政知识库系统"

# 在 GitHub 上新建一个仓库（名字随意，比如 shizheng-kb）
# 然后执行（把 YOUR_USERNAME 换成你的 GitHub 用户名）：
git remote add origin https://github.com/YOUR_USERNAME/shizheng-kb.git
git branch -M main
git push -u origin main
```

### 第四步：部署到 Render

1. 打开 https://render.com
2. 点击右上角 "Get Started for Free"，用 GitHub 账号登录
3. 点击 "New" → "Web Service"
4. 选择你刚才推送的 GitHub 仓库
5. 配置如下：
   - **Name**: shizheng-kb（或任意名字）
   - **Region**: Singapore（离中国最近）
   - **Branch**: main
   - **Runtime**: Python 3
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `gunicorn server:app --bind 0.0.0.0:$PORT --timeout 120 --workers 2`
   - **Instance Type**: Free

6. 点击 "Advanced" → "Add Environment Variable"，添加：
   - `SILICONFLOW_API_KEY` = `sk-bapmemmmswmycyamlywctomymaievhzmlyznvenqosetlgxa`
   - `DEEPSEEK_API_KEY` = `sk-97ca5455764543a8b57f63f3f9cacfef`
   - `FLASK_DEBUG` = `0`

7. 点击 "Create Web Service"

等待 2-5 分钟构建完成，Render 会给你一个免费域名如：
`https://shizheng-kb.onrender.com`

### 注意事项

**免费版限制：**
- 15分钟无访问会自动休眠，下次访问需等待约30秒唤醒
- 磁盘不持久化：重启/重新部署后上传的PDF和知识库数据会丢失
- 每月750小时免费额度（单服务足够）

**应对方案：**
- 重要的PDF题库JSON可以直接放在代码仓库里（`data/pdf_questions/` 目录）
- 新闻爬取功能需要在本地运行 `daily_news.py`，然后 push 到 GitHub 触发重新部署
- 或者接受每次重启后重新上传PDF

---

## 备选方案：Hugging Face Spaces（持久存储）

如果你需要持久化存储（上传的PDF不丢失），可以用 Hugging Face Spaces：

1. 注册 https://huggingface.co
2. 创建新 Space，选择 Docker 类型
3. 需要额外写一个 Dockerfile（如需要我可以帮你生成）

---

## 本地开发

本地运行不受影响，API Key 已有默认值：
```bash
cd shizheng_kb
pip install -r requirements.txt
python server.py
```
访问 http://localhost:5678
