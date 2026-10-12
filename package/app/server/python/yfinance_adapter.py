"""Small JSON bridge for the community yfinance package.

The TypeScript server owns validation, persistence and delivery.  This process
only translates one yfinance history request into JSON written to stdout.
"""

from __future__ import annotations

import argparse
import json
import math
import sys
from typing import Any

import yfinance as yf


def finite_or_none(value: Any) -> float | None:
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    return number if math.isfinite(number) else None


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--symbol", required=True)
    parser.add_argument("--period", required=True)
    parser.add_argument("--interval", required=True)
    args = parser.parse_args()

    symbol = args.symbol.strip().upper()
    if not symbol or len(symbol) > 32:
        raise ValueError("INVALID_SYMBOL")

    ticker = yf.Ticker(symbol)
    frame = ticker.history(
        period=args.period,
        interval=args.interval,
        auto_adjust=False,
        actions=False,
        timeout=12,
        raise_errors=True,
    )
    history: list[dict[str, Any]] = []
    for index, row in frame.iterrows():
        close = finite_or_none(row.get("Close"))
        if close is None:
            continue
        volume = finite_or_none(row.get("Volume"))
        # Keep the exact instant for intraday bars. Daily bars remain
        # YYYY-MM-DD so existing daily consumers keep their stable contract.
        timestamp = index.isoformat()
        intraday_intervals = {"1m", "2m", "5m", "15m", "30m", "60m", "90m", "1h"}
        point_date = timestamp if args.interval in intraday_intervals else index.date().isoformat()
        history.append(
            {
                "date": point_date,
                "open": finite_or_none(row.get("Open")),
                "high": finite_or_none(row.get("High")),
                "low": finite_or_none(row.get("Low")),
                "close": close,
                "volume": int(volume) if volume is not None else None,
            }
        )

    if not history:
        raise RuntimeError("YFINANCE_EMPTY_HISTORY")

    metadata = ticker.history_metadata or {}
    output = {
        "provider": "yfinance-community",
        "providerVersion": getattr(yf, "__version__", "unknown"),
        "officialYahooApi": False,
        "symbol": symbol,
        "currency": metadata.get("currency") or "未提供",
        "exchangeTimezoneName": metadata.get("exchangeTimezoneName"),
        "history": history,
    }
    sys.stdout.write(json.dumps(output, ensure_ascii=False, separators=(",", ":")))
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:  # The server records this as a provider failure.
        sys.stderr.write(f"{type(exc).__name__}: {exc}\n")
        raise SystemExit(1)
