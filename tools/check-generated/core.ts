/** Артефакт, который порождается генератором и хранится в репозитории. */
export interface GeneratedArtifact {
  readonly path: string;
  readonly command: string;
}

export interface GeneratedMismatch {
  readonly path: string;
  readonly reason: 'отсутствует в репозитории' | 'расходится с генератором';
}

/**
 * П-2 (docs/00-КОНТРАКТ.md): расхождение сгенерированного с закоммиченным —
 * ошибка сборки, а не повод для обсуждения. Сравнение — побайтовое:
 * «почти совпадает» здесь не существует.
 */
export function compareGenerated(
  entries: readonly { readonly artifact: GeneratedArtifact; readonly committed: string | null; readonly produced: string }[],
): GeneratedMismatch[] {
  const mismatches: GeneratedMismatch[] = [];
  for (const entry of entries) {
    if (entry.committed === null) {
      mismatches.push({ path: entry.artifact.path, reason: 'отсутствует в репозитории' });
      continue;
    }
    if (entry.committed !== entry.produced) {
      mismatches.push({ path: entry.artifact.path, reason: 'расходится с генератором' });
    }
  }
  return mismatches;
}
