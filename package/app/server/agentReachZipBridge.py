"""Bounded, read-only bridge to the vendored Agent Reach channel code.

This file is called only by the server with a fixed action and one bounded
argument. No arbitrary Python code, browser cookie extraction or login action
is exposed through the admin API.
"""

import json
import html
import os
import re
import shutil
import subprocess
import sys
from pathlib import Path
from urllib.parse import quote

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "vendor" / "Agent-Reach" / "Agent-Reach-main"))


def success(items, source):
    print(json.dumps({"ok": True, "source": source, "items": items}, ensure_ascii=False))


def failure(code):
    print(json.dumps({"ok": False, "error": code}, ensure_ascii=False))


def clean(value, limit=20000):
    text = re.sub(r"<(?:script|style)\b[^>]*>[\s\S]*?</(?:script|style)>", " ", str(value or ""), flags=re.I)
    text = html.unescape(re.sub(r"<[^>]*>", " ", text))
    return re.sub(r"\s+", " ", text).strip()[:limit]


def xueqiu(action, value):
    from agent_reach.channels.xueqiu import XueqiuChannel, _get_json

    channel = XueqiuChannel()
    if action == "xueqiu-search":
        stocks = channel.search_stock(value, limit=12)
        items = []
        for stock in stocks:
            symbol = clean(stock.get("symbol"), 32)
            if not re.fullmatch(r"[A-Za-z0-9.]{1,24}", symbol):
                continue
            items.append({
                "title": clean(stock.get("name") or symbol, 180),
                "url": f"https://xueqiu.com/S/{symbol}",
                "summary": f"股票代码：{symbol}；交易市场：{clean(stock.get('exchange'), 60)}",
                "content": f"雪球股票搜索：{clean(stock.get('name') or symbol, 180)}；股票代码：{symbol}；交易市场：{clean(stock.get('exchange'), 60)}",
                "fields": {"symbol": symbol, "exchange": clean(stock.get("exchange"), 60)},
            })
        success(items, "雪球股票搜索 / Agent Reach")
    elif action == "xueqiu-quote":
        if not re.fullmatch(r"[A-Za-z0-9.]{1,24}", value):
            failure("XUEQIU_INVALID_SYMBOL")
            return
        quote = channel.get_stock_quote(value)
        if quote.get("current") is None or not quote.get("symbol"):
            failure("XUEQIU_QUOTE_EMPTY")
            return
        fields = {key: quote.get(key) for key in (
            "symbol", "name", "current", "percent", "chg", "high", "low",
            "open", "last_close", "volume", "amount", "market_capital",
            "turnover_rate", "pe_ttm", "pe_forecast", "pb", "eps", "timestamp",
        )}
        summary = "；".join(f"{key}：{val}" for key, val in fields.items() if val is not None)
        success([{
            "title": clean(f"{fields['name'] or value} · {fields['symbol']}", 180),
            "url": f"https://xueqiu.com/S/{fields['symbol']}",
            "summary": summary[:2000],
            "content": summary,
            "fields": fields,
        }], "雪球股票行情 / Agent Reach")
    elif action == "xueqiu-hot-stocks":
        stocks = channel.get_hot_stocks(limit=12)
        items = []
        for stock in stocks:
            symbol = clean(stock.get("symbol"), 32)
            if not re.fullmatch(r"[A-Za-z0-9.]{1,24}", symbol):
                continue
            summary = f"人气排名 {stock.get('rank')}；最新 {stock.get('current')}；涨跌幅 {stock.get('percent')}"
            items.append({
                "title": clean(f"{stock.get('name') or symbol} · {symbol}", 180),
                "url": f"https://xueqiu.com/S/{symbol}",
                "summary": summary,
                "content": f"雪球股票热榜 {summary}；股票代码 {symbol}",
                "fields": stock,
            })
        success(items, "雪球热股榜 / Agent Reach")
    elif action == "xueqiu-hot-posts":
        # The ZIP's get_hot_posts method truncates text to 200 chars. Read
        # its underlying public timeline with the ZIP's cookie-aware helper
        # so the ingestion pipeline can clean the full post body instead.
        feed = _get_json("https://xueqiu.com/v4/statuses/public_timeline_by_category.json"
                         "?since_id=-1&max_id=-1&count=10&category=-1")
        items = []
        for record in (feed.get("list") or [])[:10]:
            try:
                post = json.loads(record["data"]) if isinstance(record.get("data"), str) else record.get("data") or {}
            except (ValueError, KeyError):
                continue
            post_id = str(post.get("id") or "")
            if not post_id.isdigit():
                continue
            body = clean(post.get("text") or post.get("description"))
            if not body:
                continue
            title = clean(post.get("title") or body[:90], 180)
            target = str(post.get("target") or "")
            if not re.fullmatch(r"/[A-Za-z0-9/_-]{1,180}", target):
                continue
            items.append({
                "title": title,
                "url": f"https://xueqiu.com{target}",
                "summary": body[:2000],
                "content": body,
                "fields": {"author": clean((post.get("user") or {}).get("screen_name"), 80),
                           "likes": post.get("like_count"), "id": post_id},
            })
        success(items, "雪球热门帖子 / Agent Reach")


def xiaohongshu_search(value):
    import yaml
    from agent_reach.channels.xiaohongshu import format_xhs_result

    binary = shutil.which("opencli")
    if binary is None:
        failure("XHS_OPENCLI_NOT_INSTALLED")
        return
    command = [binary]
    if Path(binary).suffix.lower() in {".bat", ".cmd", ".ps1"}:
        # npm on Windows creates shell shims. Never run those with a shell or
        # accept arbitrary shim paths: only the verified installed npm entry
        # can be executed by Node directly.
        app_data = os.environ.get("APPDATA", "")
        entry = Path(app_data) / "npm" / "node_modules" / "@jackwener" / "opencli" / "dist" / "src" / "main.js"
        node = shutil.which("node")
        if not app_data or not entry.is_file() or not node:
            failure("XHS_OPENCLI_ENTRY_NOT_FOUND")
            return
        command = [node, str(entry)]
    # OpenCLI uses only the user's existing, explicitly controlled Chrome
    # session. This bridge neither reads nor imports cookies.
    result = subprocess.run(
        [*command, "xiaohongshu", "search", value, "-f", "yaml"],
        capture_output=True, text=True, timeout=25, check=False,
    )
    if result.returncode != 0:
        failure("XHS_LOGIN_OR_UPSTREAM_UNAVAILABLE")
        return
    raw = yaml.safe_load(result.stdout[:500000])
    payload = format_xhs_result(raw)
    notes = payload if isinstance(payload, list) else [payload]
    raw_items = raw.get("items") or (raw.get("data") or {}).get("items") or [] if isinstance(raw, dict) else []
    items = []
    for index, note in enumerate(notes[:12]):
        if not isinstance(note, dict):
            continue
        original = raw_items[index] if index < len(raw_items) and isinstance(raw_items[index], dict) else {}
        note_id = str(note.get("id") or note.get("note_id") or original.get("id") or "")
        if not re.fullmatch(r"[0-9a-fA-F]{12,32}", note_id):
            continue
        token = str(note.get("xsec_token") or original.get("xsec_token") or "")
        if not token or len(token) > 512:
            continue
        title = clean(note.get("title") or note.get("desc") or note_id, 180)
        body = clean(note.get("desc") or note.get("content"))
        if not body:
            continue
        fields = {
            "author": (note.get("user") or {}).get("nickname", ""),
            "likes": note.get("liked_count"),
            "comments": note.get("comment_count"),
            "collected": note.get("collected_count"),
            "tags": note.get("tags") or [],
        }
        items.append({
            "title": title,
            "url": f"https://www.xiaohongshu.com/explore/{note_id}?xsec_token={quote(token, safe='')}&xsec_source=pc_search",
            "summary": body[:2000],
            "content": body,
            "fields": fields,
        })
    success(items, "小红书笔记 / Agent Reach OpenCLI")


def main():
    if len(sys.argv) != 3:
        failure("INVALID_ARGUMENTS")
        return
    action, value = sys.argv[1:]
    if action == "xueqiu-probe":
        from agent_reach.channels.xueqiu import XueqiuChannel
        state, _ = XueqiuChannel().check()
        if state == "ok":
            success([], "雪球行情接口已返回真实报价")
        else:
            failure("XUEQIU_AUTH_REQUIRED_OR_UPSTREAM_UNAVAILABLE")
    elif action in {"xueqiu-search", "xueqiu-quote", "xueqiu-hot-posts", "xueqiu-hot-stocks"}:
        xueqiu(action, value)
    elif action == "xiaohongshu-search":
        xiaohongshu_search(value)
    else:
        failure("UNSUPPORTED_ACTION")


if __name__ == "__main__":
    try:
        main()
    except subprocess.TimeoutExpired:
        failure("UPSTREAM_TIMEOUT")
    except Exception as exc:
        # Do not leak upstream response bodies or cookie contents to browser.
        failure("UPSTREAM_HTTP_" + str(exc.code) if hasattr(exc, "code") else "UPSTREAM_UNAVAILABLE")
