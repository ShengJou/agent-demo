/**
 * 从对象中删除值为 null 或 undefined 的键。
 *
 * @template T - 对象的类型。
 * @param {T} obj - 要删除空键的对象。
 * @returns {T} - 删除空键后的对象。
 */
export function removeEmptyKeys<T extends Record<string, any>>(obj: T): T {
  for (const key of Object.keys(obj) as Array<keyof T>) {
    if (obj[key] == null) {
      delete obj[key];
    }
  }
  return obj;
}
