/* =====================================================================
   김집사 프로젝트 시안 — 공용 데이터 · 헬퍼 · 앱 셸
   데이터 모양은 src/entities/project/model/project.schema.ts 와 같게 둔다.
   변경은 localStorage(kj-prj-v1)에 저장해 화면을 오가도 유지한다.
   ===================================================================== */
(function () {
  const TODAY = "2026-11-25";
  const ME = "u-jieun";
  const members = [
    { user_id: "u-jieun", display_name: "지은" },
    { user_id: "u-minho", display_name: "민호" },
  ];
  const areas = [
    { id: "a1", name: "예식" },
    { id: "a2", name: "신혼여행" },
    { id: "a3", name: "웨딩스냅" },
    { id: "a4", name: "상견례" },
    { id: "a5", name: "신혼집" },
  ];
  const t = (id, title, area_id, assignee, status, due_on, extra = {}) => ({
    id, title, area_id,
    assignee_kind: assignee === "together" || assignee === "unassigned" ? assignee : "member",
    assignee_id: assignee.startsWith("u-") ? assignee : null,
    status, starts_on: null, due_on, depends_note: "", memo: "", ...extra,
  });
  const seed = {
    projects: [
      { id: "p1", title: "결혼 준비", description: "4월 예식과 신혼여행까지", starts_on: "2026-11-01", target_on: "2027-05-06", status: "active", modules: ["decisions", "lists", "reservations", "itinerary", "budget"] },
      { id: "p2", title: "이사 준비", description: "", starts_on: "2027-06-01", target_on: null, status: "active", modules: ["lists"] },
      { id: "p3", title: "거실 정리", description: "", starts_on: "2026-09-01", target_on: "2026-10-12", status: "completed", modules: [] },
    ],
    summary: { p2: { done: 0, total: 4, next: { title: "이사 업체 견적 받기", due_on: null } }, p3: { done: 6, total: 6, next: null } },
    areas,
    milestones: [
      { id: "m1", title: "큰 틀 정하기", area_id: null, starts_on: "2026-11-01", ends_on: "2026-12-15", is_tentative: false },
      { id: "m2", title: "예식장 계약", area_id: "a1", starts_on: "2026-12-01", ends_on: "2027-01-10", is_tentative: false },
      { id: "m3", title: "웨딩스냅 촬영", area_id: "a3", starts_on: "2027-02-27", ends_on: "2027-02-28", is_tentative: false },
      { id: "m4", title: "예식", area_id: "a1", starts_on: "2027-04-17", ends_on: null, is_tentative: false },
      { id: "m5", title: "신혼여행", area_id: "a2", starts_on: "2027-04-28", ends_on: "2027-05-06", is_tentative: false },
      { id: "m6", title: "상견례", area_id: "a4", starts_on: null, ends_on: null, is_tentative: true },
    ],
    tasks: [
      t("t1", "양가 인사 날짜 조율", "a4", "together", "todo", "2026-11-22"),
      t("t2", "여행 루트 결정", "a2", "together", "in_progress", "2026-11-27", { starts_on: "2026-11-18" }),
      t("t3", "예식장 투어 예약", "a1", "u-jieun", "in_progress", "2026-11-30"),
      t("t4", "예식장 견적 비교표 만들기", "a1", "u-jieun", "todo", "2026-12-03"),
      t("t5", "상견례 식당 후보 3곳 찾기", "a4", "u-minho", "todo", "2026-12-05"),
      t("t6", "신혼집 대출 상담", "a5", "u-minho", "todo", "2026-12-10"),
      t("t7", "항공권 결제", "a2", "u-minho", "on_hold", "2027-01-15", { depends_note: "여행 루트 결정 뒤" }),
      t("t8", "스냅 촬영 의상 정하기", "a3", "together", "todo", "2027-02-01"),
      t("t9", "청첩장 문구 정하기", "a1", "unassigned", "todo", "2027-02-10"),
      t("t10", "가족 일정 확인", "a4", "u-jieun", "todo", null),
      t("t11", "가전 목록 정리", "a5", "u-jieun", "todo", null),
      t("t12", "이사 날짜 정하기", "a5", "together", "on_hold", null, { depends_note: "대출 상담 결과 보고" }),
      t("t13", "휴가 확인", "a2", "u-jieun", "done", "2026-11-20", { completed_at: "2026-11-19" }),
      t("t14", "스냅 작가 포트폴리오 보기", "a3", "u-jieun", "done", null, { completed_at: "2026-11-12" }),
      t("t15", "스냅 작가 계약금 송금", "a3", "u-minho", "done", "2026-11-15", { completed_at: "2026-11-14" }),
      t("t16", "예물 매장 방문", "a1", "together", "done", "2026-11-23", { completed_at: "2026-11-23" }),
    ],
    decisions: [
      { id: "d1", question: "상견례 날짜를 언제로 할까?", status: "discussing", due_on: "2026-12-01", options: "12월 6일(토) 점심\n12월 13일(토) 저녁", final_choice: "", opinions: [{ user_id: "u-jieun", opinion: "6일이 부모님 일정상 더 편해요.", reactions: {} }] },
      { id: "d2", question: "예식 시간대는?", status: "discussing", due_on: "2026-12-10", options: "11시\n13시 30분", final_choice: "", opinions: [{ user_id: "u-jieun", opinion: "멀리서 오는 친척을 생각하면 13시 30분.", reactions: { "u-minho": "up" } }, { user_id: "u-minho", opinion: "식대가 싼 11시도 괜찮아.", reactions: {} }] },
      { id: "d3", question: "폐백을 할까?", status: "on_hold", due_on: null, options: "한다\n안 한다", final_choice: "", opinions: [] },
      { id: "d4", question: "신혼여행지", status: "decided", due_on: "2026-11-20", options: "파리 + 로마\n포르투갈 일주", final_choice: "파리 4박 + 로마 4박", opinions: [{ user_id: "u-jieun", opinion: "파리는 꼭 가고 싶어요." }, { user_id: "u-minho", opinion: "로마도 넣자." }] },
    ],
    reservations: [
      { id: "r1", title: "파리 강변 숙소", area_id: "a2", kind: "lodging", status: "booked", starts_on: "2027-04-28", ends_on: "2027-05-02", reference_no: "HX-29481", links: [], cancel_deadline: "2027-03-28", payment_deadline: "2027-04-20", total_amount: 1840000, paid_amount: 600000, memo: "" },
      { id: "r2", title: "파리 작은 호텔", area_id: "a2", kind: "lodging", status: "reviewing", starts_on: "2027-04-30", ends_on: "2027-05-02", reference_no: "", links: [], cancel_deadline: null, payment_deadline: null, total_amount: 980000, paid_amount: null, memo: "강변 숙소 대신 후보" },
      { id: "r3", title: "파리 → 로마 기차", area_id: "a2", kind: "transport", status: "planned", starts_on: "2027-05-02", ends_on: null, reference_no: "", links: [], cancel_deadline: null, payment_deadline: "2026-12-10", total_amount: 312000, paid_amount: 100000, memo: "" },
      { id: "r4", title: "로마 숙소", area_id: "a2", kind: "lodging", status: "planned", starts_on: "2027-05-02", ends_on: "2027-05-06", reference_no: "", links: [], cancel_deadline: "2026-12-01", payment_deadline: "2027-04-01", total_amount: 1260000, paid_amount: 260000, memo: "" },
      { id: "r5", title: "웨딩스냅 스튜디오", area_id: "a3", kind: "activity", status: "booked", starts_on: "2027-02-27", ends_on: null, reference_no: "SN-0227", links: [], cancel_deadline: null, payment_deadline: "2027-02-20", total_amount: 1500000, paid_amount: 300000, memo: "" },
      { id: "r6", title: "상견례 한정식집", area_id: "a4", kind: "restaurant", status: "reviewing", starts_on: null, ends_on: null, reference_no: "", links: [], cancel_deadline: null, payment_deadline: null, total_amount: null, paid_amount: null, memo: "날짜 정해지면 예약" },
      { id: "r7", title: "이전 숙소", area_id: "a2", kind: "lodging", status: "cancelled", starts_on: "2027-04-28", ends_on: "2027-05-01", reference_no: "", links: [], cancel_deadline: null, payment_deadline: null, total_amount: 1520000, paid_amount: 0, memo: "" },
    ],
    itinerary: [
      { id: "i1", starts_on: "2027-04-28", ends_on: null, place: "샤를 드골 공항", title: "파리 도착", memo: "" },
      { id: "i2", starts_on: "2027-04-28", ends_on: null, place: "파리 강변 숙소", title: "체크인 후 센강 산책", memo: "" },
      { id: "i3", starts_on: "2027-04-29", ends_on: null, place: "오르세미술관", title: "오르세미술관", memo: "온라인 예매" },
      { id: "i4", starts_on: "2027-04-30", ends_on: null, place: "몽마르트르", title: "몽마르트르 언덕", memo: "" },
      { id: "i5", starts_on: "2027-05-02", ends_on: null, place: "파리 리옹역", title: "로마로 이동", memo: "" },
      { id: "i6", starts_on: "2027-05-03", ends_on: "2027-05-04", place: "바티칸", title: "바티칸 투어", memo: "" },
    ],
    lists: [
      { id: "l1", name: "답례품 후보", kind: "candidates", quantity_list_id: "l2", quantity_tag_key: "g1", columns: [{ key: "c1", label: "배송일", type: "text" }] },
      { id: "l2", name: "가족 명단", kind: "people", tags: [{ key: "g1", label: "답례품" }, { key: "g2", label: "별도 연락" }, { key: "g3", label: "만남" }], columns: [{ key: "c2", label: "관계", type: "select" }, { key: "c3", label: "지역", type: "select" }] },
    ],
    listItems: [
      /* 후보: 상태는 기본 '후보'. 구성원 모두 👍 이면 선택, 모두 👎 이면 제외(안), 또는 직접 바꾼 상태(manual). recipients = 이 후보를 받을 사람(한 사람은 후보 하나만) */
      { id: "li1", list_id: "l1", title: "작은 차 선물 세트", manual: null, votes: { "u-jieun": "up", "u-minho": "up" }, price: 12000, photo: "assets/cand-tea.svg", values: { c1: "주문 후 3일" }, memo: "포장 색상 확인하기", links: ["https://smartstore.naver.com/teashop/products/123"], recipients: ["pp1", "pp3", "pp5"] },
      { id: "li2", list_id: "l1", title: "수제 과자 상자", manual: null, votes: { "u-jieun": "up", "u-minho": "up" }, price: 9500, photo: "assets/cand-cookie.svg", values: { c1: "주문 후 7일" }, memo: "아이 있는 집 위주", links: ["https://www.idus.com/v2/product/abc"], recipients: ["pp2", "pp6"] },
      { id: "li4", list_id: "l1", title: "호텔 수건 세트", manual: null, votes: { "u-jieun": "up", "u-minho": "down" }, price: 15000, photo: "assets/cand-towel.svg", values: { c1: "주문 후 5일" }, memo: "", links: [], recipients: [] },
      { id: "li3", list_id: "l1", title: "머그 세트", manual: null, votes: { "u-jieun": "down", "u-minho": "down" }, price: 18000, photo: "assets/cand-mug.svg", values: { c1: "" }, memo: "깨질 걱정", links: [], recipients: [] },
      { id: "pp1", list_id: "l2", title: "김하늘", values: { c2: "고모", c3: "광주" }, tags: ["g1", "g3"], done_tags: ["g3"] },
      { id: "pp2", list_id: "l2", title: "이바다", values: { c2: "이모", c3: "안산" }, tags: ["g1", "g2"], done_tags: [] },
      { id: "pp3", list_id: "l2", title: "박산", values: { c2: "큰아버지", c3: "광주" }, tags: ["g1"], done_tags: ["g1"] },
      { id: "pp4", list_id: "l2", title: "정구름", values: { c2: "사촌", c3: "서울" }, tags: ["g2"], done_tags: [] },
      { id: "pp5", list_id: "l2", title: "최솔", values: { c2: "외삼촌", c3: "대전" }, tags: ["g1", "g3"], done_tags: [] },
      { id: "pp6", list_id: "l2", title: "한별", values: { c2: "사촌", c3: "서울" }, tags: ["g1"], done_tags: [] },
    ],
    budget: { cap: 30000000 },
    expenses: [
      { id: "e1", title: "예식장 계약금", area_id: "a1", planned: 2000000, planned_on: "2026-11-20", actual: 2000000, paid_on: "2026-11-20", payer_id: "u-minho" },
      { id: "e2", title: "스냅 계약금", area_id: "a3", planned: 300000, planned_on: "2026-11-14", actual: 300000, paid_on: "2026-11-14", payer_id: "u-minho" },
      { id: "e3", title: "예물", area_id: "a1", planned: 3500000, planned_on: "2026-11-23", actual: 3200000, paid_on: "2026-11-23", payer_id: "u-jieun" },
      { id: "e4", title: "파리 숙소 선금", area_id: "a2", planned: 600000, planned_on: "2026-10-30", actual: 600000, paid_on: "2026-10-30", payer_id: "u-jieun" },
      { id: "e5", title: "파리 → 로마 기차", area_id: "a2", planned: 312000, planned_on: "2026-12-03", actual: null, paid_on: null, payer_id: null },
      { id: "e6", title: "항공권", area_id: "a2", planned: 2400000, planned_on: "2027-01-15", actual: null, paid_on: null, payer_id: null },
      { id: "e7", title: "예식장 중도금", area_id: "a1", planned: 6000000, planned_on: "2027-02-15", actual: null, paid_on: null, payer_id: null },
      { id: "e8", title: "청첩장", area_id: "a1", planned: 250000, planned_on: "2026-11-22", actual: null, paid_on: null, payer_id: null },
      { id: "e9", title: "한복 대여", area_id: "a1", planned: 600000, planned_on: "2027-03-20", actual: null, paid_on: null, payer_id: null },
    ],
  };

  const KEY = "kj-prj-unified-v2"; // 원본 OD 시안(kj-prj-v1)과 저장소를 나눈다 // gitleaks:allow storage key name
  let db;
  try { db = JSON.parse(localStorage.getItem(KEY)) || structuredClone(seed); } catch (_) { db = structuredClone(seed); }
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (_) {} };

  /* ---------- 표기 ---------- */
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const won = (n) => (n == null ? "—" : n.toLocaleString("ko-KR") + "원"); // ACC-19 기본 표기
  const DOW = ["일", "월", "화", "수", "목", "금", "토"];
  const d = (iso) => new Date(iso + "T00:00:00");
  const md = (iso) => (iso ? `${d(iso).getMonth() + 1}.${d(iso).getDate()}` : "");
  const mdw = (iso) => (iso ? `${d(iso).getMonth() + 1}월 ${d(iso).getDate()}일 (${DOW[d(iso).getDay()]})` : "");
  const ymd = (iso) => (iso ? iso.replaceAll("-", ".") : "");
  const dateShort = (iso) => (!iso ? "" : iso.slice(0, 4) === TODAY.slice(0, 4) ? md(iso) : ymd(iso)); // g200: 올해면 11.17, 다른 해면 2027.01.15
  const days = (iso) => Math.round((d(iso) - d(TODAY)) / 86400000);
  const period = (a, b, empty = "날짜 미정") => (!a ? empty : b && b !== a ? `${md(a)} – ${md(b)}` : md(a));
  function ddayChip(iso) {
    if (!iso) return "";
    const n = days(iso);
    if (n < 0) return `<span class="dday late">${-n}일 지남</span>`;
    if (n === 0) return `<span class="dday today">오늘</span>`;
    return `<span class="dday${n <= 7 ? " soon" : ""}">D-${n}</span>`;
  }
  const memberName = (id) => members.find((m) => m.user_id === id)?.display_name ?? "탈퇴한 구성원";
  const assigneeLabel = (task) => task.assignee_kind === "together" ? "함께" : task.assignee_kind === "member" ? memberName(task.assignee_id) : "담당 미정";
  const areaName = (id) => db.areas.find((a) => a.id === id)?.name ?? "영역 없음";
  const progress = (tasks) => {
    const total = tasks.length, done = tasks.filter((x) => x.status === "done").length;
    return { total, done, percent: total ? Math.round((done / total) * 100) : 0 };
  };

  /* ---------- 아이콘 (lucide, 1.75 stroke) ---------- */
  const P = {
    house: '<path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"/><path d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
    calendar: '<path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/>',
    cart: '<circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"/>',
    package: '<path d="M11 21.73a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73z"/><path d="M12 22V12"/><path d="m3.3 7 8.7 5 8.7-5"/>',
    briefcase: '<path d="M16 20V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/><rect width="20" height="14" x="2" y="6" rx="2"/>',
    settings: '<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/>',
    back: '<path d="m15 18-6-6 6-6"/>',
    chev: '<path d="m9 18 6-6-6-6"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
    image: '<rect width="18" height="18" x="3" y="3" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>',
    plus: '<path d="M5 12h14"/><path d="M12 5v14"/>',
    pencil: '<path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/><path d="m15 5 4 4"/>',
    up: '<path d="M7 10v12"/><path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88Z"/>',
    down: '<path d="M17 14V2"/><path d="M9 18.12 10 14H4.17a2 2 0 0 1-1.92-2.56l2.33-8A2 2 0 0 1 6.5 2H20a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2.76a2 2 0 0 0-1.79 1.11L12 22a3.13 3.13 0 0 1-3-3.88Z"/>',
    link: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
  };
  const icon = (name, cls = "") => `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[name]}</svg>`;

  /* ---------- 앱 셸: 하단 탭(ACC-18 5개) · 사이드 메뉴(6개) · 집사 버튼 ---------- */
  function shell() {
    const tab = [["오늘", "house", "#"], ["일정", "calendar", "#"], ["장보기", "cart", "#"], ["프로젝트", "briefcase", "projects.html"], ["설정", "settings", "#"]];
    const side = [["오늘", "house"], ["일정", "calendar"], ["장바구니", "cart"], ["재고", "package"], ["프로젝트", "briefcase"], ["설정", "settings"]];
    const cur = (l) => (l === "프로젝트" ? ' aria-current="page"' : "");
    document.body.insertAdjacentHTML("beforeend",
      `<nav class="tabbar glass-surface" aria-label="주요 메뉴" data-od-id="tabbar">${tab.map(([l, i, h]) => `<a href="${h}"${cur(l)}>${icon(i)}${l}</a>`).join("")}</nav>
       <a class="launcher" href="#" aria-label="집사와 대화하기" data-od-id="chat-launcher"><img src="assets/kimjipsa-house.svg" alt=""></a>`);
    document.querySelector(".app")?.insertAdjacentHTML("afterbegin",
      `<aside class="sidebar" data-od-id="sidebar"><div class="brand">김집사</div><nav aria-label="주요 메뉴">${side.map(([l, i]) => `<a href="${l === "프로젝트" ? "projects.html" : "#"}"${cur(l)}>${icon(i)}${l}</a>`).join("")}</nav></aside>`);
  }

  /* ---------- 시트 · 토스트 · 폼 검증 ---------- */
  function sheet({ title, body, submit = "저장", onSubmit, danger }) {
    const dlg = document.createElement("dialog");
    dlg.className = "sheet";
    dlg.setAttribute("aria-label", title);
    dlg.innerHTML = `<form method="dialog" novalidate>
        <div class="sheet-head"><button type="button" class="text-btn" data-cancel>취소</button><h2>${esc(title)}</h2><button class="text-btn" value="ok">${submit}</button></div>
        ${body}
        ${danger ? `<div class="sheet-foot"><button type="button" class="btn danger block" data-danger>${danger.label}</button></div>` : ""}
      </form>`;
    document.body.append(dlg);
    const form = dlg.querySelector("form");
    dlg.querySelector("[data-cancel]").onclick = () => dlg.close();
    dlg.querySelector("[data-danger]")?.addEventListener("click", () => { if (confirm(danger.confirm)) { danger.run(); dlg.close(); } });
    form.addEventListener("submit", (e) => {
      if (e.submitter?.value !== "ok") return;
      const data = Object.fromEntries(new FormData(form));
      const errors = onSubmit(data, form) || {};
      form.querySelectorAll(".field").forEach((f) => f.classList.toggle("invalid", Boolean(errors[f.dataset.name])));
      if (Object.keys(errors).length) { e.preventDefault(); form.querySelector(".invalid input, .invalid select")?.focus(); }
    });
    dlg.addEventListener("close", () => dlg.remove());
    dlg.showModal();
    return dlg;
  }
  let toastTimer;
  function toast(msg, action) {
    document.querySelector(".toast")?.remove();
    const el = document.createElement("div");
    el.className = "toast"; el.setAttribute("role", "status");
    el.innerHTML = `<span>${esc(msg)}</span>${action ? `<button type="button">${action.label}</button>` : ""}`;
    if (action) el.querySelector("button").onclick = () => { action.run(); el.remove(); };
    document.body.append(el);
    clearTimeout(toastTimer); toastTimer = setTimeout(() => el.remove(), 4000);
  }
  const field = (name, label, input) => `<label class="field" data-name="${name}"><span>${label}</span>${input}</label>`;
  const options = (list, value) => list.map(([v, l]) => `<option value="${v}"${v === value ? " selected" : ""}>${esc(l)}</option>`).join("");
  const id = () => Math.random().toString(36).slice(2, 9);

  /* 후보 상태(안): 직접 바꾼 상태가 우선, 아니면 구성원 모두 👍 = 선택, 모두 👎 = 제외, 그 밖은 후보 */
  function candStatus(x) {
    if (x.manual) return x.manual;
    const v = members.map((m) => x.votes?.[m.user_id]);
    return v.every((r) => r === "up") ? "selected" : v.every((r) => r === "down") ? "excluded" : "candidate";
  }

  /* PRJ-08: 같은 종류·기간 겹침, 취소는 제외 */
  function overlaps(list) {
    const live = list.filter((r) => r.status !== "cancelled" && r.starts_on);
    const out = new Set();
    for (const a of live) for (const b of live) {
      if (a.id >= b.id || a.kind !== b.kind) continue;
      const aEnd = a.ends_on || a.starts_on, bEnd = b.ends_on || b.starts_on;
      if (a.starts_on < bEnd && b.starts_on < aEnd) { out.add(a.id); out.add(b.id); }
    }
    return out;
  }

  window.KJ = { TODAY, ME, members, db: () => db, save, esc, won, md, mdw, ymd, dateShort, days, period, ddayChip, memberName, assigneeLabel, areaName, progress, candStatus, icon, shell, sheet, toast, field, options, id, overlaps };
})();
