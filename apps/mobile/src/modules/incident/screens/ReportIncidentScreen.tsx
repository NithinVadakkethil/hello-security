import React, { useState, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, Image, Alert, Modal, ActivityIndicator, Animated } from 'react-native';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTheme } from '../../../app/hooks/useTheme';
import { useCreateIncident } from '../hooks/useIncident';
import { useOfflineStore } from '../../../app/store/offline-store';
import { Card } from '../../dashboard/components/WidgetCard';
import { Button } from '../../../components/Button';
import { useNavigation } from '@react-navigation/native';

const INCIDENT_TYPES = ['FIRE', 'THEFT', 'HAZARD', 'INTRUSION', 'OTHER'] as const;
const SEVERITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const;

const incidentFormSchema = z.object({
  type: z.enum(INCIDENT_TYPES, {
    error: 'Please select an incident type',
  }),
  severity: z.enum(SEVERITIES, {
    error: 'Please select severity level',
  }),
  description: z.string().min(10, 'Description must be at least 10 characters long'),
});

type IncidentFormData = z.infer<typeof incidentFormSchema>;

// Static high-quality mock base64 placeholders representing site photos
const MOCK_PHOTOS = [
  {
    id: '1',
    name: 'Warehouse Gate',
    uri: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAPklEQVR42mNk6GCoZyAAMxIURmDJ/p8ZcArCFLAisAowE0g2ECcZKAwZkBVAWnDKwCrAxEAcw2kCSiEWBhQCAP3iDT629Z7CAAAAAElFTkSuQmCC',
  },
  {
    id: '2',
    name: 'Broken Perimeter Fence',
    uri: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAO0lEQVR42mNkYPj/nwEDMCOJMILK/p8ZMArCFLAisAowE0g2ECcZKAwZkBVAWnDKwCrAxEAcw2kCSiEWBgCSew55l9VbVQAAAABJRU5ErkJggg==',
  },
  {
    id: '3',
    name: 'Corridor Smoke Detector',
    uri: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAOklEQVR42mNkYPj/fwEDAxgjMcAIKvv/n4EpCFLAisAowE0g2ECcZKAwZkBVAWnDKwCrAxEAcw2kCSiEWAAMuQ17d3+V6QAAAABJRU5ErkJggg==',
  },
  {
    id: '4',
    name: 'Main Entrance Lock',
    uri: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAOUlEQVR42mNkYPj/nwECMCPhAENk9n8GpCFLAisAowE0g2ECcZKAwZkBVAWnDKwCrAxEAcw2kCSiEWAAoH8Oe6W0zOAAAAAASRU5ErkJggg==',
  },
];

export function ReportIncidentScreen() {
  const { colors } = useTheme();
  const navigation = useNavigation();
  const isOnline = useOfflineStore((state) => state.isConnected);
  const { mutateAsync: reportIncident, isPending } = useCreateIncident();

  const [images, setImages] = useState<string[]>([]);
  const [showPickerMenu, setShowPickerMenu] = useState(false);
  const [showCameraModal, setShowCameraModal] = useState(false);
  const [showGalleryModal, setShowGalleryModal] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [isCompressing, setIsCompressing] = useState(false);

  const flashAnim = useRef(new Animated.Value(0)).current;

  const { control, handleSubmit, formState: { errors } } = useForm<IncidentFormData>({
    resolver: zodResolver(incidentFormSchema),
    defaultValues: {
      description: '',
    },
  });

  const triggerCameraFlash = () => {
    flashAnim.setValue(1);
    Animated.timing(flashAnim, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
    }).start();
  };

  const handleCapturePhoto = () => {
    setIsCompressing(true);
    triggerCameraFlash();

    setTimeout(() => {
      // Generate a mock base64 compressed camera photo
      const mockImage = `data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAOklEQVR42mNkYPj/fwEDAxgjMcAIKvv/n4EpCFLAisAowE0g2ECcZKAwZkBVAWnDKwCrAxEAcw2kCSiEWAAMuQ17d3+V6QAAAABJRU5ErkJggg==`;
      setImages((prev) => [...prev, mockImage]);
      setIsCompressing(false);
      setShowCameraModal(false);
      Alert.alert('Compressed Photo Added', 'Captured image compressed by 85% before attachment.');
    }, 1200);
  };

  const handleSelectGalleryPhoto = (uri: string) => {
    if (images.includes(uri)) {
      Alert.alert('Duplicate Attachment', 'This photo is already attached.');
      return;
    }
    setIsCompressing(true);
    setTimeout(() => {
      setImages((prev) => [...prev, uri]);
      setIsCompressing(false);
      setShowGalleryModal(false);
      Alert.alert('Compressed Photo Added', 'Gallery image compressed (Quality: 80%) successfully.');
    }, 800);
  };

  const handleRemovePhoto = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
    setPreviewImage(null);
  };

  const onSubmit = async (data: IncidentFormData) => {
    try {
      await reportIncident({
        ...data,
        images,
      });

      const message = isOnline 
        ? 'Your incident report has been submitted to the operations desk.'
        : 'Offline mode: incident report saved locally and queued for background sync.';

      Alert.alert('Report Saved', message, [
        { text: 'OK', onPress: () => navigation.goBack() }
      ]);
    } catch (err: any) {
      Alert.alert('Submission failed', err.message || 'Please try again.');
    }
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]} contentContainerStyle={styles.scrollContent}>
      
      {!isOnline && (
        <View style={[styles.offlineBanner, { backgroundColor: colors.danger }]}>
          <Text style={styles.offlineText}>OFFLINE MODE — Report will be queued</Text>
        </View>
      )}

      <Text style={[styles.title, { color: colors.text }]}>Report Incident</Text>

      <Text style={[styles.label, { color: colors.text }]}>Incident Type</Text>
      <Controller
        name="type"
        control={control}
        render={({ field: { value, onChange } }) => (
          <View style={styles.optionRow}>
            {INCIDENT_TYPES.map((t) => (
              <TouchableOpacity
                key={t}
                style={[
                  styles.optionButton,
                  {
                    borderColor: value === t ? colors.primary : colors.border,
                    backgroundColor: value === t ? colors.primary + '15' : colors.surface,
                  },
                ]}
                onPress={() => onChange(t)}
              >
                <Text style={[styles.optionText, { color: value === t ? colors.primary : colors.text }]}>
                  {t}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      />
      {errors.type && <Text style={[styles.errorText, { color: colors.danger }]}>{errors.type.message}</Text>}

      <Text style={[styles.label, { color: colors.text }]}>Severity Level</Text>
      <Controller
        name="severity"
        control={control}
        render={({ field: { value, onChange } }) => (
          <View style={styles.optionRow}>
            {SEVERITIES.map((s) => (
              <TouchableOpacity
                key={s}
                style={[
                  styles.optionButton,
                  {
                    borderColor: value === s ? colors.primary : colors.border,
                    backgroundColor: value === s ? colors.primary + '15' : colors.surface,
                  },
                ]}
                onPress={() => onChange(s)}
              >
                <Text style={[styles.optionText, { color: value === s ? colors.primary : colors.text }]}>
                  {s}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      />
      {errors.severity && <Text style={[styles.errorText, { color: colors.danger }]}>{errors.severity.message}</Text>}

      <Text style={[styles.label, { color: colors.text }]}>Incident Description</Text>
      <Controller
        name="description"
        control={control}
        render={({ field: { value, onChange, onBlur } }) => (
          <TextInput
            style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface }]}
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
      {errors.description && <Text style={[styles.errorText, { color: colors.danger }]}>{errors.description.message}</Text>}

      <Text style={[styles.label, { color: colors.text }]}>Attach Photos ({images.length}/4)</Text>
      <View style={styles.photoContainer}>
        {images.map((img, idx) => (
          <View key={idx} style={styles.thumbnailWrapper}>
            <TouchableOpacity onPress={() => setPreviewImage(img)}>
              <Image source={{ uri: img }} style={styles.thumbnail} />
            </TouchableOpacity>
            <TouchableOpacity style={[styles.removeButton, { backgroundColor: colors.danger }]} onPress={() => handleRemovePhoto(idx)}>
              <Text style={styles.removeButtonText}>×</Text>
            </TouchableOpacity>
          </View>
        ))}
        {images.length < 4 && (
          <TouchableOpacity style={[styles.addPhotoSlot, { borderColor: colors.border, backgroundColor: colors.surface }]} onPress={() => setShowPickerMenu(true)}>
            <Text style={[styles.addPhotoPlus, { color: colors.textSecondary }]}>+</Text>
            <Text style={[styles.addPhotoLabel, { color: colors.textSecondary }]}>Attach</Text>
          </TouchableOpacity>
        )}
      </View>

      <Button
        title="Submit Incident Report"
        onPress={handleSubmit(onSubmit)}
        loading={isPending}
        style={styles.submitButton}
      />

      {/* PHOTO SOURCE SELECTION DIALOG */}
      <Modal visible={showPickerMenu} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <Card style={styles.pickerDialog}>
            <Text style={[styles.pickerTitle, { color: colors.text }]}>Attach Photo</Text>
            <TouchableOpacity style={[styles.pickerOption, { borderColor: colors.border }]} onPress={() => { setShowPickerMenu(false); setShowCameraModal(true); }}>
              <Text style={[styles.pickerOptionText, { color: colors.text }]}>📷 Take Photo (Camera)</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.pickerOption, { borderColor: colors.border }]} onPress={() => { setShowPickerMenu(false); setShowGalleryModal(true); }}>
              <Text style={[styles.pickerOptionText, { color: colors.text }]}>🖼️ Choose from Gallery</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelPicker} onPress={() => setShowPickerMenu(false)}>
              <Text style={{ color: colors.danger, fontWeight: '700' }}>Cancel</Text>
            </TouchableOpacity>
          </Card>
        </View>
      </Modal>

      {/* CAMERA VIEWFINDER MODAL */}
      <Modal visible={showCameraModal} animationType="slide">
        <View style={[styles.cameraContainer, { backgroundColor: '#121214' }]}>
          <Text style={styles.cameraTitle}>Mock Camera Viewfinder</Text>
          <View style={styles.viewfinder}>
            <View style={styles.crosshair} />
            {isCompressing && (
              <View style={styles.compressLoader}>
                <ActivityIndicator color={colors.primary} size="large" />
                <Text style={styles.compressLabel}>Compressing Photo (85%)...</Text>
              </View>
            )}
            <Animated.View style={[styles.flashOverlay, { opacity: flashAnim }]} />
          </View>
          <View style={styles.cameraControls}>
            <TouchableOpacity style={[styles.cameraCancel, { borderColor: '#ffffff' }]} onPress={() => setShowCameraModal(false)}>
              <Text style={{ color: '#ffffff' }}>Close</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.shutterButton} onPress={handleCapturePhoto} disabled={isCompressing}>
              <View style={styles.shutterInner} />
            </TouchableOpacity>
            <View style={{ width: 60 }} />
          </View>
        </View>
      </Modal>

      {/* GALLERY GRID PICKER MODAL */}
      <Modal visible={showGalleryModal} animationType="slide">
        <View style={[styles.galleryContainer, { backgroundColor: colors.background, padding: 20 }]}>
          <Text style={[styles.galleryTitle, { color: colors.text }]}>Select Mock Gallery Photo</Text>
          {isCompressing ? (
            <View style={styles.compressLoader}>
              <ActivityIndicator color={colors.primary} size="large" />
              <Text style={[styles.compressLabel, { color: colors.text }]}>Compressing & Converting to Base64...</Text>
            </View>
          ) : (
            <ScrollView contentContainerStyle={styles.galleryGrid}>
              {MOCK_PHOTOS.map((p) => (
                <TouchableOpacity key={p.id} style={styles.galleryItem} onPress={() => handleSelectGalleryPhoto(p.uri)}>
                  <Image source={{ uri: p.uri }} style={styles.galleryImage} />
                  <Text style={[styles.galleryItemLabel, { color: colors.textSecondary }]}>{p.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
          <Button title="Close Gallery" variant="outline" onPress={() => setShowGalleryModal(false)} />
        </View>
      </Modal>

      {/* IMAGE PREVIEW LIGHTBOX */}
      <Modal visible={previewImage !== null} transparent animationType="fade">
        <View style={styles.lightboxOverlay}>
          <View style={styles.lightboxContainer}>
            {previewImage && <Image source={{ uri: previewImage }} style={styles.lightboxImage} />}
            <View style={styles.lightboxButtons}>
              <TouchableOpacity style={[styles.lightboxClose, { backgroundColor: colors.surface }]} onPress={() => setPreviewImage(null)}>
                <Text style={{ color: colors.text, fontWeight: '700' }}>Close</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.lightboxRemove, { backgroundColor: colors.danger }]}
                onPress={() => {
                  if (previewImage) {
                    const idx = images.indexOf(previewImage);
                    if (idx !== -1) handleRemovePhoto(idx);
                  }
                }}
              >
                <Text style={{ color: '#ffffff', fontWeight: '700' }}>Remove Photo</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

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
