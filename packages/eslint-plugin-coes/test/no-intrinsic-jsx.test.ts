import rule from '../rules/no-intrinsic-jsx.js';
import { tester } from './setup.ts';

/** Барьер П-3: собственная вёрстка на экранах запрещена. */
tester.run('no-intrinsic-jsx', rule, {
  valid: [
    { code: 'const Screen = () => <Registry title="События" />;' },
    { code: 'const Screen = () => <><Panel /><Table /></>;' },
    { code: 'const Screen = () => <Stack направление="горизонтально" />;' },
  ],
  invalid: [
    {
      code: 'const Screen = () => <div>События</div>;',
      errors: [{ messageId: 'intrinsic', data: { name: 'div' } }],
    },
    {
      code: 'const Screen = () => <Panel style={{ margin: 8 }} />;',
      errors: [{ messageId: 'styleAttr' }],
    },
    {
      code: 'const Screen = () => <Panel className="wide" />;',
      errors: [{ messageId: 'classNameAttr' }],
    },
    {
      code: 'const Screen = () => <table><tr /></table>;',
      errors: [{ messageId: 'intrinsic' }, { messageId: 'intrinsic' }],
    },
  ],
});
