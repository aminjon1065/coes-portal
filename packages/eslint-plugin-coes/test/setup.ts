import { RuleTester } from 'eslint';
import tsParser from '@typescript-eslint/parser';
import { describe, it } from 'vitest';

/** RuleTester из ESLint по умолчанию ищет глобальные describe/it. */
RuleTester.describe = describe;
RuleTester.it = it;

/** Разбор TypeScript и JSX: правила действуют на .ts и .tsx. */
export const tester = new RuleTester({
  languageOptions: {
    parser: tsParser,
    ecmaVersion: 2023,
    sourceType: 'module',
    parserOptions: { ecmaFeatures: { jsx: true } },
  },
});
