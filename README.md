<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/1OJDsVa8Qmy8BWSfsiKXuvYSq2JzbiE0e

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`


核心需求重新定义
App 核心价值：拍照 → 看营养 → 记录追踪

极简设计原则：

一个核心动作 - 拍照分析
三个主要页面 - 首页(拍照+今日)、历史、设置
信息层级清晰 - 卡路里最突出，其他营养次之