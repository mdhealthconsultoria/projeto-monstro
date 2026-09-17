import { h, mount, uid, todayISO } from '../utils.js';
import { icon } from '../icons.js';
import { addPhoto, getPhotosForUser, deletePhoto } from '../db.js';
import { confirmDialog, toast } from '../ui.js';
import { store } from '../store.js';
import { uploadPhotoCloud, deletePhotoCloud, downloadPhotoCloud } from '../services/photosCloud.js';

const PHOTO_DAYS = [1, 10, 20, 30];
const CATEGORIES = [
  { key: 'frente', label: 'Frente' },
  { key: 'costas', label: 'Costas' },
  { key: 'lateral', label: 'Lateral' },
];

export function renderFotos(viewEl, params, nav) {
  let photos = [];
  let activeDay = PHOTO_DAYS[0];
  const objectUrls = [];
  let didCheckCloud = false;

  function revokeUrls() {
    objectUrls.forEach(u => URL.revokeObjectURL(u));
    objectUrls.length = 0;
  }

  function photoFor(day, category) {
    const matches = photos.filter(p => p.day === day && p.category === category);
    return matches.sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] || null;
  }

  // Só busca "restaurar da nuvem" uma vez por visita à tela — chamar de novo
  // a cada loadAndDraw() (ex: depois de salvar uma foto) dispararia dezenas
  // de requisições paralelas sem necessidade (o que acabou de ser salvo já
  // está local, e o resto da nuvem não mudou só porque salvamos uma foto).
  async function loadAndDraw() {
    photos = await getPhotosForUser(store.userId);
    draw();
    if (!didCheckCloud) {
      didCheckCloud = true;
      fillMissingFromCloud();
    }
  }

  // Melhor esforço, silencioso: para cada dia/categoria sem foto local (ex:
  // aparelho novo), tenta baixar da nuvem e cachear localmente. Se o bucket
  // ainda não existir (migration não rodada) ou não houver nada lá, não faz
  // nada — não é um erro visível pro usuário.
  async function fillMissingFromCloud() {
    if (!store.userId) return;
    const missing = [];
    for (const day of PHOTO_DAYS) {
      for (const cat of CATEGORIES) {
        if (!photoFor(day, cat.key)) missing.push({ day, category: cat.key });
      }
    }
    if (!missing.length) return;

    const results = await Promise.all(missing.map(async m => {
      const blob = await downloadPhotoCloud(store.userId, m.day, m.category);
      return blob ? { ...m, blob } : null;
    }));

    let changed = false;
    for (const found of results.filter(Boolean)) {
      const id = uid();
      const rec = { id, userId: store.userId, day: found.day, category: found.category, blob: found.blob, createdAt: todayISO() };
      await addPhoto(rec);
      photos.push(rec);
      changed = true;
    }
    if (changed) draw();
  }

  function slot(day, category) {
    const photo = photoFor(day, category);
    if (photo) {
      const url = URL.createObjectURL(photo.blob);
      objectUrls.push(url);
      return h('div', { className: 'photo-slot' },
        h('img', { src: url, alt: `${category} dia ${day}` }),
        h('button', {
          className: 'remove-photo', 'aria-label': 'Remover foto',
          onClick: async () => {
            const ok = await confirmDialog({ title: 'Remover foto', message: 'Apagar esta foto permanentemente?', confirmLabel: 'Apagar', danger: true });
            if (!ok) return;
            await deletePhoto(photo.id);
            deletePhotoCloud(store.userId, day, category);
            toast('Foto removida', { iconName: 'trash' });
            loadAndDraw();
          },
        }, icon('trash', { size: 16 }))
      );
    }
    const input = h('input', {
      type: 'file', accept: 'image/*', capture: 'environment', style: { display: 'none' },
      onChange: async e => {
        const file = e.target.files[0];
        if (!file) return;
        const existing = photoFor(day, category);
        if (existing) await deletePhoto(existing.id);
        await addPhoto({ id: uid(), userId: store.userId, day, category, blob: file, createdAt: todayISO() });
        toast('Foto salva', { iconName: 'check' });
        loadAndDraw();
        uploadPhotoCloud(store.userId, day, category, file);
      },
    });
    return h('label', { className: 'photo-slot' },
      icon('camera', { size: 22 }),
      h('span', {}, CATEGORIES.find(c => c.key === category).label),
      input
    );
  }

  function comparisonBlock() {
    const day1Has = PHOTO_DAYS.map(d => photos.some(p => p.day === d));
    if (!day1Has[0] || !day1Has[3]) {
      return h('div', { className: 'empty-state' }, 'Registre fotos do Dia 1 e do Dia 30 para ver a comparação lado a lado.');
    }
    const rows = CATEGORIES.map(cat => {
      const p1 = photoFor(1, cat.key);
      const p30 = photoFor(30, cat.key);
      if (!p1 || !p30) return null;
      const u1 = URL.createObjectURL(p1.blob); objectUrls.push(u1);
      const u30 = URL.createObjectURL(p30.blob); objectUrls.push(u30);
      return h('div', { className: 'stack' },
        h('div', { className: 'section-title' }, cat.label),
        h('div', { className: 'compare-grid' },
          h('figure', {}, h('img', { src: u1 }), h('figcaption', {}, 'Dia 1')),
          h('figure', {}, h('img', { src: u30 }), h('figcaption', {}, 'Dia 30'))
        )
      );
    }).filter(Boolean);
    return rows.length ? h('div', { className: 'stack' }, rows) : h('div', { className: 'empty-state' }, 'Adicione fotos nas mesmas categorias no Dia 1 e no Dia 30 para comparar.');
  }

  function draw() {
    revokeUrls();
    const tabs = h('div', { className: 'photo-day-tabs' },
      PHOTO_DAYS.map(d => h('button', {
        className: `photo-day-tab ${d === activeDay ? 'active' : ''}`,
        onClick: () => { activeDay = d; draw(); },
      }, `Dia ${d}`))
    );

    const grid = h('div', { className: 'photo-cat-grid' }, CATEGORIES.map(c => slot(activeDay, c.key)));

    mount(viewEl, h('div', { className: 'stack fade-up' },
      h('h1', {}, 'Evolução física'),
      h('p', { className: 'text-dim' }, 'Fotos ficam salvas neste aparelho e, quando disponível, são enviadas de forma privada para a nuvem — só você tem acesso, e elas voltam a aparecer se você trocar de aparelho.'),
      h('div', { className: 'card stack' },
        h('div', { className: 'section-title' }, 'REGISTRAR FOTOS'),
        tabs,
        grid
      ),
      h('div', { className: 'card stack' },
        h('div', { className: 'section-title' }, 'COMPARAÇÃO — DIA 1 vs. DIA 30'),
        comparisonBlock()
      )
    ));
  }

  loadAndDraw();
  return () => revokeUrls();
}
