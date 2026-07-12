import { useAuthStore } from '../store/auth-store';
import { tokenManager } from './token-manager';
import { sqliteDb } from '../database/sqlite-db';
import { usePatrolStore } from '../../modules/patrol/store/patrol-store';
import { QueryClient } from '@tanstack/react-query';

export async function performLogout(queryClient?: QueryClient) {
  console.log('[Logout] Executing enterprise logout...');

  // 1. Clear tokens
  tokenManager.clearTokens();

  // 2. Reset active patrol store & SQLite refs
  await usePatrolStore.getState().completeSession();

  // 3. Purge cached SQLite database tables
  await sqliteDb.clearTable('assignments');
  await sqliteDb.clearTable('checkpoints');
  await sqliteDb.clearTable('patrols');
  
  // Note: We preserve the 'offline_mutations' table so queued reports are not lost on logout.

  // 4. Clear React Query cache
  if (queryClient) {
    queryClient.clear();
  }

  // 5. Clear User authorization store (triggers React Navigation switch to AuthStack)
  useAuthStore.getState().clearAuth();
}
