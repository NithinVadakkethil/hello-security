import { apiClient } from '../../../app/api/api-client';
import { GuardAssignment } from '../../dashboard/types';
import { sqliteDb } from '../../../app/database/sqlite-db';

function cacheAssignmentSubTasks(assignments: any[] | any) {
  if (!assignments) return;
  const list = Array.isArray(assignments) ? assignments : [assignments];
  for (const asg of list) {
    const routeGates = asg?.patrolRoute?.routeGates || [];
    const assignmentGates = asg?.assignmentGates || [];
    const allGates = [...routeGates, ...assignmentGates];

    for (const item of allGates) {
      const gate = item?.gate;
      const gateId = gate?.id || item?.gateId;
      const subTasks = gate?.subTasks || item?.subTasks;

      if (gateId && Array.isArray(subTasks) && subTasks.length > 0) {
        sqliteDb.insertSync('checkpoint_subtasks', gateId, subTasks);
        const byRole: Record<string, any[]> = {};
        for (const st of subTasks) {
          const r = st.role || 'ALL';
          if (!byRole[r]) byRole[r] = [];
          byRole[r].push(st);
        }
        for (const [r, tasks] of Object.entries(byRole)) {
          sqliteDb.insertSync('checkpoint_subtasks', `${gateId}_${r}`, tasks);
        }
      }
    }
  }
}

export const assignmentApi = {
  getActiveAssignment: async (): Promise<GuardAssignment | null> => {
    try {
      const res = (await apiClient.get('/assignments/active')) as any;
      const data = (res && res.data !== undefined) ? res.data : (res ?? null);
      if (data) {
        await sqliteDb.insert('assignments', 'active_single', data);
        cacheAssignmentSubTasks(data);
      }
      return data;
    } catch (err: any) {
      if (err.response?.status === 404) {
        return null;
      }
      // Offline fallback: return cached assignment if available
      const cached = await sqliteDb.get<GuardAssignment>('assignments', 'active_single');
      if (cached) {
        console.log('[assignmentApi] Retrieved active assignment from offline cache');
        return cached;
      }
      const cachedList = await sqliteDb.get<GuardAssignment[]>('assignments', 'active_list');
      if (cachedList && Array.isArray(cachedList) && cachedList.length > 0) {
        console.log('[assignmentApi] Retrieved active assignment from active_list cache');
        return cachedList[0];
      }
      return null;
    }
  },

  getActiveAssignments: async (): Promise<GuardAssignment[]> => {
    try {
      const res = (await apiClient.get('/assignments/active-list')) as any;
      const rawList = (res && res.data !== undefined) ? res.data : res;
      const list = Array.isArray(rawList) ? rawList : [];
      if (list.length > 0) {
        await sqliteDb.insert('assignments', 'active_list', list);
        cacheAssignmentSubTasks(list);
      }
      return list;
    } catch (err: any) {
      if (err.response?.status === 404) {
        return [];
      }
      // Offline fallback: return cached assignments list if available
      const cached = await sqliteDb.get<GuardAssignment[]>('assignments', 'active_list');
      if (cached && Array.isArray(cached) && cached.length > 0) {
        console.log(`[assignmentApi] Retrieved ${cached.length} assignments from offline cache`);
        return cached;
      }
      console.warn('[assignmentApi] No cached assignments found for offline use');
      return [];
    }
  },
};
