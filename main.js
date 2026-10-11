(function () {
  'use strict';
  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };

  /* ---------- Данные калькулятора ---------- */
  var D = JSON.parse($('#calc-data').textContent);
  var T = D.i18n;
  var byId = {};
  D.types.forEach(function (t) { byId[t.id] = t; });
  var fmt = function (n) { return Math.round(n).toLocaleString('ru-RU').replace(/ /g, ' '); };
  var RO = document.documentElement.lang === 'ro';
  var plural = RO
    ? function (n, f) { var b = n % 100; return f[n === 1 ? 0 : (n === 0 || (b >= 1 && b <= 19)) ? 1 : 2]; }
    : function (n, f) { var a = n % 10, b = n % 100; return f[(a === 1 && b !== 11) ? 0 : (a >= 2 && a <= 4 && (b < 10 || b >= 20)) ? 1 : 2]; };
  var tpl = function (s, o) { return s.replace(/\{(\w+)\}/g, function (m, k) { return o[k] != null ? o[k] : ''; }); };
  var fromPrice = function (t) { return t.perM2 * t.minArea; };

  // цены «от» в карточках
  $$('[data-from]').forEach(function (el) { var t = byId[el.getAttribute('data-from')]; if (t) el.textContent = fmt(Math.round(fromPrice(t) / 10) * 10); });
  $('[data-calc-motor-price]').textContent = '+' + fmt(D.motorPrice) + ' ' + D.currency + ' / ' + T.windows[0];

  /* ---------- Калькулятор ---------- */
  var tabs = $('[data-calc-tabs]');
  var inW = $('[data-calc-w]'), inH = $('[data-calc-h]');
  var outQty = $('[data-calc-qty]'), motor = $('[data-calc-motor]'), motorWrap = $('[data-calc-motor-wrap]');
  var outTotal = $('[data-calc-total]'), outNote = $('[data-calc-note]'), outHint = $('[data-calc-hint]');
  var wa = $('[data-calc-wa]');
  var hintDefault = outHint.textContent;
  var state = { type: D.types[0].id, qty: 1 };

  D.types.forEach(function (t, i) {
    var b = document.createElement('button');
    b.type = 'button'; b.className = 'calc__tab'; b.textContent = t.name;
    b.setAttribute('role', 'tab'); b.setAttribute('data-type', t.id);
    b.setAttribute('aria-selected', i === 0 ? 'true' : 'false');
    b.addEventListener('click', function () { setType(t.id); });
    tabs.appendChild(b);
  });

  function num(el, min, max) {
    var v = parseFloat(String(el.value).replace(',', '.'));
    if (isNaN(v)) return null;
    return Math.min(max, Math.max(min, v));
  }

  function calc() {
    var t = byId[state.type];
    var w = num(inW, .3, 6), h = num(inH, .3, 4);
    motorWrap.classList.toggle('is-off', !t.motor);
    if (!t.motor) motor.checked = false;
    if (w == null || h == null) { outTotal.textContent = '—'; outNote.textContent = ''; return null; }
    var area = w * h;
    var one = Math.max(area, t.minArea) * t.perM2;
    var withMotor = motor.checked && t.motor;
    if (withMotor) one += D.motorPrice;
    var sum = one * state.qty;
    var disc = state.qty >= D.discountFrom ? D.discount : 0;
    var total = Math.round(sum * (1 - disc / 100) / 10) * 10;
    outTotal.textContent = fmt(total) + ' ' + D.currency;
    outNote.textContent = disc ? tpl(T.discountNote, { d: disc, n: D.discountFrom }) : tpl(T.addMore, { d: D.discount, n: D.discountFrom });
    outHint.textContent = area < t.minArea ? hintDefault + ' ' + tpl(T.minAreaNote, { a: String(t.minArea).replace('.', ',') }) + '.' : hintDefault;
    var text = tpl(T.waText, {
      type: t.name, w: String(w).replace('.', ','), h: String(h).replace('.', ','),
      qty: state.qty, win: plural(state.qty, T.windows), motor: withMotor ? T.motorText : '',
      total: fmt(total), cur: D.currency
    });
    wa.href = 'https://wa.me/' + D.phone + '?text=' + encodeURIComponent(text);
    return text;
  }

  function setType(id) {
    if (!byId[id]) return;
    state.type = id;
    $$('.calc__tab', tabs).forEach(function (b) {
      var on = b.getAttribute('data-type') === id;
      b.setAttribute('aria-selected', on ? 'true' : 'false');
      if (on && b.scrollIntoView && tabs.scrollWidth > tabs.clientWidth) tabs.scrollLeft = b.offsetLeft - tabs.clientWidth / 2 + b.offsetWidth / 2;
    });
    calc();
  }

  inW.addEventListener('input', calc); inH.addEventListener('input', calc); motor.addEventListener('change', calc);
  $('[data-calc-inc]').addEventListener('click', function () { state.qty = Math.min(50, state.qty + 1); outQty.textContent = state.qty; calc(); });
  $('[data-calc-dec]').addEventListener('click', function () { state.qty = Math.max(1, state.qty - 1); outQty.textContent = state.qty; calc(); });

  // «+» на карточках и «Посчитать …» в подсказках по комнатам
  var calcBox = $('#calc');
  $$('[data-pick]').forEach(function (b) {
    b.addEventListener('click', function () {
      setType(b.getAttribute('data-pick'));
      calcBox.scrollIntoView({ behavior: 'smooth', block: 'center' });
      calcBox.classList.remove('is-flash'); void calcBox.offsetWidth; calcBox.classList.add('is-flash');
    });
  });

  // Viber не принимает текст в ссылке — копируем расчёт и открываем чат
  var toast = $('#toast'), toastT;
  function say(msg) { toast.textContent = msg; toast.classList.add('is-on'); clearTimeout(toastT); toastT = setTimeout(function () { toast.classList.remove('is-on'); }, 3200); }
  $('[data-calc-copy]').addEventListener('click', function () {
    var text = calc();
    if (!text) return;
    var done = function () { say(T.copied); setTimeout(function () { location.href = 'viber://chat?number=%2B' + D.phone; }, 600); };
    if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(text).then(done, function () { say(T.copyFail); });
    else {
      var ta = document.createElement('textarea'); ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy') ? done() : say(T.copyFail); } catch (e) { say(T.copyFail); }
      document.body.removeChild(ta);
    }
  });
  calc();

  /* ---------- Вкладки «Какой вид выбрать» ---------- */
  var roomTabs = $$('.rooms__tab');
  function openRoom(tab, focus) {
    roomTabs.forEach(function (t) {
      var on = t === tab;
      t.setAttribute('aria-selected', on ? 'true' : 'false');
      t.tabIndex = on ? 0 : -1;
      $('#' + t.getAttribute('aria-controls')).hidden = !on;
    });
    if (focus) tab.focus();
    var box = tab.parentNode;
    if (box.scrollWidth > box.clientWidth) box.scrollLeft = tab.offsetLeft - box.clientWidth / 2 + tab.offsetWidth / 2;
  }
  roomTabs.forEach(function (t, i) {
    t.addEventListener('click', function () { openRoom(t); });
    t.addEventListener('keydown', function (e) {
      var k = e.key, n = null;
      if (k === 'ArrowDown' || k === 'ArrowRight') n = roomTabs[(i + 1) % roomTabs.length];
      if (k === 'ArrowUp' || k === 'ArrowLeft') n = roomTabs[(i - 1 + roomTabs.length) % roomTabs.length];
      if (n) { e.preventDefault(); openRoom(n, true); }
    });
  });

  /* ---------- Липкая шапка ---------- */
  var bar = $('#bar'), hero = $('.hero__panel');
  var onScroll = function () { bar.classList.toggle('is-on', hero.getBoundingClientRect().bottom < 0); };
  window.addEventListener('scroll', onScroll, { passive: true }); onScroll();

  /* ---------- Мобильное меню ---------- */
  var drawer = $('#drawer'), opener = $('[data-menu-open]');
  opener.addEventListener('click', function () { drawer.hidden = false; document.body.style.overflow = 'hidden'; opener.setAttribute('aria-expanded', 'true'); $('.drawer__close').focus(); });
  $$('[data-menu-close]').forEach(function (el) { el.addEventListener('click', function () { drawer.hidden = true; document.body.style.overflow = ''; opener.setAttribute('aria-expanded', 'false'); }); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !drawer.hidden) $('.drawer__close').click(); });

  /* ---------- FAQ: открыт один вопрос ---------- */
  var qas = $$('.qa');
  qas.forEach(function (d) { d.addEventListener('toggle', function () { if (d.open) qas.forEach(function (o) { if (o !== d) o.open = false; }); }); });

  /* ---------- Появление при прокрутке ---------- */
  if ('IntersectionObserver' in window) {
    var els = $$('.type, .rooms__tab, .compare, .offer, .biz, .work, .steps li, .perk, .review, .qa, .cta, .process__photo, .calc');
    els.forEach(function (el) { el.classList.add('reveal'); });
    var io = new IntersectionObserver(function (en) { en.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); } }); }, { rootMargin: '0px 0px -8% 0px' });
    els.forEach(function (el) { io.observe(el); });
  }
})();
