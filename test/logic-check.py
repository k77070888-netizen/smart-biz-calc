#!/usr/bin/env python3
"""계산 로직 검증 러너 (Node가 없는 환경용).

assets/js 의 실제 모듈을 quickjs로 실행해 같은 케이스를 검사한다.
    python3 test/logic-check.py
"""
import json
import os
import sys

import quickjs

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FILES = [
    "assets/js/common.js",
    "assets/js/margin.js",
    "assets/js/tax.js",
    "assets/js/material.js",
]

HARNESS = r"""
var __results = [];
function t(name, fn) {
  try { fn(); __results.push({name: name, ok: true}); }
  catch (e) { __results.push({name: name, ok: false, msg: String(e && e.message || e)}); }
}
function near(a, e, tol, label) {
  if (typeof a !== 'number' || !isFinite(a)) throw new Error(label + ': NaN/Infinity (' + a + ')');
  if (Math.abs(a - e) > tol) throw new Error(label + ': expected ' + e + ' ±' + tol + ', got ' + a);
}
function eq(a, e, label) {
  if (a !== e) throw new Error(label + ': expected ' + e + ', got ' + a);
}

var MB = {price: 29900, cost: 12000, feeRate: 10, shipMode: 'free', shipCost: 3000,
          pack: 500, ad: 0, taxType: 'taxed', valueRate: 15, targetMargin: 20};

t('margin 기본 정합성', function () {
  var r = MarginCalc.compute(MB);
  near(r.feeGross, 2990, 0.01, '수수료');
  near(r.settlement, 23910, 0.01, '정산액');
  near(r.salesNet, 27181.818, 0.01, '공급가액');
  near(r.profit, 10372.727, 0.5, '순이익');
  near(r.marginRate, 38.156, 0.05, '마진율');
  if (!(isFinite(r.roi) && r.roi > 0)) throw new Error('ROI');
});

t('margin 손익분기 판매가', function () {
  var r = MarginCalc.compute(MB);
  if (!(r.bepPrice > 0 && r.bepPrice < MB.price)) throw new Error('BEP 범위: ' + r.bepPrice);
  var m = MarginCalc.normalize(MB);
  near(MarginCalc.profitAt(m, r.bepPrice), 0, 1, 'BEP 이익');
});

t('margin 목표 마진 판매가', function () {
  var r = MarginCalc.compute(MB);
  var rr = MarginCalc.compute({price: Math.round(r.targetPrice), cost: 12000, feeRate: 10,
    shipMode: 'free', shipCost: 3000, pack: 500, ad: 0, taxType: 'taxed', valueRate: 15, targetMargin: 20});
  near(rr.marginRate, 20, 0.2, '목표 마진');
});

t('margin 고객부담 배송', function () {
  var r = MarginCalc.compute({price: 29900, cost: 12000, feeRate: 10, shipMode: 'customer',
    shipCost: 3000, pack: 500, ad: 0, taxType: 'taxed'});
  near(r.settlement, 26910, 0.01, '정산액');
  near(r.shipPaid, 0, 0.01, '배송비');
});

t('margin 간이·면세 NaN 없음', function () {
  var s = MarginCalc.compute({price: 29900, cost: 12000, feeRate: 10, shipMode: 'free',
    shipCost: 3000, pack: 500, ad: 0, taxType: 'simple', valueRate: 15});
  var e = MarginCalc.compute({price: 29900, cost: 12000, feeRate: 10, shipMode: 'free',
    shipCost: 3000, pack: 500, ad: 0, taxType: 'exempt'});
  if (!isFinite(s.profit) || !isFinite(s.roi)) throw new Error('간이 NaN');
  if (!isFinite(e.profit) || !isFinite(e.marginRate)) throw new Error('면세 NaN');
  near(s.simpleVat, 448.5, 0.01, '간이 부가세');
});

t('margin 경계값 (0원, 원가 0)', function () {
  var z = MarginCalc.compute({price: 0, cost: 0, feeRate: 0, shipMode: 'free', shipCost: 0, pack: 0, ad: 0});
  if (Math.abs(z.profit) > 1e-9) throw new Error('0원 이익: ' + z.profit);
  var nz = MarginCalc.compute({price: 29900, cost: 0, feeRate: 10, shipMode: 'free',
    shipCost: 0, pack: 0, ad: 0, taxType: 'taxed'});
  if (!isFinite(nz.profit)) throw new Error('이익');
  if (isFinite(nz.roi)) throw new Error('투자 0 ROI는 NaN이어야 함');
});

t('margin 수수료 100%면 BEP 없음', function () {
  var r = MarginCalc.compute({price: 29900, cost: 12000, feeRate: 100, shipMode: 'free',
    shipCost: 3000, pack: 500, ad: 0, taxType: 'taxed'});
  if (isFinite(r.bepPrice) && r.bepPrice > 0) throw new Error('BEP: ' + r.bepPrice);
});

t('tax 공급가액 → 합계', function () {
  var r = TaxCalc.vatReverse(1000000, 'supply');
  near(r.vat, 100000, 0.5, '부가세');
  near(r.total, 1100000, 0.5, '합계');
});

t('tax 합계 → 공급가액', function () {
  var r = TaxCalc.vatReverse(1100000, 'total');
  near(r.supply, 1000000, 0.5, '공급가액');
  near(r.supply + r.vat, 1100000, 0.5, '합계 유지');
});

t('tax 일반과세 납부세액', function () {
  var r = TaxCalc.generalVat(11000000, 5500000, 0);
  near(r.salesTax, 1000000, 0.5, '매출세액');
  near(r.purchaseTax, 500000, 0.5, '매입세액');
  near(r.payable, 500000, 0.5, '납부세액');
});

t('tax 환급(음수) 처리', function () {
  var r = TaxCalc.generalVat(1100000, 2200000, 0);
  if (!(r.payable < 0)) throw new Error('환급 아님: ' + r.payable);
});

t('tax 간이과세 15%', function () {
  var r = TaxCalc.simpleVat(8000000, 15, 0);
  near(r.base, 1200000, 0.5, '과세표준');
  near(r.tax, 120000, 0.5, '산출세액');
  near(r.payable, 120000, 0.5, '납부세액');
  eq(TaxCalc.simpleVat(8000000, 15, 20000).payable, 100000, '공제 후');
  eq(TaxCalc.simpleVat(1000000, 15, 999999).payable, 0, '공제 초과');
});

t('tax 3.3% 원천징수', function () {
  var r = TaxCalc.withholding(1000000, 'gross');
  near(r.income, 30000, 0.5, '소득세');
  near(r.local, 3000, 0.5, '지방소득세');
  near(r.net, 967000, 0.5, '실수령');
  near(r.income + r.local + r.net, 1000000, 0.5, '합계');
});

t('tax 3.3% 역산', function () {
  var r = TaxCalc.withholding(967000, 'net');
  near(r.gross, 1000000, 1, '세전');
  near(r.net, 967000, 1, '실수령 유지');
  eq(TaxCalc.withholding(0, 'gross').net, 0, '0원');
});

t('material 평↔㎡', function () {
  near(MaterialCalc.pyToM2(25), 82.6446, 0.001, '25평');
  near(MaterialCalc.m2ToPy(82.6446), 25, 0.001, '역변환');
  near(MaterialCalc.pyToM2(1), 3.305785, 0.0001, '1평');
});

t('material 타일 300x300', function () {
  var r = MaterialCalc.tileNeed({areaM2: 20, tileW: 300, tileH: 300, lossPct: 10, perBox: 13});
  near(r.tileM2, 0.09, 1e-9, '장당');
  near(r.needArea, 22, 1e-9, '필요면적');
  eq(r.tiles, 245, '장수');
  eq(r.boxes, 19, '박스');
  eq(r.bought, 247, '구매장수');
  if (!(r.cover >= r.needArea)) throw new Error('커버 부족');
});

t('material 타일 600x600', function () {
  var r = MaterialCalc.tileNeed({areaM2: 10, tileW: 600, tileH: 600, lossPct: 5, perBox: 4});
  eq(r.tiles, 30, '장수');
  eq(r.boxes, 8, '박스');
});

t('material 페인트', function () {
  var r = MaterialCalc.paintNeed({areaM2: 60, coats: 2, coverage: 8, lossPct: 5});
  near(r.liters, 15.75, 0.001, '리터');
  near(r.litersRounded, 15.8, 0.001, '표시');
  eq(r.cans4, 4, '4L');
  eq(r.cans18, 1, '18L');
});

t('material 도배지', function () {
  var r = MaterialCalc.wallpaperNeed({wallArea: 178, rollM2: 16.5, lossPct: 10});
  eq(r.rolls, 12, '롤');
  near(r.needArea, 195.8, 0.01, '면적');
});

t('material 0 입력', function () {
  var tt = MaterialCalc.tileNeed({areaM2: 0, tileW: 300, tileH: 300, lossPct: 10, perBox: 13});
  var pp = MaterialCalc.paintNeed({areaM2: 0, coats: 2, coverage: 8});
  var ww = MaterialCalc.wallpaperNeed({wallArea: 0, rollM2: 16.5, lossPct: 10});
  eq(tt.tiles, 0, '타일'); eq(pp.liters, 0, '페인트'); eq(ww.rolls, 0, '도배');
  if (!(MaterialCalc.paintNeed({areaM2: 50, coats: 2, coverage: 0}).liters > 0)) throw new Error('도포율 0 방어');
});

t('format 콤마', function () {
  var s = SBC.fmtInt(1234567);
  if (s.replace(/,/g, '') !== '1234567') throw new Error('fmtInt: ' + s);
  eq(SBC.won(29900).replace(/,/g, ''), '29900원', 'won');
  eq(SBC.parse('1,234,567원'), 1234567, 'parse');
  eq(SBC.parse(''), 0, '빈값');
});

JSON.stringify(__results);
"""


def main():
    src = "\n".join(open(os.path.join(ROOT, f), encoding="utf-8").read() for f in FILES)
    ctx = quickjs.Context()
    ctx.eval(src + HARNESS)
    out = json.loads(ctx.eval("JSON.stringify(__results)"))
    failed = [r for r in out if not r["ok"]]
    for r in out:
        print(("  ✓ " if r["ok"] else "  ✗ ") + r["name"] + ("" if r["ok"] else " → " + r.get("msg", "")))
    print("\n결과: %d 통과 / %d 실패" % (len(out) - len(failed), len(failed)))
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
