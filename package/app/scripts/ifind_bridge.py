#!/usr/bin/env python3
"""Narrow JSON bridge for the licensed Tonghuashun iFinD desktop SDK."""

import contextlib
import io
import json
import os
from pathlib import Path
import re
import subprocess
import sys
from datetime import date, timedelta


# Windows redirects Python stdout through the active ANSI code page by
# default.  The Node bridge always consumes UTF-8, so force a single encoding
# boundary; otherwise legitimate Chinese SDK fields arrive as mojibake.
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8")


MARKER = "__IFIND_JSON__"
SYMBOL_RE = re.compile(r"^[A-Z0-9._-]{1,40}$")
DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")


def emit(payload):
    print(MARKER + json.dumps(payload, ensure_ascii=False, separators=(",", ":"), default=str))


def sdk_module_directory():
    configured = os.environ.get("THS_IFIND_SDK_PATH", "").strip()
    roots = []
    if configured:
        roots.append(Path(configured))
    user_profile = Path(os.environ.get("USERPROFILE", str(Path.home())))
    for parent in (user_profile / "Desktop", user_profile / "Downloads"):
        if not parent.exists():
            continue
        for item in sorted(parent.glob("THSDataInterface_Windows_*"), reverse=True):
            roots.extend((item, item / "THSDataInterface_Windows"))
    for root in roots:
        for candidate in (root, root / "bin" / "x64"):
            if (candidate / "iFinDPy.py").is_file():
                return candidate
    raise RuntimeError("IFIND_SDK_NOT_FOUND")


def load_sdk():
    module_dir = sdk_module_directory()
    sys.path.insert(0, str(module_dir))
    os.environ["PATH"] = str(module_dir) + os.pathsep + os.environ.get("PATH", "")
    with contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(io.StringIO()):
        import iFinDPy  # pylint: disable=import-outside-toplevel
    return iFinDPy


def load_credentials():
    username = os.environ.get("THS_IFIND_USERNAME", "").strip()
    password = os.environ.get("THS_IFIND_PASSWORD", "")
    if username and password:
        return username, password
    credential_path = os.environ.get("THS_IFIND_CREDENTIAL_FILE", "").strip()
    if not credential_path:
        credential_path = str(Path.cwd() / ".runtime" / "ifind-credential.xml")
    if not Path(credential_path).is_file():
        return None, None
    powershell = os.environ.get("THS_IFIND_POWERSHELL_BIN", "pwsh")
    helper_path = Path(__file__).with_name("read-ifind-credential.ps1")
    if not helper_path.is_file():
        return None, None
    completed = subprocess.run(
        [
            powershell,
            "-NoProfile",
            "-NonInteractive",
            "-File",
            str(helper_path),
            "-CredentialPath",
            credential_path,
        ],
        capture_output=True,
        text=True,
        timeout=5,
        check=False,
    )
    if completed.returncode != 0:
        return None, None
    try:
        payload = json.loads(completed.stdout.strip())
        return str(payload.get("username", "")).strip(), str(payload.get("password", ""))
    except (TypeError, ValueError, json.JSONDecodeError):
        return None, None


def value_at(value, index):
    if isinstance(value, list):
        return value[index] if index < len(value) else None
    return value if index == 0 else None


def normalize_date(value):
    if value is None:
        return None
    match = re.match(r"^(\d{4}-\d{2}-\d{2})", str(value).strip())
    return match.group(1) if match and DATE_RE.match(match.group(1)) else None


def records_from_payload(payload):
    if not isinstance(payload, dict):
        return []
    tables = payload.get("tables")
    if not isinstance(tables, list):
        return []
    records = []
    for item in tables:
        if not isinstance(item, dict):
            continue
        item_symbol = item.get("thscode") or item.get("THSCODE") or item.get("code")
        body = item.get("table") if isinstance(item.get("table"), dict) else item
        columns = {str(key).lower(): value for key, value in body.items()}
        times = item.get("time") if isinstance(item.get("time"), list) else body.get("time", [])
        if not isinstance(times, list):
            times = [times]
        row_count = max([len(value) for value in columns.values() if isinstance(value, list)] + [len(times), 1])
        for index in range(row_count):
            def field(*names):
                for name in names:
                    if name.lower() in columns:
                        return value_at(columns[name.lower()], index)
                return None

            timestamp = value_at(times, index) or field("time", "date", "tradeDate")
            records.append({
                "symbol": field("thscode", "thsCode", "code") or item_symbol,
                "date": normalize_date(timestamp),
                "timestamp": str(timestamp) if timestamp is not None else None,
                "preClose": field("preClose", "pre_close"),
                "open": field("open"),
                "high": field("high"),
                "low": field("low"),
                "close": field("close", "latest"),
                "latest": field("latest", "close"),
                "change": field("change"),
                "changeRatio": field("changeRatio", "change_ratio"),
                "volume": field("volume"),
                "amount": field("amount", "transactionAmount"),
                "bid1": field("bid1"),
                "ask1": field("ask1"),
                "bidSize1": field("bidSize1", "bid_size1"),
                "askSize1": field("askSize1", "ask_size1"),
                "inflow": field("inflow"),
                "outflow": field("outflow"),
            })
    return records


def tabular_result(payload, row_limit=1000, column_limit=80):
    """Return every SDK column without guessing its financial meaning.

    The SDK uses a list-of-tables structure with column arrays.  This generic
    normalizer is used by the licensed data explorer, while the narrow market
    adapter above keeps its stable quote schema.  Limits protect the terminal
    from accidentally materialising an unbounded licensed result set.
    """
    if not isinstance(payload, dict):
        return {"columns": [], "rows": []}
    tables = payload.get("tables")
    if not isinstance(tables, list):
        return {"columns": [], "rows": []}
    rows = []
    columns_seen = []
    for table_index, item in enumerate(tables):
        if not isinstance(item, dict):
            continue
        body = item.get("table") if isinstance(item.get("table"), dict) else item
        raw_columns = [(str(key), value) for key, value in body.items() if key not in ("table", "time")]
        raw_columns = raw_columns[:column_limit]
        times = item.get("time") if isinstance(item.get("time"), list) else body.get("time", [])
        if not isinstance(times, list):
            times = [times]
        row_count = max([len(value) for _, value in raw_columns if isinstance(value, list)] + [len(times), 1])
        item_symbol = item.get("thscode") or item.get("THSCODE") or item.get("code")
        for name, _ in raw_columns:
            if name not in columns_seen:
                columns_seen.append(name)
        for index in range(row_count):
            if len(rows) >= row_limit:
                break
            row = {"_table": table_index}
            if item_symbol is not None:
                row["THSCODE"] = item_symbol
            if index < len(times) and times[index] is not None:
                row["time"] = times[index]
            for name, value in raw_columns:
                row[name] = value_at(value, index)
            rows.append(row)
        if len(rows) >= row_limit:
            break
    output_columns = (["THSCODE"] if any("THSCODE" in row for row in rows) else [])
    output_columns += (["time"] if any("time" in row for row in rows) else [])
    output_columns += [name for name in columns_seen if name not in output_columns]
    return {"columns": output_columns[:column_limit], "rows": rows, "truncated": len(rows) >= row_limit}


def main():
    request = json.loads(sys.stdin.read() or "{}")
    action = request.get("action")
    requested_symbols = request.get("symbols")
    if isinstance(requested_symbols, list):
        symbols = [str(value).strip().upper() for value in requested_symbols[:30]]
    else:
        symbols = [str(request.get("symbol", "")).strip().upper()]
    if action not in ("health", "history", "snapshot", "dataset"):
        raise RuntimeError("IFIND_ACTION_NOT_ALLOWED")
    if action in ("history", "snapshot") and (not symbols or any(not SYMBOL_RE.fullmatch(symbol) for symbol in symbols)):
        raise RuntimeError("IFIND_SYMBOL_INVALID")

    username, password = load_credentials()
    if not username or not password:
        emit({"ok": False, "code": "IFIND_CREDENTIALS_NOT_CONFIGURED", "message": "Licensed iFinD credentials are not configured."})
        return

    sdk = load_sdk()
    login_code = None
    logged_in_here = False
    try:
        with contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(io.StringIO()):
            login_code = sdk.THS_iFinDLogin(username, password)
        if login_code not in (0, -201):
            emit({"ok": False, "code": "IFIND_LOGIN_FAILED", "providerCode": login_code, "message": "The iFinD SDK rejected the login."})
            return
        logged_in_here = login_code == 0
        if action == "health":
            emit({"ok": True, "loginCode": login_code})
            return

        if action == "dataset":
            mode = str(request.get("mode", ""))
            fields = request.get("fields")
            fields = [str(value) for value in fields[:40]] if isinstance(fields, list) else []
            field_re = re.compile(r"^[A-Za-z][A-Za-z0-9_]{0,79}$")
            if any(not field_re.fullmatch(field) for field in fields):
                raise RuntimeError("IFIND_FIELD_INVALID")
            begin = str(request.get("begin", ""))
            end = str(request.get("end", ""))
            payload = None
            if mode in ("realtime", "history", "basic"):
                if not symbols or any(not SYMBOL_RE.fullmatch(symbol) for symbol in symbols):
                    raise RuntimeError("IFIND_SYMBOL_INVALID")
                if not fields:
                    raise RuntimeError("IFIND_FIELDS_REQUIRED")
            if mode == "realtime":
                with contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(io.StringIO()):
                    payload = sdk.THS_RealtimeQuotes(",".join(symbols), ";".join(fields))
            elif mode == "history":
                if not DATE_RE.fullmatch(begin) or not DATE_RE.fullmatch(end):
                    raise RuntimeError("IFIND_DATE_INVALID")
                params = "Interval:D,CPS:1,baseDate:1900-01-01,Fill:Previous"
                with contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(io.StringIO()):
                    payload = sdk.THS_HistoryQuotes(",".join(symbols), ";".join(fields), params, begin, end)
            elif mode == "basic":
                # THS_BasicData requires one option segment per indicator.
                # The SDK's bundled sample documents PE as ``date,101`` and
                # PB as ``date,100``; name/code accept an empty segment.  Do
                # not send one generic blank option for every indicator: the
                # provider rejects that request as invalid parameters.
                option_by_field = {
                    "ths_stock_short_name_stock": "",
                    "ths_stock_code_stock": "",
                    "ths_pe_stock": end + ",101",
                    "ths_pb_stock": end + ",100",
                }
                if not DATE_RE.fullmatch(end) or any(field not in option_by_field for field in fields):
                    raise RuntimeError("IFIND_BASIC_OPTION_UNVERIFIED")
                options = ";".join(option_by_field[field] for field in fields)
                with contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(io.StringIO()):
                    payload = sdk.THS_BasicData(",".join(symbols), ";".join(fields), options)
            elif mode == "edb":
                indicators = request.get("indicators")
                indicators = [str(value).upper() for value in indicators[:40]] if isinstance(indicators, list) else []
                if not indicators or any(not re.fullmatch(r"^[A-Z][A-Z0-9_.-]{1,39}$", value) for value in indicators):
                    raise RuntimeError("IFIND_EDB_INDICATOR_INVALID")
                if not DATE_RE.fullmatch(begin) or not DATE_RE.fullmatch(end):
                    raise RuntimeError("IFIND_DATE_INVALID")
                with contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(io.StringIO()):
                    payload = sdk.THS_EDBQuery(";".join(indicators), begin, end)
            elif mode == "iwencai":
                query = str(request.get("query", "")).strip()
                domain = str(request.get("domain", "stock")).strip().lower()
                if not query or len(query) > 200 or domain not in ("stock", "fund", "bond", "index", "future", "option"):
                    raise RuntimeError("IFIND_IWENCAI_QUERY_INVALID")
                with contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(io.StringIO()):
                    payload = sdk.THS_iwencai(query, domain)
            else:
                raise RuntimeError("IFIND_DATASET_MODE_NOT_ALLOWED")
            provider_error = payload.get("errorcode", 0) if isinstance(payload, dict) else -1
            if provider_error != 0:
                emit({
                    "ok": False,
                    "code": "IFIND_DATASET_UNAVAILABLE",
                    "providerCode": provider_error,
                    "message": payload.get("errmsg", "The licensed SDK did not return this dataset.") if isinstance(payload, dict) else "The licensed SDK did not return this dataset.",
                })
                return
            table = tabular_result(payload)
            emit({
                "ok": True,
                "mode": mode,
                "providerCode": provider_error,
                "columns": table["columns"],
                "rows": table["rows"],
                "truncated": table.get("truncated", False),
            })
            return

        realtime_fields = "preClose;open;high;low;latest;change;changeRatio;amount;volume;bid1;ask1;bidSize1;askSize1;inflow;outflow"
        if action == "snapshot":
            with contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(io.StringIO()):
                realtime_payload = sdk.THS_RealtimeQuotes(",".join(symbols), realtime_fields)
            realtime_error = realtime_payload.get("errorcode", 0) if isinstance(realtime_payload, dict) else -1
            realtime_records = records_from_payload(realtime_payload) if realtime_error == 0 else []
            if realtime_records:
                emit({
                    "ok": True,
                    "records": realtime_records,
                    "realtimeAvailable": True,
                    "realtimeProviderCode": realtime_error,
                })
                return

            end_date = date.today()
            begin_date = end_date - timedelta(days=21)
            history_fields = "preClose;open;high;low;close;change;changeRatio;volume;amount"
            history_params = "Interval:D,CPS:1,baseDate:1900-01-01,Fill:Previous"
            with contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(io.StringIO()):
                history_payload = sdk.THS_HistoryQuotes(
                    ",".join(symbols),
                    history_fields,
                    history_params,
                    begin_date.isoformat(),
                    end_date.isoformat(),
                )
            history_error = history_payload.get("errorcode", 0) if isinstance(history_payload, dict) else -1
            history_records = records_from_payload(history_payload) if history_error == 0 else []
            latest_by_symbol = {}
            for record in history_records:
                record_symbol = str(record.get("symbol") or "").upper()
                record_date = str(record.get("date") or "")
                if not record_symbol:
                    continue
                current = latest_by_symbol.get(record_symbol)
                if current is None or record_date > str(current.get("date") or ""):
                    latest_by_symbol[record_symbol] = record
            if not latest_by_symbol:
                emit({
                    "ok": False,
                    "code": "IFIND_SNAPSHOT_UNAVAILABLE",
                    "providerCode": history_error if history_error != 0 else realtime_error,
                    "message": history_payload.get("errmsg", "No licensed snapshot or recent history returned.") if isinstance(history_payload, dict) else "No licensed snapshot or recent history returned.",
                })
                return
            emit({
                "ok": True,
                "records": list(latest_by_symbol.values()),
                "realtimeAvailable": False,
                "realtimeProviderCode": realtime_error,
                "historyProviderCode": history_error,
            })
            return

        begin = str(request.get("begin", ""))
        end = str(request.get("end", ""))
        if not DATE_RE.fullmatch(begin) or not DATE_RE.fullmatch(end):
            raise RuntimeError("IFIND_DATE_INVALID")
        history_fields = "preClose;open;high;low;close;change;changeRatio;volume;amount"
        history_params = "Interval:D,CPS:1,baseDate:1900-01-01,Fill:Previous"
        history_payload = None
        history_error = -1
        records = []
        symbol = symbols[0]
        for candidate in symbols:
            with contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(io.StringIO()):
                candidate_payload = sdk.THS_HistoryQuotes(candidate, history_fields, history_params, begin, end)
            candidate_error = candidate_payload.get("errorcode", 0) if isinstance(candidate_payload, dict) else -1
            candidate_records = records_from_payload(candidate_payload) if candidate_error == 0 else []
            history_payload = candidate_payload
            history_error = candidate_error
            if candidate_records:
                symbol = candidate
                records = candidate_records
                break
        with contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(io.StringIO()):
            realtime_payload = sdk.THS_RealtimeQuotes(symbol, realtime_fields)
        realtime_error = realtime_payload.get("errorcode", 0) if isinstance(realtime_payload, dict) else -1
        realtime_records = records_from_payload(realtime_payload) if realtime_error == 0 else []
        if not records:
            emit({
                "ok": False,
                "code": "IFIND_HISTORY_UNAVAILABLE",
                "providerCode": history_error,
                "message": history_payload.get("errmsg", "No licensed history returned.") if isinstance(history_payload, dict) else "No licensed history returned.",
            })
            return
        emit({
            "ok": True,
            "symbol": symbol,
            "records": records,
            "realtime": realtime_records[0] if realtime_records else None,
            "realtimeAvailable": bool(realtime_records),
            "realtimeProviderCode": realtime_error,
        })
    finally:
        if logged_in_here:
            try:
                with contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(io.StringIO()):
                    sdk.THS_iFinDLogout()
            except Exception:
                pass


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        emit({"ok": False, "code": str(error)[:120], "message": "The local iFinD bridge could not complete the request."})
