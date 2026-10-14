/* =====================================================================
   김집사 — shared app script
   - Icons (monoline SVG, currentColor)
   - Navigation (tab bar on mobile, sidebar on desktop)
   - Theme (설정 > 화면 모드: system / light / dark)
   - 집사 아이콘 + 채팅 (BOT-01~09)
   - KJ.confirm / KJ.toast helpers
   ===================================================================== */
(function () {
  "use strict";

  /* ---------- Household fixtures (shared across screens) ------------ */
  var HOUSE = { name: "도토리네", me: "지수", partner: "민호", bot: "김데비" };

  /* ---------- 가정 목록 (CAL-08 · INV-06 · INV-07 · INV-08 · ACC-13) ------------
     기본 목록을 제공하고, 가정 단위로 추가·수정·삭제한다.
     색은 Apple 시스템 컬러 이름으로 저장 → 라이트/다크 자동 대응. */
  var PALETTE = [
    ["red", "빨강"],
    ["orange", "주황"],
    ["yellow", "노랑"],
    ["green", "초록"],
    ["mint", "민트"],
    ["teal", "청록"],
    ["cyan", "하늘"],
    ["blue", "파랑"],
    ["indigo", "남색"],
    ["purple", "보라"],
    ["pink", "분홍"],
    ["brown", "갈색"],
    ["gray", "회색"],
  ];
  var LIST_DEFAULTS = {
    cal: [
      { id: "home", name: HOUSE.name, color: "teal" },
      { id: "work", name: "회사", color: "blue" },
      { id: "family", name: "가족", color: "green" },
      { id: "meet", name: "약속", color: "purple" },
      { id: "clinic", name: "병원", color: "pink" },
      { id: "etc", name: "기타", color: "brown", fixed: true },
    ],
    inv: [
      { id: "produce", name: "채소·과일", color: "green" },
      { id: "meat", name: "정육·수산", color: "red" },
      { id: "dairy", name: "유제품·계란", color: "yellow" },
      { id: "processed", name: "가공식품", color: "orange" },
      { id: "drink", name: "음료", color: "cyan" },
      { id: "sauce", name: "양념·소스", color: "brown" },
      { id: "living", name: "생활용품", color: "blue" },
      { id: "beauty", name: "건강·뷰티", color: "pink" },
      { id: "etc", name: "기타", color: "gray", fixed: true },
    ],
    loc: [
      { id: "fridge", name: "냉장실", on: true },
      { id: "freezer", name: "냉동실", on: true },
      { id: "pantry", name: "실온 식품장·팬트리", on: true },
      { id: "bath", name: "욕실·세탁실", on: true },
      { id: "drawer", name: "서랍·수납장", on: true },
    ],
    unit: [
      "개",
      "팩",
      "병",
      "봉지",
      "캔",
      "박스",
      "롤",
      "g",
      "kg",
      "ml",
      "L",
    ].map(function (n, i) {
      return { id: "unit" + i, name: n };
    }),
  };
  function clone(v) {
    return JSON.parse(JSON.stringify(v));
  }
  var LISTS_KEY = "kj:lists:v1",
    listsCache = null;
  function loadLists() {
    if (listsCache) return listsCache;
    var saved = null;
    try {
      saved = JSON.parse(localStorage.getItem(LISTS_KEY) || "null");
    } catch (_) {}
    listsCache = clone(LIST_DEFAULTS);
    if (saved)
      Object.keys(listsCache).forEach(function (k) {
        if (Array.isArray(saved[k])) listsCache[k] = saved[k];
      });
    return listsCache;
  }
  var lists = {
    PALETTE: PALETTE,
    get: function (type) {
      return clone(loadLists()[type]);
    },
    set: function (type, arr) {
      loadLists()[type] = clone(arr);
      try {
        localStorage.setItem(LISTS_KEY, JSON.stringify(listsCache));
      } catch (_) {}
    },
    reset: function (type) {
      lists.set(type, LIST_DEFAULTS[type]);
    },
    defaults: function (type) {
      return clone(LIST_DEFAULTS[type]);
    },
    color: function (c) {
      return "var(--sys-" + (c || "gray") + ")";
    },
    /* 기본 이름으로 저장된 예시 데이터 → 현재 이름 (이름이 바뀌었거나 삭제됐으면 반영) */
    current: function (type, defaultName) {
      var d = LIST_DEFAULTS[type].filter(function (x) {
        return x.name === defaultName;
      })[0];
      var cur =
        d &&
        loadLists()[type].filter(function (x) {
          return x.id === d.id;
        })[0];
      return cur ? cur.name : d ? null : defaultName;
    },
  };

  /* ---------- Theme ------------------------------------------------- */
  var savedTheme = null;
  try {
    savedTheme = localStorage.getItem("kj:theme");
  } catch (_) {}
  if (savedTheme === "light" || savedTheme === "dark")
    document.documentElement.setAttribute("data-theme", savedTheme);

  /* ---------- Icons ------------------------------------------------- */
  var P =
    'fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"';
  var ICONS = {
    today:
      '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/>',
    calendar:
      '<rect x="3.5" y="5" width="17" height="15.5" rx="1"/><path d="M3.5 9.5h17M8 3v4M16 3v4"/>',
    box: '<path d="M3.5 7.5 12 3.5l8.5 4v9L12 20.5l-8.5-4z"/><path d="M3.5 7.5 12 11.5l8.5-4M12 11.5v9"/>',
    cart: '<path d="M3 4h2.2l2.3 11h10.2l2.1-8H6.4"/><circle cx="9" cy="19" r="1.3"/><circle cx="16.5" cy="19" r="1.3"/>',
    gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 13.5a7.6 7.6 0 0 0 0-3l2-1.5-2-3.4-2.3.9a7.5 7.5 0 0 0-2.6-1.5L14.1 2.5h-4.2l-.4 2.5a7.5 7.5 0 0 0-2.6 1.5l-2.3-.9-2 3.4 2 1.5a7.6 7.6 0 0 0 0 3l-2 1.5 2 3.4 2.3-.9a7.5 7.5 0 0 0 2.6 1.5l.4 2.5h4.2l.4-2.5a7.5 7.5 0 0 0 2.6-1.5l2.3.9 2-3.4z"/>',
    bot: '<path d="M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v8a2.5 2.5 0 0 1-2.5 2.5H11l-4.5 3.5V17A2.5 2.5 0 0 1 4 14.5z"/><path d="M9 9.5v1.5M15 9.5v1.5M9.5 13.5c1.4.9 3.6.9 5 0"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    minus: '<path d="M5 12h14"/>',
    search: '<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.4-4.4"/>',
    chevron: '<path d="m9 5 7 7-7 7"/>',
    back: '<path d="m15 5-7 7 7 7"/>',
    lock: '<rect x="5" y="10.5" width="14" height="10" rx="1"/><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3"/>',
    close: '<path d="M6 6l12 12M18 6 6 18"/>',
    trash: '<path d="M4.5 6.5h15M9.5 6.5V4h5v2.5M6.5 6.5l1 13.5h9l1-13.5"/>',
    link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
    send: '<path d="M12 19V5M6 11l6-6 6 6"/>',
    minimize: '<path d="M6 9l6 6 6-6"/>',
    copy: '<rect x="8.5" y="8.5" width="11" height="11" rx="1"/><path d="M15.5 8.5v-3a1 1 0 0 0-1-1h-9a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1h3"/>',
    share: '<path d="M12 15V3.5M8 7.5l4-4 4 4"/><path d="M6 11v8.5h12V11"/>',
    offline:
      '<path d="M3 3l18 18"/><path d="M8.5 16.5a5 5 0 0 1 7 0M5 12.9a10 10 0 0 1 4-2.3M14.5 10.5a10 10 0 0 1 4.5 2.4M2 9.2a15 15 0 0 1 4.3-2.7M10.5 5.6A15 15 0 0 1 22 9.2"/><circle cx="12" cy="19.5" r=".6"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5.5M12 7.6v.1"/>',
    alert: '<path d="M12 3.5 2.5 20h19z"/><path d="M12 10v4.5M12 17.2v.1"/>',
    check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
    gift: '<rect x="3.5" y="8.5" width="17" height="4" rx=".5"/><path d="M5 12.5v8h14v-8M12 8.5v12M12 8.5S10.5 4 8 4.5 7 8.5 12 8.5zM12 8.5s1.5-4.5 4-4 1 4-4 4z"/>',
    person:
      '<circle cx="12" cy="8" r="3.5"/><path d="M5 20c.8-3.6 3.6-5.5 7-5.5s6.2 1.9 7 5.5"/>',
  };
  function icon(name, cls) {
    return (
      '<span class="icon' +
      (cls ? " " + cls : "") +
      '" aria-hidden="true"><svg viewBox="0 0 24 24" ' +
      P +
      ">" +
      (ICONS[name] || "") +
      "</svg></span>"
    );
  }
  function hydrateIcons(root) {
    (root || document).querySelectorAll("i[data-icon]").forEach(function (el) {
      var wrap = document.createElement("span");
      wrap.innerHTML = icon(el.getAttribute("data-icon"), el.className);
      el.replaceWith(wrap.firstChild);
    });
  }

  /* ---------- Navigation -------------------------------------------- */
  var TABS = [
    { id: "home", href: "home.html", label: "오늘", icon: "today" },
    { id: "calendar", href: "calendar.html", label: "일정", icon: "calendar" },
    { id: "inventory", href: "inventory.html", label: "재고", icon: "box" },
    { id: "cart", href: "cart.html", label: "장바구니", icon: "cart" },
    { id: "settings", href: "settings.html", label: "설정", icon: "gear" },
  ];
  function renderNav(page) {
    var app = document.querySelector(".app");
    if (!app || app.hasAttribute("data-no-nav")) return;
    var cur = function (t) {
      return t.id === page ? ' aria-current="page"' : "";
    };

    var side = document.createElement("aside");
    side.className = "sidebar";
    side.setAttribute("data-od-id", "sidebar-nav");
    side.innerHTML =
      '<div class="home-name t-title3">' +
      HOUSE.name +
      "<small>" +
      HOUSE.me +
      " · " +
      HOUSE.partner +
      "</small></div>" +
      TABS.map(function (t) {
        return (
          '<a href="' +
          t.href +
          '"' +
          cur(t) +
          ' data-od-id="side-' +
          t.id +
          '">' +
          icon(t.icon) +
          t.label +
          "</a>"
        );
      }).join("") +
      '<a href="chat.html" class="bot-side" data-od-id="side-bot"' +
      (page === "chat" ? ' aria-current="page"' : "") +
      ">" +
      icon("bot") +
      HOUSE.bot +
      "</a>" +
      '<div class="spacer"></div><div class="me">' +
      HOUSE.me +
      " · 관리자</div>";
    app.insertBefore(side, app.firstChild);

    var bar = document.createElement("nav");
    bar.className = "tabbar";
    bar.setAttribute("aria-label", "주요 메뉴");
    bar.setAttribute("data-od-id", "tabbar");
    bar.innerHTML =
      TABS.map(function (t) {
        return (
          '<a href="' +
          t.href +
          '"' +
          cur(t) +
          ' data-od-id="tab-' +
          t.id +
          '">' +
          icon(t.icon) +
          t.label +
          "</a>"
        );
      }).join("") +
      '<a href="#" class="bot-slot" data-bot-open data-od-id="tab-bot">' +
      icon("bot") +
      "집사</a>";
    app.appendChild(bar);
  }

  /* ---------- Toast ------------------------------------------------- */
  var toastEl, toastTimer;
  function toast(msg, action) {
    if (!toastEl) {
      toastEl = document.createElement("div");
      toastEl.className = "toast";
      toastEl.setAttribute("role", "status");
      document.body.appendChild(toastEl);
    }
    toastEl.innerHTML = "";
    toastEl.append(document.createTextNode(msg));
    if (action) {
      var b = document.createElement("button");
      b.type = "button";
      b.textContent = action.label;
      b.addEventListener("click", function () {
        action.onClick();
        toastEl.classList.remove("show");
      });
      toastEl.appendChild(b);
    }
    toastEl.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      toastEl.classList.remove("show");
    }, 3200);
  }

  /* ---------- Confirm (alert dialog) -------------------------------- */
  function confirmDialog(opts) {
    return new Promise(function (resolve) {
      var d = document.createElement("dialog");
      d.className = "alert";
      d.innerHTML =
        '<div class="body"><h2></h2>' +
        (opts.body ? "<p></p>" : "") +
        "</div>" +
        '<div class="actions"><button type="button" data-v="0">' +
        (opts.cancelLabel || "취소") +
        "</button>" +
        '<button type="button" data-v="1" class="' +
        (opts.destructive ? "danger" : "primary") +
        '">' +
        (opts.confirmLabel || "확인") +
        "</button></div>";
      d.querySelector("h2").textContent = opts.title;
      if (opts.body) d.querySelector("p").textContent = opts.body;
      document.body.appendChild(d);
      d.addEventListener("click", function (e) {
        var v = e.target.closest("[data-v]");
        if (!v) return;
        d.close();
        d.remove();
        resolve(v.getAttribute("data-v") === "1");
      });
      d.addEventListener("cancel", function () {
        d.remove();
        resolve(false);
      });
      d.showModal();
    });
  }

  /* ---------- Korean particle helper -------------------------------- */
  function josa(word, pair) {
    // pair: '을/를', '이/가', '와/과', '은/는'
    var c = word.charCodeAt(word.length - 1);
    var has = c >= 0xac00 && c <= 0xd7a3 && (c - 0xac00) % 28 > 0;
    var p = pair.split("/");
    // pair given as 받침있음/없음 except 와/과 (no/yes)
    if (pair === "와/과") return word + (has ? "과" : "와");
    return word + (has ? p[0] : p[1]);
  }

  /* ---------- 집사 채팅 (BOT-01~09) ---------------------------------- */
  var FAQ = [
    {
      q: "장바구니에 어떻게 담아요?",
      a: '장바구니 화면에서 품목을 직접 추가하거나, 재고에서 "다 썼어요"를 누른 뒤 "장바구니에 담기"를 고르면 돼요. 저에게 "계란이랑 두부 담아줘"라고 말해도 바로 담아 드려요.',
    },
    {
      q: "내 개인 일정, 배우자도 볼 수 있나요?",
      a: "아니요. 개인 일정의 제목·장소·메모는 화면에서도, 제 대답에서도 배우자에게 보이지 않아요. 배우자에게는 그 시간에 일정이 있다는 것만 표시돼요.",
    },
    {
      q: "AI 키는 어디서 등록하나요?",
      a: "설정 > AI 집사에서 Claude 또는 Gemini 키를 한 번 등록하면 가정 전체가 함께 써요. 키가 없어도 일정·재고·장바구니는 그대로 쓸 수 있어요.",
    },
  ];

  function Chat(container, opts) {
    this.el = container;
    this.opts = opts || {};
    this.log = container.querySelector(".chat-log");
    this.form = container.querySelector(".chat-input");
    this.input = this.form.querySelector("input");
    this.send = this.form.querySelector(".send");
    var self = this;
    this.input.addEventListener("input", function () {
      self.send.disabled = !self.input.value.trim();
    });
    this.form.addEventListener("submit", function (e) {
      e.preventDefault();
      self.ask(self.input.value.trim());
    });
    this.log.addEventListener("click", function (e) {
      var f = e.target.closest("[data-faq]");
      if (f) {
        var item = FAQ[+f.getAttribute("data-faq")];
        self.me(item.q);
        self.bot(item.a);
      }
    });
    this.greet();
  }
  var BOT_AVATAR = "assets/kimjipsa-avatar.png";
  Chat.prototype.scroll = function () {
    var l = this.log;
    requestAnimationFrame(function () {
      l.scrollTop = l.scrollHeight;
    });
  };
  Chat.prototype.me = function (text) {
    var m = document.createElement("div");
    m.className = "msg me";
    m.textContent = text;
    this.log.appendChild(m);
    this.scroll();
  };
  Chat.prototype.bot = function (html, isHtml) {
    var m = document.createElement("div");
    m.className = "msg bot";
    m.innerHTML =
      '<img class="bot-avatar" src="' +
      BOT_AVATAR +
      '" alt="" width="28" height="28">' +
      '<div class="body"><div class="from">' +
      HOUSE.bot +
      '</div><div class="txt"></div></div>';
    if (isHtml) m.querySelector(".txt").innerHTML = html;
    else m.querySelector(".txt").textContent = html;
    this.log.appendChild(m);
    this.scroll();
    return m.querySelector(".body");
  };
  Chat.prototype.greet = function () {
    this.bot(
      "안녕하세요, " +
        HOUSE.me +
        "님. " +
        HOUSE.bot +
        "예요. 이런 일을 도와드릴 수 있어요." +
        "<ul><li>일정 등록·수정·삭제·조회</li><li>재고 확인과 수량 변경</li><li>장바구니 담기·체크·삭제</li></ul>" +
        '<div class="faq">' +
        FAQ.map(function (f, i) {
          return (
            '<button type="button" data-faq="' +
            i +
            '" data-od-id="faq-' +
            (i + 1) +
            '">' +
            f.q +
            "</button>"
          );
        }).join("") +
        "</div>",
      true,
    );
  };
  Chat.prototype.ask = function (text) {
    if (!text) return;
    var self = this;
    this.me(text);
    this.input.value = "";
    this.send.disabled = true;
    var t = document.createElement("div");
    t.className = "msg typing-dots";
    t.textContent = "•••";
    this.log.appendChild(t);
    this.scroll();
    setTimeout(function () {
      t.remove();
      self.reply(text);
    }, 650);
  };
  Chat.prototype.reply = function (text) {
    if (/주식|코인|날씨|뉴스|로또|연예/.test(text)) {
      return this.bot(
        "그건 제가 답할 수 없는 질문이에요. 대신 일정, 재고, 장바구니와 관련된 일이라면 바로 도와드릴게요.",
      );
    }
    if (/장바구니/.test(text) && /담아|넣어|추가/.test(text)) {
      var head = text
        .split("장바구니")[0]
        .replace(/(을|를)\s*$/, "")
        .trim();
      var items = head
        .split(/이랑|랑|하고|,|\s과\s|\s와\s/)
        .map(function (s) {
          return s.trim();
        })
        .filter(Boolean);
      if (!items.length)
        return this.bot("어떤 품목을 담을까요? 품목 이름을 알려 주세요.");
      var joined =
        items.length > 1
          ? items
              .slice(0, -1)
              .map(function (w) {
                return josa(w, "와/과");
              })
              .join(" ") +
            " " +
            items[items.length - 1]
          : items[0];
      this.bot("장바구니에 " + josa(joined, "을/를") + " 담았어요.");
      if (this.opts.onCartAdd) this.opts.onCartAdd(items);
      return;
    }
    if (/재고|떨어|부족|남았/.test(text)) {
      return this.bot(
        "지금 확인이 필요한 재고예요.<ul><li>세탁세제 — 없음</li><li>우유 1팩 — 부족</li><li>두부 — 유통기한 내일까지</li></ul>",
        true,
      );
    }
    if (/일정|뭐 있|스케줄/.test(text)) {
      return this.bot(
        '오늘 일정이에요.<ul><li>10:30 치과 정기검진</li><li>19:30 성수동 저녁 약속</li></ul><div class="note">' +
          HOUSE.partner +
          "님의 개인 일정도 등록되어 있습니다.</div>",
        true,
      );
    }
    this.bot(
      '조금 더 구체적으로 말씀해 주시겠어요? 예를 들어 "이번 주 토요일 일정 알려줘", "우유 2개 샀어"처럼 말해 주시면 바로 처리할게요.',
    );
  };
  Chat.prototype.pending = function (question, seconds, target) {
    target = target || "치과";
    // BOT-08: 챗봇 판단 변경 — 채팅 안 확인/취소, 5분 뒤 만료, 팝업 없음
    var self = this,
      left = seconds;
    var m = this.bot(question, false);
    var box = document.createElement("div");
    box.className = "confirm";
    box.innerHTML =
      '<div class="timer"></div><div class="btns">' +
      '<button type="button" class="btn sm" data-ok data-od-id="pending-confirm">삭제</button>' +
      '<button type="button" class="btn sm gray" data-no data-od-id="pending-cancel">취소</button></div>';
    m.appendChild(box);
    var timer = box.querySelector(".timer");
    function fmt(s) {
      return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0");
    }
    function done(text) {
      clearInterval(iv);
      box.querySelectorAll("button").forEach(function (b) {
        b.disabled = true;
      });
      timer.textContent = text;
    }
    timer.textContent = fmt(left) + " 안에 선택해 주세요";
    var iv = setInterval(function () {
      left -= 1;
      if (left <= 0) {
        done("시간이 지나 요청이 만료됐어요. 일정은 그대로예요.");
        return;
      }
      timer.textContent = fmt(left) + " 안에 선택해 주세요";
    }, 1000);
    box.querySelector("[data-ok]").addEventListener("click", function () {
      done("확인했어요.");
      self.bot("‘" + target + "’ 일정을 삭제했어요.");
    });
    box.querySelector("[data-no]").addEventListener("click", function () {
      done("취소했어요.");
      self.bot("알겠어요. 일정은 그대로 둘게요.");
    });
  };

  function chatMarkup(inline) {
    return (
      '<section class="chat-panel' +
      (inline ? " inline" : "") +
      '" ' +
      (inline ? "" : "hidden ") +
      'role="dialog" aria-label="' +
      HOUSE.bot +
      '와 대화" data-od-id="chat-panel">' +
      '<header class="chat-head"><img class="bot-avatar lg" src="' +
      BOT_AVATAR +
      '" alt="" width="36" height="36"><div class="who"><b>' +
      HOUSE.bot +
      "</b><small>Claude 연결됨 · 대화는 나만 볼 수 있어요</small></div>" +
      (inline
        ? ""
        : '<button type="button" class="icon-btn" data-bot-min aria-label="최소화" data-od-id="chat-minimize">' +
          icon("minimize") +
          "</button>" +
          '<button type="button" class="icon-btn" data-bot-close aria-label="닫기" data-od-id="chat-close">' +
          icon("close") +
          "</button>") +
      '</header><div class="chat-log" aria-live="polite"></div>' +
      '<form class="chat-input" data-od-id="chat-input"><label class="sr-only" for="chat-q' +
      (inline ? "-i" : "") +
      '">메시지</label>' +
      '<input id="chat-q' +
      (inline ? "-i" : "") +
      '" class="input" autocomplete="off" placeholder="' +
      HOUSE.bot +
      '에게 부탁하기">' +
      '<button type="submit" class="send" disabled aria-label="보내기" data-od-id="chat-send">' +
      icon("send") +
      "</button></form></section>"
    );
  }

  /* 집 위 말풍선: 첫 등장 6초 뒤, 이후 25~40초 간격으로 4초씩, 같은 멘트 연속 없이 랜덤 */
  var PEEK_LINES = ["...", "무엇이든 도와줄 수 있어!", "오늘 할 일 알려줄까?"];
  function startPeek(el) {
    var last = -1;
    function idle() {
      return document.hidden || document.body.classList.contains("chat-open");
    }
    function show() {
      if (!idle()) {
        var i;
        do {
          i = Math.floor(Math.random() * PEEK_LINES.length);
        } while (i === last);
        last = i;
        el.textContent = PEEK_LINES[i];
        el.classList.toggle("dots", PEEK_LINES[i] === "...");
        el.classList.add("on");
        setTimeout(function () {
          el.classList.remove("on");
        }, 4000);
      }
      setTimeout(show, 25000 + Math.random() * 15000);
    }
    setTimeout(show, 6000);
  }

  function mountBot(page, opts) {
    if (
      page === "chat" ||
      page === "onboarding" ||
      page === "components" ||
      page === "launcher"
    )
      return null;
    var min = false;
    try {
      min = localStorage.getItem("kj:botMin") === "1";
    } catch (_) {}
    var fab = document.createElement("button");
    fab.type = "button";
    fab.className = "bot-fab";
    fab.setAttribute("aria-label", HOUSE.bot + " 열기");
    fab.setAttribute("data-od-id", "bot-fab");
    fab.innerHTML =
      '<img class="fab-house" src="assets/kimjipsa-house.svg" alt="" width="88" height="82"><span class="peek" aria-hidden="true"></span>';
    document.body.appendChild(fab);
    startPeek(fab.querySelector(".peek"));
    var wrap = document.createElement("div");
    wrap.innerHTML = chatMarkup(false);
    var panel = wrap.firstChild;
    document.body.appendChild(panel);
    var chat = new Chat(panel, opts);
    var tabbar = document.querySelector(".tabbar");

    function setMin(v) {
      min = v;
      fab.hidden = v;
      if (tabbar) tabbar.classList.toggle("has-bot", v);
      try {
        localStorage.setItem("kj:botMin", v ? "1" : "0");
      } catch (_) {}
    }
    function open() {
      panel.hidden = false;
      document.body.classList.add("chat-open");
      chat.input.focus();
    }
    function close() {
      panel.hidden = true;
      document.body.classList.remove("chat-open");
    }
    fab.addEventListener("click", open);
    panel.querySelector("[data-bot-close]").addEventListener("click", close);
    panel
      .querySelector("[data-bot-min]")
      .addEventListener("click", function () {
        close();
        setMin(true);
        toast("집사를 하단 메뉴로 옮겼어요", {
          label: "되돌리기",
          onClick: function () {
            setMin(false);
          },
        });
      });
    document.addEventListener("click", function (e) {
      if (e.target.closest("[data-bot-open]")) {
        e.preventDefault();
        open();
      }
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && !panel.hidden) close();
    });
    setMin(min);
    return chat;
  }

  /* ---------- Boot -------------------------------------------------- */
  var KJ = {
    HOUSE: HOUSE,
    lists: lists,
    icon: icon,
    toast: toast,
    confirm: confirmDialog,
    josa: josa,
    Chat: Chat,
    chatMarkup: chatMarkup,
    init: function (opts) {
      opts = opts || {};
      var page = document.body.getAttribute("data-page");
      renderNav(page);
      hydrateIcons();
      KJ.chat = mountBot(page, opts.bot);
    },
  };
  window.KJ = KJ;
})();
