import { connect } from '../../packages/db/connect.ts';
import { findFirstBreak, type ChainLink } from './core.ts';

/**
 * Проверка целостности журнала действий (docs/05-ДОСТУП.md § 9.3).
 * Хеш пересчитывается той же функцией базы, которой он записывался, —
 * иначе проверялось бы не то, что записано.
 */
const client = await connect();
try {
  const { rows } = await client.query<ChainLink>(`
    SELECT e.id::text                                                          AS "id",
           encode(e.prev_hash, 'hex')                                          AS "prevHash",
           encode(e.hash, 'hex')                                               AS "hash",
           encode(digest(coalesce(e.prev_hash, ''::bytea) || audit.canonical(e)::bytea, 'sha256'), 'hex') AS "expectedHash"
    FROM audit.event e
    ORDER BY e.id
  `);

  const broken = findFirstBreak(rows);
  if (broken !== null) {
    console.error(
      `Целостность журнала нарушена. Первая нарушенная связь — запись № ${broken.id}: ${broken.reason}.\n` +
        'Это признак вмешательства в базу данных в обход системы. ' +
        'Немедленно сообщите Держателю контракта (docs/12-ЭКСПЛУАТАЦИЯ.md § 10).',
    );
    process.exit(1);
  }

  console.log(`Журнал действий: записей ${rows.length}, нарушений цепочки не обнаружено.`);
} finally {
  await client.end();
}
