#!/usr/bin/env bash
# Bosqichma-bosqich pgbench load test skripti.
# Ikkala node'da (Control va Test) bir xil tarzda ishga tushiring, keyin
# natijalarni solishtiring.
set -euo pipefail

DB_NAME="${DB_NAME:-pgbench_test}"
DURATION="${DURATION:-60}"
THREADS="${THREADS:-2}"
CLIENT_LEVELS=(5 20 50 100)

echo "=================================================="
echo " pgbench load test suite"
echo " Baza: $DB_NAME | Davomiylik: ${DURATION}s | Threads: $THREADS"
echo "=================================================="

for c in "${CLIENT_LEVELS[@]}"; do
  echo ""
  echo "---- $c client bilan test ----"
  if ! sudo -u postgres pgbench -c "$c" -j "$THREADS" -T "$DURATION" "$DB_NAME"; then
    echo "!! $c client darajasida xato yuz berdi (masalan max_connections "
    echo "   yetarli emasligi mumkin). Konfiguratsiyani tekshiring."
  fi
done

echo ""
echo "=================================================="
echo " Tugadi. Natijalarni lab/results/ papkasiga yozib qo'ying."
echo "=================================================="
