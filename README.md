# 鑊仔食譜

卡通藍綠色家庭食譜 App（廣東話介面）：記食譜、購物清單、餐單加菜同搭配、推薦、圖表、廚房工具、全家同步。

## 檔案

| 位置 | 用途 |
|---|---|
| `site/` | 獨立網頁版（唔使 Claude），Netlify 部署呢個資料夾 |
| `claude/wokzai-recipes.html` | Claude 版（有 AI 功能），對應 claude.ai 上面嘅 Artifact |
| `src/` | 原始碼；改完跑 `src/build.sh` 就會更新上面兩個版本 |
| `tests/` | 測試用嘅模擬資料庫 |
| `site/使用說明.txt` | 放上網、Firebase 家庭同步、分享碼、備份嘅詳細步驟 |

## 自動更新網站（Netlify 連 GitHub）

1. 登入 Netlify → Add new project → Import an existing project → GitHub。
2. 授權 Netlify 讀取呢個 repo（private repo 都得）。
3. 揀呢個 repo，設定已經寫喺 `netlify.toml`（publish 資料夾係 `site`），直接 Deploy。
4. 之後每次有新 commit push 上 GitHub，網站會自動更新；手機開返個 App 就係新版本。

## 私隱

- 呢個 repo 設為 **Private**，唔好改成 Public。
- Firebase 設定同家庭邀請碼**唔會**存入 repo，只存喺各人手機嘅瀏覽器。
- 家庭資料存喺你自己嘅 Firebase 專案（或者 Claude），唔喺 GitHub。
