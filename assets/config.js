// FIRMS Dashboard — configuration (ไม่มีข้อมูลลับ: Client ID / Tenant ID เปิดเผยได้ตามปกติของ Single-page app)
window.FIRMS_CONFIG = {
  clientId: "4de6e336-d685-4b65-9f17-ee59fd81beb2",
  tenantId: "af3a83b6-13aa-4300-a5ae-b19c8c423a5a",
  redirectUri: "https://cnsstandardsdivision.github.io/fim/",
  siteUrl: "https://caathai.sharepoint.com/sites/ANSNASharePoint",
  spScope: "https://caathai.sharepoint.com/AllSites.Read",

  // FIRMS Recorder (Power Apps) — ปุ่มบันทึกผลต่อท้าย &facility=<เลขใบอนุญาต>
  recorderUrl: "https://apps.powerapps.com/play/e/default-af3a83b6-13aa-4300-a5ae-b19c8c423a5a/a/4d4e4b4f-f5aa-4dfb-b08f-b5081a250e4f?tenantId=af3a83b6-13aa-4300-a5ae-b19c8c423a5a",

  lists: {
    facilities: "FIM_Facilities",
    records: "FIM_Records",
    types: "FIM_Types"
  },

  // โหลดข้อมูลใหม่อัตโนมัติเมื่อกลับมาที่แท็บ ถ้าข้อมูลเก่ากว่า (นาที)
  staleMinutes: 2
};
