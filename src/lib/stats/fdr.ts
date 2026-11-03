export function bhFdr(
  pValues: Array<number | null | undefined>,
): Array<number | null> {
  const indices: number[] = [];
  pValues.forEach((value, index) => {
    if (value != null && Number.isFinite(value)) indices.push(index);
  });
  const m = indices.length;
  const result: Array<number | null> = new Array(pValues.length).fill(null);
  if (m === 0) return result;

  const sorted = [...indices].sort(
    (left, right) =>
      (pValues[left] as number) - (pValues[right] as number),
  );
  let previous = 1;
  for (let rank = m; rank >= 1; rank -= 1) {
    const index = sorted[rank - 1];
    const raw = ((pValues[index] as number) * m) / rank;
    const q = Math.min(previous, raw, 1);
    result[index] = q;
    previous = q;
  }
  return result;
}
