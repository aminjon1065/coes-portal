import noIntrinsicJsx from './rules/no-intrinsic-jsx.js';
import moduleBoundaries from './rules/module-boundaries.js';
import noDirectDate from './rules/no-direct-date.js';
import requireScope from './rules/require-scope.js';
import noRawHttpClient from './rules/no-raw-http-client.js';
import noStyleAttribute from './rules/no-style-attribute.js';
import latinIdentifiers from './rules/latin-identifiers.js';
import noForeignSchema from './rules/no-foreign-schema.js';

/**
 * Правила, которыми обеспечиваются принципы контракта:
 *   no-intrinsic-jsx   — П-3, docs/00-КОНТРАКТ.md
 *   module-boundaries  — docs/03-АРХИТЕКТУРА.md § 3
 *   no-direct-date     — docs/03-АРХИТЕКТУРА.md § 5.2
 *   require-scope      — docs/05-ДОСТУП.md § 4.5
 *   no-raw-http-client — docs/09-API.md § 9
 *   no-style-attribute — docs/06-ДИЗАЙН-СИСТЕМА.md § 13 п. 11
 *   latin-identifiers  — docs/13-ГЛОССАРИЙ.md § 3
 *   no-foreign-schema  — docs/03-АРХИТЕКТУРА.md § 3 (границы в SQL)
 */
const plugin = {
  meta: { name: '@coes/eslint-plugin', version: '0.0.0' },
  rules: {
    'no-intrinsic-jsx': noIntrinsicJsx,
    'module-boundaries': moduleBoundaries,
    'no-direct-date': noDirectDate,
    'require-scope': requireScope,
    'no-raw-http-client': noRawHttpClient,
    'no-style-attribute': noStyleAttribute,
    'latin-identifiers': latinIdentifiers,
    'no-foreign-schema': noForeignSchema,
  },
};

export default plugin;
