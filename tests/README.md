# 測試

全部用 Playwright + Chrome 跑（`python3 tests/xxx.py`），有啲要先喺 `standalone/` 開 `python3 -m http.server 8765`。

| 檔案 | 測試內容 |
|---|---|
| full-click-test.py | 逐個掣撳一次，包括模擬 AI 同惡意分享碼 |
| monkey-random-test.py | 隨機撳 600 次、打亂碼，檢查冇錯誤、資料一致 |
| two-devices-test.py | 兩部機同時改嘢、重複加材料、返回鍵 |
| undo-retry-test.py | 兩部機時復原只還原自己嘅改動、網絡斷咗自動再試 |
| date-edge-test.py | 跨年、星期日、閏年、月尾、過咗午夜 |
| accessibility-test.py | 掣名、標籤、重複 id、細掣 |
| fuzz-test.py | 6000 個壞資料（AI 回覆、分享碼、雲端資料） |
| performance-test.py | 120 張相片食譜嘅速度 |
| storage-undo-network-test.py | 儲存容量、復原、封鎖網絡、細屏 |
| simplified-backup-prune-test.py | 簡體字、備份下載、清舊資料 |
| claude-family-test.py / local-firebase-test.py / demo-clear-test.py / basic-test.py | 各種模式 |

測試用嘅模擬資料庫喺 `mock-*.js`。
