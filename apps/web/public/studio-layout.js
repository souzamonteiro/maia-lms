// Views keep the same form nodes mounted so uploads and unsaved text survive navigation.
export function mountStudioLayout(form, { t, view, onView }) {
  const bar = document.createElement('div');
  bar.className = 'studio-view-bar';
  const label = document.createElement('label');
  const toggle = document.createElement('input');
  toggle.type = 'checkbox';
  toggle.checked = Boolean(view?.focused);
  label.append(toggle, document.createTextNode(t('focusEditor')));
  const nav = document.createElement('nav');
  nav.className = 'studio-outline';
  nav.setAttribute('aria-label', t('courseOutline'));
  bar.append(label, nav);
  form.before(bar);
  const course = form.querySelector('#course-settings');
  let selected = course;
  const modules = () => [...form.querySelectorAll('.module-editor')];
  if (Number.isInteger(view?.module)) {
    const module = modules()[view.module];
    selected = Number.isInteger(view.lesson)
      ? module?.querySelectorAll('.lesson-editor')[view.lesson] || course
      : module || course;
  }
  function render() {
    if (!form.contains(selected)) selected = course;
    const focused = toggle.checked;
    nav.hidden = !focused;
    course.hidden = focused && selected !== course;
    const items = [{ node: course, title: t('courseSettings') }];
    let location = { focused };
    modules().forEach((module, mi) => {
      const active = module === selected || module.contains(selected);
      module.hidden = focused && !active;
      items.push({
        node: module,
        title: `${mi + 1}. ${module.querySelector('.module-title').value || t('moduleLegend')}`,
      });
      if (selected === module) location = { focused, module: mi };
      [...module.querySelectorAll('.lesson-editor')].forEach((lesson, li) => {
        lesson.hidden = focused && selected !== lesson;
        items.push({
          node: lesson,
          title: `${mi + 1}.${li + 1}. ${lesson.querySelector('.lesson-title').value || t('lessonLegend')}`,
        });
        if (selected === lesson) location = { focused, module: mi, lesson: li };
      });
    });
    // Reuse buttons while typing so navigation never steals the current focus.
    const signature = JSON.stringify(items.map(item => item.title));
    if (nav.dataset.signature !== signature || nav.children.length !== items.length) {
      nav.replaceChildren();
      for (const item of items) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'secondary';
        button.textContent = item.title;
        nav.append(button);
      }
      nav.dataset.signature = signature;
    }
    items.forEach((item, index) => {
      const button = nav.children[index];
      button.setAttribute('aria-current', item.node === selected ? 'true' : 'false');
      button.onclick = () => {
        selected = item.node;
        render();
      };
    });
    onView(location);
  }
  toggle.onchange = render;
  // Native validation must reveal the section before the browser focuses its input.
  form.addEventListener(
    'invalid',
    event => {
      selected = event.target.closest('.lesson-editor, .module-editor') || course;
      render();
    },
    true,
  );
  render();
  return render;
}

export function enableStudioDrag(field, { t, onMove }) {
  const handle = document.createElement('span');
  handle.tabIndex = -1;
  handle.setAttribute('role', 'img');
  handle.className = 'secondary drag-handle';
  handle.textContent = '⠿';
  handle.setAttribute('aria-label', t('dragToReorder'));
  handle.title = t('dragToReorder');
  handle.draggable = true;
  field.querySelector(':scope > .row-controls').prepend(handle);
  handle.addEventListener('dragstart', event => {
    event.stopPropagation();
    field.parentElement._draggedItem = field;
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', 'studio-reorder');
    field.classList.add('dragging');
  });
  handle.addEventListener('dragend', () => {
    delete field.parentElement._draggedItem;
    field.classList.remove('dragging');
  });
  field.addEventListener('dragover', event => {
    const source = field.parentElement._draggedItem;
    if (!source || source === field) return;
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = 'move';
  });
  field.addEventListener('drop', event => {
    const source = field.parentElement._draggedItem;
    if (!source || source === field) return;
    event.preventDefault();
    event.stopPropagation();
    const siblings = [...field.parentElement.children];
    if (siblings.indexOf(source) < siblings.indexOf(field)) field.after(source);
    else field.before(source);
    delete field.parentElement._draggedItem;
    source.classList.remove('dragging');
    source.querySelector(':scope > .row-controls .drag-handle').focus();
    onMove();
  });
}
