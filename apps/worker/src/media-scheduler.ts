export function fillMediaCapacity(
  jobs: Set<Promise<boolean>>,
  concurrency: number,
  processOne: () => Promise<boolean>,
) {
  while (jobs.size < concurrency) {
    const job = processOne().finally(() => jobs.delete(job));
    jobs.add(job);
  }
}