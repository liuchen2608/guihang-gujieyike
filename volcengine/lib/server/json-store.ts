export type Document<T> = { value: T; etag: string };
export interface JsonStore {
  get<T>(key: string): Promise<Document<T> | null>;
  put<T>(key: string, value: T, expectedEtag: string | null): Promise<boolean>;
  remove(key: string): Promise<void>;
}

export async function mutate<T, R>(store: JsonStore, key: string, initial: () => T,
  change: (value: T) => { next?: T; result: R }): Promise<R> {
  for (let attempt = 0; attempt < 8; attempt++) {
    const current = await store.get<T>(key);
    const { next, result } = change(current ? structuredClone(current.value) : initial());
    if (next === undefined) return result;
    if (await store.put(key, next, current?.etag ?? null)) return result;
  }
  throw new Error('STORAGE_BUSY_RETRY');
}
