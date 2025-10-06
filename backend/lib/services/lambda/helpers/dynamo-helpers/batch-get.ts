import { get } from './get'

export async function batchGet<T>({
  tableName,
  keys
}: {
  tableName: string
  keys: Array<{ [key: string]: string }>
}): Promise<T[]> {
  const promises = keys.map(key => {
    return get<T>({
      tableName,
      key
    })
  })
  const records = await Promise.all(promises)
  return records.filter((item): item is Awaited<T> => item != null)
}