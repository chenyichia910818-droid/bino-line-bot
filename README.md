# 比諾 HRV LINE 智慧客服

## 本機啟動

1. 安裝 Node.js 20+。
2. 在此資料夾執行 `npm install`。
3. 複製 `.env.example` 為 `.env`，填入 LINE Messaging API 的 Channel secret、Channel access token，以及林芳誼的 `LINE_STAFF_USER_ID`。
4. 執行 `npm start`。
5. 將公開 HTTPS 網址加上 `/webhook`，填入 LINE Developers 的 Webhook URL，並啟用 webhook。

## 行為

- 已知的設備問題由受控知識庫回答，不會呼叫生成式 AI。
- 其他問題在設定 `OPENAI_API_KEY` 時，交由 OpenAI Responses API 在嚴格醫療安全指示下產生回答。
- 無法回答時，系統回覆診所端「已建立客服案件」，並推送案件摘要給林芳誼。
- API 回應設定 `store: false`；正式上線仍應由公司確認資料保存、隱私、存取權限與醫療資料流程。

## 重要設定

LINE 不支援把官方帳號對話「自動切換」成個人帳號對話。林芳誼應先與官方帳號建立可接收訊息的關係，取得她的 `LINE_STAFF_USER_ID`，由系統通知後在原官方帳號對話中接手回覆。
