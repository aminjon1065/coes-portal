/*
 * СГЕНЕРИРОВАНО. Источник — packages/contracts, команда — pnpm gen:client.
 */
import type { z } from 'zod';
import { REGISTRY as registry } from '@coes/contracts/registry.ts';

export const loginRequest = registry.login.request;
export type loginRequest = z.input<typeof registry.login.request>;
export const loginResponse = registry.login.response;
export type loginResponse = z.output<typeof registry.login.response>;
export const logoutResponse = registry.logout.response;
export type logoutResponse = z.output<typeof registry.logout.response>;
export const getSessionResponse = registry.getSession.response;
export type getSessionResponse = z.output<typeof registry.getSession.response>;
export const changePasswordRequest = registry.changePassword.request;
export type changePasswordRequest = z.input<typeof registry.changePassword.request>;
export const changePasswordResponse = registry.changePassword.response;
export type changePasswordResponse = z.output<typeof registry.changePassword.response>;
export const switchContextRequest = registry.switchContext.request;
export type switchContextRequest = z.input<typeof registry.switchContext.request>;
export const switchContextResponse = registry.switchContext.response;
export type switchContextResponse = z.output<typeof registry.switchContext.response>;
export const getSettingsResponse = registry.getSettings.response;
export type getSettingsResponse = z.output<typeof registry.getSettings.response>;
export const putSettingsRequest = registry.putSettings.request;
export type putSettingsRequest = z.input<typeof registry.putSettings.request>;
export const putSettingsResponse = registry.putSettings.response;
export type putSettingsResponse = z.output<typeof registry.putSettings.response>;
export const getSystemStatusResponse = registry.getSystemStatus.response;
export type getSystemStatusResponse = z.output<typeof registry.getSystemStatus.response>;
