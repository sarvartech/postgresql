// PostgreSQL tuning formulalari — docs/03-formulas.md asosida.
// Brauzerda ham, Node testlarida ham ishlaydi; DOM'ga bog'liq emas.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.PgCalc = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const DISKS = {
    HDD: { label: "HDD", randomPageCost: 4.0, ioConcurrency: 2 },
    SSD: { label: "SATA SSD", randomPageCost: 1.1, ioConcurrency: 200 },
    NVME: { label: "NVMe SSD", randomPageCost: 1.1, ioConcurrency: 300 },
    SAN: { label: "Tarmoq disk (SAN/EBS)", randomPageCost: 1.5, ioConcurrency: 200 },
  };

  // MIXED uchun docs'da alohida qiymat yo'q: OLTP (2) va OLAP (4) o'rtasi olingan.
  const WORKLOADS = {
    OLTP: { label: "OLTP", avgOps: 2, statisticsTarget: 100 },
    MIXED: { label: "MIXED", avgOps: 3, statisticsTarget: 100 },
    OLAP: { label: "OLAP", avgOps: 4, statisticsTarget: 300 },
  };

  const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);

  // PostgreSQL xotira qiymati: faqat butun son, GB'ga bo'linsa GB ko'rinishida.
  function formatMb(mb) {
    return mb >= 1024 && mb % 1024 === 0 ? `${mb / 1024}GB` : `${mb}MB`;
  }

  function validate(input) {
    const errors = [];
    if (!(input.ramGb >= 1 && input.ramGb <= 4096)) errors.push("RAM 1 dan 4096 GB gacha bo'lishi kerak.");
    if (!(Number.isInteger(input.cpu) && input.cpu >= 1 && input.cpu <= 512)) errors.push("CPU yadrolari 1 dan 512 gacha butun son bo'lishi kerak.");
    if (!(Number.isInteger(input.maxConn) && input.maxConn >= 1 && input.maxConn <= 100000)) errors.push("Ulanishlar soni 1 dan 100000 gacha butun son bo'lishi kerak.");
    if (!(input.otherRamGb >= 0 && input.otherRamGb < input.ramGb)) errors.push("Boshqa servislar RAM'i 0 dan katta yoki teng, jami RAM'dan kichik bo'lishi kerak.");
    if (!DISKS[input.disk]) errors.push("Disk turi noto'g'ri.");
    if (!WORKLOADS[input.workload]) errors.push("Yuklama turi noto'g'ri.");
    return errors;
  }

  function calculate(input) {
    const errors = validate(input);
    if (errors.length) return { errors };

    const { ramGb, cpu, otherRamGb, maxConn, pooler, writeHeavy } = input;
    const disk = DISKS[input.disk];
    const workload = WORKLOADS[input.workload];
    const ramMb = ramGb * 1024;
    const otherMb = otherRamGb * 1024;

    const connections = pooler ? clamp(cpu * 10, 20, 50) : maxConn;
    const sharedBuffers = Math.floor(Math.min(ramMb * 0.25, 16 * 1024));
    const effectiveCache = Math.floor((ramMb - otherMb) * 0.75);
    const workMem = Math.max(1, Math.floor((ramMb * 0.25) / (connections * workload.avgOps)));
    const maintenance = Math.max(128, Math.round(Math.min(ramMb * 0.05, 2048)));
    const walBuffers = clamp(Math.floor(sharedBuffers / 32), 3, 16);
    const maxWal = Math.round(ramMb * (writeHeavy ? 1 : 0.5));
    const minWal = Math.round(maxWal / 4);
    const perGather = Math.min(cpu, Math.max(Math.floor(cpu / 2), 2));

    const worstWorkMem = workMem * connections * workload.avgOps;
    const worstTotal = sharedBuffers + worstWorkMem + maintenance + otherMb;

    const m = (name, mb, formula, restart) => ({ name, value: formatMb(mb), formula, restart: !!restart });
    const v = (name, value, formula, restart) => ({ name, value: String(value), formula, restart: !!restart });

    const params = [
      v("max_connections", connections, pooler ? "CPU × 10, 20–50 oralig'ida" : "kiritilgan qiymat", true),
      m("shared_buffers", sharedBuffers, "MIN(RAM × 0.25, 16GB)", true),
      m("effective_cache_size", effectiveCache, "(RAM − boshqa servislar) × 0.75"),
      m("work_mem", workMem, `(RAM × 0.25) / (${connections} × ${workload.avgOps})`),
      m("maintenance_work_mem", maintenance, "MIN(RAM × 0.05, 2GB), kamida 128MB"),
      m("wal_buffers", walBuffers, "CLAMP(shared_buffers / 32, 3MB, 16MB)", true),
      m("min_wal_size", minWal, "max_wal_size / 4"),
      m("max_wal_size", maxWal, writeHeavy ? "RAM × 1.0" : "RAM × 0.5"),
      v("checkpoint_completion_target", "0.9", "qat'iy qiymat"),
      v("random_page_cost", disk.randomPageCost.toFixed(1), `disk: ${disk.label}`),
      v("effective_io_concurrency", disk.ioConcurrency, `disk: ${disk.label}`),
      v("default_statistics_target", workload.statisticsTarget, `yuklama: ${workload.label}`),
      v("max_worker_processes", cpu, "CPU_CORES", true),
      v("max_parallel_workers", cpu, "CPU_CORES"),
      v("max_parallel_workers_per_gather", perGather, "MAX(CPU / 2, 2), CPU'dan oshmaydi"),
      v("log_min_duration_statement", 200, "200ms dan sekin so'rovlarni log qilish"),
      v("shared_preload_libraries", "'pg_stat_statements'", "so'rov statistikasi", true),
    ];

    const checks = [];
    const check = (level, text) => checks.push({ level, text });

    const safetyLimit = ramMb * 0.5;
    if (worstWorkMem <= safetyLimit) {
      check("ok", `work_mem xavfsizlik sharti bajarildi: ${formatMb(worstWorkMem)} ≤ ${formatMb(Math.floor(safetyLimit))} (RAM'ning yarmi).`);
    } else {
      check("danger", `work_mem × ulanishlar × operatsiyalar = ${formatMb(worstWorkMem)}, bu RAM'ning yarmidan ko'p. Eng yomon holatda server swap yoki OOM'ga tushadi. Ulanishlarni kamaytiring yoki PgBouncer yoqing.`);
    }
    if (worstTotal > ramMb) {
      check("danger", `Eng yomon holatdagi jami sarf (${formatMb(Math.round(worstTotal))}) serverdagi RAM'dan ko'p.`);
    }
    if (workMem < 4) {
      check("warn", `work_mem ${workMem}MB chiqdi, bu default 4MB dan past. Sort va hash ko'proq diskka tushadi. Ulanishlar sonini kamaytirish yoki PgBouncer ishlatish yaxshiroq.`);
    }
    if (!pooler && maxConn > cpu * 10) {
      check("warn", `${maxConn} ta ulanish CPU × 10 = ${cpu * 10} taxminidan yuqori. Har bir ulanish alohida OS process, shuning uchun PgBouncer tavsiya etiladi.`);
    }
    if (otherMb > ramMb * 0.25) {
      check("warn", "Serverda boshqa servislar ko'p RAM ishlatadi. shared_buffers formulasi jami RAM'dan hisoblanadi, shuning uchun uni qo'lda kamaytirishni ko'rib chiqing.");
    }
    if (maxWal >= 16 * 1024) {
      check("warn", `max_wal_size ${formatMb(maxWal)}: pg_wal uchun diskda shuncha joy borligini tekshiring. Bu qiymat crash recovery vaqtini ham uzaytiradi.`);
    }
    if (pooler) {
      check("ok", `PgBouncer: max_client_conn = ${maxConn}, Postgres'ga ${connections} ta haqiqiy ulanish.`);
    }

    return {
      errors: [],
      params,
      checks,
      memory: { ramMb, otherMb, sharedBuffers, worstWorkMem, maintenance, worstTotal },
    };
  }

  function toConf(input, result) {
    const disk = DISKS[input.disk];
    const lines = [
      "# PostgreSQL tuning — postgres.facesys.uz kalkulyatori",
      `# RAM: ${input.ramGb}GB (boshqa servislar: ${input.otherRamGb}GB), CPU: ${input.cpu}, disk: ${disk.label}, yuklama: ${input.workload}`,
      "# (restart) belgili parametrlar faqat PostgreSQL restart'dan keyin kuchga kiradi.",
      "# Productionga qo'yishdan oldin load test bilan tekshiring.",
      "",
    ];
    for (const p of result.params) {
      lines.push(`${p.name} = ${p.value}${p.restart ? "  # (restart)" : ""}`);
    }
    return lines.join("\n") + "\n";
  }

  return { DISKS, WORKLOADS, calculate, toConf, formatMb };
});
