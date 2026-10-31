const test = require("node:test");
const assert = require("node:assert/strict");
const { calculate, toConf, formatMb } = require("../site/calc.js");

const base = { ramGb: 2, cpu: 2, disk: "SSD", maxConn: 50, workload: "OLTP", otherRamGb: 0, pooler: false, writeHeavy: false };
const run = (over) => calculate({ ...base, ...over });
const val = (res, name) => res.params.find((p) => p.name === name).value;

test("work_mem: docs misoli (2GB, 50 ulanish, OLTP) ≈ 5MB", () => {
  assert.equal(val(run({}), "work_mem"), "5MB");
});

test("shared_buffers: RAM × 0.25, 16GB dan oshmaydi", () => {
  assert.equal(val(run({ ramGb: 8 }), "shared_buffers"), "2GB");
  assert.equal(val(run({ ramGb: 32 }), "shared_buffers"), "8GB");
  assert.equal(val(run({ ramGb: 128 }), "shared_buffers"), "16GB");
});

test("effective_cache_size boshqa servislarni hisobga oladi", () => {
  assert.equal(val(run({ ramGb: 8 }), "effective_cache_size"), "6GB");
  assert.equal(val(run({ ramGb: 8, otherRamGb: 4 }), "effective_cache_size"), "3GB");
});

test("maintenance_work_mem: docs jadvali", () => {
  assert.equal(val(run({ ramGb: 2 }), "maintenance_work_mem"), "128MB");
  assert.equal(val(run({ ramGb: 8 }), "maintenance_work_mem"), "410MB");
  assert.equal(val(run({ ramGb: 32 }), "maintenance_work_mem"), "1638MB");
  assert.equal(val(run({ ramGb: 128 }), "maintenance_work_mem"), "2GB");
});

test("wal_buffers 3MB–16MB oralig'ida", () => {
  assert.equal(val(run({ ramGb: 1 }), "wal_buffers"), "8MB");
  assert.equal(val(run({ ramGb: 64 }), "wal_buffers"), "16MB");
});

test("max_wal_size: docs jadvali, min = max / 4", () => {
  assert.equal(val(run({ ramGb: 2 }), "max_wal_size"), "1GB");
  assert.equal(val(run({ ramGb: 2 }), "min_wal_size"), "256MB");
  assert.equal(val(run({ ramGb: 8 }), "max_wal_size"), "4GB");
  assert.equal(val(run({ ramGb: 32 }), "max_wal_size"), "16GB");
  assert.equal(val(run({ ramGb: 8, writeHeavy: true }), "max_wal_size"), "8GB");
});

test("disk jadvali", () => {
  assert.equal(val(run({ disk: "HDD" }), "random_page_cost"), "4.0");
  assert.equal(val(run({ disk: "HDD" }), "effective_io_concurrency"), "2");
  assert.equal(val(run({ disk: "NVME" }), "effective_io_concurrency"), "300");
});

test("parallel workerlar CPU'dan oshmaydi", () => {
  assert.equal(val(run({ cpu: 8 }), "max_parallel_workers_per_gather"), "4");
  assert.equal(val(run({ cpu: 2 }), "max_parallel_workers_per_gather"), "2");
  assert.equal(val(run({ cpu: 1 }), "max_parallel_workers_per_gather"), "1");
});

test("pooler: Postgres ulanishlari 20–50 oralig'ida", () => {
  assert.equal(val(run({ cpu: 1, pooler: true, maxConn: 1000 }), "max_connections"), "20");
  assert.equal(val(run({ cpu: 16, pooler: true, maxConn: 1000 }), "max_connections"), "50");
});

test("juda ko'p ulanish: work_mem 1MB va xavf ogohlantirishi", () => {
  const res = run({ ramGb: 1, maxConn: 5000 });
  assert.equal(val(res, "work_mem"), "1MB");
  assert.ok(res.checks.some((c) => c.level === "danger"));
});

test("noto'g'ri kiritish hisoblanmaydi", () => {
  assert.ok(run({ ramGb: 0 }).errors.length);
  assert.ok(run({ cpu: 1.5 }).errors.length);
  assert.ok(run({ ramGb: 4, otherRamGb: 4 }).errors.length);
  assert.ok(run({ maxConn: NaN }).errors.length);
  assert.ok(run({ disk: "TAPE" }).errors.length);
});

test("formatMb PostgreSQL qabul qiladigan butun qiymat beradi", () => {
  assert.equal(formatMb(1024), "1GB");
  assert.equal(formatMb(1536), "1536MB");
  assert.equal(formatMb(512), "512MB");
});

test("barcha xotira qiymatlari kasr sonsiz: RAM 1.5GB", () => {
  const res = run({ ramGb: 1.5, otherRamGb: 0.3 });
  for (const p of res.params) assert.doesNotMatch(p.value, /^\d+\.\d+(MB|GB)$/, p.name);
});

test("toConf har bir parametrni va restart belgisini chiqaradi", () => {
  const res = run({});
  const conf = toConf(base, res);
  for (const p of res.params) assert.ok(conf.includes(`${p.name} = ${p.value}`), p.name);
  assert.match(conf, /shared_buffers = 512MB {2}# \(restart\)/);
});
