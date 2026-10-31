# 2-Ma'ruza: Parametrlar — Nima Vazifa Bajaradi va Nega Muhim

## 1. `shared_buffers` — PostgreSQL'ning o'z keshi

**Nima qiladi:** PostgreSQL diskdan o'qigan ma'lumot sahifalarini (8KB
bo'laklarda) operativ xotirada saqlab turadigan maxsus xotira hudud.

**Nega kerak:** Disk operatsiyasi RAM'dan minglab marta sekin. Bir xil
ma'lumot qayta-qayta so'ralsa, PostgreSQL diskka murojaat qilmasdan to'g'ridan
shu keshdan o'qiydi.

**Nega muhim:** Default (`128MB`) zamonaviy serverlar uchun juda kam —
doimiy "cache miss", ortiqcha disk I/O. Lekin haddan tashqari ko'paytirish
ham zararli: Linux OS'ning o'zi ham fayllarni keshlaydi (page cache), ikkita
kesh bir xil ma'lumotni ikki marta saqlasa (double buffering), xotira
behuda sarflanadi. Shu sababli ~25% "oltin o'rta" tanlanadi.

## 2. `effective_cache_size` — real xotira emas, "maslahat"

**Nima qiladi:** Hech qanday xotira ajratmaydi. Bu Query Planner'ga
"taxminan shuncha ma'lumot RAM'da (shared_buffers + OS cache) bor" deb
aytadigan ko'rsatma.

**Nega kerak:** Planner har so'rov uchun **Index Scan** yoki **Seq Scan**
orasida tanlov qiladi. Agar "ma'lumot RAM'da yo'q" deb o'ylasa, index'dan
qochadi.

**Nega muhim:** Past qo'yilsa, planner noto'g'ri qaror qabul qiladi —
jismonan ma'lumot keshda bo'lsa ham sekinroq Seq Scan tanlanishi mumkin.

## 3. `work_mem` — eng xavfli parametr

**Nima qiladi:** `ORDER BY`, `DISTINCT`, `GROUP BY`, `HASH JOIN` kabi
operatsiyalar uchun vaqtinchalik xotira. Sig'masa, PostgreSQL diskka
vaqtinchalik fayl yozadi ("disk spill").

**Nega kerak:** Disk spill — tezlikning asosiy dushmani. RAM'da
millisekundlarda bajariladigan sort, diskda soniyalab davom etadi.

**Nega eng xavfli:** Bu **global emas** — har bir ulanish, har bir
so'rovdagi har bir operatsiya uchun alohida ajratiladi:

```
Haqiqiy sarf = work_mem × faol ulanishlar × har birida nechta operatsiya
```

Noto'g'ri katta qiymat + ko'p ulanish = server **OOM** (Out Of Memory)
bilan qulab tushishi mumkin.

## 4. `maintenance_work_mem` — "orqa fon" ishlari uchun

**Nima qiladi:** `VACUUM`, `CREATE INDEX`, `REINDEX` kabi xizmat
operatsiyalari uchun xotira.

**Nega kerak:** Bu operatsiyalar kam sonli, lekin katta hajmdagi ma'lumot
bilan ishlaydi.

**Nega muhim:** Kam bo'lsa, `VACUUM` soatlab davom etishi mumkin —
natijada **table bloat** (o'chirilgan qatorlar tozalanmay yig'ilishi) va
so'rovlar sekinlashuvi.

## 5. `wal_buffers` — tranzaksiya jurnali uchun bufer

**Nima qiladi:** WAL (Write-Ahead Log) — har bir o'zgarish diskka
yozilishidan oldin jurnalga yoziladi (crash recovery uchun). `wal_buffers`
— shu yozuvlar uchun vaqtinchalik bufer.

**Nega muhim:** Kichik bo'lsa, har bir kichik o'zgarish darhol diskka
yoziladi — ko'p kichik I/O. Katta bufer bir nechta tranzaksiyani
birlashtirib, kamroq va kattaroq yozish qiladi.

## 6. `checkpoint_completion_target` — silliq yozish

**Nima qiladi:** Checkpoint — "dirty pages"ni (xotirada o'zgargan, diskka
hali yozilmagan) diskka yozib qo'yish jarayoni. Bu yozishning qancha vaqt
davomida tarqatilishini belgilaydi.

**Nega muhim:** Default `0.5` — barcha o'zgarish qisqa vaqtda "zarb bilan"
yoziladi, I/O spike yuzaga keladi. `0.9` — yozishni tekis taqsimlaydi,
"vaqti-vaqti bilan sayt sekinlashib qolish" muammosining klassik yechimi.

## 7. `min_wal_size` / `max_wal_size`

**Nima qiladi:** WAL fayllari hajm chegarasi, bilvosita checkpoint
chastotasini boshqaradi.

**Nega muhim:** Kichik `max_wal_size` → checkpoint tez-tez → I/O spike
kuchayadi. Kattaroq qiymat yozish yukini kamaytiradi, lekin crash recovery
vaqtini oshiradi (tezlik vs tiklanish vaqti trade-off).

## 8. `random_page_cost` — disk turi haqida haqiqat

**Nima qiladi:** Planner'ga tasodifiy sahifa o'qish ketma-ket o'qishdan
necha marta qimmat ekanini aytadi.

**Nega muhim:** HDD'da mexanik "seek" borligi uchun default `4.0` to'g'ri.
SSD/NVMe'da tasodifiy va ketma-ket o'qish deyarli bir xil tezlikda — shu
sababli `1.1` qilish kerak, aks holda planner tezroq Index Scan o'rniga
sekinroq Seq Scan tanlashi mumkin.

## 9. `effective_io_concurrency` — parallel disk so'rovlari

**Nima qiladi:** Disk bir vaqtda nechta I/O so'rov qabul qila olishini
bildiradi.

**Nega muhim:** HDD'da foyda kam (`2`), SSD/NVMe'da yuzlab parallel
so'rovni qabul qiladi (`200+`) — to'g'ri sozlansa, katta hajmdagi ma'lumotni
parallel o'qish imkoniyatidan foydalaniladi.

## 10. `max_connections` — nega RAM formula emas

**Nima qiladi:** Serverga bir vaqtda ulanishi mumkin bo'lgan maksimal
client soni. Har bir ulanish — alohida OS process (thread emas!), har biri
xotira sarflaydi.

**Nega muhim — bizning labda ko'rganimiz:** Buni "xavfsizlik uchun"
pasaytirsak, yuk ostida `"too many clients already"` xatosi bilan server
so'rovlarni rad eta boshlaydi. Oshirib yuborilsa — `work_mem` bilan birga
hisoblanmasa, xotira yetishmasligi xavfi bor. To'g'ri yechim: bu sonni
kichik ushlab, **PgBouncer** kabi connection pooler orqali minglab client
so'rovini kam sonli haqiqiy Postgres ulanishiga yo'naltirish.

## 11. `default_statistics_target`

**Nima qiladi:** Har bir ustun uchun yig'iladigan statistik ma'lumot
(qiymatlar taqsimoti, noyob qiymatlar soni) batafsilligi.

**Nega muhim:** OLTP uchun default `100` yetarli. OLAP (murakkab
analitika)da yuqoriroq (`300-500`) kerak — noto'g'ri tanlangan join
strategiyasi narxi juda qimmat bo'lishi mumkin.

## 12. `max_parallel_workers` va CPU parallelligi

**Nima qiladi:** Bitta katta so'rovni bir nechta CPU core'ga bo'lib
bajarish imkonini beradi.

**Nega muhim:** Default — har so'rov bitta process orqali. Ko'p yadroli
serverda bu resursning katta qismi bekor turishiga olib keladi, ayniqsa
katta `Seq Scan` yoki agregatsiya operatsiyalarida.

---

## Umumiy printsip

Hech bir parametrni boshqasidan ajratib o'zgartirib bo'lmaydi:

- `work_mem` oshirilsa → `max_connections` bilan ko'paytirilgan yig'indi
  RAM'dan oshmasligi kerak
- `shared_buffers` oshirilsa → `effective_cache_size` ham mos ravishda
  yangilanishi kerak
- `max_connections` pasaytirilsa → ilova tomonida pooler bo'lmasa, "too
  many clients" xatosi (bizning labdagi real holat)
- `max_wal_size` oshirilsa → tezlik ortadi, lekin crash recovery vaqti
  uzayadi

Shu sababli production serverda bitta parametrni alohida o'zgartirish
xavfli — har doim **butun tizim sifatida**, real load test bilan tekshirib
o'zgartirish kerak.
