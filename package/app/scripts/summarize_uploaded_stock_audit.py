from __future__ import annotations

import json
from collections import defaultdict
from pathlib import Path

INPUT_PATH = Path("/home/ubuntu/finance-hub/tmp/uploaded_stock_record_audit.json")
OUTPUT_PATH = Path("/home/ubuntu/finance-hub/tmp/uploaded_stock_record_audit_summary.md")


def preferred(labels: list[dict[str, object]]) -> dict[str, object]:
    exact_name = [sheet for sheet in labels if str(sheet["file_name"]).removesuffix(".xlsx") == str(sheet["sheet_name"])]
    return exact_name[0] if exact_name else labels[0]


def main() -> None:
    audit = json.loads(INPUT_PATH.read_text(encoding="utf-8"))
    groups: dict[str, list[dict[str, object]]] = defaultdict(list)
    for sheet in audit["sheet_records"]:
        groups[sheet["content_sha256"]].append(sheet)

    unique = [preferred(group) for group in groups.values()]
    unique.sort(key=lambda item: (str(item["sheet_name"]), str(item["file_name"])))
    lines = [
        "# 上传股票工作簿审计摘要",
        "",
        f"- 工作簿：{audit['workbook_count']} 个",
        f"- 工作表：{audit['sheet_count']} 个",
        f"- 去重后内容集：{len(unique)} 个",
        f"- 去重后候选股票记录：{sum(int(item['accepted_row_count']) for item in unique)} 条",
        "",
        "| 候选工作表 | 规范来源文件 | 有效记录 | 无效行 | 证券代码范围 | 内容哈希 | 重复来源数 |",
        "|---|---:|---:|---:|---|---|---:|",
    ]
    for item in unique:
        duplicates = groups[item["content_sha256"]]
        lines.append(
            "| {sheet} | {file} | {accepted} | {invalid} | {first} → {last} | `{hash}` | {copies} |".format(
                sheet=item["sheet_name"],
                file=item["file_name"],
                accepted=item["accepted_row_count"],
                invalid=item["invalid_row_count"],
                first=item["first_ticker"],
                last=item["last_ticker"],
                hash=str(item["content_sha256"])[:12],
                copies=len(duplicates),
            )
        )

    lines.extend(["", "## 重复内容组", ""])
    for group in audit["duplicate_content_groups"]:
        labels = group["sheets"]
        lines.append(f"- `{str(group['content_sha256'])[:12]}`：" + "； ".join(labels))
    OUTPUT_PATH.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(OUTPUT_PATH)


if __name__ == "__main__":
    main()
