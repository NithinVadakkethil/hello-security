import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { useAuthStore } from '../../../app/store/auth-store';
import { useTheme } from '../../../app/hooks/useTheme';
import { performLogout } from '../../../app/utils/logout';
import { useQueryClient } from '@tanstack/react-query';
import { useOfflineStore } from '../../../app/store/offline-store';
import { Card } from '../../dashboard/components/WidgetCard';
import { LogOut, User, Shield, Key, RefreshCw, Database } from 'lucide-react-native';

import { getRoleConfig } from '../../../app/utils/role-helpers';

export function ProfileScreen() {
  const { colors } = useTheme();
  const user = useAuthStore((state) => state.user);
  const queue = useOfflineStore((state) => state.queue);
  const isOnline = useOfflineStore((state) => state.isConnected);
  const queryClient = useQueryClient();
  const [loggingOut, setLoggingOut] = useState(false);

  const empRole = (user as any)?.employee?.role || user?.role || 'SECURITY';
  const roleObj = getRoleConfig(empRole);
  const RoleIcon = roleObj.icon;

  const handleLogout = () => {
    Alert.alert(
      'Confirm Logout',
      'Are you sure you want to end your active session? This will safely clear your cache.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Log Out',
          style: 'destructive',
          onPress: async () => {
            setLoggingOut(true);
            try {
              await performLogout(queryClient);
            } catch (err: any) {
              console.warn('[ProfileScreen] Logout fallback:', err);
              useAuthStore.getState().clearAuth();
            } finally {
              setLoggingOut(false);
            }
          },
        },
      ]
    );
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]} contentContainerStyle={styles.scrollContent}>
      
      {/* Header Profile Card */}
      <View style={styles.header}>
        <View style={[styles.avatar, { backgroundColor: roleObj.color }]}>
          <Text style={styles.avatarText}>
            {user?.firstName?.substring(0, 1).toUpperCase()}
            {user?.lastName?.substring(0, 1).toUpperCase()}
          </Text>
        </View>
        <Text style={[styles.name, { color: colors.text }]}>
          {user?.firstName} {user?.lastName}
        </Text>
        <View style={[styles.roleBadge, { backgroundColor: roleObj.color + '22' }]}>
          <RoleIcon size={12} color={roleObj.color} style={{ marginRight: 4 }} />
          <Text style={[styles.roleText, { color: roleObj.color }]}>{roleObj.label}</Text>
        </View>
      </View>

      <Text style={[styles.sectionTitle, { color: colors.text }]}>Employee Information</Text>
      
      <Card style={styles.infoCard}>
        <View style={[styles.infoRow, { borderColor: colors.border }]}>
          <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Email Address</Text>
          <Text style={[styles.infoValue, { color: colors.text }]}>{user?.email}</Text>
        </View>
        <View style={[styles.infoRow, { borderColor: colors.border }]}>
          <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Account ID</Text>
          <Text style={[styles.infoValue, { color: colors.text }]}>{user?.id}</Text>
        </View>
        <View style={[styles.infoRow, { borderColor: colors.border, borderBottomWidth: 0 }]}>
          <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>System Status</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={[styles.dot, { backgroundColor: isOnline ? colors.success : colors.danger }]} />
            <Text style={[styles.infoValue, { color: colors.text, marginLeft: 6 }]}>
              {isOnline ? 'Online' : 'Offline Mode'}
            </Text>
          </View>
        </View>
      </Card>

      <Text style={[styles.sectionTitle, { color: colors.text }]}>Sync & Storage</Text>
      
      <Card style={styles.infoCard}>
        <View style={[styles.infoRow, { borderColor: colors.border }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Database size={16} color={colors.textSecondary} style={{ marginRight: 8 }} />
            <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Pending Sync Requests</Text>
          </View>
          <Text style={[styles.infoValue, { color: colors.text, fontWeight: '800' }]}>
            {queue.length} items
          </Text>
        </View>
        <View style={[styles.infoRow, { borderColor: colors.border, borderBottomWidth: 0 }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Key size={16} color={colors.textSecondary} style={{ marginRight: 8 }} />
            <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Session Auth Tokens</Text>
          </View>
          <Text style={[styles.infoValue, { color: colors.success }]}>Active & Encrypted</Text>
        </View>
      </Card>

      {/* Logout Action Button */}
      <TouchableOpacity
        style={[styles.logoutButton, { backgroundColor: colors.danger }]}
        onPress={handleLogout}
        disabled={loggingOut}
      >
        {loggingOut ? (
          <ActivityIndicator color="#ffffff" />
        ) : (
          <>
            <LogOut size={18} color="#ffffff" style={{ marginRight: 8 }} />
            <Text style={styles.logoutButtonText}>Disconnect Session</Text>
          </>
        )}
      </TouchableOpacity>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  header: {
    alignItems: 'center',
    marginVertical: 24,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 4,
  },
  avatarText: {
    color: '#ffffff',
    fontSize: 26,
    fontWeight: '800',
  },
  name: {
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 6,
  },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  roleText: {
    fontSize: 11,
    fontWeight: '700',
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginTop: 18,
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  infoCard: {
    paddingVertical: 4,
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  infoCardContent: {
    // empty placeholder
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  infoLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  infoValue: {
    fontSize: 13,
    fontWeight: '700',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  logoutButton: {
    flexDirection: 'row',
    height: 48,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  logoutButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
});
