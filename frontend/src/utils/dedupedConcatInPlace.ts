export function dedupedConcatInPlace<T extends { id: string | number }>({
  old,
  next,
}: {
  old: Array<T>
  next: Array<T>
}): Array<T> {
  const nextById = new Map<string | number, T>()

  for (const item of next) {
    nextById.set(item.id, item)
  }

  const result: Array<T> = []

  for (const item of old) {
    const replacement = nextById.get(item.id)
    if (replacement) {
      result.push(replacement)
      nextById.delete(item.id)
    } else {
      result.push(item)
    }
  }

  for (const item of nextById.values()) {
    result.push(item)
  }

  return result
}
