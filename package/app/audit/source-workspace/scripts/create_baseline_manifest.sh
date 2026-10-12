#!/usr/bin/env bash
set -euo pipefail

readonly PROJECT_ROOT="/home/ubuntu/finance-hub-recovery"
readonly ARCHIVE="/home/ubuntu/upload/finance-hub-recovery-complete-recovery-2026-08-26.zip"
readonly BASELINE_DIR="${PROJECT_ROOT}/_baseline_archive"
readonly AUDIT_DIR="${PROJECT_ROOT}/audit/baseline"

mkdir -p "${AUDIT_DIR}"

sha256sum "${ARCHIVE}" > "${AUDIT_DIR}/uploaded-archive.sha256"
stat --printf='path=%n\nsize_bytes=%s\nmode=%A\nmodified_utc=%y\n' "${ARCHIVE}" > "${AUDIT_DIR}/uploaded-archive.stat"
unzip -Z1 "${ARCHIVE}" | LC_ALL=C sort > "${AUDIT_DIR}/uploaded-archive.entries.txt"
unzip -l "${ARCHIVE}" > "${AUDIT_DIR}/uploaded-archive.listing.txt"

(
  cd "${BASELINE_DIR}"
  find . -type f -print0 | LC_ALL=C sort -z | xargs -0 sha256sum
) > "${AUDIT_DIR}/readonly-extracted-tree.sha256"

(
  cd "${BASELINE_DIR}"
  find . -type f -printf '%p\t%s bytes\n' | LC_ALL=C sort
) > "${AUDIT_DIR}/readonly-extracted-tree.inventory.tsv"

if [ -f "${BASELINE_DIR}/source/finance-hub-complete-delivery.zip" ]; then
  sha256sum "${BASELINE_DIR}/source/finance-hub-complete-delivery.zip" > "${AUDIT_DIR}/embedded-source-archive.sha256"
  unzip -tqq "${BASELINE_DIR}/source/finance-hub-complete-delivery.zip"
  printf 'integrity=passed\n' > "${AUDIT_DIR}/embedded-source-archive.integrity.txt"
fi

printf 'baseline_generated_utc=%s\n' "$(date --utc +'%Y-%m-%dT%H:%M:%SZ')" > "${AUDIT_DIR}/generation.txt"
