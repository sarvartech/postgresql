#!/usr/bin/env bash
# PostgreSQL o'rnatish skripti — ikkala node'da (Control va Test) bir xil
# ishlatiladi. Faqat tuning qilish bosqichi alohida (tuning.conf.sample).
set -euo pipefail

PG_VERSION="17"
DB_NAME="pgbench_test"
PG_PASSWORD="${PG_PASSWORD:-test1234}"
SUBNET="${SUBNET:-192.168.0.0/24}"

echo "== 1. Tizimni yangilash =="
sudo apt update && sudo apt upgrade -y

echo "== 2. PostgreSQL rasmiy repo qo'shish =="
sudo apt install -y curl ca-certificates gnupg
sudo install -d /usr/share/postgresql-common/pgdg
sudo curl -o /usr/share/postgresql-common/pgdg/apt.postgresql.org.asc \
  --fail https://www.postgresql.org/media/keys/ACCC4CF8.asc
sudo sh -c "echo \"deb [signed-by=/usr/share/postgresql-common/pgdg/apt.postgresql.org.asc] https://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main\" > /etc/apt/sources.list.d/pgdg.list"
sudo apt update

echo "== 3. PostgreSQL o'rnatish =="
sudo apt install -y "postgresql-${PG_VERSION}" "postgresql-contrib-${PG_VERSION}"

echo "== 4. postgres parolini o'rnatish =="
sudo -u postgres psql -c "ALTER USER postgres PASSWORD '${PG_PASSWORD}';"

echo "== 5. Tashqaridan ulanishga ruxsat =="
PG_CONF="/etc/postgresql/${PG_VERSION}/main/postgresql.conf"
PG_HBA="/etc/postgresql/${PG_VERSION}/main/pg_hba.conf"

sudo sed -i "s/#listen_addresses = 'localhost'/listen_addresses = '*'/" "$PG_CONF"

if ! sudo grep -q "$SUBNET" "$PG_HBA"; then
  echo "host    all             all             ${SUBNET}          md5" | sudo tee -a "$PG_HBA"
fi

echo "== 6. pg_stat_statements yoqish =="
if ! sudo grep -q "shared_preload_libraries" "$PG_CONF"; then
  echo "shared_preload_libraries = 'pg_stat_statements'" | sudo tee -a "$PG_CONF"
fi

echo "== 7. Restart =="
sudo systemctl restart postgresql
sudo systemctl enable postgresql

echo "== 8. Test bazasini yaratish =="
sudo -u postgres createdb "$DB_NAME" 2>/dev/null || echo "Baza allaqachon mavjud, o'tkazib yuborildi"
sudo -u postgres psql -d "$DB_NAME" -c "CREATE EXTENSION IF NOT EXISTS pg_stat_statements;"

echo "== Tayyor =="
sudo systemctl status postgresql --no-pager
psql --version
