#!/usr/bin/env bash
# Очистить тома и начать заново.
# docs/12-ЭКСПЛУАТАЦИЯ.md § 0.3.
#
# Действие необратимо, поэтому требует подтверждения: локальная среда
# восстанавливается одной командой, но потерять на ней день работы неприятно.
set -euo pipefail
here=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)

if [ "${1:-}" != "--да" ]; then
  printf 'Будут удалены все данные локальной среды, включая базу.\n'
  printf 'Повторите с подтверждением: ./deploy/local/reset.sh --да\n'
  exit 1
fi

docker compose -f "$here/compose.local.yml" down --volumes --remove-orphans
printf 'Тома удалены. Поднять заново: ./deploy/local/up.sh\n'
