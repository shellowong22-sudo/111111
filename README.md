# 鑊仔食譜

**網址：https://shellowong22-sudo.github.io/wokzai-app/**（iPhone 用 Safari 開 →「分享」→「加入主畫面」）

卡通藍綠色家庭食譜 App（廣東話介面）：記食譜、購物清單、餐單加菜同搭配、推薦、圖表、廚房工具、全家同步。

## 檔案

| 位置 | 用途 |
|---|---|
| `docs/` | 獨立網頁版（唔使 Claude），GitHub Pages 或者 Netlify 部署呢個資料夾 |
| `claude/wokzai-recipes.html` | Claude 版（有 AI 功能），對應 claude.ai 上面嘅 Artifact |
| `src/` | 原始碼；改完跑 `src/build.sh` 就會更新上面兩個版本 |
| `tests/` | 測試用嘅模擬資料庫 |
| `docs/使用說明.txt` | 放上網、Firebase 家庭同步、分享碼、備份嘅詳細步驟 |

## 自動更新網站

### 方法 A：GitHub Pages（repo 要係 Public）

1. 喺 GitHub 打開呢個 repo → Settings → Pages。
2. Source 揀「Deploy from a branch」，Branch 揀 `main`，資料夾揀 `/docs`，撳 Save。
3. 一兩分鐘後會有網址：`https://<帳戶名>.github.io/<repo 名>/`。
4. 之後每次 push，網站自動更新。

repo 入面只有 App 程式，冇任何屋企資料，所以 Public 都唔會洩露你嘅清單同餐單。

### 方法 B：Netlify 連 GitHub（Private repo 都得）

1. 登入 Netlify → Add new project → Import an existing project → GitHub。
2. 授權 Netlify 讀取呢個 repo（private repo 都得）。
3. 揀呢個 repo，設定已經寫喺 `netlify.toml`（publish 資料夾係 `docs`），直接 Deploy。
4. 之後每次有新 commit push 上 GitHub，網站會自動更新；手機開返個 App 就係新版本。

## 私隱

- repo 入面**冇**任何屋企資料：清單、餐單、雪櫃、食譜全部存喺各人手機、你自己嘅 Firebase 或者 Claude。
- Firebase 設定同家庭邀請碼**唔會**存入 repo，只存喺各人手機嘅瀏覽器。
- 家庭資料存喺你自己嘅 Firebase 專案（或者 Claude），唔喺 GitHub。
