from __future__ import annotations

import hashlib
import json
from collections import defaultdict
from pathlib import Path

from openpyxl import load_workbook

UPLOAD_DIR = Path("/home/ubuntu/upload")
OUTPUT_PATH = Path("/home/ubuntu/finance-hub/tmp/uploaded_stock_record_audit.json")


def clean(value: object) -> str:
    return "" if value is None else str(value).strip()


def inspect_sheet(file_name: str, sheet) -> dict[str, object]:
    raw_rows = [tuple(clean(cell) for cell in row[:2]) for row in sheet.iter_rows(values_only=True)]
    nonempty = [row for row in raw_rows if any(row)]
    header = list(nonempty[0]) if nonempty else []
    body = nonempty[1:]
    accepted = [row for row in body if row[0] and row[1] and not row[0].startswith("数据来源")]
    invalid = [row for row in body if row not in accepted]
    digest = hashlib.sha256(
        "\n".join(f"{ticker}\t{name}" for ticker, name in accepted).encode("utf-8")
    ).hexdigest()
    return {
        "file_name": file_name,
        "sheet_name": sheet.title,
        "header": header,
        "body_row_count": len(body),
        "accepted_row_count": len(accepted),
        "invalid_row_count": len(invalid),
        "sample_invalid_rows": [list(row) for row in invalid[:3]],
        "first_ticker": accepted[0][0] if accepted else None,
        "last_ticker": accepted[-1][0] if accepted else None,
        "content_sha256": digest,
    }


def main() -> None:
    sheets = []
    for path in sorted(UPLOAD_DIR.glob("*.xlsx")):
        workbook = load_workbook(path, read_only=True, data_only=False)
        sheets.extend(inspect_sheet(path.name, sheet) for sheet in workbook.worksheets)

    by_hash: dict[str, list[str]] = defaultdict(list)
    for sheet in sheets:
        by_hash[str(sheet["content_sha256"])].append(f"{sheet['file_name']}::{sheet['sheet_name']}")

    result = {
        "workbook_count": len(list(UPLOAD_DIR.glob("*.xlsx"))),
        "sheet_count": len(sheets),
        "sheet_records": sheets,
        "duplicate_content_groups": [
            {"content_sha256": digest, "sheets": labels}
            for digest, labels in by_hash.items()
            if len(labels) > 1
        ],
    }
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps({"sheet_count": len(sheets), "duplicate_group_count": len(result["duplicate_content_groups"]), "output": str(OUTPUT_PATH)}, ensure_ascii=False))


if __name__ == "__main__":
    main()
