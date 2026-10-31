# 4-Ma'ruza: Productionda Tipik Xatolar (Lab Case-Study bilan)

## Case-Study: `max_connections`ni o'ylamasdan pasaytirish

Bu loyihada biz 2026-10-31 kuni haqiqiy testda shu xatoni o'z ko'zimiz bilan
ko'rdik — to'liq natija `lab/results/2026-10-31-run1.md` faylida.

### Nima bo'ldi

Control-node (tuning server, 2GB RAM, 2 CPU) uchun quyidagi qiymat
qo'yilgan edi:

```
max_connections = 50
```

Bu qiymat shunchaki "kichik serverga mos" deb tanlangan edi — ammo keyinchalik
`pgbench -c 100` bilan test qilinganda (100 ta parallel client):

```
FATAL: sorry, too many clients already
pgbench: error: could not create connection for client 74
```

**Test-node (default, `max_connections = 100`)** esa xatosiz ishlashda
davom etdi:

```
tps = 3506.256560
latency average = 28.520 ms
```

### Nega bu muhim

Bu — **production'da eng ko'p uchraydigan "silent killer"** turlaridan biri:

1. Kam yuklamada (5–50 ulanish) hamma narsa mukammal ishlaydi, hatto test
   ham muvaffaqiyatli o'tadi
2. Peak soatda (savdo kampaniyasi, reklama, ko'p foydalanuvchi bir vaqtda
   kirishi) ulanishlar soni chegaradan oshadi
3. Server **yangi so'rovlarni butunlay rad eta boshlaydi** — bu CPU yoki
   disk muammosi emas, balki sof konfiguratsiya xatosi
4. Monitoring to'g'ri sozlanmagan bo'lsa, bu holatni tezda aniqlash qiyin —
   "nega sayt ishlamayapti" deganda birinchi tekshiriladigan narsa odatda bu
   emas

### To'g'ri yechim

`max_connections`ni qo'lda arbitrary pasaytirish emas, balki:

```
Postgres max_connections = 20–50   (kichik, barqaror qiymat)
PgBouncer / pgpool       = 1000+   (client tomondan, pooling orqali)
```

Connection pooler minglab client so'rovini kam sonli haqiqiy Postgres
ulanishiga yo'naltiradi — bu RAM tejaydi **va** "too many clients" xatosini
butunlay yo'qotadi.

---

## Boshqa tipik production xatolari

### 1. `work_mem`ni "tezroq bo'lsin" deb ko'tarib qo'yish

Bitta so'rovni tezlashtirish uchun `work_mem = 256MB` qilib qo'yilsa, va
100 ta ulanish bir vaqtda murakkab so'rov yuborsa:

```
Haqiqiy sarf = 256MB × 100 × 2 (operatsiya) = 51.2GB
```

Bu RAM'dan ancha oshib ketadi — server **OOM** bilan qulaydi. Yechim:
`work_mem`ni `max_connections` bilan birga, formula asosida hisoblash
(`03-formulas.md`ga qarang).

### 2. Autovacuum'ni sozlamasdan qoldirish

Katta jadvallarda default autovacuum sozlamalari yetarli bo'lmay, **table
bloat** (o'chirilgan/yangilangan qatorlar tozalanmay yig'ilishi) yuzaga
keladi. Natija: jadval jismoniy hajmi shishadi, so'rovlar sekinlashadi,
disk joy ortiqcha sarflanadi.

### 3. Monitoring/logging yoqilmaganligi

`log_min_duration_statement` va `pg_stat_statements` yoqilmasa, sekin
so'rovlarni aniqlash deyarli imkonsiz bo'lib qoladi — muammo paydo
bo'lgandan keyin emas, oldindan sozlanishi kerak.

### 4. Disk turini hisobga olmasdan `random_page_cost`ni o'zgartirmaslik

SSD/NVMe serverida default `random_page_cost = 4.0` qoldirilsa, planner
HDD davri mantig'i bilan ishlaydi — tezroq Index Scan o'rniga sekinroq Seq
Scan tanlanadi, zamonaviy diskning haqiqiy imkoniyati ishlatilmaydi.

### 5. Tuningni load test qilmasdan productionga qo'llash

Eng muhim xato — bu bizning lab natijamizning asosiy xulosasi:

> Tuning qilingan konfiguratsiya past yuklamada hatto default'dan biroz
> sekinroq ham chiqishi mumkin, va noto'g'ri bitta parametr butun serverni
> yiqitishi mumkin. Shu sababli **har qanday tuning o'zgarishi albatta real
> load test bilan tasdiqlanishi kerak**, nazariy formulaga ko'r-ko'rona
> ishonib emas.

---

## Xulosa: Tuning Checklist (production uchun)

- [ ] `shared_buffers`, `effective_cache_size` RAM asosida hisoblangan
- [ ] `work_mem × max_connections × avg_ops` RAM'ning yarmidan oshmaydi
- [ ] `max_connections` ilova ehtiyojiga mos, pooler bilan birga rejalashtirilgan
- [ ] `random_page_cost` / `effective_io_concurrency` real disk turiga mos
- [ ] `checkpoint_completion_target = 0.9` qo'yilgan
- [ ] `log_min_duration_statement`, `pg_stat_statements` yoqilgan
- [ ] Autovacuum sozlamalari jadval hajmiga mos ko'rib chiqilgan
- [ ] **Har bir o'zgarish staging muhitida load test bilan tekshirilgan**
- [ ] Monitoring (TPS, latency p95/p99, connection soni) kuzatib turilmoqda
