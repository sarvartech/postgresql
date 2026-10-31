(function () {
  "use strict";
  const { calculate, toConf, formatMb } = window.PgCalc;
  const $ = (id) => document.getElementById(id);
  const form = $("form");

  const PRESETS = {
    lab: { ram: 2, cpu: 2, disk: "SSD", conn: 50, workload: "OLTP", other: 0, pooler: false, write: false },
    web: { ram: 8, cpu: 4, disk: "SSD", conn: 100, workload: "MIXED", other: 2, pooler: true, write: false },
    db: { ram: 32, cpu: 16, disk: "NVME", conn: 300, workload: "OLTP", other: 0, pooler: true, write: true },
    dwh: { ram: 128, cpu: 32, disk: "NVME", conn: 40, workload: "OLAP", other: 0, pooler: false, write: false },
  };

  let lastConf = "";

  function readInput() {
    return {
      ramGb: parseFloat($("ram").value),
      cpu: Number($("cpu").value),
      disk: $("disk").value,
      maxConn: Number($("conn").value),
      workload: form.elements.workload.value,
      otherRamGb: $("other").value === "" ? 0 : parseFloat($("other").value),
      pooler: $("pooler").checked,
      writeHeavy: $("write").checked,
    };
  }

  function el(tag, cls, text) {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function renderTable(params) {
    const body = $("rows");
    body.replaceChildren();
    for (const p of params) {
      const row = el("tr");
      const name = el("td", "name");
      name.append(el("code", "", p.name));
      if (p.restart) name.append(el("span", "badge", "restart"));
      row.append(name, el("td", "value", p.value), el("td", "formula", p.formula));
      body.append(row);
    }
  }

  function renderChecks(checks) {
    const box = $("checks");
    box.replaceChildren();
    const labels = { ok: "OK", warn: "Diqqat", danger: "Xavf" };
    for (const c of checks) {
      const item = el("li", `check ${c.level}`);
      item.append(el("strong", "", labels[c.level]), el("span", "", c.text));
      box.append(item);
    }
  }

  function renderMemory(mem) {
    const scale = Math.max(mem.ramMb, mem.worstTotal);
    const parts = [
      ["seg-other", "Boshqa servislar", mem.otherMb],
      ["seg-shared", "shared_buffers", mem.sharedBuffers],
      ["seg-work", "work_mem (eng yomon holat)", mem.worstWorkMem],
      ["seg-maint", "maintenance_work_mem", mem.maintenance],
    ];
    const bar = $("bar");
    const legend = $("legend");
    bar.replaceChildren();
    legend.replaceChildren();
    for (const [cls, label, mb] of parts) {
      if (!mb) continue;
      const seg = el("span", cls);
      seg.style.width = `${(mb / scale) * 100}%`;
      seg.title = `${label}: ${formatMb(Math.round(mb))}`;
      bar.append(seg);
      const item = el("li");
      item.append(el("i", cls), document.createTextNode(`${label} `), el("b", "", formatMb(Math.round(mb))));
      legend.append(item);
    }
    $("memory-total").textContent = `${formatMb(Math.round(mem.worstTotal))} / ${formatMb(Math.round(mem.ramMb))}`;
    $("memory-total").classList.toggle("over", mem.worstTotal > mem.ramMb);
  }

  function update() {
    const input = readInput();
    const res = calculate(input);
    const errors = $("errors");
    errors.replaceChildren();
    $("results").hidden = res.errors.length > 0;
    $("conn-label").textContent = input.pooler ? "Client ulanishlar (PgBouncer'ga)" : "Maksimal ulanishlar";
    if (res.errors.length) {
      res.errors.forEach((msg) => errors.append(el("li", "", msg)));
      lastConf = "";
      return;
    }
    renderTable(res.params);
    renderChecks(res.checks);
    renderMemory(res.memory);
    lastConf = toConf(input, res);
    $("conf").textContent = lastConf;
  }

  function applyPreset(name) {
    const p = PRESETS[name];
    $("ram").value = p.ram;
    $("cpu").value = p.cpu;
    $("disk").value = p.disk;
    $("conn").value = p.conn;
    $("other").value = p.other;
    form.elements.workload.value = p.workload;
    $("pooler").checked = p.pooler;
    $("write").checked = p.write;
    update();
  }

  async function copyConf(button) {
    const original = button.textContent;
    try {
      await navigator.clipboard.writeText(lastConf);
      button.textContent = "Nusxalandi";
    } catch {
      const range = document.createRange();
      range.selectNodeContents($("conf"));
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
      button.textContent = "Ctrl+C bosing";
    }
    setTimeout(() => (button.textContent = original), 1600);
  }

  function downloadConf() {
    const url = URL.createObjectURL(new Blob([lastConf], { type: "text/plain" }));
    const a = el("a");
    a.href = url;
    a.download = "tuning.conf";
    a.click();
    URL.revokeObjectURL(url);
  }

  form.addEventListener("input", update);
  form.addEventListener("submit", (e) => e.preventDefault());
  document.querySelectorAll("[data-preset]").forEach((b) => b.addEventListener("click", () => applyPreset(b.dataset.preset)));
  $("copy").addEventListener("click", (e) => copyConf(e.currentTarget));
  $("download").addEventListener("click", downloadConf);
  update();
})();
