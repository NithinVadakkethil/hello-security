import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useQueryClient } from '@tanstack/react-query';
import {
  Camera,
  CheckCircle2,
  Clock,
  Database,
  Key,
  LogOut,
  XCircle,
} from 'lucide-react-native';
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useTheme } from '../../../app/hooks/useTheme';
import { useAuthStore } from '../../../app/store/auth-store';
import { useOfflineStore } from '../../../app/store/offline-store';
import { performLogout } from '../../../app/utils/logout';
import { getRoleConfig } from '../../../app/utils/role-helpers';
import { Card } from '../../dashboard/components/WidgetCard';
import {
  faceEnrollmentApi,
  FaceEnrollmentStatusData,
} from '../../face/api/face-enrollment.api';
import { secureFaceCache } from '../../face/services/secure-face-cache';

export function ProfileScreen() {
  const { colors } = useTheme();
  const user = useAuthStore(state => state.user);
  const queue = useOfflineStore(state => state.queue);
  const isOnline = useOfflineStore(state => state.isConnected);
  const queryClient = useQueryClient();
  const navigation = useNavigation<any>();

  const [loggingOut, setLoggingOut] = useState(false);
  const [faceStatus, setFaceStatus] = useState<FaceEnrollmentStatusData>({
    status: 'NOT_REGISTERED',
    registeredAt: null,
  });
  const [loadingStatus, setLoadingStatus] = useState(true);

  const empRole = (user as any)?.employee?.role || user?.role || 'SECURITY';
  const roleObj = getRoleConfig(empRole);
  const RoleIcon = roleObj.icon;

  const fetchFaceStatus = useCallback(async () => {
    setLoadingStatus(true);
    try {
      const data = await faceEnrollmentApi.getStatus();
      setFaceStatus(data);
    } catch (err) {
      console.warn(
        '[ProfileScreen] Could not fetch face enrollment status:',
        err,
      );
    } finally {
      setLoadingStatus(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchFaceStatus();
    }, [fetchFaceStatus]),
  );

  const handleReRegisterPress = () => {
    Alert.alert(
      'Re-Register Face Profile',
      'This will replace your current face registration. Do you want to continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Continue',
          style: 'destructive',
          onPress: () => navigation.navigate('FaceRegistration'),
        },
      ],
    );
  };

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
              // Clear local decrypted biometric template cache on logout
              await secureFaceCache.clearSecureCache();
              await performLogout(queryClient);
            } catch (err: any) {
              console.warn('[ProfileScreen] Logout fallback:', err);
              useAuthStore.getState().clearAuth();
            } finally {
              setLoggingOut(false);
            }
          },
        },
      ],
    );
  };

  const formatRegisteredDate = (dateStr: string | null) => {
    if (!dateStr) return '';
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  const isRegistered = faceStatus.status === 'REGISTERED';

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.scrollContent}
    >
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
        <View
          style={[styles.roleBadge, { backgroundColor: roleObj.color + '22' }]}
        >
          <RoleIcon
            size={12}
            color={roleObj.color}
            style={{ marginRight: 4 }}
          />
          <Text style={[styles.roleText, { color: roleObj.color }]}>
            {roleObj.label}
          </Text>
        </View>
      </View>

      {/* Production-Ready Face Recognition Section */}
      <Text style={[styles.sectionTitle, { color: colors.text }]}>
        Face Recognition
      </Text>

      <Card style={styles.infoCard}>
        <View style={[styles.infoRow, { borderColor: colors.border }]}>
          <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>
            Face Status
          </Text>
          {loadingStatus ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <View
              style={[
                styles.statusTag,
                { backgroundColor: isRegistered ? '#10B98122' : '#F59E0B22' },
              ]}
            >
              {isRegistered ? (
                <CheckCircle2
                  size={14}
                  color="#10B981"
                  style={{ marginRight: 4 }}
                />
              ) : (
                <XCircle size={14} color="#F59E0B" style={{ marginRight: 4 }} />
              )}
              <Text
                style={[
                  styles.statusTagText,
                  { color: isRegistered ? '#10B981' : '#F59E0B' },
                ]}
              >
                {isRegistered ? 'REGISTERED' : 'NOT REGISTERED'}
              </Text>
            </View>
          )}
        </View>

        {isRegistered && faceStatus.registeredAt ? (
          <View style={[styles.infoRow, { borderColor: colors.border }]}>
            <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>
              Registered On
            </Text>
            <Text style={[styles.infoValue, { color: colors.text }]}>
              {formatRegisteredDate(faceStatus.registeredAt)}
            </Text>
          </View>
        ) : null}

        {!isRegistered ? (
          <View style={styles.registrationPromptBox}>
            <Text style={[styles.promptText, { color: colors.textSecondary }]}>
              Face recognition is required for secure verification.
            </Text>
            <TouchableOpacity
              style={[
                styles.primaryActionBtn,
                { backgroundColor: colors.primary },
              ]}
              onPress={() => navigation.navigate('FaceRegistration')}
            >
              <Camera size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
              <Text style={styles.primaryActionBtnText}>Register Face</Text>
            </TouchableOpacity>
          </View>
        ) : (
          // <View style={styles.registeredActionsRow}>
          //   <TouchableOpacity
          //     style={[styles.secondaryActionBtn, { backgroundColor: colors.primary }]}
          //     onPress={() => navigation.navigate('FaceVerification')}
          //   >
          //     <ShieldCheck size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
          //     <Text style={styles.secondaryActionBtnText}>Verify Face</Text>
          //   </TouchableOpacity>

          //   <TouchableOpacity
          //     style={[styles.secondaryActionBtn, styles.outlineBtn, { borderColor: colors.border }]}
          //     onPress={handleReRegisterPress}
          //   >
          //     <RefreshCw size={16} color={colors.text} style={{ marginRight: 6 }} />
          //     <Text style={[styles.secondaryActionBtnText, { color: colors.text }]}>Re-Register</Text>
          //   </TouchableOpacity>
          // </View>
          ''
        )}
      </Card>

      {/* Attendance Quick Action */}
      <Text style={[styles.sectionTitle, { color: colors.text }]}>
        Attendance & Shifts
      </Text>
      <Card style={styles.infoCard}>
        <TouchableOpacity
          style={[
            styles.infoRow,
            {
              borderColor: colors.border,
              borderBottomWidth: 0,
              justifyContent: 'space-between',
            },
          ]}
          onPress={() => navigation.navigate('Attendance')}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Clock
              size={18}
              color={colors.primary}
              style={{ marginRight: 10 }}
            />
            <View>
              <Text
                style={[
                  styles.infoLabel,
                  { color: colors.text, fontWeight: '700' },
                ]}
              >
                Today's Attendance
              </Text>
              <Text
                style={{
                  fontSize: 12,
                  color: colors.textSecondary,
                  marginTop: 2,
                }}
              >
                View status & mark shift check-in
              </Text>
            </View>
          </View>
          <View
            style={[
              styles.secondaryActionBtn,
              {
                backgroundColor: colors.primary,
                paddingHorizontal: 12,
                paddingVertical: 6,
              },
            ]}
          >
            <Text style={styles.secondaryActionBtnText}>View</Text>
          </View>
        </TouchableOpacity>
      </Card>

      {/* Employee Information */}
      <Text style={[styles.sectionTitle, { color: colors.text }]}>
        Employee Information
      </Text>
      <Card style={styles.infoCard}>
        <View style={[styles.infoRow, { borderColor: colors.border }]}>
          <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>
            Email Address
          </Text>
          <Text style={[styles.infoValue, { color: colors.text }]}>
            {user?.email}
          </Text>
        </View>
        <View style={[styles.infoRow, { borderColor: colors.border }]}>
          <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>
            Account ID
          </Text>
          <Text style={[styles.infoValue, { color: colors.text }]}>
            {user?.id}
          </Text>
        </View>
        <View
          style={[
            styles.infoRow,
            { borderColor: colors.border, borderBottomWidth: 0 },
          ]}
        >
          <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>
            System Status
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View
              style={[
                styles.dot,
                { backgroundColor: isOnline ? colors.success : colors.danger },
              ]}
            />
            <Text
              style={[styles.infoValue, { color: colors.text, marginLeft: 6 }]}
            >
              {isOnline ? 'Online' : 'Offline Mode'}
            </Text>
          </View>
        </View>
      </Card>

      {/* Sync & Storage */}
      <Text style={[styles.sectionTitle, { color: colors.text }]}>
        Sync & Storage
      </Text>
      <Card style={styles.infoCard}>
        <View style={[styles.infoRow, { borderColor: colors.border }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Database
              size={16}
              color={colors.textSecondary}
              style={{ marginRight: 8 }}
            />
            <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>
              Pending Sync Requests
            </Text>
          </View>
          <Text
            style={[
              styles.infoValue,
              { color: colors.text, fontWeight: '800' },
            ]}
          >
            {queue.length} items
          </Text>
        </View>
        <View
          style={[
            styles.infoRow,
            { borderColor: colors.border, borderBottomWidth: 0 },
          ]}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Key
              size={16}
              color={colors.textSecondary}
              style={{ marginRight: 8 }}
            />
            <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>
              Session Auth Tokens
            </Text>
          </View>
          <Text style={[styles.infoValue, { color: colors.success }]}>
            Active & Encrypted
          </Text>
        </View>
      </Card>

      {/* Developer Diagnostics Spike (Visible in DEV mode only) */}
      {__DEV__ && (
        <>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Phase 0 Developer Diagnostics
          </Text>
          <TouchableOpacity
            style={[
              styles.infoCard,
              {
                padding: 14,
                backgroundColor: 'rgba(37, 99, 235, 0.1)',
                borderColor: '#2563eb',
                borderWidth: 1,
              },
            ]}
            onPress={() => navigation.navigate('FaceVerificationPrototype')}
          >
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <View
                style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}
              >
                <Camera size={20} color="#2563eb" />
                <View>
                  <Text
                    style={{
                      fontSize: 13,
                      fontWeight: '800',
                      color: colors.text,
                    }}
                  >
                    Face Verification Spike
                  </Text>
                  <Text style={{ fontSize: 11, color: colors.textSecondary }}>
                    Phase 0 Biometric Diagnostics Engine
                  </Text>
                </View>
              </View>
              <Text
                style={{ fontSize: 12, fontWeight: '800', color: '#2563eb' }}
              >
                Launch →
              </Text>
            </View>
          </TouchableOpacity>
        </>
      )}

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
  statusTag: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusTagText: {
    fontSize: 12,
    fontWeight: '800',
  },
  registrationPromptBox: {
    paddingVertical: 14,
    alignItems: 'center',
  },
  promptText: {
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 12,
  },
  primaryActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
    width: '100%',
  },
  primaryActionBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  registeredActionsRow: {
    flexDirection: 'row',
    gap: 10,
    paddingVertical: 14,
  },
  secondaryActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 8,
  },
  outlineBtn: {
    backgroundColor: 'transparent',
    borderWidth: 1,
  },
  secondaryActionBtnText: {
    color: '#FFFFFF',
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
