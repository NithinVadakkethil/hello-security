import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useAuthStore } from '../store/auth-store';
import { useTheme } from '../hooks/useTheme';
import { tokenManager } from '../utils/token-manager';

export function LoginPlaceholderScreen() {
  const { setAuth } = useAuthStore();
  const { colors } = useTheme();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = () => {
    if (!email || !password) return;
    setLoading(true);
    setTimeout(() => {
      // Simulate authenticating session
      tokenManager.setAccessToken('mock_access_token');
      tokenManager.setRefreshToken('mock_refresh_token');
      setAuth({
        id: 'usr-1',
        email,
        role: 'SECURITY',
        firstName: 'Officer',
        lastName: 'Smith',
      });
      setLoading(false);
    }, 1000);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.title, { color: colors.text }]}>Hello Security</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>Guard Portal</Text>

        <TextInput
          style={[styles.input, { borderColor: colors.border, color: colors.text }]}
          placeholder="Email Address"
          placeholderTextColor={colors.textSecondary}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />

        <TextInput
          style={[styles.input, { borderColor: colors.border, color: colors.text }]}
          placeholder="Password"
          placeholderTextColor={colors.textSecondary}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />

        <TouchableOpacity 
          style={[styles.button, { backgroundColor: colors.primary }]} 
          onPress={handleLogin}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text style={styles.buttonText}>Authorize Session</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

export function DashboardPlaceholderScreen() {
  const { user, clearAuth } = useAuthStore();
  const { colors } = useTheme();

  const handleLogout = () => {
    tokenManager.clearTokens();
    clearAuth();
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={[styles.header, { color: colors.text }]}>
        Welcome, {user?.firstName} {user?.lastName}
      </Text>
      <Text style={[styles.info, { color: colors.textSecondary }]}>
        Role: {user?.role} • Status: Connected
      </Text>

      <TouchableOpacity 
        style={[styles.button, { backgroundColor: colors.danger, marginTop: 40 }]} 
        onPress={handleLogout}
      >
        <Text style={styles.buttonText}>Disconnect Session</Text>
      </TouchableOpacity>
    </View>
  );
}

export function ShiftsPlaceholderScreen() {
  const { colors } = useTheme();
  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={{ color: colors.text, fontSize: 18, fontWeight: 'bold' }}>Guard Shifts</Text>
      <Text style={{ color: colors.textSecondary, marginTop: 8 }}>No active time slots scheduled.</Text>
    </View>
  );
}

export function PatrolPlaceholderScreen() {
  const { colors } = useTheme();
  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={{ color: colors.text, fontSize: 18, fontWeight: 'bold' }}>Patrol Checkpoints</Text>
      <Text style={{ color: colors.textSecondary, marginTop: 8 }}>Scan QR code to trigger check-in sequence.</Text>
    </View>
  );
}

export function ReportsPlaceholderScreen() {
  const { colors } = useTheme();
  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={{ color: colors.text, fontSize: 18, fontWeight: 'bold' }}>Incident Logging</Text>
      <Text style={{ color: colors.textSecondary, marginTop: 8 }}>Historical patrol summaries.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 340,
    padding: 28,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 28,
  },
  header: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 8,
  },
  info: {
    fontSize: 14,
  },
  input: {
    width: '100%',
    height: 48,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 16,
    marginBottom: 16,
    fontSize: 14,
  },
  button: {
    width: '100%',
    height: 48,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
  },
});
