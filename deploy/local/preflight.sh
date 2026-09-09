#!/usr/bin/env bash
# Проверка машины перед запуском локальной среды.
# docs/12-ЭКСПЛУАТАЦИЯ.md § 0.2.
#
# Порог ступенчатый, и это решение Держателя контракта от 2026-09-09 (В-13).
# Контракт называет 10 ГБ, но это требование ПОЛНОГО состава — этапа 7
# (8,5 ГБ внутри ВМ, docs/03-АРХИТЕКТУРА.md § 7). До этапа 7 состав меньше:
# база 2 + API 0,5 + обработчик 0,75 + LibreOffice 1 = 4,25 ГБ, отсюда 5 ГБ
# с запасом. Порог не занижен молча: недостача до 10 ГБ выводится всегда.
set -euo pipefail

MIN_MEMORY_GB=5          # этапы 0–6, выведено из § 7
FULL_MEMORY_GB=10        # этап 7 и сервер, требование контракта § 0.1
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
printf 'Памяти у ВМ:       %s ГБ (нужно %s для этапов 0–6, %s для этапа 7)\n' \
  "$memory_gb" "$MIN_MEMORY_GB" "$FULL_MEMORY_GB"
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

# Недостача до полного состава видна всегда, а не всплывает на этапе 7.
if awk -v m="$memory_gb" -v t="$FULL_MEMORY_GB" 'BEGIN { exit !(m < t) }'; then
  printf 'СРЕДА УРЕЗАНА: памяти %s ГБ из %s, нужных полному составу.\n' "$memory_gb" "$FULL_MEMORY_GB"
  printf '  Этапы 0–6 работают. Этап 7 (совещания с записью) на этой машине не поместится:\n'
  printf '  локальный профиль требует 8,5 ГБ внутри ВМ. Норматив Н-20 проверяется на сервере (ПС-В-04).\n'
  printf '  Решение Держателя контракта от 2026-09-09, запись В-13.\n\n'
fi

printf 'Машина готова к запуску локальной среды.\n'
