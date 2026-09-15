// Small DOM + formatting helpers shared across views.

export function h(tag, props, ...children) {
  const el = document.createElement(tag);
  props = props || {};
  for (const [key, val] of Object.entries(props)) {
    if (val == null || val === false) continue;
    if (key === 'className') el.className = val;
    else if (key === 'style' && typeof val === 'object') Object.assign(el.style, val);
    else if (key.startsWith('on') && typeof val === 'function') el.addEventListener(key.slice(2).toLowerCase(), val);
    else if (key === 'dataset' && typeof val === 'object') Object.assign(el.dataset, val);
    else if (key === 'html') el.innerHTML = val;
    else if (key in el) {
      try { el[key] = val; } catch { el.setAttribute(key, val); }
    } else {
      el.setAttribute(key, val);
    }
  }
  const flat = children.flat(Infinity).filter(c => c != null && c !== false);
  for (const child of flat) {
    el.appendChild(typeof child === 'string' || typeof child === 'number' ? document.createTextNode(String(child)) : child);
  }
  return el;
}

export function clear(el) {
  while (el.firstChild) el.removeChild(el.firstChild);
}

export function mount(parent, node) {
  clear(parent);
  parent.appendChild(node);
}

export function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
}

export function pad2(n) {
  return String(n).padStart(2, '0');
}

export function formatMMSS(totalSeconds) {
  const s = Math.max(0, Math.round(totalSeconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${pad2(m)}:${pad2(r)}`;
}

export function formatDateShort(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

export function todayISO() {
  return new Date().toISOString();
}

export function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n));
}

export function vibrate(pattern) {
  if (navigator.vibrate) {
    try { navigator.vibrate(pattern); } catch { /* ignore */ }
  }
}

export function prefersReducedMotion() {
  return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function on(el, event, selectorOrHandler, maybeHandler) {
  if (typeof selectorOrHandler === 'function') {
    el.addEventListener(event, selectorOrHandler);
    return;
  }
  el.addEventListener(event, e => {
    const target = e.target.closest(selectorOrHandler);
    if (target && el.contains(target)) maybeHandler(e, target);
  });
}
