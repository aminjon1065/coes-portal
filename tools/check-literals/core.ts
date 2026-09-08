import ts from 'typescript';

/** Совпадение кода элемента справочника в исходном коде. */
export interface LiteralViolation {
  readonly file: string;
  readonly line: number;
  readonly value: string;
}

/**
 * Правило замещаемости, П-1 (docs/00-КОНТРАКТ.md § 2).
 * Код элемента справочника обязан содержать дефис — по этой форме он и
 * отличается от кода самого справочника, который пишется через подчёркивание
 * и является частью программы.
 */
export const CATALOG_ITEM_CODE = /^[A-ZА-Я]{2,5}(-[0-9A-Z]{1,4})+$/u;

/**
 * Находит в одном файле строковые литералы, имеющие форму кода элемента
 * справочника. Разбор ведётся синтаксическим анализатором, а не поиском по
 * тексту: иначе под правило попадали бы совпадения в комментариях.
 */
export function findCatalogCodeLiterals(file: string, source: string): LiteralViolation[] {
  const sourceFile = ts.createSourceFile(file, source, ts.ScriptTarget.ES2023, true, ts.ScriptKind.TSX);
  const found: LiteralViolation[] = [];

  const visit = (node: ts.Node): void => {
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      const value = node.text;
      if (CATALOG_ITEM_CODE.test(value)) {
        const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
        found.push({ file, line: line + 1, value });
      }
    }
    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
  return found;
}
