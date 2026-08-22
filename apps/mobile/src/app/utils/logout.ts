import { useAuthStore } from '../store/auth-store';
import { tokenManager } from './token-manager';
import { sqliteDb } from '../database/sqlite-db';
import { usePatrolStore } from '../../modules/patrol/store/patrol-store';
import { QueryClient } from '@tanstack/react-query';

export async function performLogout(queryClient?: QueryClient) {
  console.log('[Logout] Executing enterprise logout...');

  try {
    // 1. Clear tokens
    await tokenManager.clearTokens();
  } catch (err) {
    console.warn('[Logout] Warning clearing tokens:', err);
  }

  try {
    // 2. Reset active patrol store & SQLite refs
    await usePatrolStore.getState().completeSession();
  } catch (err) {
    console.warn('[Logout] Warning completing session:', err);
  }

  try {
    // 3. Purge cached SQLite database tables
    await sqliteDb.clearTable('assignments');
    await sqliteDb.clearTable('checkpoints');
    await sqliteDb.clearTable('patrols');
  } catch (err) {
    console.warn('[Logout] Warning clearing SQLite tables:', err);
  }

  // 4. Clear React Query cache
  if (queryClient) {
    try {
      queryClient.clear();
    } catch (err) {
      console.warn('[Logout] Warning clearing query client:', err);
    }
  }

  // 5. Clear User authorization store (ALWAYS triggers React Navigation switch to AuthStack)
  useAuthStore.getState().clearAuth();
}
