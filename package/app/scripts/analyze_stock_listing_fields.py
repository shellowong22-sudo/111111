from __future__ import annotations

import json
from collections import Counter, defaultdict
from pathlib import Path

from openpyxl import load_workbook

UPLOAD_DIR = Path("/home/ubuntu/upload")
OUTPUT_PATH = Path("/home/ubuntu/finance-hub/tmp/uploaded_stock_listing_field_analysis.json")

COUNTRY_BY_SHEET = {
    "东证所全部股票": ("日本", "JP", "东京证券交易所"),
    "丹麦股票": ("丹麦", "DK", "哥本哈根证券交易所"),
    "以色列股票": ("以色列", "IL", "特拉维夫证券交易所"),
    "俄罗斯股票": ("俄罗斯", "RU", "莫斯科交易所"),
    "全部A股": ("中国", "CN", "中国境内交易所"),
    "全部港股": ("中国香港", "HK", "香港交易所"),
    "全部美股": ("美国", "US", "美国证券市场"),
    "全部英股": ("英国", "GB", "伦敦证券交易所"),
    "冰岛股票": ("冰岛", "IS", "纳斯达克冰岛"),
    "加拿大多伦多证券交易所": ("加拿大", "CA", "多伦多证券交易所"),
    "印尼股票": ("印度尼西亚", "ID", "印度尼西亚证券交易所"),
    "印度全部股票_1": ("印度", "IN", "印度证券市场"),
    "台湾全部股票": ("中国台湾", "TW", "台湾证券市场"),
    "墨西哥股票": ("墨西哥", "MX", "墨西哥证券交易所"),
    "荷兰股票": ("荷兰", "NL", "泛欧阿姆斯特丹"),
    "奥地利股票": ("奥地利", "AT", "维也纳证券交易所"),
    "巴西股票": ("巴西", "BR", "巴西证券交易所"),
    "意大利股票": ("意大利", "IT", "意大利证券交易所"),
    "挪威股票": ("挪威", "NO", "奥斯陆证券交易所"),
    "新加坡全部股票": ("新加坡", "SG", "新加坡交易所"),
    "新西兰股票_1": ("新西兰", "NZ", "新西兰证券交易所"),
    "柬埔寨股票": ("柬埔寨", "KH", "柬埔寨证券交易所"),
    "沙特全部股票_1": ("沙特阿拉伯", "SA", "沙特交易所"),
    "法国全部股票": ("法国", "FR", "泛欧巴黎"),
    "泰国股票_1": ("泰国", "TH", "泰国证券交易所"),
    "爱尔兰股票": ("爱尔兰", "IE", "泛欧都柏林"),
    "瑞典股票": ("瑞典", "SE", "纳斯达克斯德哥尔摩"),
    "瑞士股票": ("瑞士", "CH", "瑞士证券交易所"),
    "缅甸股票": ("缅甸", "MM", "仰光证券交易所"),
    "老挝股票": ("老挝", "LA", "老挝证券交易所"),
    "芬兰股票": ("芬兰", "FI", "纳斯达克赫尔辛基"),
    "菲律宾股票_3": ("菲律宾", "PH", "菲律宾证券交易所"),
    "葡萄牙股票": ("葡萄牙", "PT", "泛欧里斯本"),
    "西班牙股票": ("西班牙", "ES", "西班牙证券交易所"),
    "越南全部股票": ("越南", "VN", "越南证券市场"),
    "迪拜金融市场": ("阿拉伯联合酋长国", "AE", "迪拜金融市场"),
    "阿联酋全部股票": ("阿拉伯联合酋长国", "AE", "阿联酋证券市场"),
    "马来西亚全部股票": ("马来西亚", "MY", "马来西亚交易所"),
}


def canonical_sources():
    """Prefer the workbook whose filename matches the sheet name when duplicates share identical content."""
    seen_hashes: set[str] = set()
    records = []
    for path in sorted(UPLOAD_DIR.glob("*.xlsx")):
        wb = load_workbook(path, read_only=True, data_only=False)
        for ws in wb.worksheets:
            if ws.title not in COUNTRY_BY_SHEET:
                continue
            rows = list(ws.iter_rows(values_only=True))
            body = [(row[0] if len(row) > 0 else None, row[1] if len(row) > 1 else None) for row in rows[1:]]
            valid = [(code, name) for code, name in body if code not in (None, "") and name not in (None, "") and not str(code).startswith("数据来源")]
            signature = "\n".join(f"{code}\t{name}" for code, name in valid)
            import hashlib
            content_hash = hashlib.sha256(signature.encode("utf-8")).hexdigest()
            preferred = path.stem == ws.title
            records.append({"path": path, "sheet": ws, "rows": valid, "hash": content_hash, "preferred": preferred})

    selected = []
    for record in sorted(records, key=lambda item: (not item["preferred"], item["path"].name, item["sheet"].title)):
        if record["hash"] in seen_hashes:
            continue
        seen_hashes.add(record["hash"])
        selected.append(record)
    return selected


def main() -> None:
    selected = canonical_sources()
    type_counts = Counter()
    rows = []
    symbols_by_country: dict[tuple[str, str], list[dict[str, str]]] = defaultdict(list)
    global_symbols: dict[str, list[dict[str, str]]] = defaultdict(list)

    for record in selected:
        country, country_code, exchange = COUNTRY_BY_SHEET[record["sheet"].title]
        sheet_rows = record["rows"]
        for row_number, (symbol, name) in enumerate(sheet_rows, start=2):
            type_counts[type(symbol).__name__] += 1
            type_counts[type(name).__name__] += 1
            rows.append({
                "country": country,
                "country_code": country_code,
                "exchange": exchange,
                "file_name": record["path"].name,
                "sheet_name": record["sheet"].title,
                "source_row": row_number,
                "symbol": str(symbol),
                "name": str(name),
            })
            symbols_by_country[(country_code, str(symbol))].append(rows[-1])
            global_symbols[str(symbol)].append(rows[-1])

    same_country_duplicates = [values for values in symbols_by_country.values() if len(values) > 1]
    cross_country_duplicates = [values for values in global_symbols.values() if len({item["country_code"] for item in values}) > 1]
    result = {
        "selected_source_count": len(selected),
        "candidate_record_count": len(rows),
        "cell_type_counts": dict(type_counts),
        "max_symbol_length": max(len(item["symbol"]) for item in rows),
        "max_name_length": max(len(item["name"]) for item in rows),
        "leading_or_trailing_whitespace_count": sum(
            int(item["symbol"] != item["symbol"].strip()) + int(item["name"] != item["name"].strip()) for item in rows
        ),
        "same_country_duplicate_count": len(same_country_duplicates),
        "cross_country_duplicate_symbol_count": len(cross_country_duplicates),
        "same_country_duplicate_samples": same_country_duplicates[:5],
        "cross_country_duplicate_samples": cross_country_duplicates[:5],
        "records_per_country": dict(sorted(Counter(item["country"] for item in rows).items())),
        "selected_sources": [
            {
                "country": COUNTRY_BY_SHEET[record["sheet"].title][0],
                "country_code": COUNTRY_BY_SHEET[record["sheet"].title][1],
                "exchange": COUNTRY_BY_SHEET[record["sheet"].title][2],
                "file_name": record["path"].name,
                "sheet_name": record["sheet"].title,
                "record_count": len(record["rows"]),
                "content_sha256": record["hash"],
            }
            for record in selected
        ],
    }
    OUTPUT_PATH.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps({"candidate_record_count": len(rows), "output": str(OUTPUT_PATH)}, ensure_ascii=False))


if __name__ == "__main__":
    main()
