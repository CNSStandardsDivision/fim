/* FIRMS Dashboard — read-only view of FIM_Facilities / FIM_Records (SharePoint REST, MSAL delegated) */
(function () {
  "use strict";
  const C = window.FIRMS_CONFIG;
  const DEMO = new URLSearchParams(location.search).has("demo");
  const $app = document.getElementById("app");
  const $top = document.getElementById("topRight");
  const $drawer = document.getElementById("drawer");
  const $scrim = document.getElementById("scrim");

  // ---------- status (same set as FIRMS Recorder nfStatus) ----------
  const STATUS = [
    { key: "Expired",        label: "Overdue",             fg: "#8E2F2F", bg: "#F5E1E1", dot: "#A63A3A" },
    { key: "PastDue",        label: "เกิน Next Due",        fg: "#93451B", bg: "#F7E7DE", dot: "#C0612B" },
    { key: "Action Pending", label: "รอมาตรการ",           fg: "#574A7D", bg: "#ECE8F3", dot: "#6B5B95" },
    { key: "Out of Service", label: "ปิดให้บริการ",         fg: "#57524D", bg: "#EEEBE7", dot: "#7A7570" },
    { key: "Due Next Month", label: "ครบกำหนดเดือนหน้า",    fg: "#7A5713", bg: "#F6EEDC", dot: "#B7862B" },
    { key: "No Record",      label: "ยังไม่มีผล",           fg: "#6F665D", bg: "#F3EEE6", dot: "#A89C8C" },
    { key: "Valid",          label: "Valid",               fg: "#2F6446", bg: "#E8F1EC", dot: "#3F7D5A" }
  ];
  const ST = Object.fromEntries(STATUS.map((s, i) => [s.key, { ...s, sort: i }]));
  const RESULT_COLOR = { Unrestricted: "#2F6446", Restricted: "#7A5713", Unusable: "#8E2F2F" };
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  // ---------- state ----------
  const S = {
    account: null, canAdd: false, loadedAt: null, loading: false,
    fac: [], recs: [], types: {},
    f: { status: "", branch: "", site: "", type: "", q: "", month: "" },
    open: null
  };

  // ---------- helpers ----------
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const BKK = 7 * 3600e3; // SharePoint site time zone: Bangkok (UTC+7, no DST)
  function day(iso) { // SharePoint date-only (UTC instant of local midnight) -> "YYYY-MM-DD"
    if (!iso) return "";
    const d = new Date(Date.parse(iso) + BKK);
    return isNaN(d) ? "" : d.toISOString().slice(0, 10);
  }
  const today = () => new Date(Date.now() + BKK).toISOString().slice(0, 10);
  const dmy = ymd => ymd ? ymd.slice(8, 10) + "/" + ymd.slice(5, 7) + "/" + ymd.slice(0, 4) : "–";
  function range(a, b) {
    if (!b) return "–";
    if (!a || a === b) return dmy(b);
    return a.slice(0, 4) === b.slice(0, 4) ? a.slice(8, 10) + "/" + a.slice(5, 7) + " – " + dmy(b) : dmy(a) + " – " + dmy(b);
  }
  const url = v => !v ? "" : typeof v === "string" ? v.split(",")[0].trim() : (v.Url || "");
  const pill = k => { const s = ST[k] || ST["No Record"]; return `<span class="pill" style="background:${s.bg};color:${s.fg}"><i style="background:${s.dot}"></i>${esc(s.label)}</span>`; };
  const recorderLink = lic => C.recorderUrl + (lic ? "&facility=" + encodeURIComponent(lic) : "");
  // same folder rule as F1 TypeFolder: "/" -> "-", drop "(" ")", trim
  const folderLink = x => {
    const sitePath = new URL(C.siteUrl).pathname;
    const typeFolder = String(x.type || "").replace(/\//g, "-").replace(/[()]/g, "").trim();
    return C.siteUrl + "/" + C.libraryUrl + "/Forms/AllItems.aspx?id=" + encodeURIComponent(sitePath + "/" + C.libraryUrl + "/" + x.site + "/" + typeFolder);
  };
  const stamp = d => d ? `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}` : "";
  const ICON = {
    search: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/></svg>',
    refresh: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 1 1-3-6.7L21 8"/><path d="M21 3v5h-5"/></svg>',
    x: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M6 6l12 12M18 6L6 18"/></svg>',
    plus: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6"><path d="M12 5v14M5 12h14"/></svg>',
    file: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8z"/><path d="M14 3v5h5"/></svg>'
  };
  function initials(name) {
    const w = String(name || "").trim().split(/\s+/).filter(Boolean);
    const pick = s => (/^[เแโใไ]/.test(s) ? s.charAt(1) : s.charAt(0));
    return (w.length > 1 ? pick(w[0]) + pick(w[w.length - 1]) : pick(w[0] || "?")).toUpperCase();
  }

  // ---------- auth + data ----------
  let pca = null;
  async function token() {
    const account = S.account;
    try { return (await pca.acquireTokenSilent({ scopes: [C.spScope], account })).accessToken; }
    catch (e) {
      if (e instanceof msal.InteractionRequiredAuthError) { await pca.acquireTokenRedirect({ scopes: [C.spScope], account }); return null; }
      throw e;
    }
  }
  async function sp(tk, path) {
    const res = await fetch(C.siteUrl + path, { headers: { Authorization: "Bearer " + tk, Accept: "application/json;odata=nometadata" } });
    if (!res.ok) {
      let msg = ""; try { const j = await res.json(); msg = j["odata.error"]?.message?.value || j.error?.message || ""; } catch (_) { }
      const err = new Error(`HTTP ${res.status}${msg ? " · " + msg : ""}`); err.status = res.status; throw err;
    }
    return res.json();
  }
  const list = n => `/_api/web/lists/getbytitle('${n}')`;

  // Columns the dashboard reads. Each entry: wanted name -> candidates (internal name or display name).
  // Real internal names can differ from the build guide (T11), so every list is read with $select=*
  // and each column is resolved through the list's field metadata instead of a fixed $select.
  const WANT = {
    facilities: { Title: ["Title"], SiteCode: ["SiteCode"], SiteName: ["SiteName"], FacilityType: ["FacilityType"], BaseType: ["BaseType"],
      LicenseHolder: ["LicenseHolder", "LicenceHolder"], LicenseStatus: ["LicenseStatus"], OperationalStatus: ["OperationalStatus"],
      DueStatus: ["DueStatus"], LastInspection: ["LastInspection"], LastRecord: ["LastRecord"], NextDueDate: ["NextDueDate"], ExtendableDueDate: ["ExtendableDueDate"] },
    records: { Title: ["Title"], Facility: ["Facility"], FlightDateStart: ["FlightDateStart"], FlightDate: ["FlightDate"], InspectionType: ["InspectionType"],
      Result: ["Result"], Measure: ["Measure"], MeasureCompleted: ["MeasureCompleted"], NextDueDate: ["NextDueDate"], ExtendableDueDate: ["ExtendableDueDate"],
      CertifiedDate: ["CertifiedDate"], LetterNo: ["LetterNo"], LetterDate: ["LetterDate"], FileLink: ["FileLink"], LetterLink: ["LetterLink"],
      Note: ["Note"], IsBaseline: ["IsBaseline"] },
    types: { Title: ["Title"], IntervalValue: ["IntervalValue"], IntervalUnit: ["IntervalUnit"] }
  };
  S.missing = [];

  // fields: [{InternalName, Title, TypeAsString}] -> getter(item, wantedName)
  function resolver(listKey, fields) {
    const map = {};
    for (const [want, cands] of Object.entries(WANT[listKey])) {
      if (!fields) { map[want] = { key: want }; continue; }
      let f = null;
      for (const c of cands) {
        f = fields.find(x => x.InternalName === c) || fields.find(x => String(x.Title).toLowerCase() === c.toLowerCase());
        if (f) break;
      }
      if (!f) { S.missing.push(C.lists[listKey] + "." + want); map[want] = { key: want }; continue; }
      const lookup = /^Lookup/.test(f.TypeAsString || "");
      map[want] = { key: lookup ? f.InternalName + "Id" : f.InternalName };
    }
    return (item, want) => item[map[want].key];
  }

  async function fetchAll() {
    if (DEMO) return window.FIRMS_DEMO();
    const tk = await token(); if (!tk) return null;
    const fields = n => sp(tk, list(n) + "/fields?$select=InternalName,Title,TypeAsString&$filter=Hidden eq false").then(d => d.value);
    const [f, r, t, ff, fr, ft, p] = await Promise.all([
      sp(tk, list(C.lists.facilities) + "/items?$top=5000&$select=*"),
      sp(tk, list(C.lists.records) + "/items?$top=5000&$orderby=ID desc&$select=*,Author/Title&$expand=Author"),
      sp(tk, list(C.lists.types) + "/items?$top=100&$select=*"),
      fields(C.lists.facilities), fields(C.lists.records), fields(C.lists.types),
      sp(tk, "/_api/web/currentuser/groups?$select=Title").then(d => d.value.map(g => g.Title)).catch(() => [])
    ]);
    return { facilities: f.value, records: r.value, types: t.value, fields: { facilities: ff, records: fr, types: ft }, groups: p };
  }

  function normalize(raw) {
    S.missing = [];
    const fld = raw.fields || {};
    const gf = resolver("facilities", fld.facilities), gr = resolver("records", fld.records), gt = resolver("types", fld.types);
    S.types = Object.fromEntries((raw.types || []).map(t => [gt(t, "Title"), { IntervalValue: gt(t, "IntervalValue"), IntervalUnit: gt(t, "IntervalUnit") }]));
    S.fac = (raw.facilities || [])
      .filter(x => gf(x, "LicenseStatus") === "ปกติ")
      .map(x => {
        const op = gf(x, "OperationalStatus") || "Service Ready";
        const key = op === "Service Ready" ? (gf(x, "DueStatus") || "No Record") : op;
        const base = gf(x, "BaseType") || "";
        const t = S.types[base] || {};
        return {
          id: x.ID, lic: String(gf(x, "Title") || "").trim(), site: gf(x, "SiteCode") || "", name: gf(x, "SiteName") || "", type: gf(x, "FacilityType") || "",
          base, holder: gf(x, "LicenseHolder") || "", key, branch: base ? (base === "SSR" ? "S" : "N") : "", // same rule as F4
          interval: t.IntervalValue ? `ทุก ${t.IntervalValue} ${t.IntervalUnit === "Day" ? "วัน" : t.IntervalUnit === "Month" ? "เดือน" : "ปี"}` : "–",
          last: day(gf(x, "LastInspection")), lastRec: gf(x, "LastRecord") || "", next: day(gf(x, "NextDueDate")), ext: day(gf(x, "ExtendableDueDate"))
        };
      });
    S.recs = (raw.records || []).map(x => ({
      id: x.ID, fir: gr(x, "Title") || "FIR-" + String(x.ID).padStart(4, "0"), facId: raw.fields ? gr(x, "Facility") : x.FacilityId,
      start: day(gr(x, "FlightDateStart")), end: day(gr(x, "FlightDate")), itype: gr(x, "InspectionType") || "", result: gr(x, "Result") || "",
      measure: gr(x, "Measure") || "", done: !!gr(x, "MeasureCompleted"), next: day(gr(x, "NextDueDate")), ext: day(gr(x, "ExtendableDueDate")),
      cert: day(gr(x, "CertifiedDate")), letterNo: gr(x, "LetterNo") || "", letterDate: day(gr(x, "LetterDate")),
      file: url(gr(x, "FileLink")), letter: url(gr(x, "LetterLink")), note: gr(x, "Note") || "", baseline: !!gr(x, "IsBaseline"),
      by: x.Author?.Title || "", created: x.Created || ""
    }));
    if (S.missing.length) console.warn("FIRMS: columns not found", S.missing);
    S.canAdd = DEMO ? true : (raw.groups || []).some(g => C.recorderGroups.includes(g));
    S.loadedAt = new Date();
  }

  async function load(first) {
    if (S.loading) return;
    S.loading = true; renderTop();
    if (first) $app.innerHTML = skeleton();
    try {
      const raw = await fetchAll();
      if (!raw) return;
      normalize(raw);
      render();
      if (S.open) openDrawer(S.open, true);
    } catch (e) {
      const denied = e.status === 401 || e.status === 403;
      $app.innerHTML = stateCard(denied ? "บัญชีนี้ยังไม่มีสิทธิ์อ่านข้อมูล FIRMS" : "โหลดข้อมูลไม่สำเร็จ",
        denied ? "กรุณาติดต่อ Admin กอง NA เพื่อขอสิทธิ์อ่านทะเบียน Facility และผลการบินทดสอบ" : "ลองโหลดใหม่อีกครั้ง ถ้ายังไม่ได้ ส่งข้อความด้านล่างให้ Admin",
        e.message, `<button class="btn" id="retry">${ICON.refresh} โหลดใหม่</button>`);
      document.getElementById("retry").onclick = () => load(true);
    } finally { S.loading = false; renderTop(); }
  }

  // ---------- filtering ----------
  function filtered(ignore) {
    const f = S.f, q = f.q.trim().toLowerCase();
    return S.fac.filter(x =>
      (ignore === "status" || !f.status || x.key === f.status) &&
      (!f.branch || x.branch === f.branch) &&
      (!f.site || x.site === f.site) &&
      (!f.type || x.base === f.type) &&
      (ignore === "month" || !f.month || (x.next && x.next.slice(0, 7) === f.month)) &&
      (!q || [x.site, x.name, x.type, x.lic, x.holder].join(" ").toLowerCase().includes(q))
    ).sort((a, b) => (ST[a.key]?.sort ?? 9) - (ST[b.key]?.sort ?? 9) || (a.next || "9999").localeCompare(b.next || "9999") || a.site.localeCompare(b.site));
  }

  // ---------- render ----------
  function renderTop() {
    if (!S.account && !DEMO) { $top.innerHTML = ""; return; }
    const name = DEMO ? "ผู้ใช้ตัวอย่าง" : (S.account.name || S.account.username);
    const mail = DEMO ? "demo" : S.account.username;
    $top.innerHTML = `
      ${DEMO ? '<span class="demo-flag">ข้อมูลตัวอย่าง</span>' : ""}
      <div class="stamp">${S.loadedAt ? "ข้อมูล ณ<br>" + stamp(S.loadedAt) : ""}</div>
      <button class="icon-btn${S.loading ? " spin" : ""}" id="reload" title="โหลดข้อมูลใหม่" aria-label="โหลดข้อมูลใหม่">${ICON.refresh}</button>
      <div class="user"><div class="who"><b>${esc(name)}</b><span>${esc(mail)}</span></div>
      <div class="avatar" title="${esc(name)}">${esc(initials(name))}</div>
      ${DEMO ? "" : `<button class="icon-btn" id="logout" title="ออกจากระบบ" aria-label="ออกจากระบบ"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10"/></svg></button>`}</div>`;
    document.getElementById("reload").onclick = () => load(false);
    const lo = document.getElementById("logout");
    if (lo) lo.onclick = () => pca.logoutRedirect({ account: S.account, postLogoutRedirectUri: C.redirectUri });
  }

  function render() {
    const f = S.f;
    const base = filtered("status");
    const counts = Object.fromEntries(STATUS.map(s => [s.key, base.filter(x => x.key === s.key).length]));
    const rows = filtered();
    const sites = [...new Set(S.fac.map(x => x.site))].sort();
    const types = [...new Set(S.fac.map(x => x.base))].filter(Boolean).sort();
    const nSites = new Set(S.fac.map(x => x.site)).size;

    // 12-month workload from current month
    const t = today(); let y = +t.slice(0, 4), m = +t.slice(5, 7) - 1;
    const wl = filtered("month");
    const months = [];
    for (let i = 0; i < 12; i++) {
      const k = `${y}-${String(m + 1).padStart(2, "0")}`;
      months.push({ k, label: MONTHS[m] + (i === 0 || m === 0 ? `<span class="yr"> ${String(y).slice(2)}</span>` : ""), n: wl.filter(x => x.next && x.next.slice(0, 7) === k).length });
      if (++m === 12) { m = 0; y++; }
    }
    const max = Math.max(1, ...months.map(x => x.n));

    const chips = [];
    if (f.month) { const mm = months.find(x => x.k === f.month); chips.push(["month", "ครบ Next Due " + (mm ? MONTHS[+f.month.slice(5) - 1] + " " + f.month.slice(0, 4) : f.month)]); }
    if (f.status) chips.push(["status", ST[f.status].label]);

    $app.style.setProperty("--act-col", S.canAdd ? "96px" : "0px");
    $app.innerHTML = `
      <div class="page-head">
        <div><h1>ทะเบียนการบินทดสอบ</h1><p>Facility ที่ใบอนุญาตมีผล ${S.fac.length} รายการ · ${nSites} สถานที่</p></div>
        ${S.canAdd ? `<a class="btn act" href="${esc(recorderLink())}" target="_blank" rel="noopener">${ICON.plus} บันทึกผลการบินทดสอบ</a>` : ""}
      </div>

      ${S.missing.length ? `<div class="notice">ไม่พบคอลัมน์ใน SharePoint: ${esc(S.missing.join(", "))} · ข้อมูลส่วนนี้จะว่าง แจ้ง Admin</div>` : ""}
      <section class="kpis" aria-label="สรุปสถานะ">
        <button class="kpi" data-status="" aria-pressed="${!f.status}"><div class="n num">${base.length}</div><div class="l">ทั้งหมด</div></button>
        ${STATUS.map(s => `<button class="kpi${counts[s.key] ? "" : " zero"}" data-status="${esc(s.key)}" aria-pressed="${f.status === s.key}">
          <div class="n num">${counts[s.key]}</div><div class="l"><span class="dot" style="background:${s.dot}"></span>${esc(s.label)}</div></button>`).join("")}
      </section>

      <section class="panel workload" aria-label="ภาระงาน 12 เดือนข้างหน้า">
        <div class="panel-h"><h2>ภาระงาน 12 เดือนข้างหน้า</h2><span>จำนวน Facility ที่ครบ Next Due ในแต่ละเดือน · คลิกแท่งเพื่อกรอง</span></div>
        <div class="bars">${months.map(x => `<button class="bar${x.n ? "" : " zero"}" data-month="${x.k}" aria-pressed="${f.month === x.k}" title="${x.n} รายการ">
          <span class="c num">${x.n}</span><span class="b" style="height:${Math.round((x.n / max) * 72)}px"></span><span class="m">${x.label}</span></button>`).join("")}</div>
      </section>

      <div class="filters">
        <label class="search">${ICON.search}<input id="q" type="search" placeholder="ค้นหา ICAO, ชื่อสนามบิน, ประเภท, เลขที่ใบอนุญาต" value="${esc(f.q)}" aria-label="ค้นหา"></label>
        <select id="fBranch" aria-label="สาขา"><option value="">ทุกสาขา</option><option value="N"${f.branch === "N" ? " selected" : ""}>สาขา N (NAV)</option><option value="S"${f.branch === "S" ? " selected" : ""}>สาขา S (SUR)</option></select>
        <select id="fSite" aria-label="สถานที่"><option value="">ทุกสถานที่</option>${sites.map(s => `<option${f.site === s ? " selected" : ""}>${esc(s)}</option>`).join("")}</select>
        <select id="fType" aria-label="ประเภท"><option value="">ทุกประเภท</option>${types.map(s => `<option${f.type === s ? " selected" : ""}>${esc(s)}</option>`).join("")}</select>
        <div class="chips">${chips.map(([k, l]) => `<span class="chip">${esc(l)}<button data-clear="${k}" aria-label="ล้างตัวกรอง">${ICON.x}</button></span>`).join("")}</div>
        <span class="count">${rows.length} รายการ${(f.status || f.branch || f.site || f.type || f.q || f.month) ? ` · <button class="linkbtn" id="clearAll">ล้างตัวกรอง</button>` : ""}</span>
      </div>

      <section class="panel table" aria-label="รายการ Facility">
        <div class="tr th"><span class="c-site">Site</span><span class="c-fac">Facility</span><span class="c-holder">ผู้ให้บริการ</span><span class="c-lic">ใบอนุญาต</span><span class="c-status">สถานะ</span><span class="c-last">ผ่านล่าสุด</span><span class="c-next">Next Due</span><span class="c-ext">Extendable</span>${S.canAdd ? '<span class="c-act"></span>' : ""}</div>
        ${rows.length ? rows.map(rowHtml).join("") : `<div class="empty">ไม่พบ Facility ตามเงื่อนไข</div>`}
      </section>`;
    bind();
  }

  function rowHtml(x) {
    const s = ST[x.key] || ST["No Record"];
    const flag = x.key === "Expired" || x.key === "PastDue";
    return `<div class="tr row${flag ? " flag" : ""}" style="${flag ? "--flag:" + s.dot : ""}" data-id="${x.id}" tabindex="0" role="button" aria-label="${esc(x.site + " " + x.type)}">
      <span class="c-site site">${esc(x.site)}</span>
      <span class="c-fac fac"><b data-site="${esc(x.site)}">${esc(x.type)}</b><span title="${esc(x.name)}">${esc(x.name)}</span></span>
      <span class="c-holder dim">${esc(x.holder || "–")}</span>
      <span class="c-lic dim num">${esc(x.lic)}</span>
      <span class="c-status">${pill(x.key)}</span>
      <span class="c-last dim num">${dmy(x.last)}</span>
      <span class="c-next num"><span class="lbl-m">Next Due </span>${dmy(x.next)}<span class="lbl-m"> · Ext. ${dmy(x.ext)}</span></span>
      <span class="c-ext dim num">${dmy(x.ext)}</span>
      ${S.canAdd ? `<span class="c-act"><a class="btn ghost sm" href="${esc(recorderLink(x.lic))}" target="_blank" rel="noopener" data-stop>บันทึกผล</a></span>` : ""}
    </div>`;
  }

  function bind() {
    $app.querySelectorAll(".kpi").forEach(b => b.onclick = () => { S.f.status = b.dataset.status === S.f.status ? "" : b.dataset.status; render(); });
    $app.querySelectorAll(".bar").forEach(b => b.onclick = () => { S.f.month = S.f.month === b.dataset.month ? "" : b.dataset.month; render(); });
    $app.querySelectorAll("[data-clear]").forEach(b => b.onclick = () => { S.f[b.dataset.clear] = ""; render(); });
    const ca = document.getElementById("clearAll");
    if (ca) ca.onclick = () => { S.f = { status: "", branch: "", site: "", type: "", q: "", month: "" }; render(); };
    const q = document.getElementById("q");
    let tm; q.oninput = () => { clearTimeout(tm); tm = setTimeout(() => { S.f.q = q.value; const pos = q.selectionStart; render(); const n = document.getElementById("q"); n.focus(); n.setSelectionRange(pos, pos); }, 200); };
    [["fBranch", "branch"], ["fSite", "site"], ["fType", "type"]].forEach(([id, k]) => document.getElementById(id).onchange = e => { S.f[k] = e.target.value; render(); });
    $app.querySelectorAll(".row").forEach(r => {
      r.onclick = e => { if (e.target.closest("[data-stop]")) return; openDrawer(+r.dataset.id); };
      r.onkeydown = e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openDrawer(+r.dataset.id); } };
    });
  }

  // ---------- drawer ----------
  function openDrawer(id, silent) {
    const x = S.fac.find(f => f.id === id); if (!x) return closeDrawer();
    S.open = id;
    const hist = S.recs.filter(r => r.facId === id).sort((a, b) => (b.end || "").localeCompare(a.end || "") || b.id - a.id);
    $drawer.innerHTML = `
      <div class="d-head">
        <button class="icon-btn close" id="dClose" aria-label="ปิด">${ICON.x}</button>
        <div class="tag">FACILITY</div>
        <h2 id="dTitle">${esc(x.site)}</h2>
        <h3>${esc(x.type)}</h3>
        <p>${esc(x.name)}<br>ใบอนุญาต ${esc(x.lic)}${x.holder ? " · " + esc(x.holder) : ""}</p>
        <div class="row2">${pill(x.key)}<a class="btn ghost sm" href="${esc(folderLink(x))}" target="_blank" rel="noopener">${ICON.file} โฟลเดอร์ไฟล์</a>${S.canAdd ? `<a class="btn sm" href="${esc(recorderLink(x.lic))}" target="_blank" rel="noopener">${ICON.plus} บันทึกผลของ Facility นี้</a>` : ""}</div>
      </div>
      <div class="d-body">
        <dl class="facts">
          <div><dt>Next Due</dt><dd class="num">${dmy(x.next)}</dd></div>
          <div><dt>Extendable Due</dt><dd class="num">${dmy(x.ext)}</dd></div>
          <div><dt>ผลผ่านล่าสุด</dt><dd class="num">${dmy(x.last)}${x.lastRec ? " · " + esc(x.lastRec) : ""}</dd></div>
          <div><dt>รอบการบิน · สาขา</dt><dd>${esc(x.interval)}${x.branch ? " · " + esc(x.branch) : ""}</dd></div>
        </dl>
        <div class="h-sec"><h4>ประวัติผลการบินทดสอบ</h4><span>${hist.length} ครั้ง</span></div>
        ${hist.length ? hist.map(recHtml).join("") : `<div class="rec dim">ยังไม่มีผลการบินทดสอบในระบบ</div>`}
      </div>`;
    if (!silent || $drawer.hidden) {
      $drawer.hidden = false; $scrim.hidden = false; document.body.style.overflow = "hidden";
      document.getElementById("dClose").focus();
    }
    document.getElementById("dClose").onclick = closeDrawer;
  }
  function recHtml(r) {
    const col = RESULT_COLOR[r.result] || "var(--text)";
    const meas = r.result === "Unusable" && r.measure ? ` · มาตรการ ${esc(r.measure)}${r.measure === "Other" ? (r.done ? " (เสร็จแล้ว)" : " (ยังไม่เสร็จ)") : ""}` : "";
    const letter = r.letterNo || r.letterDate ? `${esc(r.letterNo || "–")}${r.letterDate ? " ลงวันที่ " + dmy(r.letterDate) : ""}` : "–";
    return `<article class="rec">
      <div class="rec-top"><span class="fir">${esc(r.fir)}</span><span class="when num">${range(r.start, r.end)}${r.itype ? " · " + esc(r.itype) : ""}</span>${r.baseline ? '<span class="badge">ข้อมูลย้อนหลัง</span>' : ""}</div>
      <div class="rec-res" style="color:${col}">${esc(r.result || "–")}<span style="font-weight:400;color:var(--muted)">${meas}</span></div>
      <dl>
        ${r.result !== "Unusable" ? `<dt>Next / Ext.</dt><dd class="num">${dmy(r.next)} · ${dmy(r.ext)}</dd>` : ""}
        <dt>วันที่รับรอง</dt><dd class="num">${dmy(r.cert)}</dd>
        <dt>หนังสือแจ้งผล</dt><dd>${letter}</dd>
      </dl>
      ${r.file || r.letter ? `<div class="links">${r.file ? `<a class="btn ghost sm" href="${esc(r.file)}" target="_blank" rel="noopener">${ICON.file} รายงานผลการบิน</a>` : ""}${r.letter ? `<a class="btn ghost sm" href="${esc(r.letter)}" target="_blank" rel="noopener">${ICON.file} หนังสือแจ้งผล</a>` : ""}</div>` : ""}
      ${r.note ? `<div class="note">${esc(r.note)}</div>` : ""}
      ${r.by ? `<div class="by">บันทึกโดย ${esc(r.by)}</div>` : ""}
    </article>`;
  }
  function closeDrawer() {
    S.open = null; $drawer.hidden = true; $scrim.hidden = true; document.body.style.overflow = "";
  }
  $scrim.onclick = closeDrawer;
  document.addEventListener("keydown", e => { if (e.key === "Escape" && !$drawer.hidden) closeDrawer(); });

  // ---------- states ----------
  function stateCard(title, text, err, action) {
    return `<div class="state"><img src="assets/firms-icon.png" alt="" width="64" height="64"><h1>${esc(title)}</h1><p>${esc(text)}</p>${err ? `<div class="err">${esc(err)}</div>` : ""}${action || ""}</div>`;
  }
  function skeleton() {
    return `<div class="page-head"><div style="width:320px"><div class="skeleton" style="height:26px;width:60%"></div><div class="skeleton" style="margin-top:10px;width:80%"></div></div></div>
      <div class="panel" style="padding:20px">${Array.from({ length: 8 }, () => '<div class="skeleton" style="margin:14px 0"></div>').join("")}</div>`;
  }

  // ---------- refresh when returning to the tab ----------
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && S.loadedAt && (Date.now() - S.loadedAt) / 60000 > C.staleMinutes) load(false);
  });

  // ---------- boot ----------
  (async () => {
    if (DEMO) { renderTop(); return load(true); }
    try {
      pca = new msal.PublicClientApplication({
        auth: { clientId: C.clientId, authority: "https://login.microsoftonline.com/" + C.tenantId, redirectUri: C.redirectUri },
        cache: { cacheLocation: "sessionStorage" }
      });
      await pca.initialize();
      const resp = await pca.handleRedirectPromise();
      const account = resp?.account || pca.getAllAccounts()[0];
      if (!account) {
        $app.innerHTML = stateCard("FIRMS Dashboard", "ทะเบียน Facility และผลการบินทดสอบเครื่องช่วยการเดินอากาศ · เข้าสู่ระบบด้วยบัญชี CAAT", "",
          `<button class="btn" id="login">เข้าสู่ระบบด้วยบัญชี CAAT</button>`);
        document.getElementById("login").onclick = () => pca.loginRedirect({ scopes: [C.spScope] });
        return;
      }
      pca.setActiveAccount(account); S.account = account; renderTop();
      await load(true);
    } catch (e) {
      $app.innerHTML = stateCard("เข้าสู่ระบบไม่สำเร็จ", "ลองใหม่อีกครั้ง ถ้ายังไม่ได้ ส่งข้อความด้านล่างให้ Admin",
        e.errorCode ? e.errorCode + ": " + e.errorMessage : e.message, `<button class="btn" id="login">ลองใหม่</button>`);
      const b = document.getElementById("login"); if (b) b.onclick = () => location.reload();
    }
  })();
})();
