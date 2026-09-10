/** Единственный вход в модуль iam извне (docs/03-АРХИТЕКТУРА.md § 3). */
export {
  verifyCredentials, openSession, liveSession, switchSessionAssignment, endSession,
  createAccount, changeOwnPassword, blockAccount, unblockAccount, accountByPerson,
  hashPassword,
} from './service.ts';
export type {
  Credentials, VerifiedAccount, OpenedSession, CreateAccount, AccountRow, SessionRow,
} from './service.ts';

export const IAM_PERMISSIONS = {
  accountRead: 'iam.account.read',
  accountManage: 'iam.account.manage',
} as const;
