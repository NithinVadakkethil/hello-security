import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  RefreshControl,
  Image,
  Modal,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import {
  ClipboardList,
  ShieldAlert,
  Wrench,
  Search,
  Calendar,
  Clock,
  MapPin,
  ChevronRight,
  X,
  Camera,
} from 'lucide-react-native';
import { useTheme } from '../../../app/hooks/useTheme';
import { apiClient } from '../../../app/api/api-client';
import { Card } from '../../dashboard/components/WidgetCard';

export function HistoryScreen() {
  const { colors } = useTheme();
  const [activeTab, setActiveTab] = useState<'PATROLS' | 'INCIDENTS' | 'SNAGS'>('PATROLS');
  const [dateFilter, setDateFilter] = useState<'TODAY' | 'YESTERDAY' | 'WEEK' | 'ALL'>('TODAY');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedItem, setSelectedItem] = useState<any | null>(null);

  // Fetch Patrols History
  const {
    data: patrolsRes,
    isLoading: isLoadingPatrols,
    refetch: refetchPatrols,
    isRefetching: isRefetchingPatrols,
  } = useQuery({
    queryKey: ['history-patrols'],
    queryFn: async () => {
      const res = (await apiClient.get('/patrol-sessions?limit=50')) as any;
      return res.data?.items || res.data || [];
    },
  });

  // Fetch Incidents History
  const {
    data: incidentsRes,
    isLoading: isLoadingIncidents,
    refetch: refetchIncidents,
    isRefetching: isRefetchingIncidents,
  } = useQuery({
    queryKey: ['history-incidents'],
    queryFn: async () => {
      const res = (await apiClient.get('/incidents?limit=50')) as any;
      return res.data?.items || res.data || [];
    },
  });

  // Fetch Snags History
  const {
    data: snagsRes,
    isLoading: isLoadingSnags,
    refetch: refetchSnags,
    isRefetching: isRefetchingSnags,
  } = useQuery({
    queryKey: ['history-snags'],
    queryFn: async () => {
      const res = (await apiClient.get('/snags?limit=50')) as any;
      return res.data?.items || res.data || [];
    },
  });

  const isLoading = isLoadingPatrols || isLoadingIncidents || isLoadingSnags;
  const isRefreshing = isRefetchingPatrols || isRefetchingIncidents || isRefetchingSnags;

  const onRefresh = () => {
    refetchPatrols();
    refetchIncidents();
    refetchSnags();
  };

  const filterByDate = React.useCallback(
    (dateStr?: string) => {
      if (!dateStr) return true;
      const itemDate = new Date(dateStr);
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      if (dateFilter === 'TODAY') {
        return itemDate >= todayStart;
      }
      if (dateFilter === 'YESTERDAY') {
        const yesterdayStart = new Date(todayStart);
        yesterdayStart.setDate(yesterdayStart.getDate() - 1);
        return itemDate >= yesterdayStart && itemDate < todayStart;
      }
      if (dateFilter === 'WEEK') {
        const weekStart = new Date(todayStart);
        weekStart.setDate(weekStart.getDate() - 7);
        return itemDate >= weekStart;
      }
      return true;
    },
    [dateFilter],
  );

  const rawList = React.useMemo(() => {
    return activeTab === 'PATROLS'
      ? patrolsRes || []
      : activeTab === 'INCIDENTS'
      ? incidentsRes || []
      : snagsRes || [];
  }, [activeTab, patrolsRes, incidentsRes, snagsRes]);

  const filteredList = React.useMemo(() => {
    return rawList.filter((item: any) => {
      const dateMatch = filterByDate(item.createdAt || item.startedAt);
      if (!dateMatch) return false;
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      const site = (item.assignment?.site?.name || item.site?.name || '').toLowerCase();
      const code = (item.patrolCode || item.incidentCode || item.snagCode || '').toLowerCase();
      const title = (item.title || item.description || item.remarks || '').toLowerCase();
      return site.includes(q) || code.includes(q) || title.includes(q);
    });
  }, [rawList, filterByDate, searchQuery]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Top Tab Bar */}
      <View style={[styles.tabBar, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'PATROLS' && { backgroundColor: colors.primary + '20', borderColor: colors.primary }]}
          onPress={() => setActiveTab('PATROLS')}
        >
          <ClipboardList size={16} color={activeTab === 'PATROLS' ? colors.primary : colors.textSecondary} />
          <Text style={[styles.tabText, { color: activeTab === 'PATROLS' ? colors.primary : colors.textSecondary }]}>
            Patrols
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'INCIDENTS' && { backgroundColor: colors.danger + '20', borderColor: colors.danger }]}
          onPress={() => setActiveTab('INCIDENTS')}
        >
          <ShieldAlert size={16} color={activeTab === 'INCIDENTS' ? colors.danger : colors.textSecondary} />
          <Text style={[styles.tabText, { color: activeTab === 'INCIDENTS' ? colors.danger : colors.textSecondary }]}>
            Incidents
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'SNAGS' && { backgroundColor: colors.warning + '20', borderColor: colors.warning }]}
          onPress={() => setActiveTab('SNAGS')}
        >
          <Wrench size={16} color={activeTab === 'SNAGS' ? colors.warning : colors.textSecondary} />
          <Text style={[styles.tabText, { color: activeTab === 'SNAGS' ? colors.warning : colors.textSecondary }]}>
            Snags
          </Text>
        </TouchableOpacity>
      </View>

      {/* Date Filter & Search Bar */}
      <View style={styles.filterSection}>
        <View style={[styles.searchBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Search size={16} color={colors.textSecondary} />
          <TextInput
            placeholder={`Search ${activeTab.toLowerCase()}...`}
            placeholderTextColor={colors.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
            style={[styles.searchInput, { color: colors.text }]}
          />
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dateRow}>
          {[
            { key: 'TODAY', label: 'Today' },
            { key: 'YESTERDAY', label: 'Yesterday' },
            { key: 'WEEK', label: 'This Week' },
            { key: 'ALL', label: 'All History' },
          ].map((df) => (
            <TouchableOpacity
              key={df.key}
              onPress={() => setDateFilter(df.key as any)}
              style={[
                styles.datePill,
                {
                  backgroundColor: dateFilter === df.key ? colors.primary : colors.surface,
                  borderColor: dateFilter === df.key ? colors.primary : colors.border,
                },
              ]}
            >
              <Text
                style={[
                  styles.datePillText,
                  { color: dateFilter === df.key ? '#fff' : colors.textSecondary },
                ]}
              >
                {df.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Main List */}
      <ScrollView
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} colors={[colors.primary]} />}
      >
        {filteredList.length === 0 ? (
          <Card style={styles.emptyCard}>
            <Calendar size={36} color={colors.textSecondary} style={{ alignSelf: 'center', marginBottom: 8 }} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>No records found</Text>
            <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
              There are no logged {activeTab.toLowerCase()} for the selected date filter.
            </Text>
          </Card>
        ) : (
          filteredList.map((item: any) => {
            const dateVal = item.createdAt || item.startedAt;
            const formattedDate = dateVal ? new Date(dateVal).toLocaleDateString() : 'N/A';
            const formattedTime = dateVal ? new Date(dateVal).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'N/A';
            const siteName = item.assignment?.site?.name || item.site?.name || 'Site Location';
            const code = item.patrolCode || item.incidentCode || item.snagCode || item.id?.substring(0, 8);
            const status = item.status || 'LOGGED';

            return (
              <TouchableOpacity key={item.id} onPress={() => setSelectedItem(item)}>
                <Card style={[styles.card, { borderColor: colors.border }]}>
                  <View style={styles.cardHeader}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.code, { color: colors.primary }]}>{code}</Text>
                      <Text style={[styles.site, { color: colors.text }]}>{siteName}</Text>
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: colors.primary + '20' }]}>
                      <Text style={[styles.statusText, { color: colors.primary }]}>{status}</Text>
                    </View>
                  </View>

                  <View style={[styles.divider, { backgroundColor: colors.border }]} />

                  <View style={styles.cardFooter}>
                    <View style={styles.metaItem}>
                      <Calendar size={13} color={colors.textSecondary} />
                      <Text style={[styles.metaText, { color: colors.textSecondary }]}>{formattedDate}</Text>
                    </View>
                    <View style={styles.metaItem}>
                      <Clock size={13} color={colors.textSecondary} />
                      <Text style={[styles.metaText, { color: colors.textSecondary }]}>{formattedTime}</Text>
                    </View>
                    <ChevronRight size={16} color={colors.textSecondary} />
                  </View>
                </Card>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>

      {/* Read-Only Details Modal */}
      {selectedItem && (
        <Modal visible animationType="slide" transparent>
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { color: colors.text }]}>
                  {activeTab === 'PATROLS' ? 'Patrol Record' : activeTab === 'INCIDENTS' ? 'Incident Detail' : 'Snag Ticket'}
                </Text>
                <TouchableOpacity onPress={() => setSelectedItem(null)}>
                  <X size={22} color={colors.text} />
                </TouchableOpacity>
              </View>

              <ScrollView style={{ paddingVertical: 12 }}>
                <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Reference Code</Text>
                <Text style={[styles.detailVal, { color: colors.primary }]}>
                  {selectedItem.patrolCode || selectedItem.incidentCode || selectedItem.snagCode || selectedItem.id}
                </Text>

                <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Site Location</Text>
                <Text style={[styles.detailVal, { color: colors.text }]}>
                  {selectedItem.assignment?.site?.name || selectedItem.site?.name || 'N/A'}
                </Text>

                <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Status</Text>
                <Text style={[styles.detailVal, { color: colors.text }]}>{selectedItem.status || 'COMPLETED'}</Text>

                {(selectedItem.description || selectedItem.remarks || selectedItem.notes) && (
                  <>
                    <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Remarks / Description</Text>
                    <Text style={[styles.detailVal, { color: colors.text }]}>
                      {selectedItem.description || selectedItem.remarks || selectedItem.notes}
                    </Text>
                  </>
                )}
              </ScrollView>
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  tabBar: {
    flexDirection: 'row',
    padding: 10,
    borderBottomWidth: 1,
    gap: 8,
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'transparent',
    gap: 6,
  },
  tabText: {
    fontSize: 12,
    fontWeight: '700',
  },
  filterSection: {
    padding: 12,
    gap: 10,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    height: 42,
    borderRadius: 10,
    borderWidth: 1,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
  },
  dateRow: {
    gap: 8,
  },
  datePill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  datePillText: {
    fontSize: 11,
    fontWeight: '600',
  },
  listContent: {
    padding: 12,
    gap: 12,
  },
  card: {
    padding: 14,
    borderRadius: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  code: {
    fontSize: 11,
    fontWeight: '800',
  },
  site: {
    fontSize: 14,
    fontWeight: '700',
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '700',
  },
  divider: {
    height: 1,
    marginVertical: 10,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 11,
  },
  emptyCard: {
    padding: 30,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  emptySubtitle: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  detailLabel: {
    fontSize: 11,
    fontWeight: '700',
    marginTop: 12,
  },
  detailVal: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 2,
  },
});
