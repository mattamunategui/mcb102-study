import { h, fill, put } from '../lib/render.js?v=f2a08e3cc5';
import * as store from '../lib/store.js?v=f2a08e3cc5';
import { mountEngine } from './practice.js?v=f2a08e3cc5';

export function render(ctx) {
  document.title = 'Missed · MCB 102';
  const items = store.missedItems(ctx.bundle);
  const root = h('div', { class: 'wrap engine' });
  ctx.root.append(root);
  if (!items.length) {
    put(root, h('div', { class: 'engine-head' }, h('a', { class: 'back', href: '#/' }, '← Home'), h('h1', null, 'Retry missed')),
      h('div', { class: 'empty card-box' }, h('p', null, 'Nothing to retry. Questions you get wrong in modules or exams will show up here until you answer them correctly.')));
    return;
  }
  ctx.onCleanup(mountEngine(root, { title: `Retry missed (${items.length})`, items, backHref: '#/', backLabel: 'Home' }));
}
