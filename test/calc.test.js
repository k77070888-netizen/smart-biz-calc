/* 계산 로직 검증 — node test/calc.test.js */
'use strict';

const path = require('path');
const assert = require('assert');

global.SBC = require(path.join(__dirname, '..', 'assets/js/common.js'));
const Margin = require(path.join(__dirname, '..', 'assets/js/margin.js'));
const Tax = require(path.join(__dirname, '..', 'assets/js/tax.js'));
const Mat = require(path.join(__dirname, '..', 'assets/js/material.js'));

let pass = 0;
const fails = [];

function near(actual, expected, tol, label) {
  if (!isFinite(actual)) throw new Error(label + ': NaN/Infinity (' + actual + ')');
  if (Math.abs(actual - expected) > tol) {
    throw new Error(label + ': expected ' + expected + ' ±' + tol + ', got ' + actual);
  }
}

function test(name, fn) {
  try { fn(); pass++; console.log('  ✓ ' + name); }
  catch (e) { fails.push(name + ' → ' + e.message); console.log('  ✗ ' + name + ' → ' + e.message); }
}

console.log('\n[margin]');
const base = {
  price: 29900, cost: 12000, feeRate: 10, shipMode: 'free', shipCost: 3000,
  pack: 500, ad: 0, taxType: 'taxed', valueRate: 15, targetMargin: 20
};

test('기본 케이스 숫자 정합성', () => {
  const r = Margin.compute(base);
  near(r.feeGross, 2990, 0.01, '수수료');
  near(r.settlement, 23910, 0.01, '정산액');
  near(r.salesNet, 27181.818, 0.01, '공급가액');
  near(r.profit, 10372.727, 0.5, '순이익');
  near(r.marginRate, 38.16, 0.1, '마진율');
  assert(isFinite(r.roi) && r.roi > 0, 'ROI 유한값');
});

test('손익분기 판매가에서 순이익 = 0', () => {
  const r = Margin.compute(base);
  assert(r.bepPrice > 0 && r.bepPrice < base.price, 'BEP < 판매가');
  const m = Margin.normalize(base);
  near(Margin.profitAt(m, r.bepPrice), 0, 1, 'BEP 순이익');
});

test('목표 마진 판매가의 마진율 = 목표', () => {
  const r = Margin.compute(base);
  const m = Margin.normalize({ ...base, price: r.targetPrice });
  const rr = Margin.compute({ ...base, price: Math.round(r.targetPrice) });
  near(rr.marginRate, 20, 0.15, '목표 마진');
});

test('고객부담 배송이면 정산액에서 배송비 차감 없음', () => {
  const r = Margin.compute({ ...base, shipMode: 'customer' });
  near(r.settlement, 29900 - 2990, 0.01, '정산액');
  near(r.shipPaid, 0, 0.01, '배송비');
});

test('간이과세 · 면세도 NaN 없이 계산', () => {
  const s = Margin.compute({ ...base, taxType: 'simple', valueRate: 15 });
  const e = Margin.compute({ ...base, taxType: 'exempt' });
  assert(isFinite(s.profit) && isFinite(s.roi), '간이과세 유한값');
  assert(isFinite(e.profit) && isFinite(e.marginRate), '면세 유한값');
  near(s.simpleVat, 29900 * 0.15 * 0.1, 0.01, '간이 부가세');
  assert(s.profit < Margin.compute(base).profit, '간이과세 이익 < 일반과세 이익');
});

test('0원 입력 · 원가 0 · 수수료 0 경계값', () => {
  const z = Margin.compute({ price: 0, cost: 0, feeRate: 0, shipMode: 'free', shipCost: 0, pack: 0, ad: 0, taxType: 'taxed' });
  assert(z.profit === 0 || Math.abs(z.profit) < 1e-9, '가격 0 → 이익 0');
  assert(!isFinite(z.marginRate) || Math.abs(z.marginRate) <= 100, '마진율 안전');
  const nz = Margin.compute({ ...base, cost: 0, shipCost: 0, pack: 0, ad: 0 });
  assert(nz.roi === Infinity || !isFinite(nz.roi), '투자 0 → ROI NaN 처리');
  assert(isFinite(nz.profit), '투자 0이어도 이익은 유한값');
});

test('수수료율 100%면 손익분기 없음', () => {
  const r = Margin.compute({ ...base, feeRate: 100 });
  assert(!isFinite(r.bepPrice) || r.bepPrice === 0, 'BEP 없음');
});

console.log('\n[tax]');
test('공급가액 → 합계금액', () => {
  const r = Tax.vatReverse(1000000, 'supply');
  near(r.vat, 100000, 0.5, '부가세');
  near(r.total, 1100000, 0.5, '합계');
});

test('합계금액 → 공급가액 역산 왕복', () => {
  const r = Tax.vatReverse(1100000, 'total');
  near(r.supply, 1000000, 0.5, '공급가액');
  near(r.vat, 100000, 0.5, '부가세');
  near(r.supply + r.vat, 1100000, 0.5, '합계 유지');
});

test('일반과세 납부세액', () => {
  const r = Tax.generalVat(11000000, 5500000, 0);
  near(r.salesTax, 1000000, 0.5, '매출세액');
  near(r.purchaseTax, 500000, 0.5, '매입세액');
  near(r.payable, 500000, 0.5, '납부세액');
});

test('매입이 더 많으면 환급(음수)', () => {
  const r = Tax.generalVat(1100000, 2200000, 0);
  assert(r.payable < 0, '환급');
});

test('간이과세 15% 업종', () => {
  const r = Tax.simpleVat(8000000, 15, 0);
  near(r.base, 1200000, 0.5, '과세표준');
  near(r.tax, 120000, 0.5, '산출세액');
  near(r.payable, 120000, 0.5, '납부세액');
});

test('간이과세 매입세액 공제 반영', () => {
  const r = Tax.simpleVat(8000000, 15, 20000);
  near(r.payable, 100000, 0.5, '공제 후');
  const over = Tax.simpleVat(1000000, 15, 999999);
  assert(over.payable === 0, '공제 초과 시 0');
});

test('3.3% 원천징수 (세전 → 실수령)', () => {
  const r = Tax.withholding(1000000, 'gross');
  near(r.income, 30000, 0.5, '소득세');
  near(r.local, 3000, 0.5, '지방소득세');
  near(r.net, 967000, 0.5, '실수령');
  near(r.income + r.local + r.net, 1000000, 0.5, '합계 일치');
});

test('3.3% 원천징수 역산 (실수령 → 세전)', () => {
  const r = Tax.withholding(967000, 'net');
  near(r.gross, 1000000, 1, '세전');
  near(r.net, 967000, 1, '실수령 유지');
});

test('원천징수 0원 · 소액 경계', () => {
  const z = Tax.withholding(0, 'gross');
  assert(z.net === 0 && z.income === 0, '0원');
  const s = Tax.withholding(30000, 'gross');
  assert(isFinite(s.net) && s.net === 30000 - 900 - 90, '3만원');
});

console.log('\n[material]');
test('평 ↔ ㎡ 변환', () => {
  near(Mat.pyToM2(25), 82.6446, 0.001, '25평');
  near(Mat.m2ToPy(82.6446), 25, 0.001, '역변환');
  near(Mat.pyToM2(1), 3.305785, 0.0001, '1평');
});

test('타일 300×300 · 20㎡ · 로스 10%', () => {
  const r = Mat.tileNeed({ areaM2: 20, tileW: 300, tileH: 300, lossPct: 10, perBox: 13 });
  near(r.tileM2, 0.09, 1e-9, '장당 면적');
  near(r.needArea, 22, 1e-9, '필요 면적');
  assert(r.tiles === 245, '필요 장수 245, got ' + r.tiles);
  assert(r.boxes === 19, '박스 19, got ' + r.boxes);
  assert(r.bought === 247, '구매 247장');
  assert(r.cover >= r.needArea, '구매 면적 ≥ 필요 면적');
});

test('타일 600×600 · 박스당 4장 올림 확인', () => {
  const r = Mat.tileNeed({ areaM2: 10, tileW: 600, tileH: 600, lossPct: 5, perBox: 4 });
  assert(r.tiles === 30, '30장, got ' + r.tiles);
  assert(r.boxes === 8, '8박스, got ' + r.boxes);
});

test('페인트 60㎡ · 2회 · 8㎡/L · 5%', () => {
  const r = Mat.paintNeed({ areaM2: 60, coats: 2, coverage: 8, lossPct: 5 });
  near(r.liters, 15.75, 0.001, '리터');
  near(r.litersRounded, 15.8, 0.001, '표시 리터');
  assert(r.cans4 === 4 && r.cans18 === 1, '통 수');
});

test('도배 178㎡ · 실크 16.5㎡ · 로스 10%', () => {
  const r = Mat.wallpaperNeed({ wallArea: 178, rollM2: 16.5, lossPct: 10 });
  assert(r.rolls === 12, '12롤, got ' + r.rolls);
  near(r.needArea, 195.8, 0.01, '필요 면적');
});

test('0 입력 경계값에서 NaN 없음', () => {
  const t = Mat.tileNeed({ areaM2: 0, tileW: 300, tileH: 300, lossPct: 10, perBox: 13 });
  const p = Mat.paintNeed({ areaM2: 0, coats: 2, coverage: 8 });
  const w = Mat.wallpaperNeed({ wallArea: 0, rollM2: 16.5, lossPct: 10 });
  assert(t.tiles === 0 && t.boxes === 0, '타일 0');
  assert(p.liters === 0 && p.cans4 === 0, '페인트 0');
  assert(w.rolls === 0, '도배 0');
});

test('도포율 최소값 방어 (0 나누기)', () => {
  const r = Mat.paintNeed({ areaM2: 50, coats: 2, coverage: 0 });
  assert(isFinite(r.liters) && r.liters > 0, '도포율 0 방어');
});

console.log('\n[format]');
test('콤마 · 원화 포맷', () => {
  assert.strictEqual(SBC.fmtInt(1234567), '1,234,567');
  assert.strictEqual(SBC.won(29900), '29,900원');
  assert.strictEqual(SBC.fmtPct(38.156, 1), '38.2%');
  assert.strictEqual(SBC.parse('1,234,567원'), 1234567);
  assert.strictEqual(SBC.parse(''), 0);
  assert.strictEqual(SBC.parse('abc'), 0);
});

console.log('\n결과: ' + pass + ' 통과 / ' + fails.length + ' 실패');
if (fails.length) {
  console.log(fails.map((f) => ' - ' + f).join('\n'));
  process.exit(1);
}
