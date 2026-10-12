#!/usr/bin/env bash
set -euo pipefail

readonly PROJECT_ROOT="/home/ubuntu/finance-hub-recovery"
readonly BASELINE_ROOT="${PROJECT_ROOT}/_baseline_archive/project"
readonly OUTPUT_DIR="${PROJECT_ROOT}/audit/inventory"

mkdir -p "${OUTPUT_DIR}"

{
  printf 'path\tcomponent_or_wrapper\n'
  grep -E '<Route path=' "${BASELINE_ROOT}/client/src/App.tsx" \
    | sed -E 's/.*path=\{?"([^"]+)"\}?.*component=\{([^}]*)\}.*/\1\t\2/'
} > "${OUTPUT_DIR}/routes.tsv"

{
  printf 'file\n'
  (
    cd "${BASELINE_ROOT}"
    find client/src/pages -type f \( -name '*.ts' -o -name '*.tsx' \) -printf '%p\n' | LC_ALL=C sort
  )
} > "${OUTPUT_DIR}/pages.tsv"

{
  printf 'file\n'
  (
    cd "${BASELINE_ROOT}"
    find client/src/components -type f \( -iname '*menu*.ts' -o -iname '*menu*.tsx' -o -iname '*navigation*.ts' -o -iname '*navigation*.tsx' \) -printf '%p\n' | LC_ALL=C sort
  )
} > "${OUTPUT_DIR}/menu-components.tsv"

{
  printf 'router_domain\tsource_module\n'
  sed -n -E "s/^import \{ ([A-Za-z0-9_]+) \} from ['\"](\.\/routers\/[^'\"]+)['\"];?/\1\t\2/p" "${BASELINE_ROOT}/server/routers.ts" | LC_ALL=C sort
  printf 'appRouter\t./server/routers.ts\n'
} > "${OUTPUT_DIR}/api-router-domains.tsv"

{
  printf 'file\n'
  (
    cd "${BASELINE_ROOT}"
    find . -type f \( -name '*.test.ts' -o -name '*.test.tsx' -o -name '*.spec.ts' -o -name '*.spec.tsx' \) -printf '%p\n' | LC_ALL=C sort
  )
} > "${OUTPUT_DIR}/tests.tsv"

{
  printf 'file\n'
  (
    cd "${BASELINE_ROOT}"
    find client/src/lib server -type f \( -iname '*data*.ts' -o -iname '*data*.tsx' -o -iname '*market*.ts' -o -iname '*market*.tsx' -o -iname '*news*.ts' -o -iname '*news*.tsx' -o -iname '*curve*.ts' -o -iname '*curve*.tsx' -o -iname '*public*.ts' \) -printf '%p\n' | LC_ALL=C sort
  )
} > "${OUTPUT_DIR}/data-boundary-files.tsv"

{
  printf 'metric\tcount\n'
  printf 'app_routes\t%s\n' "$(tail -n +2 "${OUTPUT_DIR}/routes.tsv" | wc -l)"
  printf 'pages\t%s\n' "$(tail -n +2 "${OUTPUT_DIR}/pages.tsv" | wc -l)"
  printf 'menu_components\t%s\n' "$(tail -n +2 "${OUTPUT_DIR}/menu-components.tsv" | wc -l)"
  printf 'api_router_domains\t%s\n' "$(tail -n +2 "${OUTPUT_DIR}/api-router-domains.tsv" | wc -l)"
  printf 'test_files\t%s\n' "$(tail -n +2 "${OUTPUT_DIR}/tests.tsv" | wc -l)"
  printf 'data_boundary_files\t%s\n' "$(tail -n +2 "${OUTPUT_DIR}/data-boundary-files.tsv" | wc -l)"
} > "${OUTPUT_DIR}/summary.tsv"

printf 'generated_utc=%s\n' "$(date --utc +'%Y-%m-%dT%H:%M:%SZ')" > "${OUTPUT_DIR}/generation.txt"
