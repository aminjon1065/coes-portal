#!/usr/bin/env bash
# Перечень доступных копий.
# docs/12-ЭКСПЛУАТАЦИЯ.md § 7.
set -euo pipefail
here=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
compose="$here/../local/compose.local.yml"

printf 'Полные копии базы:\n'
if docker compose -f "$compose" exec -T db sh -c 'ls -1 /backup/base 2>/dev/null' | grep -q .; then
  docker compose -f "$compose" exec -T db sh -c \
    'for d in /backup/base/*/; do printf "  %-24s %s\n" "$(basename "$d")" "$(du -sh "$d" | cut -f1)"; done'
else
  printf '  копий нет — снимите: ./deploy/backup/backup.sh\n'
fi

printf '\nАрхив журнала транзакций:\n'
docker compose -f "$compose" exec -T db sh -c \
  'printf "  сегментов: %s, объём: %s\n" "$(ls -1 /backup/wal | wc -l | tr -d " ")" "$(du -sh /backup/wal | cut -f1)"'

printf '\nСостояние архивации:\n'
docker compose -f "$compose" exec -T db psql -U coes_owner -d coes -tAc \
  "SELECT '  заархивировано: ' || archived_count || ', неудач: ' || failed_count ||
          ', последний: ' || coalesce(last_archived_wal, 'нет') FROM pg_stat_archiver;"
