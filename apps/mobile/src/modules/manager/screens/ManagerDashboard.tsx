import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  Image,
} from 'react-native';
import { useTheme } from '../../../app/hooks/useTheme';
import { useManagerStore } from '../store/manager-store';
import { apiClient } from '../../../app/api/api-client';
import {
  Building2,
  QrCode,
  Activity,
  CheckCircle2,
  MapPin,
  RefreshCw,
  Eye,
  Shield,
} from 'lucide-react-native';

interface DashboardStats {
  activePatrolsCount: number;
  completedTodayCount: number;
  sitesCount: number;
  checkpointsCount: number;
}

interface Props {
  onSwitchOrganization: () => void;
  onNavigateToScan: () => void;
  onNavigateToMonitoring: () => void;
  onNavigateToHistory: () => void;
}

export function ManagerDashboard({
  onSwitchOrganization,
  onNavigateToScan,
  onNavigateToMonitoring,
  onNavigateToHistory,
}: Props) {
  const { colors } = useTheme();
  const { activeClient } = useManagerStore();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchStats = async () => {
    if (!activeClient) return;
    try {
      const [activeRes, completedRes, sitesRes]: [any, any, any] = await Promise.all([
        apiClient.get(`/manager/clients/${activeClient.clientId}/active-patrols`),
        apiClient.get(`/manager/clients/${activeClient.clientId}/completed-patrols?limit=50`),
        apiClient.get(`/manager/clients/${activeClient.clientId}/sites`),
      ]);

      const activePatrols = Array.isArray(activeRes?.data) ? activeRes.data : Array.isArray(activeRes) ? activeRes : [];
      const completedPatrols = Array.isArray(completedRes?.data) ? completedRes.data : Array.isArray(completedRes) ? completedRes : [];
      const sites = Array.isArray(sitesRes?.data) ? sitesRes.data : Array.isArray(sitesRes) ? sitesRes : [];

      setStats({
        activePatrolsCount: activePatrols.length,
        completedTodayCount: completedPatrols.length,
        sitesCount: sites.length,
        checkpointsCount: sites.reduce(
          (acc: number, s: any) => acc + (s._count?.gates || 0),
          0,
        ),
      });
    } catch (err) {
      console.error('[ManagerDashboard] Failed to fetch stats:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, [activeClient?.clientId]);

  if (!activeClient) {
    return (
      <View style={[styles.centerContainer, { backgroundColor: colors.background }]}>
        <Building2 size={48} color={colors.textSecondary} />
        <Text style={[styles.title, { color: colors.text }]}>No Active Organization</Text>
        <TouchableOpacity
          style={[styles.switchBtn, { backgroundColor: colors.primary }]}
          onPress={onSwitchOrganization}
        >
          <Text style={styles.switchBtnText}>Select Organization</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.contentContainer}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            fetchStats();
          }}
          colors={[colors.primary]}
        />
      }
    >
      {/* Active Organization Banner */}
      <View style={[styles.banner, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.bannerLeft}>
          <View style={[styles.logoBox, { backgroundColor: colors.primary + '15' }]}>
            {activeClient.clientLogoUrl ? (
              <Image source={{ uri: activeClient.clientLogoUrl }} style={styles.logoImg} resizeMode="contain" />
            ) : (
              <Building2 size={22} color={colors.primary} />
            )}
          </View>

          <View style={styles.bannerInfo}>
            <View style={styles.roleBadgeRow}>
              <Shield size={12} color={colors.primary} />
              <Text style={[styles.roleBadgeText, { color: colors.primary }]}>MANAGER CONTEXT</Text>
            </View>
            <Text style={[styles.companyTitle, { color: colors.text }]} numberOfLines={1}>
              {activeClient.companyName}
            </Text>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.switchChip, { backgroundColor: colors.primary + '15' }]}
          onPress={onSwitchOrganization}
        >
          <RefreshCw size={14} color={colors.primary} />
          <Text style={[styles.switchChipText, { color: colors.primary }]}>Switch</Text>
        </TouchableOpacity>
      </View>

      {/* Main Scan Action Button */}
      <TouchableOpacity
        style={[styles.scanActionBtn, { backgroundColor: colors.primary }]}
        activeOpacity={0.85}
        onPress={onNavigateToScan}
      >
        <View style={styles.scanIconBox}>
          <QrCode size={28} color="#ffffff" />
        </View>
        <View style={styles.scanTextBox}>
          <Text style={styles.scanTitle}>Manager Checkpoint Scan</Text>
          <Text style={styles.scanSubtitle}>
            Scan any site checkpoint in {activeClient.companyName}
          </Text>
        </View>
      </TouchableOpacity>

      {/* Statistics Section */}
      <Text style={[styles.sectionHeading, { color: colors.text }]}>Organization Monitoring Overview</Text>

      {loading ? (
        <ActivityIndicator size="small" color={colors.primary} style={{ marginVertical: 20 }} />
      ) : (
        <View style={styles.statsGrid}>
          <TouchableOpacity
            style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
            activeOpacity={0.7}
            onPress={onNavigateToMonitoring}
          >
            <View style={[styles.statIconBox, { backgroundColor: 'rgba(59, 130, 246, 0.15)' }]}>
              <Activity size={20} color="#3b82f6" />
            </View>
            <Text style={[styles.statNumber, { color: colors.text }]}>
              {stats?.activePatrolsCount ?? 0}
            </Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Active Patrols</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
            activeOpacity={0.7}
            onPress={onNavigateToHistory}
          >
            <View style={[styles.statIconBox, { backgroundColor: 'rgba(34, 197, 94, 0.15)' }]}>
              <CheckCircle2 size={20} color="#22c55e" />
            </View>
            <Text style={[styles.statNumber, { color: colors.text }]}>
              {stats?.completedTodayCount ?? 0}
            </Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Completed Patrols</Text>
          </TouchableOpacity>

          <View style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={[styles.statIconBox, { backgroundColor: 'rgba(168, 85, 247, 0.15)' }]}>
              <MapPin size={20} color="#a855f7" />
            </View>
            <Text style={[styles.statNumber, { color: colors.text }]}>
              {stats?.sitesCount ?? 0}
            </Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
              Sites ({stats?.checkpointsCount ?? 0} Checkpoints)
            </Text>
          </View>
        </View>
      )}

      {/* Quick Navigation Cards */}
      <Text style={[styles.sectionHeading, { color: colors.text, marginTop: 20 }]}>
        Read-Only Patrol Monitoring
      </Text>

      <TouchableOpacity
        style={[styles.navCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
        activeOpacity={0.7}
        onPress={onNavigateToMonitoring}
      >
        <View style={[styles.navIconBox, { backgroundColor: 'rgba(59, 130, 246, 0.15)' }]}>
          <Eye size={20} color="#3b82f6" />
        </View>
        <View style={styles.navInfo}>
          <Text style={[styles.navTitle, { color: colors.text }]}>Live Patrol Monitoring</Text>
          <Text style={[styles.navDesc, { color: colors.textSecondary }]}>
            View real-time guard activity & checkpoint scans in progress
          </Text>
        </View>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.navCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
        activeOpacity={0.7}
        onPress={onNavigateToHistory}
      >
        <View style={[styles.navIconBox, { backgroundColor: 'rgba(34, 197, 94, 0.15)' }]}>
          <CheckCircle2 size={20} color="#22c55e" />
        </View>
        <View style={styles.navInfo}>
          <Text style={[styles.navTitle, { color: colors.text }]}>Completed Patrol History</Text>
          <Text style={[styles.navDesc, { color: colors.textSecondary }]}>
            Audit finished patrol sessions, remarks, photos, and responses
          </Text>
        </View>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 40,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    marginTop: 12,
  },
  switchBtn: {
    marginTop: 16,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  switchBtnText: {
    color: '#ffffff',
    fontWeight: '700',
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 16,
  },
  bannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 10,
  },
  logoBox: {
    width: 40,
    height: 40,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  logoImg: {
    width: 28,
    height: 28,
  },
  bannerInfo: {
    flex: 1,
  },
  roleBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 2,
  },
  roleBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  companyTitle: {
    fontSize: 15,
    fontWeight: '800',
  },
  switchChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  switchChipText: {
    fontSize: 12,
    fontWeight: '700',
  },
  scanActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 18,
    borderRadius: 16,
    marginBottom: 20,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
  scanIconBox: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  scanTextBox: {
    flex: 1,
  },
  scanTitle: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '800',
    marginBottom: 2,
  },
  scanSubtitle: {
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: 12,
  },
  sectionHeading: {
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 12,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  statCard: {
    flex: 1,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  statIconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  statNumber: {
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  navCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 10,
  },
  navIconBox: {
    width: 40,
    height: 40,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  navInfo: {
    flex: 1,
  },
  navTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 2,
  },
  navDesc: {
    fontSize: 12,
  },
});
