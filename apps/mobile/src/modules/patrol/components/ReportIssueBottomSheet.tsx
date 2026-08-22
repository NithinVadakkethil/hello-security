import { AlertTriangle, Wrench, X } from 'lucide-react-native';
import React from 'react';
import {
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { useTheme } from '../../../app/hooks/useTheme';

interface ReportIssueBottomSheetProps {
  visible: boolean;
  onClose: () => void;
  onSelectIncident: () => void;
  onSelectSnag: () => void;
}

export function ReportIssueBottomSheet({
  visible,
  onClose,
  onSelectIncident,
  onSelectSnag,
}: ReportIssueBottomSheetProps) {
  const { colors } = useTheme();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.backdrop}>
          <TouchableWithoutFeedback>
            <View style={[styles.sheetContainer, { backgroundColor: colors.surface }]}>
              {/* Sheet Header */}
              <View style={styles.sheetHeader}>
                <View>
                  <Text style={[styles.sheetTitle, { color: colors.text }]}>
                    Report Issue
                  </Text>
                  <Text style={[styles.sheetSubtitle, { color: colors.textSecondary }]}>
                    Choose the type of issue observed during patrol
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={onClose}
                  style={[styles.closeButton, { backgroundColor: colors.background }]}
                >
                  <X size={20} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>

              {/* Option 1: Report Incident */}
              <TouchableOpacity
                style={[
                  styles.optionCard,
                  {
                    backgroundColor: colors.background,
                    borderColor: 'rgba(239, 68, 68, 0.3)',
                  },
                ]}
                onPress={() => {
                  onClose();
                  onSelectIncident();
                }}
              >
                <View
                  style={[
                    styles.iconWrapper,
                    { backgroundColor: 'rgba(239, 68, 68, 0.12)' },
                  ]}
                >
                  <AlertTriangle size={24} color={colors.danger} />
                </View>
                <View style={styles.optionContent}>
                  <View style={styles.optionTitleRow}>
                    <Text style={[styles.optionTitle, { color: colors.text }]}>
                      Report Incident
                    </Text>
                    <Text
                      style={[
                        styles.badge,
                        {
                          backgroundColor: 'rgba(239, 68, 68, 0.15)',
                          color: colors.danger,
                        },
                      ]}
                    >
                      HIGH PRIORITY
                    </Text>
                  </View>
                  <Text style={[styles.optionDescription, { color: colors.textSecondary }]}>
                    Security emergencies, fire, theft, intrusion, hazards, or violent conflicts.
                  </Text>
                </View>
              </TouchableOpacity>

              {/* Option 2: Report Snag */}
              <TouchableOpacity
                style={[
                  styles.optionCard,
                  {
                    backgroundColor: colors.background,
                    borderColor: 'rgba(245, 158, 11, 0.3)',
                  },
                ]}
                onPress={() => {
                  onClose();
                  onSelectSnag();
                }}
              >
                <View
                  style={[
                    styles.iconWrapper,
                    { backgroundColor: 'rgba(245, 158, 11, 0.12)' },
                  ]}
                >
                  <Wrench size={24} color="#f59e0b" />
                </View>
                <View style={styles.optionContent}>
                  <View style={styles.optionTitleRow}>
                    <Text style={[styles.optionTitle, { color: colors.text }]}>
                      Report Snag (Maintenance)
                    </Text>
                    <Text
                      style={[
                        styles.badge,
                        {
                          backgroundColor: 'rgba(245, 158, 11, 0.15)',
                          color: '#f59e0b',
                        },
                      ]}
                    >
                      DEFECT / REPAIR
                    </Text>
                  </View>
                  <Text style={[styles.optionDescription, { color: colors.textSecondary }]}>
                    Broken doors, water leaks, lighting faults, fence damage, or dirty areas.
                  </Text>
                </View>
              </TouchableOpacity>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 36,
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  sheetTitle: {
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 4,
  },
  sheetSubtitle: {
    fontSize: 13,
  },
  closeButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 14,
  },
  iconWrapper: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  optionContent: {
    flex: 1,
  },
  optionTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  optionTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  badge: {
    fontSize: 9,
    fontWeight: '800',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: 'hidden',
  },
  optionDescription: {
    fontSize: 12,
    lineHeight: 16,
  },
});
