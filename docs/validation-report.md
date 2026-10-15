# Persona Overlay Lite v1 驗收紀錄

驗收日期：2026-10-15  
環境：SillyTavern 1.18.0、Tavern Helper 4.9.3、Windows／Chromium；行動版以 390 × 844 viewport 模擬。

## 已完成

- `npm run check`：TypeScript、14 項 Node 測試、production build 全部通過。
- 本機 Tavern Helper 匯入成功，`#extensionsMenu` 只有一個 Lite 入口，singleton 面板只有一份 DOM。
- 實測桌面雙欄為 `477.5px / 345.795px`，文字方向為 `horizontal-tb`。
- 實測 390 × 844 為底部面板，可開啟、讀取欄位、切聊天與關閉；並修正 ST 行動版全域樣式造成 fixed backdrop 高度為 0 的相容問題。
- 面板開啟時，實測 A → B → A；聊天標題與各聊天 nickname 都跟著切換，面板 instance 數仍為 1。
- 實測讀到既有 `chatMetadata.user_persona_overlay`（聊天 A nickname 為「測試暱稱」），沒有搬移或轉換資料。
- 實測目前 Persona 為「測試 Persona」，Helper Persona API 與 `powerUserSettings` 三項生效設定一致；面板顯示 Prompt / Depth 2 / System。
- 完整版 Extension 與 Lite 同時載入時，Lite 會顯示共用 prompt ID 的提示；原 Extension 工作目錄保持未修改。
- Lite 來源沒有 `MutationObserver`、`setInterval`、跨聊天 API 或全聊天掃描。
- Console 篩選 `persona-overlay-lite` 後沒有 error／warning。

## 自動化覆蓋

- enabled=false、空 content 不注入。
- IN_PROMPT 與 AT_DEPTH / depth / role 映射。
- 無法鏡像的位置使用聊天 fallback。
- Helper API 與 powerUserSettings 的一致性判斷。
- 既有 library、undo、applied template schema。
- 模板追加、安全撤銷。
- 生成前 flush 300ms debounce，再刷新注入。
- 固定使用 `user_persona_overlay` prompt ID 與既有 metadata / localStorage keys。

## 無法在此環境完成的實機項目

- 本機沒有 iOS Safari；已完成相同窄螢幕 viewport 的開啟、讀取與關閉驗收，但不宣稱 Safari 實機通過。
- 本機目前未連線模型 API，因此沒有送出付費生成，也沒有取得生成後 Prompt Inspector 截圖；同一 prompt ID 與生成前 flush 由契約測試及來源檢查驗證。
- 此瀏覽器的既有 Persona Library 為空；直接讀取既有 key 與 schema 由程式碼及測試驗證，沒有可供畫面比對的舊項目。

## Extension 記錄

完整版的 `bindFloatingIconDrag()` 使用 pointer capture。已知 iOS Safari 可能有拖曳失效風險；Lite v1 沒有 floating icon，因此不受影響。依施工單，本次不修改完整版 Extension。
