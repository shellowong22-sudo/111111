"""Restricted AKShare bridge.

The Node server is the policy boundary. This process only accepts the
operation names below and emits JSON records; it never evaluates a Python
function name supplied by a request.
"""

from __future__ import annotations

import argparse
import json
import math
import sys
from datetime import date, datetime, timedelta, timezone
from typing import Any, Callable


def clean_value(value: Any) -> Any:
    if value is None:
        return None
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    if isinstance(value, float) and (math.isnan(value) or math.isinf(value)):
        return None
    if hasattr(value, "item"):
        try:
            return clean_value(value.item())
        except Exception:
            pass
    return str(value) if not isinstance(value, (str, int, float, bool, list, dict)) else value


def dataframe_records(frame: Any, limit: int = 5_000, newest: bool = False) -> list[dict[str, Any]]:
    if frame is None or not hasattr(frame, "to_dict"):
        return []
    window = frame.tail(limit) if newest else frame.head(limit)
    records = window.to_dict(orient="records")
    return [
        {str(key): clean_value(value) for key, value in record.items()}
        for record in records
    ]


def verified_cn_session(ak: Any, frame: Any, sentinel_code: str, daily: Any) -> Any:
    """Pin a date-less market cross-section to a separately checked close."""
    sentinel = frame.loc[frame["代码"] == sentinel_code]
    if len(sentinel) != 1:
        raise ValueError("AKSHARE_CN_SESSION_UNVERIFIED")
    now_cn = datetime.now(timezone(timedelta(hours=8)))
    if daily is None or daily.empty:
        raise ValueError("AKSHARE_CN_SESSION_UNVERIFIED")
    latest = daily.iloc[-1]
    session = latest["date"].date() if hasattr(latest["date"], "date") else date.fromisoformat(str(latest["date"])[:10])
    if not 0 <= (now_cn.date() - session).days <= 14:
        raise ValueError("AKSHARE_CN_SESSION_OUT_OF_RANGE")
    if abs(float(sentinel.iloc[0]["最新价"]) - float(latest["close"])) > 0.011:
        raise ValueError("AKSHARE_CN_SESSION_PRICE_MISMATCH")
    # A security with no turnover may carry a prior session's last price.
    # Do not assign the verified market session to such a stale row.
    frame = frame.loc[(frame["成交量"] > 0) & (frame["最新价"] > 0)].copy()
    frame["交易日期"] = session.isoformat()
    return frame


def verified_cn_stock_snapshot(ak: Any) -> Any:
    """The spot clock time alone is not a trading date or realtime proof."""
    now_cn = datetime.now(timezone(timedelta(hours=8)))
    return verified_cn_session(
        ak, ak.stock_zh_a_spot(), "sh600000",
        ak.stock_zh_a_daily(
            symbol="sh600000",
            start_date=(now_cn - timedelta(days=15)).strftime("%Y%m%d"),
            end_date=now_cn.strftime("%Y%m%d"),
        ),
    )


def verified_cn_index_snapshot(ak: Any) -> Any:
    """Exchange-index cross-section with a checked Shanghai Composite day."""
    return verified_cn_session(
        ak, ak.stock_zh_index_spot_sina(), "sh000001",
        ak.stock_zh_index_daily(symbol="sh000001"),
    )


def run_operation(operation: str) -> tuple[str, list[dict[str, Any]]]:
    import akshare as ak

    # Explicit allow-list. Do not turn this into an arbitrary AKShare RPC.
    operations: dict[str, Callable[[], Any]] = {
        "stock_snapshot": lambda: verified_cn_stock_snapshot(ak),
        # Fincept exposes the complete A-share code/name directory as a
        # separate capability. It belongs to the existing EQS universe
        # selector, not to a new page.
        "stock_directory": ak.stock_info_a_code_name,
        "hk_stock_snapshot": ak.stock_hk_spot_em,
        "us_stock_snapshot": ak.stock_us_spot_em,
        "cn_index_snapshot": lambda: verified_cn_index_snapshot(ak),
        "global_index_snapshot": ak.index_global_spot_em,
        # This endpoint returns dated ETF unit NAVs, not exchange bid/ask or
        # a tradeable last price. The Node contract labels it accordingly.
        "etf_snapshot": ak.fund_etf_spot_ths,
        "fund_snapshot": ak.fund_open_fund_daily_em,
        "forex_snapshot": ak.forex_spot_em,
        "futures_snapshot": ak.futures_global_spot_em,
        "futures_cn_snapshot": ak.futures_zh_realtime,
        # A single official public inventory series is kept as a distinct
        # contract so it cannot be mistaken for futures quotes or CFTC
        # positions. The symbol is intentionally fixed and auditable.
        "futures_inventory": lambda: ak.futures_inventory_em(symbol="沪铜"),
        # The broad option_current_em endpoint is not reachable on every
        # network. This exchange-public underlying snapshot is a narrower,
        # real response and remains within the existing options panel.
        "options_snapshot": ak.option_sse_underlying_spot_price_sina,
        # This is a public daily yield-curve observation, not a live order
        # book. It is kept separate from bond trading and is only projected
        # into the existing bond research panel.
        "bond_curve": ak.bond_zh_us_rate,
        "news_publication": ak.stock_news_main_cx,
        "economic_gdp": ak.macro_china_gdp,
        "economic_cpi": ak.macro_china_cpi_yearly,
        "economic_pmi": ak.macro_china_pmi,
        "macro_semiconductor_index": ak.macro_global_sox_index,
        "macro_shipping_bdi": ak.macro_shipping_bdi,
        "macro_japan_bank_rate": ak.macro_japan_bank_rate,
        "macro_uk_bank_rate": ak.macro_uk_bank_rate,
        "news_cctv": lambda: ak.news_cctv(
            date=datetime.utcnow().strftime("%Y%m%d")
        ),
    }
    if operation not in operations:
        raise ValueError("AKSHARE_OPERATION_NOT_ALLOWED")
    frame = operations[operation]()
    return operation, dataframe_records(
        frame, limit=10_000 if operation == "stock_snapshot" else 5_000,
        newest=operation == "bond_curve",
    )


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--operation", required=True)
    args = parser.parse_args()
    sys.stdout.reconfigure(encoding="utf-8")
    try:
        operation, records = run_operation(args.operation)
        payload = {
            "provider": "akshare",
            "providerVersion": "1.18.97",
            "operation": operation,
            "retrievedAt": datetime.utcnow().isoformat(timespec="seconds") + "Z",
            "records": records,
        }
        print(json.dumps(payload, ensure_ascii=False, separators=(",", ":")))
        return 0
    except Exception as error:
        print(
            json.dumps(
                {
                    "provider": "akshare",
                    "providerVersion": "1.18.97",
                    "error": f"{type(error).__name__}:{error}",
                },
                ensure_ascii=False,
                separators=(",", ":"),
            )
        )
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
