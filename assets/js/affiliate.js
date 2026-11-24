/* ==========================================================================
   제휴(쿠팡 파트너스) 링크 · 엑셀 템플릿 구매 링크 설정
   --------------------------------------------------------------------------
   ▶ 제휴 링크를 받으면 아래 각 항목의 url 값만 채우면 됩니다.
     HTML은 손대지 않아도 카드가 바로 '구매 가능' 상태로 바뀝니다.
   ▶ url 이 빈 문자열("")이면 카드는 '준비 중' 상태로 표시되고
     링크가 걸리지 않습니다. (검색 링크나 # 로 대체하지 않습니다)
   ▶ 쿠팡 파트너스는 '상품별 바로가기 링크'를 그대로 넣으세요.
   ========================================================================== */
window.SBC_AFFILIATE = {
  version: "2026-11-24",

  /* 실제 링크가 하나라도 연결되면 카드 아래에 자동으로 표시됩니다. */
  disclosure:
    "이 영역의 상품 링크는 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받을 수 있습니다. 가격과 재고는 판매처 기준입니다.",

  groups: {
    /* 마진·수수료 계산기 하단 — 셀러 포장·발송 부자재 */
    margin: {
      title: "셀러 포장·발송 부자재",
      items: [
        {
          name: "택배박스 3~6호",
          desc: "상품 크기별로 3~4종을 섞어 두면 포장이 빨라집니다.",
          emoji: "📦",
          url: ""
        },
        {
          name: "OPP 테이프 45mm",
          desc: "박스 봉인용 투명 테이프. 50m 두세 개면 한 달은 갑니다.",
          emoji: "🎗️",
          url: ""
        },
        {
          name: "에어캡(뽁뽁이) 30cm",
          desc: "깨지기 쉬운 상품에 필수. 좁은 폭이 감기 편합니다.",
          emoji: "🫧",
          url: ""
        },
        {
          name: "포장 감사 스티커",
          desc: "주문 마감에 한 장 붙이면 리뷰율이 올라갑니다.",
          emoji: "🏷️",
          url: ""
        }
      ]
    },

    /* 자재 소요량 계산기 하단 — 인테리어 시공 부자재 */
    material: {
      title: "타일·도장 시공 부자재",
      items: [
        {
          name: "타일 스페이서 2·3mm",
          desc: "줄눈 폭을 일정하게. 100개입 한 봉이면 3~4㎡ 분입니다.",
          emoji: "🧱",
          url: ""
        },
        {
          name: "줄눈제 5kg",
          desc: "타일 5~8㎡ 기준 한 포. 색상은 타일과 맞춰 주세요.",
          emoji: "🪣",
          url: ""
        },
        {
          name: "페인트 롤러 세트",
          desc: "4인치·7인치 세트. 롤러 커버는 소모품이라 여유 있게.",
          emoji: "🖌️",
          url: ""
        },
        {
          name: "마스킹 테이프 24·48mm",
          desc: "창틀·몰딩 경계 작업에. 두세 개는 있어야 합니다.",
          emoji: "🧻",
          url: ""
        }
      ]
    }
  },

  /* 엑셀 템플릿 — 스마트스토어 '에스앤비 제주' 오픈 후 상품 URL을 넣습니다. */
  templates: {
    storeName: "에스앤비 제주",
    storeUrl: "",
    items: {
      marginBook: { price: "9,900원", url: "" },
      vatBook: { price: "9,900원", url: "" },
      bundle: { price: "16,900원", url: "" }
    }
  }
};

/* ==========================================================================
   렌더러 — 위 설정을 읽어 카드를 그립니다. (수정 불필요)
   ========================================================================== */
(function () {
  "use strict";

  var CFG = window.SBC_AFFILIATE || {};
  var EMPTY_NOTE =
    "지금은 준비 중인 자리입니다. 링크가 연결되면 이 카드에서 바로 구매할 수 있습니다.";

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function buildCard(item, live) {
    var tag = live ? "a" : "div";
    var card = document.createElement(tag);
    card.className = "aff-card" + (live ? "" : " is-soon");
    if (live) {
      card.href = item.url;
      card.target = "_blank";
      card.rel = "nofollow sponsored noopener";
    }
    var html = '<span class="aff-emoji" aria-hidden="true">' + esc(item.emoji || "🛒") + "</span>";
    if (!live) html += '<span class="aff-badge">준비 중</span>';
    html += "<h3>" + esc(item.name) + "</h3>";
    if (item.desc) html += "<p>" + esc(item.desc) + "</p>";
    if (live) html += '<span class="aff-go">판매처에서 보기 →</span>';
    card.innerHTML = html;
    return card;
  }

  function renderGroup(node) {
    var key = node.getAttribute("data-affiliate-group");
    var group = (CFG.groups || {})[key];
    if (!group || !group.items) return false;
    node.innerHTML = "";
    var live = false;
    group.items.forEach(function (item) {
      var on = !!(item.url && String(item.url).trim());
      if (on) live = true;
      node.appendChild(buildCard(item, on));
    });
    return live;
  }

  function renderNote(node, live) {
    node.textContent = live ? CFG.disclosure || "" : EMPTY_NOTE;
    node.classList.toggle("is-live", !!live);
  }

  function renderTemplateLinks() {
    var T = CFG.templates || {};
    var items = T.items || {};
    var anyLive = false;

    document.querySelectorAll("[data-template-link]").forEach(function (node) {
      var item = items[node.getAttribute("data-template-link")] || {};
      var url = item.url && String(item.url).trim();
      if (url) {
        anyLive = true;
        node.innerHTML =
          '<a class="btn btn-primary" href="' + esc(url) +
          '" target="_blank" rel="nofollow sponsored noopener">스마트스토어에서 구매</a>' +
          '<span class="tpl-status">판매 중</span>';
      } else {
        node.innerHTML =
          '<span class="btn btn-disabled" aria-disabled="true">스마트스토어 오픈 후 구매</span>' +
          '<span class="tpl-status">오픈 준비 중</span>';
      }
    });

    document.querySelectorAll("[data-template-price]").forEach(function (node) {
      var item = items[node.getAttribute("data-template-price")] || {};
      node.textContent = item.price || "가격 미정";
    });

    document.querySelectorAll("[data-store-url]").forEach(function (node) {
      var url = T.storeUrl && String(T.storeUrl).trim();
      if (url) {
        node.href = url;
        node.textContent = T.storeName || "스마트스토어";
        node.hidden = false;
      } else {
        node.hidden = true;
      }
    });

    document.querySelectorAll("[data-store-name]").forEach(function (node) {
      if (T.storeName) node.textContent = T.storeName;
    });
    return anyLive;
  }

  function boot() {
    var liveAny = false;
    document.querySelectorAll("[data-affiliate-group]").forEach(function (node) {
      if (renderGroup(node)) liveAny = true;
    });
    document.querySelectorAll("[data-affiliate-note]").forEach(function (node) {
      renderNote(node, liveAny);
    });
    renderTemplateLinks();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
