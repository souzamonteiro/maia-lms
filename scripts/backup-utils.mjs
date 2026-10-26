export function validStorageKey(key) {
  return typeof key === 'string' &&
    /^[a-zA-Z0-9_-]+(?:\/[a-zA-Z0-9_.-]+)*$/.test(key) &&
    !key.split('/').some(part => part === '.' || part === '..');
}

export function referencedStorageKeys(db) {
  const references = [
    ['assets', 'storage_key'],
    ['video_chunks', 'storage_key'],
    ['video_uploads', 'output_key'],
    ['video_uploads', 'poster_key'],
    ['video_uploads', 'hls_key'],
    ['course_revisions', 'image_key'],
    ['certificates', 'pdf_storage_key'],
  ];
  const keys = new Set();
  for (const [table, column] of references) {
    const columns = db.pragma(`table_info(${table})`);
    if (!columns.some(item => item.name === column)) continue;
    const rows = db.prepare(`SELECT "${column}" AS storage_key FROM "${table}" WHERE "${column}" IS NOT NULL`).all();
    for (const row of rows) {
      if (!validStorageKey(row.storage_key)) throw new Error('Database contains an invalid storage key');
      keys.add(row.storage_key);
    }
  }
  return [...keys];
}
