# 1-Ma'ruza: Nega PostgreSQL Tuning Kerak?

## PostgreSQL "default" sozlamalari nima uchun yomon?

PostgreSQL loyihasi 1990-yillarning oxirida boshlangan va uning default
`postgresql.conf` qiymatlari **eng kichik, eng zaif serverda ham ishga
tushishi** uchun juda konservativ qilib belgilangan — masalan eski noutbuk
yoki 512MB RAM'li virtual mashina.

Natijada:

- `shared_buffers = 128MB` — zamonaviy serverda bu hajm hech narsaga
  yetmaydi
- `work_mem = 4MB` — murakkab so'rovlar doim diskka "spill" qiladi
- `max_connections = 100` — ba'zi yuklamalar uchun kam, ba'zilari uchun xavfli ko'p
- `checkpoint` sozlamalari disk yozishni silliqlashtirmagan

Bu — **PostgreSQL'ning kamchiligi emas**, balki falsafasi: "universal, hech
qayerda yiqilmaydigan boshlang'ich nuqta" berish. Production uchun esa har
doim serverning real resurslari (RAM, CPU, disk turi) va yuklama xarakteriga
(OLTP yoki OLAP) qarab sozlash talab qilinadi.

## Tuning nima va nima emas

**Tuning bu:**
- Serverning mavjud resurslarini (RAM, CPU, disk) to'liqroq ishlatish
- So'rov rejalashtiruvchisiga (query planner) real holat haqida to'g'ri
  ma'lumot berish
- Disk I/O yukini vaqt bo'yicha silliqlashtirish
- Ilova (application) ehtiyojiga mos ulanishlar sonini belgilash

**Tuning bu emas:**
- "Internetdan ko'chirib olingan raqamlar" — har bir server, har bir
  yuklama boshqacha
- Faqat bitta parametrni (masalan `work_mem`) oshirish — parametrlar
  bir-biriga bog'liq
- Bir marta qilib, abadiy unutib qo'yiladigan ish — yuklama o'zgarsa,
  tuning ham qayta ko'rib chiqilishi kerak

## Nega buni amaliy sinab ko'rish kerak

Nazariy formula va real natija har doim mos kelavermaydi. Shu lab loyihasida
biz buni o'z ko'zimiz bilan ko'ramiz:

> Dastlabki testda tuning qilingan server past yuklamada (5-50 client)
> default serverdan sal **sekinroq** chiqdi, va 100 client'da esa
> `max_connections` noto'g'ri pasaytirilgani sababli butunlay **ishlamay
> qoldi** — default server esa ishlashda davom etdi.

Bu aynan production'da uchraydigan stsenariy: tuning noto'g'ri qilinsa, u
yordam berish o'rniga zarar keltiradi. Shu sababli har qanday tuning
o'zgarishi **albatta load test bilan tekshirilishi** kerak, ishonch bilan
emas.

## Keyingi bo'limlar

- `02-parameters-explained.md` — har bir parametrning aniq vazifasi
- `03-formulas.md` — RAM/CPU asosida hisoblash formulalari
- `04-production-pitfalls.md` — bizning labda ko'rgan va boshqa tipik xatolar
