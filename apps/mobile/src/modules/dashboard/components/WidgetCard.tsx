import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ViewStyle, StyleProp } from 'react-native';
import { useTheme } from '../../../app/hooks/useTheme';

interface CardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

export function Card({ children, style }: CardProps) {
  const { colors } = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }, style as any]}>
      {children}
    </View>
  );
}

interface StatCardProps {
  value: string | number;
  label: string;
  subtext?: string;
  badge?: string;
  badgeColor?: string;
  style?: StyleProp<ViewStyle>;
}

export function StatCard({ value, label, subtext, badge, badgeColor, style }: StatCardProps) {
  const { colors } = useTheme();

  return (
    <Card style={[styles.statCard, style as any]}>
      <View style={styles.statHeader}>
        <Text style={[styles.statValue, { color: colors.text }]}>{value}</Text>
        {badge && (
          <View style={[styles.badge, { backgroundColor: badgeColor ? badgeColor + '20' : colors.primary + '20' }]}>
            <Text style={[styles.badgeText, { color: badgeColor || colors.primary }]}>{badge}</Text>
          </View>
        )}
      </View>
      <Text style={[styles.statLabel, { color: colors.textSecondary }]}>{label}</Text>
      {subtext && <Text style={[styles.statSubtext, { color: colors.textSecondary }]}>{subtext}</Text>}
    </Card>
  );
}

interface QuickActionProps {
  title: string;
  description: string;
  onPress: () => void;
  color?: string;
  style?: StyleProp<ViewStyle>;
}

export function QuickAction({ title, description, onPress, color, style }: QuickActionProps) {
  const { colors } = useTheme();
  const themeColor = color || colors.primary;

  return (
    <TouchableOpacity
      onPress={onPress}
      style={[
        styles.actionCard,
        { backgroundColor: colors.surface, borderColor: colors.border },
        style,
      ]}
      activeOpacity={0.7}
    >
      <View style={[styles.iconIndicator, { backgroundColor: themeColor }]} />
      <View style={styles.actionContent}>
        <Text style={[styles.actionTitle, { color: colors.text }]}>{title}</Text>
        <Text style={[styles.actionDesc, { color: colors.textSecondary }]}>{description}</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  statCard: {
    flex: 1,
    minWidth: '46%',
    margin: 6,
  },
  statHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '800',
  },
  statLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 4,
  },
  statSubtext: {
    fontSize: 11,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  actionCard: {
    flexDirection: 'row',
    borderRadius: 10,
    borderWidth: 1,
    padding: 12,
    alignItems: 'center',
    marginBottom: 10,
  },
  iconIndicator: {
    width: 6,
    height: 36,
    borderRadius: 3,
    marginRight: 12,
  },
  actionContent: {
    flex: 1,
  },
  actionTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 2,
  },
  actionDesc: {
    fontSize: 12,
  },
});
