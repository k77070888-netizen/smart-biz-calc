/* ==========================================================================
   부가세 · 원천세(3.3%) 계산기
   - 공급가액 ↔ 합계금액 역산
   - 일반과세자 예상 납부세액 / 간이과세자 납부세액
   - 3.3% 원천징수 (세전 ↔ 실수령)
   ========================================================================== */
(function (global) {
  'use strict';

  var SBC = global.SBC || (typeof require === 'function' ? require('./common.js') : {});
  var VAT_RATE = 0.1;

  /* ---------- 부가세 ---------- */
  function vatReverse(amount, base) {
    var a = Math.max(0, amount || 0);
    if (base === 'total') {
      var supply = Math.round(a / (1 + VAT_RATE));
      return { supply: supply, vat: a - supply, total: a };
    }
    var vat = Math.round(a * VAT_RATE);
    return { supply: a, vat: vat, total: a + vat };
  }

  function generalVat(salesTotal, purchaseTotal, credit) {
    var sales = Math.max(0, salesTotal || 0);
    var purchase = Math.max(0, purchaseTotal || 0);
    var salesTax = Math.round(sales / (1 + VAT_RATE) * VAT_RATE);
    var purchaseTax = Math.round(purchase / (1 + VAT_RATE) * VAT_RATE);
    var payable = salesTax - purchaseTax - Math.max(0, credit || 0);
    return {
      salesTax: salesTax,
      purchaseTax: purchaseTax,
      credit: Math.max(0, credit || 0),
      payable: payable
    };
  }

  function simpleVat(salesTotal, valueRate, credit) {
    var sales = Math.max(0, salesTotal || 0);
    var rate = SBC.clamp(valueRate || 0, 0, 100);
    var base = sales * rate / 100;
    var tax = Math.round(base * VAT_RATE);
    var payable = Math.max(0, tax - Math.max(0, credit || 0));
    return { base: base, tax: tax, credit: Math.max(0, credit || 0), payable: payable };
  }

  /* ---------- 3.3% 원천징수 ---------- */
  var RATE_INCOME = 0.03;
  var RATE_LOCAL = 0.003;

  function withholding(amount, mode) {
    var a = Math.max(0, amount || 0);
    var gross, income, local, net;
    if (mode === 'net') {
      net = a;
      gross = Math.round(a / (1 - RATE_INCOME - RATE_LOCAL));
      income = Math.round(gross * RATE_INCOME);
      local = Math.round(gross * RATE_LOCAL);
      net = gross - income - local;
    } else {
      gross = a;
      income = Math.round(gross * RATE_INCOME);
      local = Math.round(gross * RATE_LOCAL);
      net = gross - income - local;
    }
    return { gross: gross, income: income, local: local, tax: income + local, net: net };
  }

  var VALUE_RATES = {
    retail: { rate: 15, label: '소매업 · 음식점업 (15%)' },
    food: { rate: 15, label: '음식점업 · 숙박업 (15~20%)' },
    manufacture: { rate: 20, label: '제조업 · 농림어업 (20%)' },
    construction: { rate: 30, label: '건설업 · 사업서비스업 (30%)' },
    rent: { rate: 40, label: '부동산임대업 (40%)' },
    etc: { rate: 40, label: '기타 서비스업 (40%)' }
  };

  /* ---------------- DOM ---------------- */
  function init() {
    var page = document.getElementById('taxPage');
    if (!page) return;

    var $ = function (id) { return document.getElementById(id); };
    var vatSection = $('vatSection');
    var whSection = $('whSection');

    function checked(name) {
      var el = page.querySelector('input[name="' + name + '"]:checked');
      return el ? el.value : '';
    }

    function renderVat() {
      var base = checked('vatBase') || 'supply';
      var r = vatReverse(SBC.val($('vatAmount')), base);
      SBC.setText($('oSupply'), SBC.won(r.supply));
      SBC.setText($('oVat'), SBC.won(r.vat));
      SBC.setText($('oTotal'), SBC.won(r.total));
      SBC.setText($('oVatCaption'), base === 'total'
        ? '합계금액 ' + SBC.won(r.total) + ' ÷ 1.1 → 공급가액'
        : '공급가액 × 10% → 부가세');
    }

    function renderGeneral() {
      var r = generalVat(SBC.val($('generalSales')), SBC.val($('generalPurchase')), SBC.val($('generalCredit')));
      SBC.setText($('oSalesTax'), SBC.won(r.salesTax));
      SBC.setText($('oPurchaseTax'), r.purchaseTax > 0 ? '−' + SBC.won(r.purchaseTax) : '0원');
      SBC.setText($('oGeneralPayable'), r.payable < 0 ? SBC.won(r.payable) + ' (환급)' : SBC.won(r.payable),
        r.payable < 0 ? 'pos' : undefined);
      SBC.setText($('oGeneralPayableSub'), r.payable < 0 ? SBC.won(r.payable) + ' (환급)' : SBC.won(r.payable),
        r.payable < 0 ? 'pos' : undefined);
      SBC.setText($('oGeneralCaption'), r.payable < 0
        ? '매입세액이 더 많아 환급 대상으로 계산됩니다.'
        : '매출세액 − 매입세액' + (r.credit > 0 ? ' − 세액공제' : '') + ' 기준입니다.');
    }

    function renderSimple() {
      var select = $('simpleType');
      var rate = parseFloat(select.value) || 0;
      var r = simpleVat(SBC.val($('simpleSales')), rate, SBC.val($('simpleCredit')));
      SBC.setText($('oSimpleBase'), SBC.won(r.base));
      SBC.setText($('oSimpleTax'), SBC.won(r.tax));
      SBC.setText($('oSimplePayable'), SBC.won(r.payable));
      SBC.setText($('oSimpleCaption'), '공급대가 × 부가가치율 ' + rate + '% × 10% − 매입세액 공제');
    }

    function renderWh() {
      var mode = checked('whMode') || 'gross';
      var r = withholding(SBC.val($('whAmount')), mode);
      SBC.setText($('oWhGross'), SBC.won(r.gross));
      SBC.setText($('oWhIncome'), '−' + SBC.won(r.income));
      SBC.setText($('oWhLocal'), '−' + SBC.won(r.local));
      SBC.setText($('oWhTax'), SBC.won(r.tax));
      SBC.setText($('oWhNet'), SBC.won(r.net));
      SBC.setText($('oWhNetSub'), SBC.won(r.net));
      SBC.setText($('oWhCaption'), mode === 'net'
        ? '실수령액 ÷ 0.967 → 세전 계약금액'
        : '세전 계약금액 × 3.3% → 실수령액');
    }

    function renderMode() {
      var mode = checked('calcMode') || 'vat';
      var isVat = mode === 'vat';
      vatSection.classList.toggle('hidden', !isVat);
      whSection.classList.toggle('hidden', isVat);
      if (isVat) { renderVat(); renderGeneral(); renderSimple(); }
      else renderWh();
    }

    function renderAll() {
      renderMode();
    }

    page.querySelectorAll('input[name="calcMode"]').forEach(function (el) {
      el.addEventListener('change', renderMode);
    });
    $('simpleType').addEventListener('change', renderSimple);
    SBC.bindInputs(page, function () {
      renderVat();
      renderGeneral();
      renderSimple();
      renderWh();
    });

    renderAll();
  }

  var api = {
    vatReverse: vatReverse,
    generalVat: generalVat,
    simpleVat: simpleVat,
    withholding: withholding,
    VALUE_RATES: VALUE_RATES
  };
  global.TaxCalc = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  SBC.ready(init);
})(typeof window !== 'undefined' ? window : globalThis);
