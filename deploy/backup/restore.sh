#!/usr/bin/env bash
# Восстановление базы из копии.
# docs/12-ЭКСПЛУАТАЦИЯ.md § 7, docs/03-АРХИТЕКТУРА.md § 9.
#
# Восстанавливается ПОЛНАЯ копия, затем доигрывается архив журнала транзакций
# до последнего сохранённого момента. Поэтому изменения, сделанные ПОСЛЕ
# копии, тоже возвращаются: потеря ограничена archive_timeout, а не временем
# последней копии.
#
#   ./deploy/backup/restore.sh <метка>            восстановить рабочую базу
#   ./deploy/backup/restore.sh --to-test <метка>  проверочное восстановление
#                                                 в отдельную базу, рабочую
#                                                 не трогает (§ 7.1)
set -euo pipefail
here=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
compose="$here/../local/compose.local.yml"

# Имена томов заданы в deploy/local/compose.local.yml.
DATA_VOLUME=coes-local-db-data
BACKUP_VOLUME=coes-local-backup
IMAGE=imresamu/postgis:17-3.5

to_test=0
if [ "${1:-}" = "--to-test" ]; then to_test=1; shift; fi
label="${1:-}"

if [ -z "$label" ]; then
  printf 'Укажите метку копии. Доступные — ./deploy/backup/list.sh\n' >&2
  exit 1
fi

if ! docker run --rm -v "$BACKUP_VOLUME:/backup" "$IMAGE" \
       test -f "/backup/base/$label/PG_VERSION" 2>/dev/null; then
  printf 'ОТКАЗ: копии «%s» нет или она неполна. Доступные — ./deploy/backup/list.sh\n' "$label" >&2
  exit 1
fi

# Разворачивает копию в указанный том и настраивает доигрывание архива.
# Настройка добавляется в отдельный файл, а не правит postgresql.auto.conf:
# так её видно и так её проще снять.
prepare_volume() {
  local target="$1"
  docker run --rm -v "$target:/target" -v "$BACKUP_VOLUME:/backup" "$IMAGE" sh -c "
    set -e
    find /target -mindepth 1 -delete
    cp -a '/backup/base/$label/.' /target/
    printf \"restore_command = 'cp /backup/wal/%%f %%p'\n\" >> /target/postgresql.auto.conf
    touch /target/recovery.signal
    chown -R postgres:postgres /target
    chmod 700 /target
  "
}

# Ждёт окончания доигрывания журнала.
wait_ready() {
  local container="$1" i
  for i in $(seq 1 120); do
    if docker exec "$container" pg_isready -q -U coes_owner -d coes 2>/dev/null &&
       [ "$(docker exec "$container" psql -U coes_owner -d coes -tAc 'SELECT pg_is_in_recovery()' 2>/dev/null)" = "f" ]; then
      return 0
    fi
    sleep 1
  done
  printf 'ОТКАЗ: база не вышла из восстановления за 120 секунд.\n' >&2
  return 1
}

started=$(date +%s)

if [ "$to_test" -eq 1 ]; then
  # ── Проверочное восстановление: рабочая база не затрагивается ──────────
  test_volume=coes-restore-check
  test_container=coes-restore-check
  printf 'Проверочное восстановление копии %s в отдельную базу.\n' "$label"
  docker rm -f "$test_container" >/dev/null 2>&1 || true
  docker volume rm "$test_volume" >/dev/null 2>&1 || true
  docker volume create "$test_volume" >/dev/null

  prepare_volume "$test_volume"
  docker run -d --name "$test_container" \
    -v "$test_volume:/var/lib/postgresql/data" -v "$BACKUP_VOLUME:/backup" \
    -e POSTGRES_PASSWORD=unused "$IMAGE" >/dev/null

  if wait_ready "$test_container"; then
    printf '\nПроверочная база поднялась. Состояние:\n'
    docker exec "$test_container" psql -U coes_owner -d coes -tAc \
      "SELECT '  подразделений: ' || (SELECT count(*) FROM org.org_unit) ||
              ', элементов справочников: ' || (SELECT count(*) FROM ref.catalog_item) ||
              ', записей журнала: ' || (SELECT count(*) FROM audit.event);"
    ok=0
  else
    ok=1
  fi
  docker rm -f "$test_container" >/dev/null 2>&1 || true
  docker volume rm "$test_volume" >/dev/null 2>&1 || true
  elapsed=$(( $(date +%s) - started ))
  printf '\nПроверочное восстановление заняло %s с. Рабочая база не затронута.\n' "$elapsed"
  exit "$ok"
fi

# ── Восстановление рабочей базы ──────────────────────────────────────────
printf 'Восстанавливаю рабочую базу из копии %s.\n' "$label"
printf 'Текущее содержимое тома базы будет заменено.\n\n'

# Каждое восстановление создаёт новую линию времени. PostgreSQL доигрывает
# архив по НОВЕЙШЕЙ линии, поэтому данные, оставшиеся за прежней линией,
# после повторного восстановления недостижимы без явного указания линии.
# Для обычного случая — восстановление после отказа — это верное поведение.
# Если линий несколько, об этом нужно знать заранее, а не после.
timelines=$(docker run --rm -v "$BACKUP_VOLUME:/backup" "$IMAGE" \
  sh -c 'ls /backup/wal 2>/dev/null | grep -c "\.history$" || true')
if [ "${timelines:-0}" -gt 0 ]; then
  printf 'ВНИМАНИЕ: в архиве %s линия(й) времени сверх первой.\n' "$timelines"
  printf '  Восстановление пойдёт по новейшей. Данные, оставшиеся за прежними\n'
  printf '  линиями, этим восстановлением не возвращаются (запись В-15).\n\n'
fi

docker compose -f "$compose" stop db >/dev/null
prepare_volume "$DATA_VOLUME"
docker compose -f "$compose" start db >/dev/null

container=$(docker compose -f "$compose" ps -q db)
wait_ready "$container"

elapsed=$(( $(date +%s) - started ))
printf '\nВосстановление завершено за %s с.\n' "$elapsed"

printf '\nВосстановлено на момент:\n'
docker exec "$container" psql -U coes_owner -d coes -tAc \
  "SELECT '  последняя запись журнала действий: ' ||
          coalesce(max(occurred_at)::text, 'журнал пуст') FROM audit.event;"

printf '\nЦелостность журнала действий:\n'
if (cd "$here/../.." && pnpm run --silent audit:verify 2>&1 | sed 's/^/  /'); then
  :
else
  printf '  ОТКАЗ: цепочка журнала нарушена — сообщите Держателю контракта.\n' >&2
  exit 1
fi
