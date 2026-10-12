"""Restricted, code-scoped AKShare fund disclosure reader."""

from __future__ import annotations

import argparse
import json
import re
import sys
from datetime import datetime, timezone


def records(frame):
    if frame is None or frame.empty:
        return []
    return json.loads(frame.to_json(orient="records", force_ascii=False))


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--code", required=True)
    args = parser.parse_args()
    sys.stdout.reconfigure(encoding="utf-8")
    if not re.fullmatch(r"\d{6}", args.code):
        raise ValueError("INVALID_FUND_CODE")

    import akshare as ak

    results = {}
    errors = {}
    try:
        results["stock"] = records(ak.fund_portfolio_hold_em(symbol=args.code, date=""))
    except Exception as error:
        errors["stock"] = f"{type(error).__name__}:{error}"[:300]
    try:
        year = datetime.now(timezone.utc).year
        bond = ak.fund_portfolio_bond_hold_em(symbol=args.code, date=str(year))
        if bond.empty:
            bond = ak.fund_portfolio_bond_hold_em(symbol=args.code, date=str(year - 1))
        results["bond"] = records(bond)
    except Exception as error:
        errors["bond"] = f"{type(error).__name__}:{error}"[:300]
    print(json.dumps({
        "code": args.code,
        "retrievedAt": datetime.now(timezone.utc).isoformat(),
        "results": results,
        "errors": errors,
    }, ensure_ascii=False, separators=(",", ":")))
    return 0 if results else 2


if __name__ == "__main__":
    raise SystemExit(main())
