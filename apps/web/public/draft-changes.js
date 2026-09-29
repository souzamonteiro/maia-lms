// Indexes are safe only together with the exact expected revision identifier.
export function draftChanges(previous, next) {
  if (
    !previous ||
    previous.modules.length !== next.modules.length ||
    previous.modules.some((module, i) => module.lessons.length !== next.modules[i].lessons.length)
  )
    return null;
  const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const metadata = value =>
    Object.fromEntries(Object.entries(value).filter(([key]) => key !== 'modules'));
  const changes = [];
  if (!equal(metadata(previous), metadata(next)))
    changes.push({ unit: 'course', value: metadata(next) });
  next.modules.forEach((module, mi) => {
    if (module.title !== previous.modules[mi].title)
      changes.push({ unit: 'module', module: mi, title: module.title });
    module.lessons.forEach((lesson, li) => {
      if (!equal(lesson, previous.modules[mi].lessons[li]))
        changes.push({ unit: 'lesson', module: mi, lesson: li, value: lesson });
    });
  });
  return changes;
}
