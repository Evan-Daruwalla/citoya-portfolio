// Every row of a paged list endpoint. The API returns at most `pageSize` rows a call and
// 100 by default, so a single call silently drops the rest (audit DY, 2026-10-02).
export async function collectPages<T>(
  fetchPage: (limit: number, offset: number) => Promise<T[]>,
  pageSize = 200,
): Promise<T[]> {
  const all: T[] = [];
  for (let offset = 0; ; offset += pageSize) {
    const page = await fetchPage(pageSize, offset);
    all.push(...page);
    if (page.length < pageSize) return all;
  }
}
