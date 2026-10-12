# Admin provider and LLM browser verification

- Verified at: 2026-09-12 14:03-14:06 Asia/Shanghai
- Reverified after production rebuild and process restart: 2026-09-12 14:27-14:29 Asia/Shanghai
- Runtime: `http://localhost:4173`
- Method: actual in-app browser navigation, tab selection, button activation, full-page downward navigation, accessibility-tree inspection, and visual screenshot inspection.

## AI data ingestion

1. Opened `/admin/data-ingestion` in the running production preview.
2. Activated the `工具箱` tab rather than inferring its contents from source code.
3. Navigated to the bottom of the page and visually inspected the provider table and configuration form.
4. Confirmed eight rows are visible with distinct access and latency boundaries:
   - Stooq public CSV: public/no key; end-of-day.
   - FRED public CSV: public/no key; latest public release.
   - ECB Data Portal EXR: public/no key; official reference.
   - NY Fed Markets API: public/no key; latest public release.
   - SEC EDGAR Company Facts: public/no key; latest public release.
   - World Bank Indicators API: public/no key; latest public release.
   - Twelve Data: free quota/key; `未配置 TWELVE_DATA_API_KEY`.
   - Alpha Vantage: free quota/key; `未配置 ALPHA_VANTAGE_API_KEY`.
5. Confirmed the page does not label the two unconfigured keyed providers as available and does not display any credential value.

## AI management

1. Opened `/admin/ai-management` in the same running production preview.
2. Activated the `模型状态` tab and navigated to the bottom of the model list.
3. Confirmed OpenAI, Anthropic Claude, DeepSeek, xAI Grok, Manus, and Google Gemini catalog entries are marked `待配置`, with text stating that an unconfigured interface or key is not considered online.
4. Confirmed the separately named Finance Hub local orchestrators are marked `在线`; these are not presented as authenticated remote vendor models.
5. Confirmed the quality-evaluation summary remains `尚未建立可验证评测基线` rather than displaying a fabricated score.

## Result

- PASS: provider catalog and credential-state UI match the runtime adapter boundaries.
- PASS: remote LLM catalog entries remain unavailable without external configuration.
- PASS: the page distinguishes local orchestration from remote vendor model access.
- EXTERNAL BLOCKER: licensed or account-scoped calls for Twelve Data, Alpha Vantage, and remote LLM vendors cannot be executed until the user supplies valid credentials and confirms the applicable data/model license.
