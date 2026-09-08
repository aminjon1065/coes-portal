#!/usr/bin/env bash
# Поднять локальную среду из пустого состояния.
# docs/12-ЭКСПЛУАТАЦИЯ.md § 0.3.
set -euo pipefail
here=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)

"$here/preflight.sh"

printf '\nПоднимаю локальную среду...\n'
docker compose -f "$here/compose.local.yml" up -d --wait

printf '\nСреда поднята.\n'
docker compose -f "$here/compose.local.yml" ps --format 'table {{.Service}}\t{{.Status}}'
printf '\nБаза данных: postgresql://coes_owner@127.0.0.1:5432/coes\n'
printf 'Остановить:  ./deploy/local/down.sh\n'
printf 'Очистить:    ./deploy/local/reset.sh\n'
