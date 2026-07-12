import React, { useState } from 'react';
import { View, Text, StyleSheet, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTheme } from '../../../app/hooks/useTheme';
import { useAuth } from '../hooks/useAuth';
import { LoginCredentials, loginValidationSchema } from '../types';
import { Input } from '../../../components/Input';
import { Button } from '../../../components/Button';

export function LoginScreen() {
  const { colors } = useTheme();
  const { login, isLoggingIn } = useAuth();
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

  const onSubmit = async (data: LoginCredentials) => {
    setApiError(null);
    try {
      await login(data);
    } catch (err: any) {
      console.error('[LoginScreen] Login failed:', err);
      const errorMessage =
        err.response?.data?.message || err.message || 'An unexpected error occurred. Please try again.';
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
          
          <Text style={[styles.title, { color: colors.text }]}>Hello Security</Text>
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
