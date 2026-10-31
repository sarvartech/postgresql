# Lab Setup: Ikkita Node Muhitini Qurish

## Talablar

- VMware ESXi (yoki istalgan hypervisor)
- 2 ta Ubuntu Linux VM (24.04 tavsiya etiladi)
- Har biriga: minimal 2 vCPU, 2GB RAM, 20GB+ disk
- Ikkala VM bir xil tarmoqda (masalan `192.168.0.0/24`)

## Topologiya

| Node | Rol | IP (misol) |
|---|---|---|
| Control-node | Tuning qilinadigan server | 192.168.0.200 |
| Test-node | Tegilmaydigan (default) server | 192.168.0.201 |

## Qadamlar

### 1. Ikkita bir xil VM yarating

ESXi / Proxmox / VirtualBox'da bir xil resurs va bir xil Ubuntu versiyasi
bilan ikkita VM yarating. **Bir xillik muhim** — aks holda solishtirish
noto'g'ri chiqadi (masalan bittasida HDD, bittasida SSD datastore bo'lsa).

### 2. PostgreSQL o'rnatish (ikkala serverda bir xil)

```bash
bash lab/scripts/install_postgres.sh
```

Skript nima qiladi:
- Tizimni yangilaydi
- Rasmiy PostgreSQL APT repo'sini qo'shadi
- PostgreSQL 17 va contrib (pgbench) paketlarini o'rnatadi
- Tashqaridan ulanishga ruxsat beradi (`listen_addresses`, `pg_hba.conf`)
- `pgbench_test` bazasini yaratadi va `pg_stat_statements`ni yoqadi

### 3. Faqat Control-node'da tuning qo'llash

```bash
sudo tee -a /etc/postgresql/17/main/postgresql.conf < lab/configs/tuning.conf.sample
sudo systemctl restart postgresql
```

**Test-node'ga tegmang** — u baseline (solishtirish nuqtasi) bo'lib qoladi.

### 4. Test ma'lumotlarini yuklash (ikkala serverda bir xil)

```bash
sudo -u postgres pgbench -i -s 50 pgbench_test
```

### 5. Load test o'tkazish

```bash
bash lab/scripts/run_pgbench_suite.sh
```

Bu skript 5, 20, 50, 100 client bilan ketma-ket test o'tkazadi va
natijalarni ekranga chiqaradi.

### 6. Natijalarni yozib borish

Har bir test tsiklidan so'ng natijalarni `lab/results/` papkasiga sana
bilan nomlangan faylga yozing (masalan `2026-11-05-run2.md`), 
`lab/results/2026-10-31-run1.md` namunasiga asoslanib.

## Muhim eslatmalar

- Har ikki serverda **bir vaqtda emas, lekin bir xil tartibda** test
  o'tkazing — tarmoq/disk sharoitini imkon qadar bir xil ushlab turish uchun
- `max_connections` kabi parametrlarni o'zgartirishdan oldin, pgbench qancha
  client bilan ishlashini rejalashtiring — aks holda "too many clients"
  xatosiga duch kelasiz (bizning birinchi testimizda bo'lgani kabi)
- Har bir o'zgarishdan keyin `sudo systemctl restart postgresql` shart
