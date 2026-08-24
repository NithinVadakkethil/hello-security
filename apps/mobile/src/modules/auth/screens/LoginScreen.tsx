import React, { useState } from 'react';
import { View, Text, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, Image, Alert } from 'react-native';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTheme } from '../../../app/hooks/useTheme';
import { useAuth } from '../hooks/useAuth';
import { LoginCredentials, loginValidationSchema } from '../types';
import { Input } from '../../../components/Input';
import { Button } from '../../../components/Button';

export function LoginScreen() {
  const { colors } = useTheme();
  const { login, logoutAllDevices, isLoggingIn } = useAuth();
  const [apiError, setApiError] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginCredentials>({
    resolver: zodResolver(loginValidationSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const handleLogoutAllAndLogin = async (data: LoginCredentials) => {
    setApiError(null);
    try {
      await logoutAllDevices(data);
    } catch (err: any) {
      console.error('[LoginScreen] Logout all devices failed:', err);
      const errorMessage =
        err.response?.data?.error?.message ||
        err.response?.data?.message ||
        err.message ||
        'Failed to log out from all devices. Please check your credentials and try again.';
      setApiError(errorMessage);
    }
  };

  const onSubmit = async (data: LoginCredentials) => {
    setApiError(null);
    try {
      await login(data);
    } catch (err: any) {
      console.error('[LoginScreen] Login failed:', err);
      const errorCode = err.response?.data?.error?.code || err.response?.data?.code;
      const errorMessage =
        err.response?.data?.error?.message ||
        err.response?.data?.message ||
        err.message ||
        'An unexpected error occurred. Please try again.';

      if (errorCode === 'USER_ALREADY_LOGGED_IN') {
        Alert.alert(
          'Account Already Logged In',
          'Your account is currently signed in on another device. Please sign out from that device, or use \'Log Out From All Devices\' if you no longer have access to it.',
          [
            {
              text: 'Cancel',
              style: 'cancel',
            },
            {
              text: 'Log Out From All Devices',
              style: 'destructive',
              onPress: () => handleLogoutAllAndLogin(data),
            },
          ],
        );
      }

      setApiError(errorMessage);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      <ScrollView contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled">
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          
          <View style={styles.logoContainer}>
            <View style={[styles.logoBadge, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Image
                source={require('../../../assets/hello-orbit-logo.png')}
                style={styles.logoImage}
                resizeMode="contain"
              />
            </View>
          </View>

          <Text style={[styles.title, { color: colors.text }]}>Hello Orbit</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            Secure Guardian Management System
          </Text>

          {apiError && (
            <View style={[styles.errorContainer, { backgroundColor: colors.danger + '15', borderColor: colors.danger }]}>
              <Text style={[styles.errorText, { color: colors.danger }]}>{apiError}</Text>
            </View>
          )}

          <Controller
            control={control}
            name="email"
            render={({ field: { onChange, value } }) => (
              <Input
                label="Email Address"
                placeholder="officer@hellosecurity.com"
                value={value}
                onChangeText={onChange}
                error={errors.email?.message}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            )}
          />

          <Controller
            control={control}
            name="password"
            render={({ field: { onChange, value } }) => (
              <Input
                label="Security Pin / Password"
                placeholder="Enter password"
                value={value}
                onChangeText={onChange}
                error={errors.password?.message}
                secureTextEntry
                autoCapitalize="none"
              />
            )}
          />

          <Button
            title="Authorize Session"
            onPress={handleSubmit(onSubmit)}
            loading={isLoggingIn}
            style={styles.button}
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    padding: 28,
    borderRadius: 16,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  logoBadge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 1,
    padding: 8,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 2,
  },
  logoImage: {
    width: '100%',
    height: '100%',
    borderRadius: 4,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
    marginBottom: 32,
  },
  errorContainer: {
    width: '100%',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 20,
  },
  errorText: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  button: {
    marginTop: 12,
  },
});
