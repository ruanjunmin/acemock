# AceMock - 智能 AI 模拟考试与备考平台 🚀

[![Gemini](https://img.shields.io/badge/Powered%20by-Gemini%203.0%20Flash-blue?logo=google-gemini)](https://ai.google.dev/)
[![React](https://img.shields.io/badge/React-19.0-61DAFB?logo=react)](https://react.dev/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

**AceMock** 是一款专为学生和专业人士设计的全能型 AI 考试辅助平台。通过集成最新的 **Google Gemini API**，它可以将复杂的学习资料（PDF, Word, Excel, 图片）瞬间转化为结构化的模拟试卷、思维导图和背诵卡片。

> **核心使命**：让每一份枯燥的讲义都变成互动的考场，通过 AI 的深度解析与联网补全，消除知识盲点。

---

## ✨ 核心功能

### 1. 📄 多格式智能解析
- **深度提取**：支持 PDF、Word (.docx)、Excel (.xlsx)、Markdown、文本及图片。
- **本地解析**：使用 `mammoth.js` 和 `xlsx` 在前端实现解析，保护隐私，响应迅速。

### 2. 🤖 “复印机式”出题引擎
- **10 种专业题型**：单选、多选、判断、填空、连线、排序、名词解释、简答题、案例鉴析及抽认卡。
- **原文还原**：AI 优先提取文档中的既有习题（1:1 还原），并根据知识点生成补充练习。
- **智能去重**：内置三层模糊匹配算法，确保生成的题目不重复、无幻觉。

### 3. 🌐 智能联网补全 (Grounded Search)
- **按需检索**：当文档答案标注为“略”或“见教材”时，系统会自动提取关键词。
- **题型过滤逻辑**：**（独创）** 仅针对用户选中的题型进行联网补全。例如，如果您只选了选择题，AI 会智能忽略简答题的缺失内容，从而优化搜索速度与准确度。
- **多引擎支持**：集成 Google Native Search, Tavily AI, 百度, Serper.dev。

### 4. 🧠 学习中心 (Study Guide)
- **思维导图**：基于 **ECharts** 生成动态交互式脑图。
- **考点卡片 (Flashcards)**：自动提取至少 18 个核心概念，支持滑动背诵。
- **结构化笔记**：将长文档一键压缩为 Markdown 格式的考纲。

### 5. 🎧 TTS 语音伴读
- 集成 **Gemini 2.5 TTS** 原生音频模型。
- 支持 5 种不同风格的音色（Kore, Puck, Charon, Fenrir, Zephyr），并可调节语速与音量。

---

## 🚀 技术优势

*   **高性能分片 (Task Sharding)**：自研分片逻辑，支持并行/串行批次生成，解决长文本超时问题，支持一次性生成 60+ 道题目。
*   **隐私保护 (Local-First)**：所有文档数据仅在本地处理，考试历史与错题本存储于浏览器 **IndexedDB**，数据不出本地。
*   **AI 深度评分**：针对主观题（简答、鉴析），AI 提供 0-100 评分、改进建议及知识点解析。
*   **零后端架构**：纯前端实现，通过 API 直接与大模型交互，易于部署。

---

## 🛠️ 安装与运行

### 1. 克隆仓库
```bash
git clone https://github.com/your-username/acemock.git
cd acemock
```

### 2. 配置 API Key
在运行前，请确保您拥有有效且支持 Gemini 3.0 系列模型的 **Google AI Studio API Key**。

### 3. 环境要求
项目采用 ES 模块化开发，建议使用现代浏览器。

### 4. 运行
由于项目是基于 React + Tailwind 的单页应用，您可以使用任何静态服务器打开 `index.html`。
```bash
# 例如使用 python
python -m http.server 8000
```

---

## 📸 界面预览

- **仪表盘**：多维能力雷达图，分析您的记忆力、逻辑力与应用力。
- **出题配置**：高度自定义的参数调整面板。
- **答疑模式**：随时呼唤 AI 助教，通过联网搜索解答试卷外的知识。

---

## 🤝 贡献
欢迎提交 Issue 或 Pull Request 来改进 AceMock！

## 📄 许可证
本项目采用 [MIT License](LICENSE) 许可。

---

*Made with ❤️ and Gemini AI.*