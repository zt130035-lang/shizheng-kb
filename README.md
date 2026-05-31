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
| 新闻归档 | 按日期浏览爬取的时政新闻全文 |
| 每日日报 | 查看 AI 生成的考点日报和周报 |
| 知识查询 | 输入问题，语义搜索向量知识库 |
| PDF做题 | 导入PDF → 提取/AI出题 → 答题 → AI解析 |
| 知识库管理 | 创建/删除知识库，上传文本入库 |

## 本地运行

```bash
pip install -r requirements.txt
python server.py
```

浏览器打开 http://localhost:5678

## 云端部署

本项目支持 Hugging Face Spaces (Docker) 部署，详见 DEPLOY.md。
