#!/bin/bash
# 由 src/ 砌出兩個版本：claude/（Claude 入面用）同 site/（獨立網頁，Netlify 部署）
set -e
cd "$(dirname "$0")"
TMP="$(mktemp --suffix=.js)"
cat icons.js data.js app1.js app2.js sync.js > "$TMP"
node --check "$TMP"
{ cat head.html; echo '<script>'; cat "$TMP"; echo '</script>'; echo '</body>'; echo '</html>'; } > ../claude/wokzai-recipes.html
python3 - "$TMP" <<'PY'
import sys
s = open('head.html', encoding='utf-8').read()
extra = '''<link rel="manifest" href="manifest.webmanifest">
<link rel="icon" type="image/png" sizes="192x192" href="icon-192.png">
<link rel="apple-touch-icon" href="icon-180.png">
<meta name="theme-color" content="#15a596">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="鑊仔食譜">
<meta name="apple-mobile-web-app-status-bar-style" content="default">
'''
s = s.replace('<title>鑊仔食譜</title>\n', '<title>鑊仔食譜</title>\n' + extra, 1)
js = open(sys.argv[1], encoding='utf-8').read()
open('../site/index.html', 'w', encoding='utf-8').write(s + '<script>window.WZ_STANDALONE=true;</script>\n<script>\n' + js + '\n</script>\n</body>\n</html>\n')
PY
rm -f "$TMP"
echo "砌好：claude/wokzai-recipes.html、site/index.html"
