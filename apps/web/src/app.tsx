import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@coes/ui/tokens.css';
import '../../../packages/ui/src/fonts.css';
import { Vitrina } from './screens/vitrina/Vitrina.tsx';

/**
 * Точка входа. Витрина компонентов живёт по адресу /__ui и доступна только
 * вне продуктовой сборки (docs/06-ДИЗАЙН-СИСТЕМА.md § 14). Проверка
 * разрешения sys.status.read добавляется вместе с сессиями: сейчас
 * проверять нечем.
 */
const VITRINA_PATH = '/__ui';

const root = document.getElementById('root');
if (root === null) throw new Error('Не найден корневой элемент приложения.');

// Единственный существующий экран — витрина. Э-001 «Вход» появится вместе
// с сессиями, и тогда эта строка уступит место таблице маршрутов.
if (window.location.pathname !== VITRINA_PATH) {
  window.history.replaceState(null, '', VITRINA_PATH);
}

if (process.env.NODE_ENV === 'production') {
  throw new Error('Витрина компонентов недоступна в продуктовой сборке (§ 14).');
}

createRoot(root).render(
  <StrictMode>
    <Vitrina />
  </StrictMode>,
);
