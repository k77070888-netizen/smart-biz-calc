/* ==========================================================================
   건축·인테리어 자재 소요량 계산기
   - 평수 ↔ ㎡ 변환
   - 타일 / 페인트 / 도배지 소요량
   ========================================================================== */
(function (global) {
  'use strict';

  var SBC = global.SBC || (typeof require === 'function' ? require('./common.js') : {});
  var PYEONG = 3.305785;

  function pyToM2(p) { return (p || 0) * PYEONG; }
  function m2ToPy(m) { return (m || 0) / PYEONG; }

  /* ---------- 타일 ---------- */
  function tileNeed(input) {
    var area = Math.max(0, input.areaM2 || 0);
    var w = Math.max(1, input.tileW || 0) / 1000;
    var h = Math.max(1, input.tileH || 0) / 1000;
    var loss = SBC.clamp(input.lossPct === undefined ? 10 : input.lossPct, 0, 50);
    var perBox = Math.max(1, Math.round(input.perBox || 1));
    var tileM2 = w * h;
    var needArea = area * (1 + loss / 100);
    var tiles = area > 0 ? Math.ceil(needArea / tileM2) : 0;
    var boxes = tiles > 0 ? Math.ceil(tiles / perBox) : 0;
    var bought = boxes * perBox;
    return {
      areaM2: area,
      tileM2: tileM2,
      needArea: needArea,
      tiles: tiles,
      boxes: boxes,
      bought: bought,
      cover: bought * tileM2,
      spare: bought - tiles
    };
  }

  /* ---------- 페인트 ---------- */
  function paintNeed(input) {
    var area = Math.max(0, input.areaM2 || 0);
    var coats = SBC.clamp(Math.round(input.coats || 1), 1, 10);
    var coverage = Math.max(0.1, input.coverage || 8);
    var loss = SBC.clamp(input.lossPct === undefined ? 5 : input.lossPct, 0, 50);
    var liters = area * coats / coverage * (1 + loss / 100);
    return {
      areaM2: area,
      coats: coats,
      coverage: coverage,
      liters: liters,
      litersRounded: Math.ceil(liters * 10) / 10,
      cans4: Math.ceil(liters / 4),
      cans18: Math.ceil(liters / 18)
    };
  }

  /* ---------- 도배지 ---------- */
  function wallpaperNeed(input) {
    var wallArea = Math.max(0, input.wallArea || 0);
    var rollM2 = Math.max(0.1, input.rollM2 || 16.5);
    var loss = SBC.clamp(input.lossPct === undefined ? 10 : input.lossPct, 0, 50);
    var needArea = wallArea * (1 + loss / 100);
    var rolls = wallArea > 0 ? Math.ceil(needArea / rollM2) : 0;
    return {
      wallArea: wallArea,
      rollM2: rollM2,
      needArea: needArea,
      rolls: rolls
    };
  }

  /* ---------- DOM ---------- */
  function init() {
    var page = document.getElementById('materialPage');
    if (!page) return;

    var $ = function (id) { return document.getElementById(id); };

    function checked(name) {
      var el = page.querySelector('input[name="' + name + '"]:checked');
      return el ? el.value : '';
    }

    function areaFrom(inputId, unitName) {
      var v = SBC.val($(inputId));
      return checked(unitName) === 'py' ? pyToM2(v) : v;
    }

    /* 평 ↔ ㎡ */
    var lock = false;
    $('cvPyeong').addEventListener('input', function () {
      if (lock) return;
      lock = true;
      var v = SBC.val($('cvPyeong'));
      $('cvM2').value = v > 0 ? String(Math.round(pyToM2(v) * 10) / 10) : '';
      lock = false;
    });
    $('cvM2').addEventListener('input', function () {
      if (lock) return;
      lock = true;
      var v = SBC.val($('cvM2'));
      $('cvPyeong').value = v > 0 ? String(Math.round(m2ToPy(v) * 100) / 100) : '';
      lock = false;
    });

    /* 탭 */
    var sections = { tile: $('tileSection'), paint: $('paintSection'), paper: $('paperSection') };
    function renderTab() {
      var tab = checked('matTab') || 'tile';
      Object.keys(sections).forEach(function (k) {
        sections[k].classList.toggle('hidden', k !== tab);
      });
    }
    page.querySelectorAll('input[name="matTab"]').forEach(function (el) {
      el.addEventListener('change', renderTab);
    });

    /* 타일 */
    function renderTile() {
      var self = page.querySelector('input[name="tileSize"]:checked');
      var preset = self ? self.value : '300x300';
      var w = SBC.val($('tileW')) || 300;
      var h = SBC.val($('tileH')) || 300;
      if (preset !== 'custom') {
        var parts = preset.split('x');
        w = parseFloat(parts[0]);
        h = parseFloat(parts[1]);
      }
      $('tileSizeCustom').classList.toggle('hidden', preset !== 'custom');
      var loss = parseFloat($('tileLoss').value) || 0;
      $('tileLossVal').textContent = loss + '%';
      var area = areaFrom('tileArea', 'tileUnit');
      var r = tileNeed({ areaM2: area, tileW: w, tileH: h, lossPct: loss, perBox: SBC.val($('tilePerBox')) });

      SBC.setText($('oTileArea'), SBC.fmtFixed(area, 2) + '㎡');
      SBC.setText($('oTileTileM2'), SBC.fmtFixed(r.tileM2, 3) + '㎡ / 장');
      SBC.setText($('oTileNeedArea'), SBC.fmtFixed(r.needArea, 2) + '㎡');
      SBC.setText($('oTileCount'), SBC.fmtInt(r.tiles) + '장');
      SBC.setText($('oTileBoxes'), SBC.fmtInt(r.boxes) + '박스');
      SBC.setText($('oTileBought'), SBC.fmtInt(r.bought) + '장 (' + SBC.fmtFixed(r.cover, 2) + '㎡)');
      SBC.setText($('oTileSpare'), r.spare > 0 ? SBC.fmtInt(r.spare) + '장 여유' : '여유 없음');

      var price = SBC.val($('tileBoxPrice'));
      SBC.setText($('oTileCost'), price > 0 ? SBC.won(price * r.boxes) : '–');
    }

    /* 페인트 */
    function renderPaint() {
      var loss = parseFloat($('paintLoss').value) || 0;
      $('paintLossVal').textContent = loss + '%';
      var area = areaFrom('paintArea', 'paintUnit');
      var r = paintNeed({
        areaM2: area,
        coats: parseFloat($('paintCoats').value) || 2,
        coverage: SBC.val($('paintCoverage')) || 8,
        lossPct: loss
      });
      SBC.setText($('oPaintArea'), SBC.fmtFixed(area, 2) + '㎡');
      SBC.setText($('oPaintCoats'), r.coats + '회');
      SBC.setText($('oPaintLiters'), SBC.fmtFixed(r.litersRounded, 1) + 'L');
      SBC.setText($('oPaint4L'), SBC.fmtInt(r.cans4) + '통');
      SBC.setText($('oPaint18L'), SBC.fmtInt(r.cans18) + '통');

      var price = SBC.val($('paintPrice'));
      SBC.setText($('oPaintCost'), price > 0 ? SBC.won(price * r.litersRounded) : '–');
    }

    /* 도배 */
    function renderPaper() {
      var mode = checked('paperMode') || 'auto';
      $('paperAutoFields').classList.toggle('hidden', mode !== 'auto');
      $('paperManualFields').classList.toggle('hidden', mode !== 'manual');

      var factor = parseFloat($('paperFactor').value) || 0.9;
      $('paperFactorVal').textContent = factor.toFixed(2);
      var height = parseFloat($('paperHeight').value) || 2.4;
      var ceiling = $('paperCeiling').checked;

      var wall;
      if (mode === 'manual') {
        wall = SBC.val($('paperWall'));
      } else {
        var floorArea = areaFrom('paperArea', 'paperUnit');
        wall = floorArea * height * factor;
        if (ceiling) wall += floorArea;
      }

      var type = $('paperType').value;
      var rollM2 = type === 'silk' ? 16.5 : type === 'habji' ? 12.5 : (SBC.val($('paperRollM2')) || 16.5);
      $('paperRollCustom').classList.toggle('hidden', type !== 'custom');

      var loss = parseFloat($('paperLoss').value) || 0;
      $('paperLossVal').textContent = loss + '%';

      var r = wallpaperNeed({ wallArea: wall, rollM2: rollM2, lossPct: loss });
      SBC.setText($('oPaperWall'), SBC.fmtFixed(wall, 1) + '㎡');
      SBC.setText($('oPaperNeedArea'), SBC.fmtFixed(r.needArea, 1) + '㎡');
      SBC.setText($('oPaperRolls'), SBC.fmtInt(r.rolls) + '롤');
      SBC.setText($('oPaperRollM2'), SBC.fmtFixed(rollM2, 1) + '㎡ / 롤');

      var price = SBC.val($('paperPrice'));
      SBC.setText($('oPaperCost'), price > 0 ? SBC.won(price * r.rolls) : '–');
    }

    function renderAll() {
      renderTab();
      renderTile();
      renderPaint();
      renderPaper();
    }

    page.querySelectorAll('input[name="tileSize"]').forEach(function (el) {
      el.addEventListener('change', function () {
        var v = el.value;
        if (v !== 'custom') {
          var parts = v.split('x');
          $('tileW').value = parts[0];
          $('tileH').value = parts[1];
          var perBox = { '300x300': 13, '300x600': 8, '600x600': 4, '200x200': 25, '100x300': 30 };
          if (perBox[v]) $('tilePerBox').value = String(perBox[v]);
        }
        renderTile();
      });
    });
    $('paperType').addEventListener('change', renderPaper);
    SBC.bindInputs(page, function () {
      renderTile();
      renderPaint();
      renderPaper();
    });

    renderAll();
  }

  var api = {
    pyToM2: pyToM2,
    m2ToPy: m2ToPy,
    tileNeed: tileNeed,
    paintNeed: paintNeed,
    wallpaperNeed: wallpaperNeed,
    PYEONG: PYEONG
  };
  global.MaterialCalc = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  SBC.ready(init);
})(typeof window !== 'undefined' ? window : globalThis);
