import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigation, useRoute } from '@react-navigation/native';
import { AlertCircle } from 'lucide-react-native';
import React from 'react';
import { Controller, useForm } from 'react-hook-form';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { z } from 'zod';
import { useTheme } from '../../../app/hooks/useTheme';
import { useOfflineStore } from '../../../app/store/offline-store';
import { Button } from '../../../components/Button';
import { useActiveAssignment } from '../../assignment/hooks/useAssignment';
import { Card } from '../../dashboard/components/WidgetCard';
import { usePatrolStore } from '../../patrol/store/patrol-store';
import { useCreateIncident } from '../hooks/useIncident';

const INCIDENT_TYPES = [
  'FIRE',
  'THEFT',
  'HAZARD',
  'INTRUSION',
  'OTHER',
] as const;
const SEVERITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const;

const incidentFormSchema = z.object({
  type: z.enum(INCIDENT_TYPES, {
    error: 'Please select an incident type',
  }),
  severity: z.enum(SEVERITIES, {
    error: 'Please select severity level',
  }),
  description: z
    .string()
    .min(10, 'Description must be at least 10 characters long'),
});

type IncidentFormData = z.infer<typeof incidentFormSchema>;

export function ReportIncidentScreen() {
  const { colors } = useTheme();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const routeParams = route.params || {};

  const isOnline = useOfflineStore(state => state.isConnected);
  const { mutateAsync: reportIncident, isPending } = useCreateIncident();
  const { activeSession, unlockedGateId } = usePatrolStore();
  const { data: assignment } = useActiveAssignment();

  // Checkpoint restrictions
  const gateId = routeParams.gateId || unlockedGateId;
  const patrolSessionId = routeParams.patrolSessionId || activeSession?.id;

  const routeGates = assignment?.patrolRoute?.routeGates || [];
  const targetGate = routeGates.find((rg: any) => rg.gateId === gateId)?.gate;

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<IncidentFormData>({
    resolver: zodResolver(incidentFormSchema),
    defaultValues: {
      description: '',
    },
  });

  const onSubmit = async (data: IncidentFormData) => {
    try {
      await reportIncident({
        ...data,
        images: [],
        gateId: gateId || undefined,
        patrolSessionId: patrolSessionId || undefined,
        latitude: assignment?.site?.latitude || undefined,
        longitude: assignment?.site?.longitude || undefined,
      });

      const message = isOnline
        ? 'Your incident report has been submitted to the operations desk.'
        : 'Offline mode: incident report saved locally and queued for background sync.';

      Alert.alert('Report Saved', message, [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (err: any) {
      Alert.alert('Submission failed', err.message || 'Please try again.');
    }
  };

  if (!gateId || !patrolSessionId) {
    return (
      <View
        style={[
          styles.container,
          {
            backgroundColor: colors.background,
            justifyContent: 'center',
            padding: 24,
          },
        ]}
      >
        <View style={{ alignItems: 'center', marginBottom: 20 }}>
          <AlertCircle size={48} color={colors.danger} />
        </View>
        <Text
          style={{
            fontSize: 20,
            fontWeight: '800',
            color: colors.text,
            textAlign: 'center',
            marginBottom: 12,
          }}
        >
          Incident Reporting Locked
        </Text>
        <Text
          style={{
            fontSize: 13,
            color: colors.textSecondary,
            textAlign: 'center',
            lineHeight: 18,
            marginBottom: 24,
          }}
        >
          Under Hello Orbit protocol, you cannot report incidents manually. You
          must first scan a checkpoint QR code during a patrol route sweep to
          unlock reporting.
        </Text>
        <Button
          title="Go to Patrol Screen"
          onPress={() => navigation.navigate('Patrol')}
        />
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.scrollContent}
    >
      {!isOnline && (
        <View
          style={[styles.offlineBanner, { backgroundColor: colors.danger }]}
        >
          <Text style={styles.offlineText}>
            OFFLINE MODE — Report will be queued
          </Text>
        </View>
      )}

      <Text style={[styles.title, { color: colors.text }]}>
        Report Incident
      </Text>

      <Card
        style={{
          padding: 14,
          marginBottom: 20,
          borderColor: colors.primary,
          borderWidth: 1,
        }}
      >
        <Text
          style={{
            fontSize: 10,
            color: colors.textSecondary,
            fontWeight: '700',
            textTransform: 'uppercase',
            letterSpacing: 0.5,
          }}
        >
          Reporting Incident For Checkpoint:
        </Text>
        <Text
          style={{
            fontSize: 16,
            color: colors.text,
            fontWeight: '800',
            marginTop: 4,
          }}
        >
          {targetGate?.name || 'Active Unlocked Gate'}
        </Text>
        <Text
          style={{ fontSize: 11, color: colors.textSecondary, marginTop: 2 }}
        >
          Gate ID Code: {targetGate?.gateCode || gateId}
        </Text>
      </Card>

      <Text style={[styles.label, { color: colors.text }]}>Incident Type</Text>
      <Controller
        name="type"
        control={control}
        render={({ field: { value, onChange } }) => (
          <View style={styles.optionRow}>
            {INCIDENT_TYPES.map(t => (
              <TouchableOpacity
                key={t}
                style={[
                  styles.optionButton,
                  {
                    borderColor: value === t ? colors.primary : colors.border,
                    backgroundColor:
                      value === t ? colors.primary + '15' : colors.surface,
                  },
                ]}
                onPress={() => onChange(t)}
              >
                <Text
                  style={[
                    styles.optionText,
                    { color: value === t ? colors.primary : colors.text },
                  ]}
                >
                  {t}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      />
      {errors.type && (
        <Text style={[styles.errorText, { color: colors.danger }]}>
          {errors.type.message}
        </Text>
      )}

      <Text style={[styles.label, { color: colors.text }]}>Severity Level</Text>
      <Controller
        name="severity"
        control={control}
        render={({ field: { value, onChange } }) => (
          <View style={styles.optionRow}>
            {SEVERITIES.map(s => (
              <TouchableOpacity
                key={s}
                style={[
                  styles.optionButton,
                  {
                    borderColor: value === s ? colors.primary : colors.border,
                    backgroundColor:
                      value === s ? colors.primary + '15' : colors.surface,
                  },
                ]}
                onPress={() => onChange(s)}
              >
                <Text
                  style={[
                    styles.optionText,
                    { color: value === s ? colors.primary : colors.text },
                  ]}
                >
                  {s}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      />
      {errors.severity && (
        <Text style={[styles.errorText, { color: colors.danger }]}>
          {errors.severity.message}
        </Text>
      )}

      <Text style={[styles.label, { color: colors.text }]}>
        Incident Description
      </Text>
      <Controller
        name="description"
        control={control}
        render={({ field: { value, onChange, onBlur } }) => (
          <TextInput
            style={[
              styles.input,
              {
                color: colors.text,
                borderColor: colors.border,
                backgroundColor: colors.surface,
              },
            ]}
            placeholder="Provide a detailed description of the incident..."
            placeholderTextColor={colors.textSecondary}
            value={value}
            onChangeText={onChange}
            onBlur={onBlur}
            multiline
            numberOfLines={4}
          />
        )}
      />
      {errors.description && (
        <Text style={[styles.errorText, { color: colors.danger }]}>
          {errors.description.message}
        </Text>
      )}

      <Button
        title="Submit Incident Report"
        onPress={handleSubmit(onSubmit)}
        loading={isPending}
        style={styles.submitButton}
      />
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
  offlineBanner: {
    padding: 8,
    borderRadius: 6,
    alignItems: 'center',
    marginBottom: 16,
  },
  offlineText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '700',
    marginTop: 16,
    marginBottom: 8,
  },
  optionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 4,
  },
  optionButton: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginRight: 8,
    marginBottom: 8,
  },
  optionText: {
    fontSize: 12,
    fontWeight: '700',
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 13,
    textAlignVertical: 'top',
    height: 100,
  },
  photoContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 4,
    marginBottom: 20,
  },
  thumbnailWrapper: {
    position: 'relative',
    marginRight: 12,
    marginBottom: 12,
  },
  thumbnail: {
    width: 72,
    height: 72,
    borderRadius: 8,
  },
  removeButton: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  removeButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
    marginTop: -2,
  },
  addPhotoSlot: {
    width: 72,
    height: 72,
    borderRadius: 8,
    borderWidth: 1,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addPhotoPlus: {
    fontSize: 20,
    fontWeight: '700',
  },
  addPhotoLabel: {
    fontSize: 10,
    marginTop: 2,
  },
  errorText: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 4,
  },
  submitButton: {
    marginTop: 20,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  pickerDialog: {
    padding: 20,
    width: '100%',
    maxWidth: 280,
  },
  pickerTitle: {
    fontSize: 16,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 16,
  },
  pickerOption: {
    borderBottomWidth: 1,
    paddingVertical: 14,
  },
  pickerOptionText: {
    fontSize: 14,
    fontWeight: '600',
  },
  cancelPicker: {
    marginTop: 14,
    alignItems: 'center',
  },
  cameraContainer: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
  },
  cameraTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 16,
  },
  viewfinder: {
    flex: 1,
    borderWidth: 2,
    borderColor: '#ffffff',
    borderRadius: 8,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#000000',
  },
  crosshair: {
    width: 40,
    height: 40,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.4)',
    borderRadius: 20,
  },
  compressLoader: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  compressLabel: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 10,
  },
  flashOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#ffffff',
  },
  cameraControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 24,
  },
  cameraCancel: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  shutterButton: {
    width: 68,
    height: 68,
    borderRadius: 34,
    borderWidth: 4,
    borderColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterInner: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#ffffff',
  },
  galleryContainer: {
    flex: 1,
  },
  galleryTitle: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 16,
  },
  galleryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  galleryItem: {
    width: '48%',
    marginBottom: 16,
  },
  galleryImage: {
    width: '100%',
    height: 120,
    borderRadius: 8,
  },
  galleryItemLabel: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 4,
    textAlign: 'center',
  },
  lightboxOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  lightboxContainer: {
    width: '100%',
    alignItems: 'center',
  },
  lightboxImage: {
    width: '100%',
    height: 320,
    borderRadius: 8,
    resizeMode: 'contain',
  },
  lightboxButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: 20,
  },
  lightboxClose: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 6,
  },
  lightboxRemove: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 6,
  },
});
