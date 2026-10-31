# 3-Ma'ruza: Parametrlarni Ilmiy Hisoblash Formulalari

Bu formulalar **istalgan hostga** (RAM, CPU, disk turiga qarab) moslashadi —
o'zgaruvchilarni almashtirib hisoblang.

## Kirish o'zgaruvchilari

```
RAM_GB    = serverdagi jami operativ xotira (GB)
CPU_CORES = nechta protsessor yadrosi
DISK_TYPE = HDD | SSD | NVMe
MAX_CONN  = kutilayotgan maksimal parallel ulanishlar soni
WORKLOAD  = OLTP (ko'p kichik tranzaksiya) | OLAP (analitika) | MIXED
```

## 1. `shared_buffers`

```
shared_buffers = MIN(RAM_GB × 0.25, 16) GB
```

| RAM | Formula | Izoh |
|---|---|---|
| ≤ 2GB | RAM × 0.25 | minimal, OS'ga joy qoldirish kerak |
| 2–8GB | RAM × 0.25 | standart qoida ishlaydi |
| 8–32GB | RAM × 0.25 (max 8GB) | 25% dan oshsa ham 8GB dan oshirmaslik |
| > 32GB | 8–16GB qat'iy | undan ortig'i deyarli foyda bermaydi |

## 2. `effective_cache_size`

```
effective_cache_size = RAM_GB × 0.75
```

Boshqa servislar (nginx, app) ham shu serverda bo'lsa:
```
effective_cache_size = (RAM_GB − boshqa_servis_RAM) × 0.70–0.75
```

## 3. `work_mem`

```
work_mem(MB) = (RAM_GB × 1024 × 0.25) / (MAX_CONN × avg_ops_per_query)
```

`avg_ops_per_query`:
- Oddiy OLTP: **2**
- Murakkab JOIN/reporting: **4**
- Parallel query yoqilgan: **4–8**

**Misol (2GB RAM, 50 connection, OLTP):**
```
work_mem = (2048 × 0.25) / (50 × 2) = 512 / 100 ≈ 5MB
```

**Xavfsizlik cheklovi:**
```
work_mem × MAX_CONN × avg_ops_per_query ≤ RAM_GB × 1024 × 0.5
```

Shart buzilsa — worst-case'da server swap/OOM'ga tushadi.

## 4. `maintenance_work_mem`

```
maintenance_work_mem = MIN(RAM_GB × 1024 × 0.05, 2048) MB
```

| RAM | Natija |
|---|---|
| 2GB | ~102MB → 128MB ga yaxlitlanadi |
| 8GB | ~410MB |
| 32GB | ~1638MB |
| 128GB | 2GB (cheklov ishlaydi) |

## 5. `max_connections`

RAM formula emas — ilova arxitekturasiga bog'liq:

```
max_connections = CPU_CORES × 10   (boshlang'ich taxmin, OLTP)
```

Pooler bilan (tavsiya etiladi):
```
Postgres max_connections = 20–50   (pooler orqasida)
PgBouncer pool_size       = 1000+  (client tomondan)
```

## 6. `wal_buffers`

```
wal_buffers = CLAMP(shared_buffers / 32, 3MB, 16MB)
```

## 7. `min_wal_size` / `max_wal_size`

```
max_wal_size = RAM_GB × 0.5 GB     (OLTP)
max_wal_size = RAM_GB × 1.0 GB     (yuqori yozish intensivligi)
min_wal_size = max_wal_size / 4
```

| RAM | max_wal_size (OLTP) |
|---|---|
| 2GB | 1GB |
| 8GB | 4GB |
| 32GB | 16GB |

## 8. `checkpoint_completion_target`

Qat'iy qiymat, har doim:
```
checkpoint_completion_target = 0.9
```

## 9. `random_page_cost` / `effective_io_concurrency`

| DISK_TYPE | random_page_cost | effective_io_concurrency |
|---|---|---|
| HDD | 4.0 (default) | 2 |
| SATA SSD | 1.1 | 200 |
| NVMe SSD | 1.0–1.1 | 300–400 |
| Tarmoq disk (SAN/EBS) | 1.5–2.0 | 100–200 |

## 10. `default_statistics_target`

```
OLTP → 100 (default)
OLAP → 300–500
```

## 11. Parallel workerlar

```
max_worker_processes             = CPU_CORES
max_parallel_workers             = CPU_CORES
max_parallel_workers_per_gather  = MAX(CPU_CORES / 2, 2)
```

## Umumiy jadval (tez ko'rish uchun)

| Parametr | Formula |
|---|---|
| shared_buffers | `MIN(RAM×0.25, 16GB)` |
| effective_cache_size | `RAM×0.75` |
| work_mem | `(RAM×0.25×1024) / (max_conn × 2÷4)` |
| maintenance_work_mem | `MIN(RAM×1024×0.05, 2048)MB` |
| wal_buffers | `CLAMP(shared_buffers/32, 3MB, 16MB)` |
| max_wal_size | `RAM×0.5GB` (OLTP) |
| min_wal_size | `max_wal_size/4` |
| max_connections | ilova ehtiyoji / pooler bilan 20–50 |
| random_page_cost | disk jadvalidan |
| max_parallel_workers | CPU_CORES |

## Bizning lab misolimiz (2GB RAM, 2 CPU, Control-node)

| Parametr | Hisoblangan qiymat |
|---|---|
| shared_buffers | 480MB |
| effective_cache_size | 1400MB |
| work_mem | 8MB |
| maintenance_work_mem | 128MB |
| wal_buffers | 16MB |
| max_wal_size | 2GB |
| min_wal_size | 512MB |
| max_connections | 50 → keyin 200 ga tuzatildi (sabab: `04-production-pitfalls.md`) |
| random_page_cost | 1.1 |
| effective_io_concurrency | 200 |
