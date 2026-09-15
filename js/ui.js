import { h } from './utils.js';
import { icon } from './icons.js';

const modalRoot = document.getElementById('modal-root');
const toastLayer = document.getElementById('toast-layer');

export function openModal(contentNode, { title, onClose } = {}) {
  const backdrop = h('div', { className: 'modal-backdrop' });
  const sheet = h('div', { className: 'modal-sheet' },
    h('div', { className: 'modal-handle' }),
    title ? h('h2', { className: 'modal-title' }, title) : null,
    contentNode
  );
  backdrop.appendChild(sheet);
  backdrop.addEventListener('click', e => { if (e.target === backdrop) close(); });

  function close() {
    if (backdrop.parentNode) backdrop.parentNode.removeChild(backdrop);
    document.removeEventListener('keydown', onKey);
    if (onClose) onClose();
  }
  function onKey(e) { if (e.key === 'Escape') close(); }
  document.addEventListener('keydown', onKey);

  modalRoot.appendChild(backdrop);
  return close;
}

export function confirmDialog({ title = 'Confirmar', message, confirmLabel = 'Confirmar', danger = false }) {
  return new Promise(resolve => {
    const content = h('div', { className: 'stack' },
      h('p', { className: 'text-dim' }, message),
      h('div', { className: 'row', style: { marginTop: '8px' } },
        h('button', { className: 'btn btn-outline grow', onClick: () => { resolve(false); close(); } }, 'Cancelar'),
        h('button', { className: `btn grow ${danger ? 'btn-danger' : 'btn-primary'}`, onClick: () => { resolve(true); close(); } }, confirmLabel)
      )
    );
    const close = openModal(content, { title, onClose: () => resolve(false) });
  });
}

let toastTimer = null;
export function toast(text, { iconName = 'trophy', variant = 'pr' } = {}) {
  const el = h('div', { className: 'toast-pr row' }, icon(iconName, { size: 20 }), h('span', {}, text));
  toastLayer.appendChild(el);
  setTimeout(() => { if (el.parentNode) el.parentNode.removeChild(el); }, 2900);
}

export function queueToasts(items) {
  items.forEach((item, i) => {
    setTimeout(() => toast(item.text, { iconName: item.icon }), i * 900);
  });
}
