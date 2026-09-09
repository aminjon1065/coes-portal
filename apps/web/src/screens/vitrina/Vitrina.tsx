import type { ReactNode } from 'react';
import { Plus, Pencil, Trash2, Printer } from 'lucide-react';
import {
  Stack, Grid, Panel, Section, Divider,
  Text, Heading,
  Button, IconButton,
  Tag, StatusBadge, SeverityBadge, Counter,
  Skeleton, Spinner, EmptyState, ErrorState, NoAccessState, Banner, RestrictedNotice,
  NETWORK_ERROR,
  type LifecycleStatus, type SeverityToken, type TextVariant, type ButtonKind,
} from '@coes/ui';

/**
 * Витрина компонентов — docs/06-ДИЗАЙН-СИСТЕМА.md § 14.
 *
 * Эталон для сравнения снимков, а не игровая площадка: интерактивных
 * настроек здесь нет. Собрана только из компонентов библиотеки — правило
 * coes/no-intrinsic-jsx действует и здесь, и это проверка самой библиотеки
 * на достаточность.
 */

/* Строка с таджикскими буквами: § 3.1 требует показать её без замещающих
   прямоугольников (приёмочный сценарий ПС-0-06). */
const ТАДЖИКСКИЕ = 'Ғафуров Ӯктам Ҳақназарӣ Ҷумъа қишлоқ';

const СОСТОЯНИЯ: readonly LifecycleStatus[] = [
  'draft', 'registered', 'clarifying', 'closed', 'cancelled',
  'onApproval', 'approved', 'rejected', 'toDestroy', 'destroyed', 'permanent',
];

const ВАЖНОСТЬ: readonly { readonly level: SeverityToken; readonly label: string }[] = [
  { level: 'sev-1', label: 'Локальный' },
  { level: 'sev-2', label: 'Местный' },
  { level: 'sev-3', label: 'Районный' },
  { level: 'sev-4', label: 'Областной' },
  { level: 'sev-5', label: 'Республиканский' },
];

const НАЧЕРТАНИЯ: readonly { readonly variant: TextVariant; readonly name: string }[] = [
  { variant: 'caption', name: 'caption 11/16' },
  { variant: 'small', name: 'small 12/18' },
  { variant: 'body', name: 'body 14/20' },
  { variant: 'bodyStrong', name: 'bodyStrong 14/20' },
  { variant: 'lead', name: 'lead 16/24' },
];

const ВИДЫ_КНОПОК: readonly { readonly kind: ButtonKind; readonly name: string }[] = [
  { kind: 'primary', name: 'основная' },
  { kind: 'normal', name: 'обычная' },
  { kind: 'quiet', name: 'тихая' },
  { kind: 'danger', name: 'опасная' },
];

export function Vitrina(): ReactNode {
  return (
    <Stack gap="sp-6">
      <Heading level={1}>Витрина компонентов</Heading>
      <Banner tone="info" title="Эталон, а не игровая площадка">
        Снимки этой страницы сравниваются с эталоном при каждой проверке, допуск 0,1 % площади.
        Интерактивных настроек здесь нет намеренно.
      </Banner>

      <Panel title={<Heading level={3}>Типографика</Heading>}>
        <Stack gap="sp-3">
          <Heading level={1}>Заголовок первого уровня</Heading>
          <Heading level={2}>Заголовок второго уровня</Heading>
          <Heading level={3}>Заголовок третьего уровня</Heading>
          <Heading level={4}>Заголовок четвёртого уровня</Heading>
          <Divider />
          {НАЧЕРТАНИЯ.map(({ variant, name }) => (
            <Stack key={variant} direction="horizontal" gap="sp-4" align="center">
              <Text variant="caption" tone="secondary">{name}</Text>
              <Text variant={variant}>{ТАДЖИКСКИЕ}</Text>
            </Stack>
          ))}
          <Divider />
          <Text variant="caption" tone="secondary">моноширинные цифры</Text>
          <Text numeric>1 234 567,89 смн — 08.09.2026 14:35 — 38,55980° с. ш.</Text>
          <Text tone="secondary">вторичный текст</Text>
          <Text tone="danger">текст ошибки</Text>
          <Text variant="small" tone="secondary">
            Тон отключённого текста показан на отключённых кнопках выше: § 2.1 отдаёт
            его только отключённым элементам, а самостоятельным текстом он не набирается.
          </Text>
        </Stack>
      </Panel>

      <Panel title={<Heading level={3}>Кнопки</Heading>}>
        <Stack gap="sp-4">
          {ВИДЫ_КНОПОК.map(({ kind, name }) => (
            <Stack key={kind} direction="horizontal" gap="sp-2" align="center" wrap>
              <Text variant="caption" tone="secondary">{name}</Text>
              <Button kind={kind} size="s">Малая</Button>
              <Button kind={kind}>Обычная</Button>
              <Button kind={kind} size="l">Крупная</Button>
              <Button kind={kind} icon={<Plus size={16} aria-hidden="true" />}>Со значком</Button>
              <Button kind={kind} disabled disabledReason="Событие уже закрыто">Отключена</Button>
              <Button kind={kind} busy>Выполняется</Button>
            </Stack>
          ))}
          <Divider />
          <Stack direction="horizontal" gap="sp-2" align="center">
            <Text variant="caption" tone="secondary">кнопки-значки</Text>
            <IconButton label="Изменить" icon={<Pencil size={16} />} />
            <IconButton label="Печать" icon={<Printer size={16} />} />
            <IconButton label="Удалить" icon={<Trash2 size={16} />} kind="danger" />
            <IconButton label="Изменить" icon={<Pencil size={16} />} size="s" />
          </Stack>
        </Stack>
      </Panel>

      <Panel title={<Heading level={3}>Состояния объекта и важность</Heading>}>
        <Stack gap="sp-4">
          <Section title={<Text variant="bodyStrong">Состояния жизненного цикла</Text>}>
            <Stack direction="horizontal" gap="sp-4" wrap>
              {СОСТОЯНИЯ.map((status) => <StatusBadge key={status} status={status} />)}
            </Stack>
          </Section>
          <Section title={<Text variant="bodyStrong">Шкала важности — цвет никогда не единственный носитель смысла</Text>}>
            <Stack direction="horizontal" gap="sp-2" wrap>
              {ВАЖНОСТЬ.map(({ level, label }) => <SeverityBadge key={level} level={level} label={label} />)}
            </Stack>
          </Section>
          <Section title={<Text variant="bodyStrong">Метки и счётчики</Text>}>
            <Stack direction="horizontal" gap="sp-2" align="center" wrap>
              <Tag>Нейтральная</Tag>
              <Tag tone="primary">Основная</Tag>
              <Tag tone="success">Успех</Tag>
              <Tag tone="warning">Предупреждение</Tag>
              <Tag tone="danger">Ошибка</Tag>
              <Counter value={3} />
              <Counter value={99} />
              <Counter value={150} />
            </Stack>
          </Section>
        </Stack>
      </Panel>

      <Panel title={<Heading level={3}>Баннеры</Heading>}>
        <Stack gap="sp-3">
          <Banner tone="info" title="Сведение">Подложка недоступна. Объекты и координаты отображаются без фоновой карты.</Banner>
          <Banner tone="warning" title="Предупреждение">Срок хранения истекает через 14 дней.</Banner>
          <Banner tone="danger" title="Ошибка">Не удалось сформировать отчёт. Повторите или обратитесь к администратору.</Banner>
          <Banner tone="success" title="Успех">Событие 2026-SUG-0001 зарегистрировано.</Banner>
          <RestrictedNotice />
        </Stack>
      </Panel>

      <Panel title={<Heading level={3}>Семь состояний области данных</Heading>}>
        <Grid columns={2}>
          <Panel title={<Text variant="bodyStrong">1. Загрузка</Text>} padding="tight">
            <Stack gap="sp-2">
              <Skeleton />
              <Skeleton />
              <Skeleton width="short" />
              <Stack direction="horizontal" gap="sp-2" align="center" justify="center">
                <Spinner />
              </Stack>
            </Stack>
          </Panel>
          <Panel title={<Text variant="bodyStrong">2. Пусто</Text>} padding="tight">
            <EmptyState
              kind="empty" title="Событий пока нет" hint="Зарегистрируйте первое событие"
              action={<Button kind="primary" icon={<Plus size={16} aria-hidden="true" />}>Зарегистрировать событие</Button>}
            />
          </Panel>
          <Panel title={<Text variant="bodyStrong">3. Ничего не найдено</Text>} padding="tight">
            <EmptyState
              kind="notFound" title="Ничего не найдено" hint="Измените условия отбора"
              action={<Button>Сбросить условия</Button>}
            />
          </Panel>
          <Panel title={<Text variant="bodyStrong">4. Ошибка</Text>} padding="tight">
            <ErrorState
              message="Номер 12/2026 уже присвоен другому документу. Обновите страницу и повторите."
              requestId="01JC7Z0K8Q9V2M4N6P8R0T2W4Y"
            />
          </Panel>
          <Panel title={<Text variant="bodyStrong">5. Нет прав</Text>} padding="tight">
            <NoAccessState />
          </Panel>
          <Panel title={<Text variant="bodyStrong">6. Частичный отказ</Text>} padding="tight">
            <Stack gap="sp-3">
              <Banner tone="warning" title="Часть данных недоступна">
                Слой границ районов не загрузился. События показаны без привязки к району.
              </Banner>
              <Text tone="secondary">Загруженные данные показываются, а не скрываются.</Text>
            </Stack>
          </Panel>
          <Panel title={<Text variant="bodyStrong">7. Только чтение</Text>} padding="tight">
            <Stack gap="sp-3">
              <Banner tone="info" title="Событие закрыто">
                Изменение недоступно. Чтобы внести уточнение, переоткройте событие.
              </Banner>
              <Text>Погибло: 2 &nbsp;·&nbsp; Пропало без вести: —</Text>
            </Stack>
          </Panel>
          <Panel title={<Text variant="bodyStrong">Сетевой сбой — текст задан дословно</Text>} padding="tight">
            <ErrorState message={`${NETWORK_ERROR.title}. ${NETWORK_ERROR.hint}`} />
          </Panel>
        </Grid>
      </Panel>
    </Stack>
  );
}
