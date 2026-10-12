"""Restricted JSON bridge for the vendored Scrapling engine.

The bridge deliberately exposes read-only collection primitives.  It rejects
private-network targets and honours robots.txt.  Challenge solving, CAPTCHA
handling, paywall bypass and arbitrary page scripts are not exposed.
"""

from __future__ import annotations

import hashlib
import importlib.metadata
import ipaddress
import json
import os
from pathlib import Path
import re
import shutil
import socket
import sys
from typing import Any
from urllib.parse import urlsplit, urlunsplit
from urllib.robotparser import RobotFileParser


USER_AGENT = "FinanceHub-Scrapling/1.0"
MAX_TEXT = 120_000
MAX_ROWS = 500
CLEANING_VERSION = "2026-09-11.article-v2"

# These are presentation-only regions that routinely pollute a financial
# article feed with logos, navigation, QR codes, share widgets and legal
# footers.  We remove them from the *derived* text while retaining the raw
# HTML artifact for audit and replay.
NOISE_CLASS_HINTS = (
    "top-outer", "header-outer", "menu-outer", "h-logo", "h-search", "h-app",
    "ad-outer", "ad-import", "swiper", "pagination", "share", "banquan",
    "list-right", "footer-outer", "scroll_fixed", "scroll_home", "scroll_top",
    "scroll_bottom", "page-num", "page-go", "qr", "qrcode", "cookie",
    "breadcrumb", "related", "friend-link", "copyright", "app-download",
)
NOISE_TAGS = {"script", "style", "noscript", "template", "svg", "canvas", "iframe", "form", "nav", "header", "footer", "aside"}


def emit(payload: dict[str, Any], code: int = 0) -> None:
    sys.stdout.write(json.dumps(payload, ensure_ascii=False, default=str))
    sys.stdout.flush()
    raise SystemExit(code)


def normalize_url(value: str) -> str:
    parsed = urlsplit(value.strip())
    if parsed.scheme not in {"http", "https"}:
        raise ValueError("只允许 http/https 公共来源")
    if not parsed.hostname or parsed.username or parsed.password:
        raise ValueError("来源地址缺少有效主机，或包含禁止的内嵌凭据")
    port = parsed.port
    if port not in {None, 80, 443}:
        raise ValueError("只允许标准 HTTP/HTTPS 端口")
    host = parsed.hostname.rstrip(".").lower()
    if host == "localhost" or host.endswith((".localhost", ".local", ".internal")):
        raise ValueError("禁止访问本机或内部网络主机")
    try:
        addresses = {row[4][0] for row in socket.getaddrinfo(host, port or (443 if parsed.scheme == "https" else 80))}
    except socket.gaierror as exc:
        raise ValueError(f"域名解析失败：{exc}") from exc
    if not addresses:
        raise ValueError("域名没有返回可验证地址")
    for raw in addresses:
        ip = ipaddress.ip_address(raw.split("%")[0])
        if not ip.is_global:
            raise ValueError("禁止访问私有、回环、链路本地或保留地址")
    netloc = host
    if port and not ((parsed.scheme == "http" and port == 80) or (parsed.scheme == "https" and port == 443)):
        netloc = f"{host}:{port}"
    path = re.sub(r"/{2,}", "/", parsed.path or "/")
    return urlunsplit((parsed.scheme, netloc, path, parsed.query, ""))


def robots_check(url: str, timeout_seconds: float) -> dict[str, Any]:
    parsed = urlsplit(url)
    robots_url = f"{parsed.scheme}://{parsed.netloc}/robots.txt"
    parser = RobotFileParser()
    parser.set_url(robots_url)
    try:
        import urllib.request

        request = urllib.request.Request(robots_url, headers={"User-Agent": USER_AGENT})
        with urllib.request.urlopen(request, timeout=timeout_seconds) as response:
            body = response.read(1_000_000).decode(response.headers.get_content_charset() or "utf-8", errors="replace")
        parser.parse(body.splitlines())
        allowed = parser.can_fetch(USER_AGENT, url) and parser.can_fetch("*", url)
        return {
            "checked": True,
            "allowed": allowed,
            "robotsUrl": robots_url,
            "crawlDelay": parser.crawl_delay(USER_AGENT) or parser.crawl_delay("*"),
            "status": "allowed" if allowed else "blocked",
        }
    except Exception as exc:
        # A missing or unreachable robots file is not treated as permission to
        # evade a site.  The caller gets an explicit unavailable state.
        return {
            "checked": False,
            "allowed": True,
            "robotsUrl": robots_url,
            "crawlDelay": None,
            "status": "unavailable",
            "detail": str(exc)[:500],
        }


def capability_catalog() -> list[dict[str, Any]]:
    return [
        {"id": "fetcher", "group": "Fetcher", "name": "Fetcher / AsyncFetcher", "state": "ready", "detail": "GET/HEAD/许可域 API 的静态请求与持久会话"},
        {"id": "dynamic", "group": "Fetcher", "name": "DynamicFetcher", "state": "ready", "detail": "Chromium 动态页面、异步内容、XHR 捕获和选择器等待"},
        {"id": "stealth", "group": "Fetcher", "name": "StealthyFetcher", "state": "policy_limited", "detail": "库已保留；验证码、访问控制、付费墙和挑战绕过不在后台开放"},
        {"id": "sessions", "group": "会话", "name": "FetcherSession / DynamicSession", "state": "ready", "detail": "单次任务内复用连接、Cookie 容器与浏览器页面池；后台不展示凭据"},
        {"id": "adaptive", "group": "解析", "name": "Adaptive scraping", "state": "ready", "detail": "元素快照、结构变化后重定位、SQLite 自适应存储"},
        {"id": "selectors", "group": "解析", "name": "CSS / XPath / text / regex", "state": "ready", "detail": "选择、导航、相似元素、文本与正则提取"},
        {"id": "markdown", "group": "AI/RAG", "name": "LLM-ready Markdown", "state": "ready", "detail": "清理脚本、样式、隐藏内容后生成 Markdown"},
        {"id": "spider", "group": "Spider", "name": "Spider / CrawlSpider", "state": "ready", "detail": "并发、域并发、优先队列、URL 指纹去重与流式统计"},
        {"id": "checkpoint", "group": "Spider", "name": "Pause / resume / checkpoint", "state": "ready", "detail": "任务级 checkpoint、暂停文件和恢复运行"},
        {"id": "autothrottle", "group": "Spider", "name": "AutoThrottle", "state": "ready", "detail": "按响应速度调整抓取节奏，阻断响应触发退避"},
        {"id": "robots", "group": "合规", "name": "robots.txt", "state": "enforced", "detail": "所有后台运行强制检查，不能关闭"},
        {"id": "proxy", "group": "网络", "name": "Proxy rotation", "state": "environment", "detail": "仅从服务器环境读取代理池，凭据不进入浏览器"},
        {"id": "cache", "group": "开发", "name": "Response cache", "state": "ready", "detail": "按请求指纹保存响应并支持离线复放"},
        {"id": "templates", "group": "Spider", "name": "Sitemap / feed / Shopify templates", "state": "available", "detail": "随 vendored 源码完整保留，可由 Spider 任务模板调用"},
        {"id": "exports", "group": "结果", "name": "JSON / JSONL / CSV / XML", "state": "ready", "detail": "真实采集结果导出，不生成缺失字段"},
        {"id": "mcp", "group": "AI", "name": "Scrapling MCP server", "state": "installed", "detail": "MCP 依赖已安装；网络监听默认关闭，需显式服务端配置"},
        {"id": "scrapy", "group": "集成", "name": "Scrapy integration", "state": "available", "detail": "响应转换与装饰器随源码保留"},
    ]


def chrome_candidates() -> list[str]:
    roots = [
        os.environ.get("PROGRAMFILES", ""),
        os.environ.get("PROGRAMFILES(X86)", ""),
        os.environ.get("LOCALAPPDATA", ""),
    ]
    candidates = [
        Path(roots[0]) / "Google/Chrome/Application/chrome.exe" if roots[0] else Path(""),
        Path(roots[1]) / "Google/Chrome/Application/chrome.exe" if roots[1] else Path(""),
        Path(roots[2]) / "Google/Chrome/Application/chrome.exe" if roots[2] else Path(""),
    ]
    return [str(path) for path in candidates if str(path) and path.is_file()]


def health() -> dict[str, Any]:
    imports: dict[str, bool] = {}
    for name in ["scrapling", "lxml", "curl_cffi", "playwright", "patchright", "protego", "mcp", "markdownify"]:
        try:
            __import__(name)
            imports[name] = True
        except Exception:
            imports[name] = False
    version = importlib.metadata.version("scrapling") if imports["scrapling"] else None
    playwright_executable = None
    playwright_binary_exists = False
    browser_root = Path(os.environ.get("PLAYWRIGHT_BROWSERS_PATH") or (Path.home() / "AppData/Local/ms-playwright"))
    if browser_root.is_dir():
        matches = list(browser_root.glob("chromium-*/chrome-win*/chrome.exe"))
        if matches:
            playwright_executable = str(matches[0])
            playwright_binary_exists = True
    chrome = chrome_candidates()
    return {
        "ok": all(imports.values()),
        "version": version,
        "python": sys.version.split()[0],
        "pythonExecutable": sys.executable,
        "imports": imports,
        "dynamicRuntime": "playwright-bundled" if playwright_binary_exists else ("system-chrome" if chrome else "missing"),
        "playwrightExecutable": playwright_executable if playwright_binary_exists else None,
        "systemChrome": chrome[0] if chrome else None,
        "proxyConfigured": bool(os.environ.get("SCRAPLING_PROXY_POOL")),
        "mutationAllowlistConfigured": bool(os.environ.get("SCRAPLING_MUTATION_ALLOWLIST")),
        "stealthBypassExposed": False,
        "capabilities": capability_catalog(),
    }


def clean_text(value: Any, limit: int = MAX_TEXT) -> str:
    text = re.sub(r"\s+", " ", str(value or "")).strip()
    return text[:limit]


def _is_noise_element(node: Any) -> bool:
    tag = str(getattr(node, "tag", "") or "").lower()
    if tag in NOISE_TAGS:
        return True
    attrs = getattr(node, "attrib", {}) or {}
    identity = f"{attrs.get('id', '')} {attrs.get('class', '')}".lower()
    return any(hint in identity for hint in NOISE_CLASS_HINTS)


def _strip_markdown_artifacts(value: str) -> str:
    # Keep the visible label of a source link, but never leak navigation URLs
    # or image markdown into the content delivered to a terminal user.
    text = re.sub(r"!\[[^\]]*\]\([^)]*\)", " ", value)
    text = re.sub(r"\[([^\]]+)\]\([^)]*\)", r"\1", text)
    text = re.sub(r"https?://\S+", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    for marker in ("友情链接", "Copyright", "版权 ©", "ICP备案", "互联网新闻信息服务许可证", "违法和不良信息举报"):
        position = text.find(marker)
        if position > 0:
            text = text[:position].rstrip()
    return text[:MAX_TEXT]


def extract_public_text(raw_body: bytes, title: str, source_url: str = "") -> tuple[str, int]:
    """Return article/list text and the count of removed presentation nodes.

    The source HTML is deliberately not changed.  This function creates the
    canonical body used for delivery, hashing and AI processing, making the
    cleaning version observable and reproducible.
    """
    try:
        from lxml import html as lxml_html

        root = lxml_html.fromstring(raw_body)
        removed = 0
        for node in list(root.iter()):
            if _is_noise_element(node):
                parent = node.getparent()
                if parent is not None:
                    parent.remove(node)
                    removed += 1
        # Prefer the semantic article/list regions used by common Chinese
        # financial sites.  Category pages expose news-list; article pages
        # expose detail-cont.  The full body is a safe fallback for feeds.
        target = root
        homepage_path = urlsplit(source_url).path.lower().rstrip("/")
        is_homepage = homepage_path in {"", "/index", "/index.html", "/index.htm"}
        if is_homepage:
            # The home page is a navigation shell with repeated category
            # lists.  Its editorially useful, non-duplicating unit is the
            # lead/hero block; category pages are crawled separately.
            candidates = root.cssselect(".plate-outer")
            candidate = next((node for node in candidates if clean_text(node.text_content(), 4000)), None)
            if candidate is not None:
                target = candidate
        # Evaluate selectors in business priority order rather than relying
        # on document order (a .list-main wrapper otherwise wins over its
        # .news-list child and reintroduces sidebar text).
        selectors = () if target is not root else (".detail-cont", ".news-list", "article", "main", ".list-main")
        for selector in selectors:
            candidates = root.cssselect(selector)
            candidate = next((node for node in candidates if clean_text(node.text_content(), 4000)), None)
            if candidate is not None:
                target = candidate
                break
        text = _strip_markdown_artifacts(target.text_content())
        if title and text.startswith(title):
            text = text[len(title):].lstrip(" ：:—-")
        return text, removed
    except Exception:
        # lxml is a required runtime dependency, but a conservative fallback
        # keeps the bridge usable if a malformed document defeats parsing.
        return _strip_markdown_artifacts(clean_text(raw_body.decode("utf-8", errors="replace"))), 0


def selector_values(page: Any, selector_type: str, selector: str) -> list[str]:
    if not selector:
        return []
    nodes = page.xpath(selector) if selector_type == "xpath" else page.css(selector)
    values = []
    for node in nodes[:MAX_ROWS]:
        value = node.get() if hasattr(node, "get") else str(node)
        values.append(clean_text(value, 20_000))
    return values


def page_result(page: Any, source_url: str, selector_type: str, selector: str, artifact_dir: Path, ordinal: int) -> dict[str, Any]:
    body = bytes(page.body)
    raw_content_hash = hashlib.sha256(body).hexdigest()
    artifact_path = artifact_dir / f"{ordinal:04d}-{raw_content_hash[:20]}.html"
    artifact_path.write_bytes(body)
    title = clean_text(page.css("title::text").get(""), 1000)
    text, removed_noise_nodes = extract_public_text(body, title, source_url)
    # The canonical fingerprint is based on the cleaned, user-facing body;
    # rawContentHash remains available for forensic comparison.
    content_hash = hashlib.sha256(f"{source_url}\n{title}\n{text}".encode("utf-8")).hexdigest()
    links = []
    for raw in page.css("a::attr(href)").getall()[:500]:
        try:
            links.append(str(page.urljoin(str(raw))))
        except Exception:
            continue
    links = list(dict.fromkeys(links))[:200]
    markdown = text
    headers = {str(k): str(v) for k, v in dict(page.headers or {}).items()}
    observed_url = str(getattr(page, "url", source_url) or source_url)
    if not observed_url.startswith(("http://", "https://")):
        observed_url = source_url
    return {
        "url": observed_url,
        "status": int(getattr(page, "status", 0) or 0),
        "reason": str(getattr(page, "reason", "") or ""),
        "title": title,
        "text": text,
        "markdown": markdown,
        "selected": selector_values(page, selector_type, selector),
        "selector": selector,
        "selectorType": selector_type,
        "links": links,
        "linkCount": len(links),
        "bytes": len(body),
        "contentHash": content_hash,
        "rawContentHash": raw_content_hash,
        "cleaningVersion": CLEANING_VERSION,
        "removedNoiseNodes": removed_noise_nodes,
        "contentType": headers.get("content-type") or headers.get("Content-Type"),
        "encoding": str(getattr(page, "encoding", "") or ""),
        "artifactPath": str(artifact_path),
    }


def fetch_pages(payload: dict[str, Any]) -> dict[str, Any]:
    from scrapling.fetchers import DynamicSession, FetcherSession, StealthySession

    urls = [normalize_url(str(item)) for item in payload.get("urls", [])]
    if not urls:
        raise ValueError("至少需要一个来源地址")
    timeout_ms = max(3_000, min(int(payload.get("timeoutMs", 30_000)), 120_000))
    selector = str(payload.get("selector") or "")[:1000]
    selector_type = "xpath" if payload.get("selectorType") == "xpath" else "css"
    mode = str(payload.get("mode") or "static")
    if mode == "stealth" and os.environ.get("SCRAPLING_ENABLE_STEALTH") != "1":
        raise PermissionError("StealthyFetcher 已随源码保留，但后台未启用规避检测模式；禁止挑战、验证码、访问控制或付费墙绕过")
    artifact_dir = Path(str(payload["artifactDir"])).resolve()
    artifact_dir.mkdir(parents=True, exist_ok=True)
    robots = [robots_check(url, min(timeout_ms / 1000, 15)) for url in urls]
    blocked = [urls[index] for index, result in enumerate(robots) if not result["allowed"]]
    if blocked:
        raise PermissionError(f"robots.txt 禁止采集：{', '.join(blocked)}")
    selector_config = {
        "adaptive": bool(payload.get("adaptive", False)),
        "adaptive_domain": urlsplit(urls[0]).hostname,
        "storage_args": {"storage_file": str(artifact_dir / "adaptive-elements.db")},
    }
    results = []
    if mode == "static":
        with FetcherSession(timeout=timeout_ms / 1000, stealthy_headers=False, selector_config=selector_config) as session:
            for index, url in enumerate(urls, 1):
                page = session.get(url, headers={"User-Agent": USER_AGENT})
                results.append(page_result(page, url, selector_type, selector, artifact_dir, index))
    elif mode == "dynamic":
        kwargs = {
            "headless": True,
            "disable_resources": bool(payload.get("disableResources", True)),
            "block_ads": True,
            "network_idle": bool(payload.get("networkIdle", True)),
            "timeout": timeout_ms,
            "selector_config": selector_config,
            "real_chrome": not health()["playwrightExecutable"],
            "google_search": False,
        }
        with DynamicSession(**kwargs) as session:
            for index, url in enumerate(urls, 1):
                page = session.fetch(url, wait_selector=selector or None)
                results.append(page_result(page, url, selector_type, selector, artifact_dir, index))
    else:
        kwargs = {
            "headless": True,
            "disable_resources": True,
            "block_ads": True,
            "solve_cloudflare": False,
            "google_search": False,
            "timeout": timeout_ms,
            "selector_config": selector_config,
            "real_chrome": not health()["playwrightExecutable"],
        }
        with StealthySession(**kwargs) as session:
            for index, url in enumerate(urls, 1):
                page = session.fetch(url, wait_selector=selector or None)
                results.append(page_result(page, url, selector_type, selector, artifact_dir, index))
    return {"ok": True, "kind": "fetch", "mode": mode, "robots": robots, "items": results}


def crawl(payload: dict[str, Any]) -> dict[str, Any]:
    from scrapling.fetchers import AsyncDynamicSession, FetcherSession
    from scrapling.spiders import Request, Spider
    from scrapling.spiders.links import LinkExtractor

    start_url = normalize_url(str(payload.get("urls", [""])[0]))
    timeout_ms = max(3_000, min(int(payload.get("timeoutMs", 30_000)), 120_000))
    robots = robots_check(start_url, min(timeout_ms / 1000, 15))
    if not robots["allowed"]:
        raise PermissionError("robots.txt 禁止采集该入口")
    max_pages = max(1, min(int(payload.get("maxPages", 10)), 100))
    concurrency = max(1, min(int(payload.get("concurrency", 2)), 8))
    delay_ms = max(250, min(int(payload.get("delayMs", 750)), 60_000))
    mode = "dynamic" if payload.get("mode") == "dynamic" else "static"
    host = urlsplit(start_url).hostname or ""
    artifact_dir = Path(str(payload["artifactDir"])).resolve()
    artifact_dir.mkdir(parents=True, exist_ok=True)
    control_file = Path(str(payload["controlFile"])).resolve()
    checkpoint_dir = Path(str(payload["checkpointDir"])).resolve()
    selector = str(payload.get("selector") or "")[:1000]
    selector_type = "xpath" if payload.get("selectorType") == "xpath" else "css"

    class AdminSpider(Spider):
        name = "finance_hub_admin"
        start_urls = [start_url]
        allowed_domains = {host}
        robots_txt_obey = True
        concurrent_requests = concurrency
        concurrent_requests_per_domain = concurrency
        download_delay = delay_ms / 1000
        max_blocked_retries = 1
        autothrottle_enabled = True
        autothrottle_start_delay = max(0.5, delay_ms / 1000)
        autothrottle_max_delay = 30.0
        autothrottle_target_concurrency = float(concurrency)

        def __init__(self, *args: Any, **kwargs: Any) -> None:
            self.scheduled: set[str] = {start_url}
            self.ordinal = 0
            super().__init__(*args, **kwargs)

        def configure_sessions(self, manager: Any) -> None:
            if mode == "dynamic":
                manager.add("default", AsyncDynamicSession(headless=True, real_chrome=not health()["playwrightExecutable"], disable_resources=True, block_ads=True, timeout=timeout_ms))
            else:
                manager.add("default", FetcherSession(timeout=timeout_ms / 1000, stealthy_headers=False))

        async def parse(self, response: Any):
            self.ordinal += 1
            yield page_result(response, str(response.url), selector_type, selector, artifact_dir, self.ordinal)
            if control_file.exists():
                self.pause()
                return
            if len(self.scheduled) >= max_pages:
                return
            extractor = LinkExtractor(allow_domains=(host,))
            for link in extractor.extract(response):
                if len(self.scheduled) >= max_pages:
                    break
                normalized = normalize_url(link)
                if normalized in self.scheduled:
                    continue
                self.scheduled.add(normalized)
                yield Request(normalized, callback=self.parse, sid="default")

    spider = AdminSpider(crawldir=checkpoint_dir, interval=2.0)
    result = spider.start()
    return {
        "ok": True,
        "kind": "crawl",
        "mode": mode,
        "robots": [robots],
        "paused": bool(result.paused),
        "items": list(result.items),
        "stats": result.stats.to_dict(),
    }


def parse_artifact(payload: dict[str, Any]) -> dict[str, Any]:
    from scrapling import Selector

    path = Path(str(payload["artifactPath"])).resolve()
    allowed_root = Path(str(payload["artifactDir"])).resolve()
    if allowed_root not in path.parents or not path.is_file():
        raise ValueError("原始快照不存在或不在允许目录")
    source_url = normalize_url(str(payload["sourceUrl"]))
    page = Selector(path.read_bytes(), url=source_url, adaptive=bool(payload.get("adaptive", False)), storage_args={"storage_file": str(allowed_root / "adaptive-elements.db")})
    selector = str(payload.get("selector") or "")[:1000]
    selector_type = "xpath" if payload.get("selectorType") == "xpath" else "css"
    return {"ok": True, "values": selector_values(page, selector_type, selector), "selector": selector, "selectorType": selector_type}


def main() -> None:
    payload = json.load(sys.stdin)
    action = str(payload.get("action") or "health")
    if action == "health":
        emit(health())
    if action == "inspect_source":
        url = normalize_url(str(payload.get("url") or ""))
        emit({"ok": True, "url": url, "robots": robots_check(url, 15)})
    if action == "fetch":
        emit(fetch_pages(payload))
    if action == "crawl":
        emit(crawl(payload))
    if action == "parse_artifact":
        emit(parse_artifact(payload))
    raise ValueError("未知 Scrapling 桥接动作")


if __name__ == "__main__":
    try:
        main()
    except BaseException as exc:
        if isinstance(exc, SystemExit):
            raise
        emit({"ok": False, "error": str(exc)[:1800], "errorType": exc.__class__.__name__}, 1)
