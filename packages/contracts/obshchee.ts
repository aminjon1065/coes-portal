import { z } from 'zod';

/**
 * Общие схемы — docs/09-API.md § 1, § 2, § 3.
 * Описаны один раз: этими же схемами проверяет сервер, из них же
 * порождаются OpenAPI и клиент (принцип П-2).
 */

/** Идентификаторы — строка uuid (§ 1). */
export const uuid = z.string().uuid();

/** Время — ISO 8601 с суффиксом Z, всегда UTC (§ 1). */
export const isoDateTime = z.string().datetime({ offset: false });

export const ERROR_CODES = [
  'VALIDATION_FAILED', 'UNAUTHENTICATED', 'ACCESS_DENIED', 'NOT_FOUND',
  'CONFLICT', 'PRECONDITION_FAILED', 'LIMIT_REACHED', 'RATE_LIMITED', 'INTERNAL',
] as const;

/** Единственный вид ответа об errorResponseе (§ 2). */
export const errorResponse = z.object({
  error: z.object({
    code: z.enum(ERROR_CODES),
    message: z.string(),
    details: z.record(z.unknown()),
    requestId: z.string(),
  }),
});

/**
 * Постраничный вывод — только курсорный (§ 3.1). Смещения не существует:
 * на пятистах тысячах строк оно работает недопустимо медленно.
 */
export const pageParams = z.object({
  limit: z.number().int().positive().optional(),
  cursor: z.string().optional(),
});

/** Общие условия отбора всех реестров (§ 3.2). */
export const commonFilter = pageParams.extend({
  q: z.string().optional(),
  orgUnitId: uuid.optional(),
  includeDescendants: z.boolean().optional(),
  sort: z.string().optional(),
});

/**
 * Оболочка списка. `totalIsExact` равен false, когда точное число
 * превысило десять тысяч: интерфейс тогда показывает «более 10 000».
 */
export function listOf<T extends z.ZodTypeAny>(item: T) {
  return z.object({
    items: z.array(item),
    nextCursor: z.string().nullable(),
    total: z.number().int().nonnegative(),
    totalIsExact: z.boolean(),
  });
}

/** Пустой ответ действия, которое ничего не возвращает. */
export const accepted = z.object({ ok: z.literal(true) });
