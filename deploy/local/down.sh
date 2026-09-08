#!/usr/bin/env bash
# Остановить локальную среду, сохранив данные.
# docs/12-ЭКСПЛУАТАЦИЯ.md § 0.3.
set -euo pipefail
here=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
docker compose -f "$here/compose.local.yml" down
printf 'Среда остановлена. Данные сохранены; чтобы удалить их — ./deploy/local/reset.sh\n'
