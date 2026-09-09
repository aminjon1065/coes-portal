import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@coes/ui/tokens.css';
import '../../../packages/ui/src/fonts.css';
import { Vitrina } from './screens/vitrina/Vitrina.tsx';

/**
 * Точка входа. Пока в приложении один экран — витрина компонентов
 * (docs/06-ДИЗАЙН-СИСТЕМА.md § 14). Остальные экраны появляются вместе
 * со своими модулями.
 */
const root = document.getElementById('root');
if (root === null) throw new Error('Не найден корневой элемент приложения.');

createRoot(root).render(
  <StrictMode>
    <Vitrina />
  </StrictMode>,
);
