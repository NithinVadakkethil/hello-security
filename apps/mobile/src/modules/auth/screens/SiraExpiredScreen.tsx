import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { ShieldAlert, User, LogOut } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { useQueryClient } from '@tanstack/react-query';
import { useTheme } from '../../../app/hooks/useTheme';
import { useAuthStore } from '../../../app/store/auth-store';
import { performLogout } from '../../../app/utils/logout';

export function SiraExpiredScreen() {
  const { colors } = useTheme();
  const navigation = useNavigation<any>();
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const [loggingOut, setLoggingOut] = React.useState(false);

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await performLogout(queryClient);
    } catch {
      useAuthStore.getState().clearAuth();
    } finally {
      setLoggingOut(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {/* Warning Icon Badge */}
          <View style={[styles.iconContainer, { backgroundColor: colors.danger + '18' }]}>
            <ShieldAlert size={48} color={colors.danger} />
          </View>

          {/* Title */}
          <Text style={[styles.title, { color: colors.text }]}>SIRA Card Expired</Text>

          {/* Description */}
          <Text style={[styles.message, { color: colors.textSecondary }]}>
            Your SIRA card has expired. Please renew your SIRA card to continue using security operational features.
          </Text>

          <Text style={[styles.subMessage, { color: colors.textSecondary }]}>
            Please contact your administrator after renewal to restore operational access.
          </Text>

          {/* User Info Badge */}
          {user && (
            <View style={[styles.userBadge, { backgroundColor: colors.background, borderColor: colors.border }]}>
              <Text style={[styles.userName, { color: colors.text }]}>
                {user.firstName} {user.lastName}
              </Text>
              <Text style={[styles.userRole, { color: colors.textSecondary }]}>
                {user.role === 'SUPERVISOR' ? 'Supervisor' : 'Security Officer'} • {user.email}
              </Text>
            </View>
          )}

          {/* Action Buttons */}
          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.primaryButton, { backgroundColor: colors.primary }]}
              onPress={() => navigation.navigate('Profile')}
              activeOpacity={0.8}
            >
              <User size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
              <Text style={styles.primaryButtonText}>View Profile</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.secondaryButton, { borderColor: colors.danger }]}
              onPress={handleLogout}
              disabled={loggingOut}
              activeOpacity={0.8}
            >
              <LogOut size={18} color={colors.danger} style={{ marginRight: 8 }} />
              <Text style={[styles.secondaryButtonText, { color: colors.danger }]}>
                {loggingOut ? 'Disconnecting...' : 'Log Out'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    padding: 28,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  iconContainer: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 12,
  },
  message: {
    fontSize: 15,
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 10,
  },
  subMessage: {
    fontSize: 13,
    fontWeight: '400',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 24,
  },
  userBadge: {
    width: '100%',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    marginBottom: 24,
  },
  userName: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 2,
  },
  userRole: {
    fontSize: 12,
  },
  actions: {
    width: '100%',
    gap: 12,
  },
  primaryButton: {
    height: 48,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  secondaryButton: {
    height: 48,
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  secondaryButtonText: {
    fontSize: 15,
    fontWeight: '700',
  },
});
