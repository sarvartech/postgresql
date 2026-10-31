# PostgreSQL Tuning Lab

Home-lab loyihasi: ikkita bir xil Linux (Ubuntu) virtual mashinada PostgreSQL
o'rnatib, bittasini default holicha qoldirib, ikkinchisini tuning qilib,
yuklama (load) ostida ikkalasining xatti-harakatini solishtirish.

## Maqsad

- PostgreSQL konfiguratsiya parametrlarining ishlash tezligiga ta'sirini
  amaliyotda ko'rish
- `pgbench` yordamida yuklama testini o'tkazishni o'rganish
- Noto'g'ri tuning production'ni qanday buzishi mumkinligini real sinab ko'rish
- Natijalarni o'lchab, hujjatlashtirib, xulosa chiqarish

## Repo tarkibi

```
postgresql/
├── README.md                  — shu fayl
├── docs/
│   ├── 01-lecture-intro.md        — nazariy kirish: nega tuning kerak
│   ├── 02-parameters-explained.md — har bir parametr vazifasi va nega muhimligi
│   ├── 03-formulas.md             — RAM/CPU asosida qiymat hisoblash formulalari
│   └── 04-production-pitfalls.md  — productionda uchraydigan tipik xatolar
├── lab/
│   ├── 00-lab-setup.md            — lab muhitini qurish bo'yicha qo'llanma
│   ├── configs/
│   │   └── tuning.conf.sample     — tuning qilingan postgresql.conf qo'shimchasi
│   ├── scripts/
│   │   ├── install_postgres.sh    — PostgreSQL o'rnatish skripti
│   │   └── run_pgbench_suite.sh   — bosqichma-bosqich load test skripti
│   └── results/
│       └── 2026-10-31-run1.md     — birinchi test tsikli natijalari va tahlili
```

## Lab topologiyasi

| Server | Rol | IP | Konfiguratsiya |
|---|---|---|---|
| Control-node | tuning qilingan | 192.168.0.200 | `lab/configs/tuning.conf.sample` qo'llangan |
| Test-node | default (tegilmagan) | 192.168.0.201 | PostgreSQL default sozlamalari |

Ikkalasi ham: Ubuntu 24.04, PostgreSQL 17.11, 2 vCPU, ~2GB RAM, VMware ESXi
ustida ishlaydigan virtual mashinalar.

## Qanday boshlash kerak

1. `docs/` papkasidagi lecture materiallarini o'qib chiqing (nazariya)
2. `lab/00-lab-setup.md` bo'yicha ikkita VM tayyorlang
3. `lab/scripts/install_postgres.sh` ni ikkala serverda ishga tushiring
4. Faqat tuning serverida `lab/configs/tuning.conf.sample` dagi
   parametrlarni qo'llang
5. `lab/scripts/run_pgbench_suite.sh` bilan load test o'tkazing
6. Natijalarni `lab/results/` ga yangi fayl sifatida qo'shib boring

## Litsenziya

Shaxsiy o'quv loyihasi — erkin foydalanish mumkin.
