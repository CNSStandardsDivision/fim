/* ข้อมูลตัวอย่างสำหรับ ?demo=1 — ไม่ใช่ข้อมูลจริง ใช้ตรวจหน้าตาโดยไม่ต้อง Login */
window.FIRMS_DEMO = function () {
  const iso = (y, m, d) => new Date(Date.UTC(y, m - 1, d) - 7 * 3600e3).toISOString(); // Bangkok midnight
  const add = (y, m, d, days) => { const t = new Date(Date.UTC(y, m - 1, d + days)); return [t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate()]; };
  const addY = (y, m, d) => [y + 1, m, d];
  const now = new Date(Date.now() + 7 * 3600e3);
  const T = [now.getUTCFullYear(), now.getUTCMonth() + 1, now.getUTCDate()];
  const types = [
    { Title: "ILS/DME", IntervalValue: 180, IntervalUnit: "Day", Branch: "N" },
    { Title: "LOC/DME", IntervalValue: 180, IntervalUnit: "Day", Branch: "N" },
    { Title: "DVOR/DME", IntervalValue: 1, IntervalUnit: "Year", Branch: "N" },
    { Title: "DME", IntervalValue: 1, IntervalUnit: "Year", Branch: "N" },
    { Title: "NDB", IntervalValue: 1, IntervalUnit: "Year", Branch: "N" },
    { Title: "SSR", IntervalValue: 1, IntervalUnit: "Year", Branch: "S" }
  ];
  // [site, type, base, name, lic, holder, daysSinceLast, op]
  const F = [
    ["VTCC", "ILS/DME", "ILS/DME", "สนามบินเชียงใหม่ จังหวัดเชียงใหม่", "2/2558", "AEROTHAI", 240, "Service Ready"],
    ["VTBS", "ILS/DME (02R)", "ILS/DME", "ศูนย์ควบคุมจราจรทางอากาศสุวรรณภูมิ", "5/2558", "AEROTHAI", 225, "Service Ready"],
    ["VTBS", "ILS/DME (19)", "ILS/DME", "ศูนย์ควบคุมจราจรทางอากาศสุวรรณภูมิ", "4/2558", "AEROTHAI", 60, "Service Ready"],
    ["VTBD", "ILS/DME (21R)", "ILS/DME", "สนามบินดอนเมือง กรุงเทพมหานคร", "20/2557", "AEROTHAI", 190, "Service Ready"],
    ["VTCL", "DVOR/DME", "DVOR/DME", "สนามบินลำปาง จังหวัดลำปาง", "33/2557", "AEROTHAI", 40, "Action Pending"],
    ["VTUU", "ILS/DME", "ILS/DME", "สนามบินอุบลราชธานี จังหวัดอุบลราชธานี", "49/2557", "AEROTHAI", 160, "Service Ready"],
    ["VTSG", "DVOR/DME", "DVOR/DME", "สนามบินกระบี่ จังหวัดกระบี่", "62/2557", "AEROTHAI", 340, "Service Ready"],
    ["VTBU", "NDB", "NDB", "สนามบินอู่ตะเภา ระยอง-พัทยา จังหวัดระยอง", "N005/2562", "Royal Thai Navy", 120, "Service Ready"],
    ["VTSB", "DVOR/DME", "DVOR/DME", "สนามบินสุราษฎร์ธานี จังหวัดสุราษฎร์ธานี", "84/2557", "AEROTHAI", 20, "Service Ready"],
    ["VTPO", "ILS/DME", "ILS/DME", "สนามบินสุโขทัย จังหวัดสุโขทัย", "N004/2561", "AEROTHAI", 90, "Service Ready"],
    ["CMP", "DVOR/DME", "DVOR/DME", "สถานีเครื่องช่วยการเดินอากาศ DVOR/DME ชุมแพ จังหวัดขอนแก่น", "54/2557", "AEROTHAI", 170, "Service Ready"],
    ["VTCT", "SSR", "SSR", "สนามบินแม่ฟ้าหลวง จังหวัดเชียงราย", "12/2558", "AEROTHAI", 330, "Out of Service"],
    ["VTSP", "ILS/DME (27)", "ILS/DME", "สนามบินภูเก็ต จังหวัดภูเก็ต", "18/2558", "AEROTHAI", 150, "Service Ready"],
    ["VTSP", "SSR", "SSR", "สนามบินภูเก็ต จังหวัดภูเก็ต", "S003/2561", "AEROTHAI", 200, "Service Ready"],
    ["VTSS", "ILS/DME (08)", "ILS/DME", "สนามบินหาดใหญ่ จังหวัดสงขลา", "16/2558", "AEROTHAI", 45, "Service Ready"],
    ["VTUD", "DVOR/DME", "DVOR/DME", "สนามบินอุดรธานี จังหวัดอุดรธานี", "41/2557", "AEROTHAI", 300, "Service Ready"],
    ["VTUK", "DME", "DME", "สนามบินขอนแก่น จังหวัดขอนแก่น", "44/2557", "AEROTHAI", 260, "Service Ready"],
    ["VTCN", "NDB", "NDB", "สนามบินน่านนคร จังหวัดน่าน", "27/2557", "AEROTHAI", null, "Service Ready"],
    ["VTBK", "LOC/DME", "LOC/DME", "สนามบินกำแพงแสน จังหวัดนครปฐม", "N002/2562", "Royal Thai Navy", 100, "Service Ready"],
    ["VTSM", "SSR", "SSR", "สนามบินสมุย จังหวัดสุราษฎร์ธานี", "S002/2561", "AEROTHAI", 380, "Service Ready"]
  ];
  const facilities = [], records = [];
  let rid = 1;
  F.forEach((f, i) => {
    const [site, type, base, name, lic, holder, since, op] = f;
    const ils = base === "ILS/DME" || base === "LOC/DME";
    let last = null, next = null, ext = null, due = "No Record";
    if (since !== null) {
      last = add(...T, -since);
      next = ils ? add(...last, 180) : addY(...last);
      ext = add(...next, 30);
      const n = Date.UTC(next[0], next[1] - 1, next[2]), e = Date.UTC(ext[0], ext[1] - 1, ext[2]), t = Date.UTC(T[0], T[1] - 1, T[2]);
      const nm = new Date(Date.UTC(T[0], T[1], 1)), nmEnd = new Date(Date.UTC(T[0], T[1] + 1, 0));
      due = t > e ? "Expired" : t > n ? "PastDue" : (n >= +nm && n <= +nmEnd) ? "Due Next Month" : "Valid";
      const prev = ils ? add(...last, -182) : add(...last, -365);
      [[prev, true], [last, false]].forEach(([d, old]) => {
        const id = rid++;
        records.push({
          ID: id, Title: "FIR-" + String(id).padStart(4, "0"), FacilityId: i + 1,
          FlightDateStart: iso(...add(...d, base === "ILS/DME" ? -1 : 0)), FlightDate: iso(...d),
          InspectionType: "Periodic", Result: id % 5 === 0 ? "Restricted" : "Unrestricted", Measure: null, MeasureCompleted: false,
          NextDueDate: iso(...(ils ? add(...d, 180) : addY(...d))), ExtendableDueDate: iso(...add(...(ils ? add(...d, 180) : addY(...d)), 30)),
          CertifiedDate: iso(...add(...d, 6)), LetterNo: "กพท 08/" + (1200 + id), LetterDate: iso(...add(...d, 8)),
          FileLink: { Url: "#demo-report", Description: "" }, LetterLink: old ? null : { Url: "#demo-letter", Description: "" },
          Note: id % 7 === 0 ? "ข้อจำกัดตามรายงานหน้า 4" : "", IsBaseline: old, Author: { Title: old ? "AF Pilot 1" : "AF Pilot 2" }
        });
      });
    }
    if (op !== "Service Ready") {
      const id = rid++;
      const d = add(...T, -12);
      records.push({
        ID: id, Title: "FIR-" + String(id).padStart(4, "0"), FacilityId: i + 1, FlightDateStart: iso(...d), FlightDate: iso(...d),
        InspectionType: "Special", Result: "Unusable", Measure: op === "Out of Service" ? "Out of Service" : "Other", MeasureCompleted: false,
        CertifiedDate: iso(...add(...d, 4)), LetterNo: "กพท 08/" + (1200 + id), LetterDate: iso(...add(...d, 5)),
        FileLink: { Url: "#demo-report" }, LetterLink: { Url: "#demo-letter" }, Note: "", IsBaseline: false, Author: { Title: "AF Pilot 2" }
      });
    }
    facilities.push({
      ID: i + 1, Title: lic, SiteCode: site, SiteName: name, FacilityType: type, BaseType: base, LicenseHolder: holder,
      LicenseStatus: "ปกติ", OperationalStatus: op, DueStatus: due,
      LastInspection: last && iso(...last), LastRecord: last ? records.filter(r => r.FacilityId === i + 1 && r.Result !== "Unusable").slice(-1)[0]?.Title : null,
      NextDueDate: next && iso(...next), ExtendableDueDate: ext && iso(...ext)
    });
  });
  return new Promise(r => setTimeout(() => r({ facilities, records: records.reverse(), types, perm: { High: "0", Low: "2" } }), 300));
};
