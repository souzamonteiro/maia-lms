// Local SVG icons; labels remain translated by the caller.
const paths = {
  heading: 'M5 4v16M19 4v16M5 12h14',
  bold: 'M6 4h7a4 4 0 0 1 0 8H6m7 0a4 4 0 0 1 0 8H6V4',
  italic: 'M10 4h10M4 20h10M15 4 9 20',
  list: 'M9 6h12M9 12h12M9 18h12M3 6h1M3 12h1M3 18h1',
  numberedList: 'M10 6h11M10 12h11M10 18h11M3 3h1v5M3 8h2M2 13q4-3 4 0l-4 5h4',
  quote: 'M4 6h6v7H4V6m0 7q0 5 6 5M14 6h6v7h-6V6m0 7q0 5 6 5',
  code: 'm8 6-6 6 6 6m8-12 6 6-6 6M14 3l-4 18',
  link: 'm10 13 4-4M8 16l-2 2a4 4 0 0 1-5-5l5-5a4 4 0 0 1 5 0m2 0 2-2a4 4 0 0 1 5 5l-5 5a4 4 0 0 1-5 0',
  image: 'M3 3h18v18H3V3m0 14 6-6 4 4 3-3 5 5M7 7h.01',
  table: 'M3 3h18v18H3V3m0 6h18M3 15h18M9 3v18M15 3v18',
  moveUp: 'm6 10 6-6 6 6M12 4v16',
  moveDown: 'm6 14 6 6 6-6M12 4v16',
  duplicate: 'M9 9h12v12H9V9M5 15H3V3h12v2',
  remove: 'M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7',
  add: 'M12 4v16M4 12h16',
  previewContent: 'M2 12q10-14 20 0-10 14-20 0m7 0a3 3 0 1 0 6 0 3 3 0 1 0-6 0',
  saveDraft: 'M3 3h15l3 3v15H3V3m4 0v6h10V3M7 21v-8h10v8',
  reloadDraft: 'M20 8a9 9 0 1 0 1 7M20 3v5h-5',
  edit: 'm4 16 12-12 4 4L8 20H4v-4m9-9 4 4',
  publish: 'M12 16V3m-5 5 5-5 5 5M4 15v6h16v-6',
  archive: 'M3 3h18v5H3V3m2 5v13h14V8M9 12h6',
  signOut: 'M9 3H3v18h6M8 12h13m-5-5 5 5-5 5',
};
export function icon(name) {
  const path = paths[name];
  return path
    ? `<svg class="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="${path}"/></svg>`
    : '';
}
export function iconButton(button, name, label, compact = false) {
  button.innerHTML = icon(name);
  button.classList.add('with-icon');
  if (compact) {
    button.classList.add('icon-only');
    button.setAttribute('aria-label', label);
    button.title = label;
  } else button.append(document.createTextNode(label));
}
