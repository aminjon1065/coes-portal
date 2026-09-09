import rule from '../rules/no-style-attribute.js';
import { tester } from './setup.ts';

/** Барьер 06 § 13 п. 11: значение, заданное атрибутом style, минует stylelint. */
tester.run('no-style-attribute', rule, {
  valid: [
    { code: 'const Znak = () => <span className={styles.severity} data-level="sev-3" />;' },
    { code: 'const Skelet = () => <div className={[styles.skeleton, size].join(" ")} />;' },
    // Слово style само по себе не атрибут разметки.
    { code: 'const style = { width: "60%" }; export default style;' },
    { code: 'import styles from "./dannye.module.css"; const T = () => <span className={styles.tag} />;' },
  ],
  invalid: [
    {
      code: 'const Znak = () => <span style={{ backgroundColor: "var(--c-sev-3-bg)" }} />;',
      errors: [{ messageId: 'styleAttr' }],
    },
    {
      code: 'const Setka = () => <div style={{ gridTemplateColumns: "repeat(2, 1fr)" }} />;',
      errors: [{ messageId: 'styleAttr' }],
    },
    {
      code: 'const Skelet = () => <div className={styles.skeleton} style={{ width }} />;',
      errors: [{ messageId: 'styleAttr' }],
    },
    {
      code: 'const Panel = () => <Panel style={ownStyle} />;',
      errors: [{ messageId: 'styleAttr' }],
    },
  ],
});
