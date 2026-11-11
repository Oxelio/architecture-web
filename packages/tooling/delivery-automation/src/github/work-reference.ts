export function workReferences(body: string | null): readonly number[] {
  return Array.from(body?.matchAll(/^Refs #([1-9]\d*)\r?$/gmu) ?? [], (line) =>
    Number(line[1]),
  );
}

export function workReference(body: string | null): number | null {
  const references = workReferences(body);
  const [workNumber] = references;
  return references.length === 1 &&
    workNumber !== undefined &&
    Number.isSafeInteger(workNumber)
    ? workNumber
    : null;
}
