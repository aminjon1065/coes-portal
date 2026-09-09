/**
 * Объявления для таблиц стилей. CSS Modules дают объект с именами классов;
 * побочный импорт обычного .css допустим только для токенов и шрифтов.
 */
declare module '*.module.css' {
  const classes: Readonly<Record<string, string>>;
  export default classes;
}

declare module '*.css';
