import React, { useState, useMemo, useCallback } from 'react';
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
  SafeAreaView,
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
  User,
  FileText,
  AlertCircle,
  HelpCircle,
  Building,
} from 'lucide-react-native';
import { useTheme } from '../../../app/hooks/useTheme';
import { apiClient } from '../../../app/api/api-client';
import { formatPatrolDate, formatPatrolTime } from '../../../app/utils/date-formatter';
import { getEmployeeDisplayName } from '../../../app/utils/user-helpers';
import { Config } from '../../../app/config';
import { Card } from '../../dashboard/components/WidgetCard';

const resolveImageUrl = (url?: string) => {
  if (!url) return null;
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) {
    return url;
  }
  const baseUrl = Config.API_URL.replace(/\/api\/v1\/?$/, '');
  return `${baseUrl}${url.startsWith('/') ? '' : '/'}${url}`;
};

export function parseIncidentDetails(item: any) {
  if (!item) return null;

  const desc = item.description || item.remarks || '';
  const isSubtaskFailure =
    desc.includes('Sub-Task Answer:') ||
    desc.includes('Task Description:') ||
    (Boolean(item.patrolSessionId) && (desc.includes('Sub-Task') || (item.type && item.type.includes('?'))));

  let source = isSubtaskFailure ? 'Subtask Failure' : 'Independent Incident';
  let question: string | null = null;
  let answer: string | null = null;
  let cleanRemarks: string = desc;

  if (isSubtaskFailure) {
    answer = 'NO';
    if (item.type && item.type !== 'Verification Sub-Task') {
      question = item.type;
    }

    const subtaskMatch = desc.match(/Sub-Task Answer:\s*NO\s*\((.*?)\)/i);
    if (subtaskMatch && subtaskMatch[1]) {
      question = subtaskMatch[1].trim();
    }

    const remarksMatch = desc.match(/Remarks:\s*([^\n]+)/i);
    if (remarksMatch && remarksMatch[1]) {
      const extracted = remarksMatch[1].trim();
      if (extracted.toLowerCase() !== 'no remarks provided' && extracted.toLowerCase() !== 'n/a') {
        cleanRemarks = extracted;
      } else {
        cleanRemarks = 'No remarks provided';
      }
    } else {
      const lines = desc
        .split('\n')
        .filter(
          (l: string) =>
            !l.startsWith('Sub-Task Answer:') &&
            !l.startsWith('Task Description:') &&
            !l.startsWith('Officer Role:') &&
            !l.startsWith('Checkpoint:') &&
            !l.startsWith('Patrol Session:'),
        )
        .map((l: string) => l.replace(/^Remarks:\s*/i, '').trim())
        .filter(Boolean);
      cleanRemarks = lines.join('\n') || 'No remarks provided';
    }
  }

  // Location details
  const gateName = item.gate?.name || null;
  const gateCode = item.gate?.gateCode || null;
  const siteName = item.gate?.site?.name || item.patrolSession?.assignment?.site?.name || item.site?.name || null;

  let fallbackGateName = gateName;
  let fallbackGateCode = gateCode;
  if (!fallbackGateName || !fallbackGateCode) {
    const checkpointMatch = desc.match(/Checkpoint:\s*(.*?)\s*\((.*?)\)/i);
    if (checkpointMatch) {
      if (!fallbackGateName) fallbackGateName = checkpointMatch[1].trim();
      if (!fallbackGateCode) fallbackGateCode = checkpointMatch[2].trim();
    }
  }

  // Patrol session
  let patrolSessionCode = item.patrolSession?.patrolCode || null;
  if (!patrolSessionCode) {
    const psMatch = desc.match(/Patrol Session:\s*([^\n]+)/i);
    if (psMatch && psMatch[1]) {
      patrolSessionCode = psMatch[1].trim();
    }
  }

  // Officer details
  const officerName = getEmployeeDisplayName(item);
  const employeeCode = item.employee?.employeeCode || null;
  const rawRole = item.employee?.role || null;
  let roleFormatted = 'Security Guard';
  if (rawRole) {
    if (['SECURITY', 'GUARD', 'SECURITY_GUARD'].includes(rawRole.toUpperCase())) {
      roleFormatted = 'Security Guard';
    } else if (rawRole.toUpperCase() === 'SUPERVISOR') {
      roleFormatted = 'Supervisor';
    } else if (rawRole.toUpperCase() === 'MANAGER') {
      roleFormatted = 'Property Manager';
    } else {
      roleFormatted = rawRole;
    }
  }

  // Images
  const rawImages = Array.isArray(item.images) && item.images.length > 0 ? item.images : item.imageUrl ? [item.imageUrl] : [];

  return {
    referenceCode: item.incidentCode || item.id,
    source,
    question: question || (isSubtaskFailure ? item.type || 'Verification Sub-Task' : null),
    answer: isSubtaskFailure ? 'NO' : null,
    remarks: cleanRemarks,
    checkpointName: fallbackGateName || '—',
    gateCode: fallbackGateCode || '—',
    siteName: siteName || '—',
    officerName: officerName && officerName !== 'User' ? officerName : item.employee?.name || '—',
    employeeCode: employeeCode || '—',
    role: roleFormatted,
    patrolSessionCode: patrolSessionCode || '—',
    images: rawImages,
    status: item.status || 'OPEN',
    createdAt: item.createdAt,
  };
}

export function HistoryScreen() {
  const { colors } = useTheme();
  const [activeTab, setActiveTab] = useState<'PATROLS' | 'INCIDENTS' | 'SNAGS'>('PATROLS');
  const [dateFilter, setDateFilter] = useState<'TODAY' | 'YESTERDAY' | 'WEEK' | 'ALL'>('TODAY');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedItem, setSelectedItem] = useState<any | null>(null);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);

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

  const filterByDate = useCallback(
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

  const rawList = useMemo(() => {
    return activeTab === 'PATROLS'
      ? patrolsRes || []
      : activeTab === 'INCIDENTS'
      ? incidentsRes || []
      : snagsRes || [];
  }, [activeTab, patrolsRes, incidentsRes, snagsRes]);

  const filteredList = useMemo(() => {
    return rawList.filter((item: any) => {
      const dateMatch = filterByDate(item.createdAt || item.startedAt);
      if (!dateMatch) return false;
      if (!searchQuery.trim()) return true;

      const q = searchQuery.toLowerCase();

      if (activeTab === 'INCIDENTS') {
        const parsed = parseIncidentDetails(item);
        const refCode = (parsed?.referenceCode || '').toLowerCase();
        const cpName = (parsed?.checkpointName || '').toLowerCase();
        const gCode = (parsed?.gateCode || '').toLowerCase();
        const sName = (parsed?.siteName || '').toLowerCase();
        const rem = (parsed?.remarks || '').toLowerCase();
        const offName = (parsed?.officerName || '').toLowerCase();

        return (
          refCode.includes(q) ||
          cpName.includes(q) ||
          gCode.includes(q) ||
          sName.includes(q) ||
          rem.includes(q) ||
          offName.includes(q)
        );
      }

      const site = (item.assignment?.site?.name || item.site?.name || '').toLowerCase();
      const code = (item.patrolCode || item.incidentCode || item.snagCode || '').toLowerCase();
      const title = (item.title || item.description || item.remarks || '').toLowerCase();
      return site.includes(q) || code.includes(q) || title.includes(q);
    });
  }, [rawList, filterByDate, searchQuery, activeTab]);

  const parsedIncident = useMemo(() => {
    if (activeTab !== 'INCIDENTS' || !selectedItem) return null;
    return parseIncidentDetails(selectedItem);
  }, [activeTab, selectedItem]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Top Tab Bar */}
      <View style={[styles.tabBar, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <TouchableOpacity
          style={[
            styles.tabButton,
            activeTab === 'PATROLS' && { backgroundColor: colors.primary + '20', borderColor: colors.primary },
          ]}
          onPress={() => setActiveTab('PATROLS')}
        >
          <ClipboardList size={16} color={activeTab === 'PATROLS' ? colors.primary : colors.textSecondary} />
          <Text style={[styles.tabText, { color: activeTab === 'PATROLS' ? colors.primary : colors.textSecondary }]}>
            Patrols
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.tabButton,
            activeTab === 'INCIDENTS' && { backgroundColor: colors.danger + '20', borderColor: colors.danger },
          ]}
          onPress={() => setActiveTab('INCIDENTS')}
        >
          <ShieldAlert size={16} color={activeTab === 'INCIDENTS' ? colors.danger : colors.textSecondary} />
          <Text style={[styles.tabText, { color: activeTab === 'INCIDENTS' ? colors.danger : colors.textSecondary }]}>
            Incidents
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.tabButton,
            activeTab === 'SNAGS' && { backgroundColor: colors.warning + '20', borderColor: colors.warning },
          ]}
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
            const formattedDate = formatPatrolDate(dateVal);
            const formattedTime = formatPatrolTime(dateVal, undefined, false);

            if (activeTab === 'INCIDENTS') {
              const incidentDetails = parseIncidentDetails(item);
              const refCode = incidentDetails?.referenceCode || item.id;
              const checkpointName = incidentDetails?.checkpointName || '—';
              const gateCode = incidentDetails?.gateCode || '—';
              const siteName = incidentDetails?.siteName || '—';
              const status = incidentDetails?.status || item.status || 'OPEN';

              return (
                <TouchableOpacity key={item.id} onPress={() => setSelectedItem(item)} activeOpacity={0.7}>
                  <Card style={[styles.card, { borderColor: colors.border }]}>
                    {/* Header Row */}
                    <View style={styles.cardHeader}>
                      <Text style={[styles.incidentCodeText, { color: colors.primary }]}>{refCode}</Text>
                      <View style={[styles.statusBadge, { backgroundColor: colors.danger + '20' }]}>
                        <Text style={[styles.statusText, { color: colors.danger }]}>{status.toUpperCase()}</Text>
                      </View>
                    </View>

                    {/* Checkpoint Name & Gate Code */}
                    <View style={styles.checkpointSection}>
                      <Text style={[styles.checkpointTitle, { color: colors.text }]}>{checkpointName}</Text>
                      {gateCode !== '—' && (
                        <Text style={[styles.gateCodeText, { color: colors.textSecondary }]}>{gateCode}</Text>
                      )}
                    </View>

                    {/* Site Location */}
                    <View style={styles.siteRow}>
                      <MapPin size={13} color={colors.primary} />
                      <Text style={[styles.siteNameText, { color: colors.textSecondary }]}>{siteName}</Text>
                    </View>

                    <View style={[styles.divider, { backgroundColor: colors.border }]} />

                    {/* Footer Row */}
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
            }

            // Patrols & Snags Tab Standard Card
            const siteName = item.assignment?.site?.name || item.site?.name || 'Site Location';
            const code = item.patrolCode || item.snagCode || item.id?.substring(0, 8);
            const status = item.status || 'LOGGED';

            return (
              <TouchableOpacity key={item.id} onPress={() => setSelectedItem(item)} activeOpacity={0.7}>
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

      {/* Incident Detail Bottom Sheet / Modal (90% Height) */}
      {selectedItem && (
        <Modal visible animationType="slide" transparent onRequestClose={() => setSelectedItem(null)}>
          <View style={styles.modalOverlay}>
            <SafeAreaView style={[styles.modalContent, { backgroundColor: colors.surface }]}>
              {/* Header */}
              <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
                <View>
                  <Text style={[styles.modalTitle, { color: colors.text }]}>
                    {activeTab === 'INCIDENTS'
                      ? 'INCIDENT DETAIL'
                      : activeTab === 'PATROLS'
                      ? 'PATROL RECORD'
                      : 'SNAG TICKET'}
                  </Text>
                  {parsedIncident && (
                    <Text style={[styles.modalSubTitle, { color: colors.primary }]}>
                      {parsedIncident.referenceCode}
                    </Text>
                  )}
                </View>
                <TouchableOpacity onPress={() => setSelectedItem(null)} style={styles.closeBtn}>
                  <X size={22} color={colors.text} />
                </TouchableOpacity>
              </View>

              {activeTab === 'INCIDENTS' && parsedIncident ? (
                <ScrollView
                  style={{ flex: 1 }}
                  contentContainerStyle={styles.sheetScrollContent}
                  showsVerticalScrollIndicator={false}
                >
                  {/* Status & Reference Header Card */}
                  <View style={[styles.detailSection, { backgroundColor: colors.background, borderColor: colors.border }]}>
                    <View style={styles.detailRowBetween}>
                      <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>Reference Code</Text>
                      <Text style={[styles.detailValueBold, { color: colors.primary }]}>
                        {parsedIncident.referenceCode}
                      </Text>
                    </View>
                    <View style={styles.detailRowBetween}>
                      <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>Status</Text>
                      <View style={[styles.statusBadge, { backgroundColor: colors.danger + '20' }]}>
                        <Text style={[styles.statusText, { color: colors.danger }]}>
                          {parsedIncident.status.toUpperCase()}
                        </Text>
                      </View>
                    </View>
                  </View>

                  {/* LOCATION SECTION */}
                  <Text style={[styles.groupHeader, { color: colors.textSecondary }]}>LOCATION</Text>
                  <View style={[styles.detailSection, { backgroundColor: colors.background, borderColor: colors.border }]}>
                    <View style={styles.fieldBlock}>
                      <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Site</Text>
                      <Text style={[styles.fieldValue, { color: colors.text }]}>{parsedIncident.siteName}</Text>
                    </View>

                    <View style={styles.fieldBlock}>
                      <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Checkpoint</Text>
                      <Text style={[styles.fieldValue, { color: colors.text }]}>{parsedIncident.checkpointName}</Text>
                    </View>

                    <View style={styles.fieldBlock}>
                      <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Gate Code</Text>
                      <Text style={[styles.fieldValue, { color: colors.text }]}>{parsedIncident.gateCode}</Text>
                    </View>
                  </View>

                  {/* REPORTED BY SECTION */}
                  <Text style={[styles.groupHeader, { color: colors.textSecondary }]}>REPORTED BY</Text>
                  <View style={[styles.detailSection, { backgroundColor: colors.background, borderColor: colors.border }]}>
                    <View style={styles.fieldBlock}>
                      <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Officer</Text>
                      <Text style={[styles.fieldValue, { color: colors.text }]}>{parsedIncident.officerName}</Text>
                    </View>

                    <View style={styles.fieldBlock}>
                      <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Employee Code</Text>
                      <Text style={[styles.fieldValue, { color: colors.text }]}>{parsedIncident.employeeCode}</Text>
                    </View>

                    <View style={styles.fieldBlock}>
                      <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Role</Text>
                      <Text style={[styles.fieldValue, { color: colors.text }]}>{parsedIncident.role}</Text>
                    </View>
                  </View>

                  {/* INCIDENT CONTEXT SECTION */}
                  <Text style={[styles.groupHeader, { color: colors.textSecondary }]}>INCIDENT CONTEXT</Text>
                  <View style={[styles.detailSection, { backgroundColor: colors.background, borderColor: colors.border }]}>
                    <View style={styles.fieldBlock}>
                      <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Source</Text>
                      <Text style={[styles.fieldValue, { color: colors.text }]}>{parsedIncident.source}</Text>
                    </View>

                    {parsedIncident.question && (
                      <View style={styles.fieldBlock}>
                        <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Question / Subtask</Text>
                        <Text style={[styles.fieldValue, { color: colors.text }]}>{parsedIncident.question}</Text>
                      </View>
                    )}

                    {parsedIncident.answer && (
                      <View style={styles.fieldBlock}>
                        <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Answer</Text>
                        <View style={[styles.answerBadge, { backgroundColor: colors.danger + '20' }]}>
                          <Text style={[styles.answerBadgeText, { color: colors.danger }]}>
                            {parsedIncident.answer}
                          </Text>
                        </View>
                      </View>
                    )}
                  </View>

                  {/* REMARKS SECTION */}
                  <Text style={[styles.groupHeader, { color: colors.textSecondary }]}>REMARKS</Text>
                  <View style={[styles.detailSection, { backgroundColor: colors.background, borderColor: colors.border }]}>
                    <Text style={[styles.remarksText, { color: colors.text }]}>{parsedIncident.remarks}</Text>
                  </View>

                  {/* EVIDENCE PHOTOS SECTION */}
                  <Text style={[styles.groupHeader, { color: colors.textSecondary }]}>EVIDENCE PHOTOS</Text>
                  <View style={[styles.detailSection, { backgroundColor: colors.background, borderColor: colors.border }]}>
                    {parsedIncident.images.length === 0 ? (
                      <Text style={[styles.emptyPhotoText, { color: colors.textSecondary }]}>
                        No evidence photos attached.
                      </Text>
                    ) : (
                      <View style={styles.imageGrid}>
                        {parsedIncident.images.map((imgUrl: string, idx: number) => {
                          const resolved = resolveImageUrl(imgUrl);
                          if (!resolved) return null;

                          return (
                            <TouchableOpacity
                              key={idx}
                              onPress={() => setPreviewImageUrl(resolved)}
                              activeOpacity={0.8}
                              style={styles.imageWrapper}
                            >
                              <Image source={{ uri: resolved }} style={styles.evidenceImage} resizeMode="cover" />
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    )}
                  </View>

                  {/* PATROL INFORMATION SECTION */}
                  <Text style={[styles.groupHeader, { color: colors.textSecondary }]}>PATROL INFORMATION</Text>
                  <View style={[styles.detailSection, { backgroundColor: colors.background, borderColor: colors.border }]}>
                    <View style={styles.fieldBlock}>
                      <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Patrol Session</Text>
                      <Text style={[styles.fieldValue, { color: colors.text }]}>{parsedIncident.patrolSessionCode}</Text>
                    </View>

                    <View style={styles.fieldBlock}>
                      <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Reported At</Text>
                      <Text style={[styles.fieldValue, { color: colors.text }]}>
                        {formatPatrolDate(parsedIncident.createdAt)}, {formatPatrolTime(parsedIncident.createdAt, undefined, false)}
                      </Text>
                    </View>
                  </View>
                </ScrollView>
              ) : (
                /* Fallback Patrol/Snags Read-Only Details */
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
              )}
            </SafeAreaView>
          </View>
        </Modal>
      )}

      {/* Full Screen Image Preview Modal */}
      {previewImageUrl && (
        <Modal visible animationType="fade" transparent onRequestClose={() => setPreviewImageUrl(null)}>
          <View style={styles.fullScreenImageOverlay}>
            <SafeAreaView style={styles.fullScreenHeader}>
              <TouchableOpacity onPress={() => setPreviewImageUrl(null)} style={styles.fullScreenCloseBtn}>
                <X size={26} color="#ffffff" />
              </TouchableOpacity>
            </SafeAreaView>
            <View style={styles.fullScreenImageContainer}>
              <Image source={{ uri: previewImageUrl }} style={styles.fullScreenImage} resizeMode="contain" />
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
    alignItems: 'center',
  },
  code: {
    fontSize: 11,
    fontWeight: '800',
  },
  incidentCodeText: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  site: {
    fontSize: 14,
    fontWeight: '700',
    marginTop: 2,
  },
  checkpointSection: {
    marginTop: 8,
  },
  checkpointTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  gateCodeText: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
  },
  siteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 6,
  },
  siteNameText: {
    fontSize: 13,
    fontWeight: '600',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '800',
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
    paddingHorizontal: 16,
    paddingTop: 16,
    height: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  modalSubTitle: {
    fontSize: 12,
    fontWeight: '700',
    marginTop: 2,
  },
  closeBtn: {
    padding: 4,
  },
  sheetScrollContent: {
    paddingVertical: 14,
    gap: 12,
  },
  groupHeader: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginTop: 6,
    marginBottom: -4,
  },
  detailSection: {
    borderRadius: 10,
    borderWidth: 1,
    padding: 12,
    gap: 10,
  },
  detailRowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  detailValueBold: {
    fontSize: 12,
    fontWeight: '800',
  },
  fieldBlock: {
    gap: 2,
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  fieldValue: {
    fontSize: 13,
    fontWeight: '700',
  },
  answerBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginTop: 2,
  },
  answerBadgeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  remarksText: {
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 18,
  },
  emptyPhotoText: {
    fontSize: 12,
    fontStyle: 'italic',
  },
  imageGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  imageWrapper: {
    width: '47%',
    aspectRatio: 1.3,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#000',
  },
  evidenceImage: {
    width: '100%',
    height: '100%',
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
  fullScreenImageOverlay: {
    flex: 1,
    backgroundColor: '#000000',
  },
  fullScreenHeader: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  fullScreenCloseBtn: {
    padding: 8,
  },
  fullScreenImageContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullScreenImage: {
    width: '100%',
    height: '100%',
  },
});
