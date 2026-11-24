#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""assets/js/affiliate.js 동작 검증 (DOM 최소 스텁 + quickjs).

    python3 test/affiliate-check.py

확인 항목
1. 링크가 비어 있을 때: 카드가 div(링크 없음)로 4개 그려지고 '준비 중' 상태
2. 링크를 채웠을 때: a 태그 + href + rel="nofollow sponsored noopener", 수수료 고지 표시
3. 템플릿 구매 버튼: 링크 없으면 비활성 span, 있으면 a 태그
"""
import os
import sys

import quickjs

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = open(os.path.join(ROOT, "assets/js/affiliate.js"), encoding="utf-8").read()

STUB = r"""
function El(tag) {
  this.tagName = tag.toUpperCase();
  this.className = "";
  this.innerHTML = "";
  this.textContent = "";
  this.hidden = false;
  this.children = [];
  this._attr = {};
}
El.prototype.appendChild = function (c) { this.children.push(c); };
El.prototype.getAttribute = function (k) { return this._attr[k]; };
El.prototype.setAttribute = function (k, v) { this._attr[k] = v; };
Object.defineProperty(El.prototype, "classList", {
  get: function () { var self = this; return { toggle: function () {} }; }
});

var nodes = { group: [], note: [], tpl: [], price: [] };
var els = {};

function makeNode(attr, key) {
  var e = new El("div");
  e._attr = attr;
  e.key = key;
  return e;
}

var document = {
  readyState: "complete",
  addEventListener: function () {},
  createElement: function (t) { return new El(t); },
  querySelectorAll: function (sel) {
    if (sel === "[data-affiliate-group]") return nodes.group;
    if (sel === "[data-affiliate-note]") return nodes.note;
    if (sel === "[data-template-link]") return nodes.tpl;
    if (sel === "[data-template-price]") return nodes.price;
    if (sel === "[data-store-url]" || sel === "[data-store-name]") return [];
    return [];
  }
};

function setup() {
  nodes.group = [makeNode({ "data-affiliate-group": "margin" }, "margin"),
                 makeNode({ "data-affiliate-group": "material" }, "material")];
  nodes.note = [makeNode({ "data-affiliate-note": "" }, "note")];
  nodes.tpl = [makeNode({ "data-template-link": "marginBook" }, "tpl")];
  nodes.price = [makeNode({ "data-template-price": "bundle" }, "price")];
}
"""


def run(src):
    ctx = quickjs.Context()
    ctx.eval("var window = {};")
    ctx.eval(STUB)
    ctx.eval("setup();")
    ctx.eval(src)
    return ctx


fails = []


def check(cond, label):
    if not cond:
        fails.append(label)


# 1) 링크 없음 상태
ctx = run(SRC)
check(ctx.eval("nodes.group[0].children.length") == 4, "마진 그룹 카드 4개")
check(ctx.eval("nodes.group[1].children.length") == 4, "자재 그룹 카드 4개")
check(ctx.eval("nodes.group[0].children[0].tagName") == "DIV", "준비 중 카드는 링크가 아닌 div")
check(ctx.eval("nodes.group[0].children[0].className") == "aff-card is-soon", "준비 중 클래스")
check("준비 중" in ctx.eval("nodes.group[0].children[0].innerHTML"), "준비 중 배지")
check("href" not in ctx.eval("nodes.group[0].children[0].innerHTML"), "준비 중 카드에 href 없음")
check("준비 중" in ctx.eval("nodes.note[0].textContent"), "안내 문구 표시")
check(ctx.eval("nodes.tpl[0].innerHTML").find("btn-disabled") >= 0, "템플릿 구매 버튼 비활성")
check(ctx.eval("nodes.price[0].textContent") == "16,900원", "세트 예정가 표시")

# 2) 링크를 채운 상태 (첫 상품 + 템플릿 링크)
live_src = SRC.replace('url: ""', 'url: "https://link.coupang.com/a/test"', 1)
live_src = live_src.replace('marginBook: { price: "9,900원", url: "" }',
                            'marginBook: { price: "9,900원", url: "https://smartstore.naver.com/snbjeju/products/1" }')
ctx = run(live_src)
check(ctx.eval("nodes.group[0].children[0].tagName") == "A", "링크가 있으면 a 태그")
check(ctx.eval("nodes.group[0].children[0].href") == "https://link.coupang.com/a/test", "href 연결")
check("sponsored" in ctx.eval("nodes.group[0].children[0].rel"), "rel=sponsored")
check("쿠팡 파트너스" in ctx.eval("nodes.note[0].textContent"), "수수료 고지 표시")
check(ctx.eval("nodes.group[0].children[1].tagName") == "DIV", "링크 없는 카드는 그대로 준비 중")
check(ctx.eval("nodes.tpl[0].innerHTML").find("스마트스토어에서 구매") >= 0, "템플릿 구매 버튼 활성")

if fails:
    print("❌ affiliate.js 검증 실패")
    for f in fails:
        print("  -", f)
    sys.exit(1)
print("✅ affiliate.js 검증 통과 (준비 중 4+4 카드 / 링크 연결 시 a 태그·수수료 고지 / 템플릿 버튼 상태)")
