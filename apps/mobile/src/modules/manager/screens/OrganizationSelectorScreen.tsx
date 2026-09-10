import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Image,
  RefreshControl,
  Alert,
} from 'react-native';
import { useTheme } from '../../../app/hooks/useTheme';
import { useManagerStore, ManagerClient } from '../store/manager-store';
import { usePatrolStore } from '../../patrol/store/patrol-store';
import { apiClient } from '../../../app/api/api-client';
import { Building2, ChevronRight, ShieldCheck, LogOut } from 'lucide-react-native';
import { useAuth } from '../../auth/hooks/useAuth';

interface Props {
  onSelectClient?: (client: ManagerClient) => void;
}

export function OrganizationSelectorScreen({ onSelectClient }: Props) {
  const { colors } = useTheme();
  const { logout } = useAuth();
  const { assignedClients, setAssignedClients, setActiveClient } = useManagerStore();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchClients = async () => {
    try {
      setError(null);
      const res: any = await apiClient.get('/manager/clients');
      const clientsList: ManagerClient[] = Array.isArray(res?.data)
        ? res.data
        : Array.isArray(res)
        ? res
        : [];

      setAssignedClients(clientsList);

      // If only 1 organization assigned, select it automatically if desired
      if (clientsList.length === 1 && onSelectClient) {
        setActiveClient(clientsList[0]);
        onSelectClient(clientsList[0]);
      }
    } catch (err: any) {
      console.error('[OrganizationSelector] Failed to fetch manager clients:', err);
      const errorMessage =
        err.response?.data?.error?.message ||
        err.message ||
        'Unable to load your assigned organizations. Please try again.';
      setError(errorMessage);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchClients();
  }, []);

  const handleSelect = (client: ManagerClient) => {
    const activeSession = usePatrolStore.getState().activeSession;
    const currentClient = useManagerStore.getState().activeClient;

    if (
      activeSession &&
      activeSession.status === 'IN_PROGRESS' &&
      activeSession.clientId &&
      activeSession.clientId !== client.clientId
    ) {
      const clientName = currentClient?.companyName || 'your current organization';
      Alert.alert(
        'Active Manager Patrol',
        `You have an active Manager patrol for ${clientName}. Finish the current sweep before switching organizations.`,
        [{ text: 'OK', style: 'default' }],
      );
      return;
    }

    setActiveClient(client);
    if (onSelectClient) {
      onSelectClient(client);
    }
  };

  const renderClientItem = ({ item }: { item: ManagerClient }) => (
    <TouchableOpacity
      style={[
        styles.card,
        { backgroundColor: colors.surface, borderColor: colors.border },
      ]}
      activeOpacity={0.7}
      onPress={() => handleSelect(item)}
    >
      <View style={styles.cardHeader}>
        <View style={[styles.iconContainer, { backgroundColor: colors.primary + '15' }]}>
          {item.clientLogoUrl ? (
            <Image
              source={{ uri: item.clientLogoUrl }}
              style={styles.logoImage}
              resizeMode="contain"
            />
          ) : (
            <Building2 size={24} color={colors.primary} />
          )}
        </View>

        <View style={styles.clientInfo}>
          <Text style={[styles.companyName, { color: colors.text }]}>
            {item.companyName}
          </Text>
          <Text style={[styles.clientCode, { color: colors.textSecondary }]}>
            Code: {item.clientCode} • {item.siteCount} Site{item.siteCount === 1 ? '' : 's'}
          </Text>
        </View>

        <ChevronRight size={20} color={colors.textSecondary} />
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <View style={styles.headerLeft}>
          <View style={[styles.badge, { backgroundColor: colors.primary + '20' }]}>
            <ShieldCheck size={18} color={colors.primary} />
          </View>

          <View>
            <Text style={[styles.title, { color: colors.text }]}>Select Organization</Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              Choose client context for monitoring & inspection
            </Text>
          </View>
        </View>

        <TouchableOpacity onPress={logout} style={styles.logoutBtn}>
          <LogOut size={20} color={colors.danger || '#ef4444'} />
        </TouchableOpacity>
      </View>

      {/* Content */}
      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
            Loading assigned organizations...
          </Text>
        </View>
      ) : error ? (
        <View style={styles.centerContainer}>
          <Text style={[styles.errorText, { color: colors.danger }]}>{error}</Text>
          <TouchableOpacity
            style={[styles.retryBtn, { backgroundColor: colors.primary }]}
            onPress={() => {
              setLoading(true);
              fetchClients();
            }}
          >
            <Text style={styles.retryBtnText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : assignedClients.length === 0 ? (
        <View style={styles.centerContainer}>
          <Building2 size={48} color={colors.textSecondary} />
          <Text style={[styles.emptyTitle, { color: colors.text }]}>
            No Organizations Assigned
          </Text>
          <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
            No organizations are currently assigned to your Manager account. Please contact your Client Administrator.
          </Text>
          <TouchableOpacity
            style={[styles.retryBtn, { backgroundColor: colors.primary, marginTop: 16 }]}
            onPress={() => {
              setLoading(true);
              fetchClients();
            }}
          >
            <Text style={styles.retryBtnText}>Refresh Organizations</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={assignedClients}
          keyExtractor={(item) => item.clientId}
          renderItem={renderClientItem}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                fetchClients();
              }}
              colors={[colors.primary]}
            />
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  badge: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
  },
  subtitle: {
    fontSize: 12,
  },
  logoutBtn: {
    padding: 8,
  },
  listContent: {
    padding: 16,
    gap: 12,
  },
  card: {
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
    overflow: 'hidden',
  },
  logoImage: {
    width: 32,
    height: 32,
  },
  clientInfo: {
    flex: 1,
  },
  companyName: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  clientCode: {
    fontSize: 12,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
  },
  errorText: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 16,
  },
  retryBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryBtnText: {
    color: '#ffffff',
    fontWeight: '700',
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
});
