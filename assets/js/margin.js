/* ==========================================================================
   셀러 마진·수수료 계산기
   - 판매가(VAT 포함) → 정산액·순이익·마진율·ROI·손익분기 판매가
   - 과세/간이/면세 판매자의 부가세 차이를 반영
   ========================================================================== */
(function (global) {
  'use strict';

  var SBC = global.SBC || (typeof require === 'function' ? require('./common.js') : {});

  var VAT_RATE = 0.1;

  /** 모델 파라미터 정규화 */
  function normalize(input) {
    return {
      price: Math.max(0, input.price || 0),
      cost: Math.max(0, input.cost || 0),
      feeRate: SBC.clamp(input.feeRate || 0, 0, 100),
      shipMode: input.shipMode === 'free' ? 'free' : 'customer',
      shipCost: Math.max(0, input.shipCost || 0),
      pack: Math.max(0, input.pack || 0),
      ad: Math.max(0, input.ad || 0),
      taxType: input.taxType === 'simple' ? 'simple' : input.taxType === 'exempt' ? 'exempt' : 'taxed',
      valueRate: SBC.clamp(input.valueRate === undefined ? 15 : input.valueRate, 0, 100),
      targetMargin: SBC.clamp(input.targetMargin || 0, 0, 99)
    };
  }

  /** 판매가 P일 때의 손익 계산 */
  function profitAt(m, P) {
    var taxed = m.taxType === 'taxed';
    var div = taxed ? 1 + VAT_RATE : 1;
    var salesNet = P / div;
    var costNet = m.cost / div;
    var feeNet = (P * m.feeRate / 100) / div;
    var shipNet = (m.shipMode === 'free' ? m.shipCost : 0) / div;
    var packNet = m.pack / div;
    var adNet = m.ad / div;
    var simpleVat = m.taxType === 'simple' ? P * (m.valueRate / 100) * VAT_RATE : 0;

    return salesNet - costNet - feeNet - shipNet - packNet - adNet - simpleVat;
  }

  function compute(rawInput) {
    var m = normalize(rawInput);
    var taxed = m.taxType === 'taxed';
    var div = taxed ? 1 + VAT_RATE : 1;

    var feeGross = m.price * m.feeRate / 100;
    var feeNet = feeGross / div;
    var shipPaid = m.shipMode === 'free' ? m.shipCost : 0;
    var settlement = m.price - feeGross - shipPaid;

    var salesNet = m.price / div;
    var costNet = m.cost / div;
    var shipNet = shipPaid / div;
    var packNet = m.pack / div;
    var adNet = m.ad / div;
    var simpleVat = m.taxType === 'simple' ? m.price * (m.valueRate / 100) * VAT_RATE : 0;
    var profit = profitAt(m, m.price);

    var invest = costNet + shipNet + packNet + adNet;
    var marginRate = salesNet > 0 ? profit / salesNet * 100 : NaN;
    var roi = invest > 0 ? profit / invest * 100 : NaN;

    var bepPrice = NaN;
    if (profitAt(m, 0) < 0) {
      bepPrice = SBC.solve(function (p) { return profitAt(m, p); }, 0, Math.max(1e7, m.price * 100));
    }

    var targetPrice = NaN;
    if (m.targetMargin > 0) {
      targetPrice = SBC.solve(function (p) {
        var sales = p / div;
        if (sales <= 0) return -m.targetMargin / 100;
        return profitAt(m, p) / sales - m.targetMargin / 100;
      }, 0, Math.max(1e7, m.price * 100), 0.0005);
    }

    return {
      price: m.price,
      feeRate: m.feeRate,
      feeGross: feeGross,
      feeNet: feeNet,
      vatOut: taxed ? m.price - salesNet : 0,
      shipPaid: shipPaid,
      shipNet: shipNet,
      settlement: settlement,
      salesNet: salesNet,
      costNet: costNet,
      packNet: packNet,
      adNet: adNet,
      simpleVat: simpleVat,
      profit: profit,
      invest: invest,
      marginRate: marginRate,
      roi: roi,
      bepPrice: bepPrice,
      targetMargin: m.targetMargin,
      targetPrice: targetPrice,
      taxType: m.taxType,
      shipMode: m.shipMode
    };
  }

  var MARKETS = {
    smartstore: { rate: 3.63, label: '네이버 스마트스토어' },
    coupang: { rate: 10.8, label: '쿠팡' },
    eleven: { rate: 9.0, label: '11번가' },
    gmarket: { rate: 8.0, label: 'G마켓' },
    custom: { rate: null, label: '직접 입력' }
  };

  /* ---------------- DOM ---------------- */
  function init() {
    var form = document.getElementById('marginForm');
    if (!form) return;

    var $ = function (id) { return document.getElementById(id); };
    var out = {
      settlement: $('outSettlement'),
      profit: $('outProfit'),
      margin: $('outMargin'),
      roi: $('outRoi'),
      bep: $('outBep'),
      target: $('outTargetPrice'),
      caption: $('outCaption'),
      bdPrice: $('bdPrice'),
      bdFee: $('bdFee'),
      bdShip: $('bdShip'),
      bdCost: $('bdCost'),
      bdPack: $('bdPack'),
      bdAd: $('bdAd'),
      bdVat: $('bdVat'),
      bdVatRow: $('bdVatRow'),
      bdProfit: $('bdProfit'),
      feeNote: $('feeNote'),
      simpleRow: $('simpleRow'),
      shipLabel: $('shipCostLabel')
    };

    function checked(name) {
      var el = form.querySelector('input[name="' + name + '"]:checked');
      return el ? el.value : '';
    }

    function read() {
      return {
        price: SBC.val($('price')),
        cost: SBC.val($('cost')),
        feeRate: SBC.val($('feeRate')),
        shipMode: checked('shipMode'),
        shipCost: SBC.val($('shipCost')),
        pack: SBC.val($('pack')),
        ad: SBC.val($('ad')),
        taxType: checked('taxType'),
        valueRate: parseFloat($('valueRate').value) || 0,
        targetMargin: SBC.val($('targetMargin'))
      };
    }

    function render() {
      var input = read();
      var r = compute(input);

      SBC.setText(out.settlement, SBC.won(r.settlement));
      SBC.setText(out.profit, SBC.won(r.profit), r.profit < 0 ? 'neg' : r.profit > 0 ? 'pos' : undefined);
      SBC.setText(out.margin, isFinite(r.marginRate) ? SBC.fmtPct(r.marginRate) : '–',
        r.marginRate < 0 ? 'neg' : undefined);
      SBC.setText(out.roi, isFinite(r.roi) ? SBC.fmtPct(r.roi) : '–', r.roi < 0 ? 'neg' : undefined);
      SBC.setText(out.bep, isFinite(r.bepPrice) && r.bepPrice > 0 ? SBC.won(r.bepPrice) : '–');

      var targetOk = isFinite(r.targetPrice) && r.targetPrice > 0;
      SBC.setText(out.target, targetOk ? SBC.won(r.targetPrice) : '달성 어려움');
      if ($('outTargetMarginLabel')) {
        $('outTargetMarginLabel').textContent = SBC.fmtInt(input.targetMargin) + '%';
      }
      if ($('outTargetNote')) {
        $('outTargetNote').classList.toggle('hidden', input.targetMargin <= 0);
      }

      var captions = [];
      if (r.taxType === 'taxed') captions.push('부가세 제외 실질 손익 기준');
      if (r.taxType === 'simple') captions.push('간이과세 부가가치율 ' + (input.valueRate || 0) + '% 반영');
      if (r.taxType === 'exempt') captions.push('면세 사업자 기준');
      if (r.shipMode === 'customer') captions.push('배송비는 고객 부담(상계)');
      if (out.caption) out.caption.textContent = captions.join(' · ');

      SBC.setText(out.bdPrice, SBC.won(r.price));
      SBC.setText($('bdVatOut'), '−' + SBC.won(r.vatOut));
      SBC.setText($('bdSalesNet'), SBC.won(r.salesNet));
      SBC.setText(out.bdFee, '−' + SBC.won(r.feeNet));
      SBC.setText(out.bdShip, r.shipNet > 0 ? '−' + SBC.won(r.shipNet) : '0원');
      SBC.setText(out.bdCost, r.costNet > 0 ? '−' + SBC.won(r.costNet) : '0원');
      SBC.setText(out.bdPack, r.packNet > 0 ? '−' + SBC.won(r.packNet) : '0원');
      SBC.setText(out.bdAd, r.adNet > 0 ? '−' + SBC.won(r.adNet) : '0원');
      if ($('bdVatOutRow')) $('bdVatOutRow').classList.toggle('hidden', r.taxType !== 'taxed');
      if ($('outSettleNote')) {
        $('outSettleNote').textContent = '마켓이 입금하는 금액(부가세 포함)은 ' + SBC.won(r.settlement) + '입니다.';
      }

      if (r.taxType === 'simple') {
        out.bdVatRow.classList.remove('hidden');
        SBC.setText(out.bdVat, '−' + SBC.won(r.simpleVat));
      } else {
        out.bdVatRow.classList.add('hidden');
      }
      SBC.setText(out.bdProfit, SBC.won(r.profit), r.profit < 0 ? 'neg' : undefined);

      if (out.shipLabel) {
        out.shipLabel.textContent = r.shipMode === 'free' ? '실택배비 (판매자 부담)' : '실택배비 (고객에게 받는 금액)';
      }
      if (out.simpleRow) out.simpleRow.classList.toggle('hidden', r.taxType !== 'simple');

      if (out.feeNote) {
        var market = form.querySelector('input[name="market"]:checked');
        var key = market ? market.value : 'custom';
        var name = MARKETS[key] ? MARKETS[key].label : '직접 입력';
        out.feeNote.textContent = name + ' 기준 ' + SBC.fmtFixed(r.feeRate, 2) + '%가 적용되었습니다. 실제 수수료는 카테고리·계약 조건에 따라 다릅니다.';
      }
    }

    form.querySelectorAll('input[name="market"]').forEach(function (radio) {
      radio.addEventListener('change', function () {
        var preset = MARKETS[radio.value];
        if (preset && preset.rate !== null) {
          $('feeRate').value = String(preset.rate).replace('.', '.');
        }
        render();
      });
    });

    $('feeRate').addEventListener('input', function () {
      var custom = form.querySelector('input[name="market"][value="custom"]');
      if (custom) custom.checked = true;
    });

    SBC.bindInputs(form, render);
    render();
  }

  var api = { compute: compute, profitAt: profitAt, normalize: normalize, MARKETS: MARKETS };
  global.MarginCalc = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  SBC.ready(init);
})(typeof window !== 'undefined' ? window : globalThis);
