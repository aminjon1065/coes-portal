/**
 * Механизм проверки дизайн-системы: docs/06-ДИЗАЙН-СИСТЕМА.md § 15.
 * Значения цвета, размера шрифта, отступа, скругления и тени допускаются
 * только как var(--…). Единственное место, где токены объявляются
 * литералами, — packages/ui/src/tokens.css.
 */
const TOKEN_ONLY = [
  'color',
  'background-color',
  'border-color',
  'outline-color',
  'fill',
  'stroke',
  'font-size',
  'line-height',
  'margin',
  'margin-top',
  'margin-right',
  'margin-bottom',
  'margin-left',
  'padding',
  'padding-top',
  'padding-right',
  'padding-bottom',
  'padding-left',
  'gap',
  'row-gap',
  'column-gap',
  'border-radius',
  'box-shadow',
];

export default {
  rules: {
    'declaration-no-important': true,
    // Каждое значение обязано быть токеном. Сокращённая запись из токенов
    // (padding: var(--sp-3) var(--sp-6)) правилу удовлетворяет: литералов
    // в ней нет. Одиночный литерал по-прежнему не проходит.
    'declaration-property-value-allowed-list': Object.fromEntries(
      TOKEN_ONLY.map((property) => [property, [/^var\(--[a-z0-9-]+\)(\s+var\(--[a-z0-9-]+\)){0,3}$/]]),
    ),
  },
  overrides: [
    {
      files: ['packages/ui/src/tokens.css'],
      rules: { 'declaration-property-value-allowed-list': null },
    },
  ],
  ignoreFiles: ['**/node_modules/**', 'coverage/**', 'dist/**'],
};
