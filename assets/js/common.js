/* ==========================================================================
   공통 유틸 — 숫자 파싱, 콤마 포맷, 입력 바인딩
   브라우저(window.SBC)와 Node 테스트(require) 양쪽에서 쓸 수 있게 구성
   ========================================================================== */
(function (global) {
  'use strict';

  var SBC = {};

  /** 숫자 → 정수 콤마 문자열 */
  SBC.fmtInt = function (n) {
    if (typeof n !== 'number' || !isFinite(n)) return '–';
    return Math.round(n).toLocaleString('ko-KR');
  };

  /** 숫자 → "1,234원" */
  SBC.won = function (n) {
    if (typeof n !== 'number' || !isFinite(n)) return '–';
    return SBC.fmtInt(n) + '원';
  };

  /** 숫자 → 소수 d자리 문자열 (콤마 포함) */
  SBC.fmtFixed = function (n, d) {
    if (typeof n !== 'number' || !isFinite(n)) return '–';
    return n.toLocaleString('ko-KR', { minimumFractionDigits: d, maximumFractionDigits: d });
  };

  /** 퍼센트 표시 */
  SBC.fmtPct = function (n, d) {
    if (typeof n !== 'number' || !isFinite(n)) return '–';
    return SBC.fmtFixed(n, d === undefined ? 1 : d) + '%';
  };

  /** 문자열에서 숫자만 뽑아 파싱 (콤마·원·공백 허용) */
  SBC.parse = function (value) {
    if (typeof value === 'number') return isFinite(value) ? value : 0;
    if (value === null || value === undefined) return 0;
    var cleaned = String(value).replace(/[^0-9.\-]/g, '');
    var n = parseFloat(cleaned);
    return isFinite(n) ? n : 0;
  };

  /** 엘리먼트 값 파싱 */
  SBC.val = function (el) {
    return el ? SBC.parse(el.value) : 0;
  };

  /** 0으로 나누기 방어 */
  SBC.safeDiv = function (a, b) {
    if (!b || !isFinite(b)) return NaN;
    var r = a / b;
    return isFinite(r) ? r : NaN;
  };

  SBC.clamp = function (n, lo, hi) {
    return Math.min(hi, Math.max(lo, n));
  };

  /** 단조 증가 함수의 영점을 이분법으로 찾기 */
  SBC.solve = function (fn, lo, hi, tol) {
    lo = lo === undefined ? 0 : lo;
    hi = hi === undefined ? 1e9 : hi;
    tol = tol || 0.5;
    var fLo = fn(lo), fHi = fn(hi);
    if (!isFinite(fLo) || !isFinite(fHi)) return NaN;
    if (fLo >= 0) return lo;
    if (fHi < 0) return NaN;
    for (var i = 0; i < 80; i++) {
      var mid = (lo + hi) / 2;
      var fMid = fn(mid);
      if (!isFinite(fMid)) return NaN;
      if (Math.abs(fMid) < tol || hi - lo < tol) return mid;
      if (fMid < 0) lo = mid; else hi = mid;
    }
    return (lo + hi) / 2;
  };

  /* ---------- 입력 콤마 포맷 (커서 위치 유지) ---------- */
  function formatComma(el) {
    var raw = el.value;
    var caret = typeof el.selectionStart === 'number' ? el.selectionStart : raw.length;
    var digitsBefore = raw.slice(0, caret).replace(/[^0-9]/g, '').length;
    var digits = raw.replace(/[^0-9]/g, '');
    if (digits.length > 1) digits = digits.replace(/^0+/, '');
    if (digits.length > 15) digits = digits.slice(0, 15);
    el.value = digits ? Number(digits).toLocaleString('en-US') : '';

    if (document.activeElement === el) {
      var pos = 0, seen = 0;
      if (digitsBefore === 0) {
        pos = 0;
      } else {
        for (var i = 0; i < el.value.length; i++) {
          if (/[0-9]/.test(el.value[i])) seen++;
          if (seen === digitsBefore) { pos = i + 1; break; }
          pos = el.value.length;
        }
      }
      try { el.setSelectionRange(pos, pos); } catch (e) { /* noop */ }
    }
  }

  /** root 안의 .comma 입력들에 콤마 포맷을 붙이고, 입력 시 콜백 호출 */
  SBC.bindInputs = function (root, callback) {
    if (!root) return;
    var inputs = root.querySelectorAll('input.comma');
    Array.prototype.forEach.call(inputs, function (el) {
      el.addEventListener('input', function () {
        formatComma(el);
        if (callback) callback();
      });
      el.addEventListener('blur', function () {
        formatComma(el);
        if (callback) callback();
      });
    });
    var others = root.querySelectorAll('input:not(.comma), select');
    Array.prototype.forEach.call(others, function (el) {
      var evt = el.tagName === 'SELECT' ? 'change' : 'input';
      if (el.type === 'range') evt = 'input';
      el.addEventListener(evt, function () { if (callback) callback(); });
      if (el.type !== 'range' && el.tagName !== 'SELECT') {
        el.addEventListener('change', function () { if (callback) callback(); });
      }
    });
  };

  /** 결과 숫자 칸에 값/색상 적용 */
  SBC.setText = function (el, text, tone) {
    if (!el) return;
    el.textContent = text;
    if (tone !== undefined) {
      el.classList.remove('pos', 'neg');
      if (tone === 'pos') el.classList.add('pos');
      if (tone === 'neg') el.classList.add('neg');
    }
  };

  SBC.ready = function (fn) {
    if (typeof document === 'undefined') return;
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
    else fn();
  };

  global.SBC = SBC;
  if (typeof module !== 'undefined' && module.exports) module.exports = SBC;
})(typeof window !== 'undefined' ? window : globalThis);
