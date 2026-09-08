#!/usr/bin/env bash
# Проверка машины перед запуском локальной среды.
# docs/12-ЭКСПЛУАТАЦИЯ.md § 0.2. Отказ с объяснением вместо падения
# контейнера базы данных посреди работы.
set -euo pipefail

MIN_MEMORY_GB=10
MIN_DISK_GB=100

failed=0
refuse() { printf 'ОТКАЗ: %s\n' "$1" >&2; failed=1; }

if ! command -v docker >/dev/null 2>&1; then
  refuse "Docker не установлен. Локальная среда без него не поднимается."
  exit 1
fi

if ! docker info >/dev/null 2>&1; then
  refuse "Docker установлен, но не запущен. Запустите Docker Desktop."
  exit 1
fi

docker_version=$(docker version --format '{{.Server.Version}}')
cpu_count=$(docker info --format '{{.NCPU}}')
memory_bytes=$(docker info --format '{{.MemTotal}}')
memory_gb=$(awk -v b="$memory_bytes" 'BEGIN { printf "%.1f", b / 1073741824 }')
disk_gb=$(df -g . | awk 'NR==2 { print $4 }')

printf 'Docker:            %s\n' "$docker_version"
printf 'Памяти у ВМ:       %s ГБ\n' "$memory_gb"
printf 'Ядер у ВМ:         %s\n' "$cpu_count"
printf 'Свободно на диске: %s ГБ\n' "$disk_gb"
printf '\n'

if awk -v m="$memory_gb" -v t="$MIN_MEMORY_GB" 'BEGIN { exit !(m < t) }'; then
  refuse "Docker Desktop отдаёт виртуальной машине ${memory_gb} ГБ. Нужно не менее ${MIN_MEMORY_GB} ГБ. Настройки → Resources → Memory."
fi

if [ "$disk_gb" -lt "$MIN_DISK_GB" ]; then
  refuse "Свободно ${disk_gb} ГБ. Нужно не менее ${MIN_DISK_GB} ГБ (docs/12-ЭКСПЛУАТАЦИЯ.md § 0.1)."
fi

if [ "$failed" -ne 0 ]; then
  printf '\nЗапуск остановлен. Устраните перечисленное и повторите.\n' >&2
  exit 1
fi

printf 'Машина готова к запуску локальной среды.\n'
