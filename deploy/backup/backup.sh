#!/usr/bin/env bash
# Полная копия базы данных.
# docs/12-ЭКСПЛУАТАЦИЯ.md § 6, docs/03-АРХИТЕКТУРА.md § 9.
#
# Копия ложится на том, ОТДЕЛЬНЫЙ от тома базы: копия на том же диске копией
# не является. Непрерывная архивация журнала транзакций идёт помимо этого
# скрипта, постоянно, и даёт восстановление на момент, а не только на копию.
set -euo pipefail
here=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
compose="$here/../local/compose.local.yml"

label=$(date -u +%Y-%m-%dT%H-%M-%SZ)

printf 'Снимаю полную копию базы: %s\n' "$label"

docker compose -f "$compose" exec -T db \
  pg_basebackup --username=coes_owner --pgdata="/backup/base/$label" \
                --format=plain --wal-method=stream --checkpoint=fast

# Копия считается существующей только после успешного восстановления из неё
# (§ 9). Здесь проверяется хотя бы её целостность как каталога.
if ! docker compose -f "$compose" exec -T db test -f "/backup/base/$label/PG_VERSION"; then
  printf 'ОТКАЗ: копия %s неполна — нет PG_VERSION.\n' "$label" >&2
  exit 1
fi

size=$(docker compose -f "$compose" exec -T db du -sh "/backup/base/$label" | cut -f1)
printf 'Копия снята: %s (%s)\n' "$label" "$size"
printf 'Восстановить: ./deploy/backup/restore.sh %s\n' "$label"
