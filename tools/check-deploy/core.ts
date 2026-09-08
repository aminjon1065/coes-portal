import { parse } from 'yaml';

export interface DeployProblem {
  readonly file: string;
  readonly message: string;
}

/**
 * Развёртывание собирается заранее и проверяется локально
 * (docs/03-АРХИТЕКТУРА.md § 11.2): то, что впервые собирают в день появления
 * сервера, в этот же день и ломается.
 */
export function checkComposeText(file: string, text: string): DeployProblem[] {
  let document: unknown;
  try {
    document = parse(text);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return [{ file, message: `не разбирается как YAML: ${message}` }];
  }
  if (document === null || typeof document !== 'object') {
    return [{ file, message: 'пуст или не является объектом' }];
  }
  const services = (document as { services?: unknown }).services;
  if (services === undefined) {
    return [{ file, message: 'нет раздела services' }];
  }
  if (services === null || typeof services !== 'object' || Object.keys(services).length === 0) {
    return [{ file, message: 'раздел services пуст' }];
  }
  return [];
}
