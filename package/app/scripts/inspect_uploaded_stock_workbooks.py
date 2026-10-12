from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from openpyxl import load_workbook

UPLOAD_DIR = Path("/home/ubuntu/upload")
OUTPUT_PATH = Path("/home/ubuntu/finance-hub/tmp/uploaded_stock_workbook_inventory.json")


def value(value: Any) -> Any:
    if value is None:
        return None
    if isinstance(value, (str, int, float, bool)):
        return value
    return str(value)


def nonempty_rows(sheet) -> list[list[Any]]:
    return [
        [value(cell) for cell in row]
        for row in sheet.iter_rows(values_only=True)
        if any(cell not in (None, "") for cell in row)
    ]


def inspect_workbook(path: Path) -> dict[str, Any]:
    workbook = load_workbook(path, read_only=True, data_only=False)
    sheets = []
    for sheet in workbook.worksheets:
        rows = nonempty_rows(sheet)
        sheets.append(
            {
                "sheet_name": sheet.title,
                "nonempty_row_count": len(rows),
                "max_column_count": max((len(row) for row in rows), default=0),
                "first_four_rows": rows[:4],
            }
        )
    return {
        "file_name": path.name,
        "file_size_bytes": path.stat().st_size,
        "sheet_count": len(sheets),
        "sheets": sheets,
    }


def main() -> None:
    workbooks = [inspect_workbook(path) for path in sorted(UPLOAD_DIR.glob("*.xlsx"))]
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(json.dumps(workbooks, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps({"workbook_count": len(workbooks), "output": str(OUTPUT_PATH)}, ensure_ascii=False))


if __name__ == "__main__":
    main()
