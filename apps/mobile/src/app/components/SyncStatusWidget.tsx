import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useTheme } from '../hooks/useTheme';
import { useOfflineStore } from '../store/offline-store';
import { offlineSyncEngine } from '../services/offline-sync-engine';
import { Card } from '../../modules/dashboard/components/WidgetCard';

export function SyncStatusWidget() {
  const { colors } = useTheme();
  const {
    isConnected,
    queue,
    isSyncing,
    lastSyncTime,
    updateMutationStatus,
    dequeue,
  } = useOfflineStore();

  const failedItems = queue.filter((m) => m.status === 'failed');
  const pendingCount = queue.filter((m) => m.status === 'pending').length;
  const syncingCount = queue.filter((m) => m.status === 'syncing').length;

  const handleForceSync = () => {
    offlineSyncEngine.sync();
  };

  const handleRetryItem = async (id: string) => {
    await updateMutationStatus(id, 'pending', undefined, false);
    // Reset retry count in MMKV/local queue directly
    const item = queue.find((m) => m.id === id);
    if (item) {
      item.retryCount = 0;
    }
    offlineSyncEngine.sync();
  };

  const handleDiscardItem = async (id: string) => {
    await dequeue(id);
  };

  if (queue.length === 0 && isConnected) {
    return null; // Don't show anything if fully synchronized and online
  }

  return (
    <Card style={[styles.container, { borderColor: isConnected ? colors.border : colors.warning }]}>
      <View style={styles.header}>
        <View style={styles.statusRow}>
          <View style={[styles.dot, { backgroundColor: isConnected ? colors.success : colors.warning }]} />
          <Text style={[styles.statusText, { color: colors.text }]}>
            {isConnected ? 'Sync Engine: Online' : 'Sync Engine: Offline'}
          </Text>
        </View>

        {queue.length > 0 && !isSyncing && (
          <TouchableOpacity
            style={[styles.syncButton, { backgroundColor: colors.primary }]}
            onPress={handleForceSync}
          >
            <Text style={styles.syncButtonText}>Sync Now</Text>
          </TouchableOpacity>
        )}

        {isSyncing && <ActivityIndicator color={colors.primary} size="small" />}
      </View>

      {queue.length > 0 && (
        <View style={styles.stats}>
          <Text style={[styles.statText, { color: colors.textSecondary }]}>
            Pending: {pendingCount} | Syncing: {syncingCount} | Failed: {failedItems.length}
          </Text>
          {lastSyncTime && (
            <Text style={[styles.timeText, { color: colors.textSecondary }]}>
              Last Sync: {new Date(lastSyncTime).toLocaleTimeString()}
            </Text>
          )}
        </View>
      )}

      {/* Failed/Conflict Items List */}
      {failedItems.length > 0 && (
        <View style={styles.failedList}>
          <Text style={[styles.failedHeader, { color: colors.danger }]}>Attention Required (Errors / Conflicts):</Text>
          {failedItems.map((item) => (
            <View key={item.id} style={[styles.errorRow, { borderColor: colors.border }]}>
              <View style={styles.errorDetails}>
                <Text style={[styles.errorAction, { color: colors.text }]}>
                  {item.method} {item.url.split('?')[0]}
                </Text>
                {item.lastError && (
                  <Text style={[styles.errorMsg, { color: colors.danger }]}>
                    {item.lastError}
                  </Text>
                )}
                <Text style={[styles.retryText, { color: colors.textSecondary }]}>
                  Retries: {item.retryCount}/3
                </Text>
              </View>

              <View style={styles.errorActions}>
                <TouchableOpacity
                  style={[styles.actionButton, { backgroundColor: colors.success }]}
                  onPress={() => handleRetryItem(item.id)}
                >
                  <Text style={styles.actionBtnText}>Retry</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionButton, { backgroundColor: colors.danger }]}
                  onPress={() => handleDiscardItem(item.id)}
                >
                  <Text style={styles.actionBtnText}>Discard</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 14,
    borderWidth: 1.5,
    marginBottom: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8,
  },
  statusText: {
    fontSize: 13,
    fontWeight: '700',
  },
  syncButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  syncButtonText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
  },
  stats: {
    marginTop: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statText: {
    fontSize: 11,
    fontWeight: '600',
  },
  timeText: {
    fontSize: 11,
  },
  failedList: {
    marginTop: 14,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
    paddingTop: 10,
  },
  failedHeader: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 8,
  },
  errorRow: {
    borderWidth: 1,
    borderRadius: 6,
    padding: 10,
    marginBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  errorDetails: {
    flex: 0.72,
  },
  errorAction: {
    fontSize: 12,
    fontWeight: '700',
  },
  errorMsg: {
    fontSize: 11,
    marginTop: 4,
  },
  retryText: {
    fontSize: 10,
    marginTop: 4,
  },
  errorActions: {
    flexDirection: 'row',
    flex: 0.26,
    justifyContent: 'space-between',
  },
  actionButton: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 4,
    alignItems: 'center',
    width: '48%',
  },
  actionBtnText: {
    color: '#ffffff',
    fontSize: 9,
    fontWeight: '700',
  },
});
