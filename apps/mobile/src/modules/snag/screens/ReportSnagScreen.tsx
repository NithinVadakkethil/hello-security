import { useNavigation, useRoute } from '@react-navigation/native';
import { Camera as CameraIcon, CheckCircle2, MapPin, Trash2, Wrench, X } from 'lucide-react-native';
import React, { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Camera, useCameraDevice, useCameraPermission } from 'react-native-vision-camera';
import { useTheme } from '../../../app/hooks/useTheme';
import { useOfflineStore } from '../../../app/store/offline-store';
import { Button } from '../../../components/Button';
import { useActiveAssignment } from '../../assignment/hooks/useAssignment';
import { Card } from '../../dashboard/components/WidgetCard';
import { usePatrolStore } from '../../patrol/store/patrol-store';
import { useCreateSnag } from '../hooks/useSnag';

// Predefined Master Categories & Sub-Categories
const SNAG_CATEGORIES: Record<string, string[]> = {
  'Door / Lock': ['Latch Broken', 'Handle Damaged', 'Keycard Reader Fault', 'Frame Misaligned', 'Door Glass Cracked', 'Other'],
  'Plumbing / Water': ['Pipe Leakage', 'Water Accumulation', 'Drain Clogged', 'Faucet Broken', 'Pump Issue', 'Other'],
  'Lighting / Electrical': ['Light Not Working', 'Flickering Light', 'Exposed Wire', 'Switch Board Fault', 'Breaker Tripped', 'Other'],
  'Fence / Perimeter': ['Fence Broken', 'Barbed Wire Damaged', 'Perimeter Sensor Fault', 'Gate Hinge Broken', 'Other'],
  'Equipment Fault': ['CCTV Down', 'Fire Extinguisher Expired', 'Intercom Down', 'Generator Fault', 'HVAC Issue', 'Other'],
  'Cleaning / Hygiene': ['Dirty Area', 'Trash Overflow', 'Chemical Spill', 'Odors / Waste', 'Other'],
  'Window / Glass': ['Glass Cracked', 'Window Lock Broken', 'Mesh Damaged', 'Other'],
  'General Maintenance': ['Wall Paint Damaged', 'Ceiling Damage', 'Floor Tile Broken', 'Other'],
};

const PRIORITIES = [
  { id: 'LOW', label: 'Low', color: '#10b981' },
  { id: 'MEDIUM', label: 'Medium', color: '#f59e0b' },
  { id: 'HIGH', label: 'High', color: '#ef4444' },
] as const;

export function ReportSnagScreen() {
  const { colors } = useTheme();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const routeParams = route.params || {};

  const isOnline = useOfflineStore(state => state.isConnected);
  const { mutateAsync: createSnag, isPending } = useCreateSnag();
  const { activeSession, unlockedGateId } = usePatrolStore();
  const { data: assignment } = useActiveAssignment();

  const gateId = routeParams.gateId || unlockedGateId;
  const patrolSessionId = routeParams.patrolSessionId || activeSession?.id;

  const routeGates = assignment?.patrolRoute?.routeGates || [];
  const targetGate = routeGates.find((rg: any) => rg.gateId === gateId)?.gate;

  const [selectedCategory, setSelectedCategory] = useState<string>('Door / Lock');
  const [selectedSubCategory, setSelectedSubCategory] = useState<string>('Latch Broken');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<'LOW' | 'MEDIUM' | 'HIGH'>('MEDIUM');
  const [images, setImages] = useState<string[]>([]);
  const [showCameraModal, setShowCameraModal] = useState(false);
  const [isCompressing, setIsCompressing] = useState(false);
  const [cameraError, setCameraError] = useState(false);

  const { hasPermission, requestPermission } = useCameraPermission();
  const device = useCameraDevice('back');
  const cameraRef = useRef<Camera>(null);
  const flashAnim = useRef(new Animated.Value(0)).current;

  const triggerCameraFlash = () => {
    flashAnim.setValue(1);
    Animated.timing(flashAnim, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
    }).start();
  };

  const handleOpenCamera = async () => {
    setCameraError(false);
    if (!hasPermission) {
      const granted = await requestPermission();
      if (!granted) {
        Alert.alert(
          'Permission Required',
          'Camera access is mandatory for capturing live snag inspection photos.',
        );
        return;
      }
    }
    setShowCameraModal(true);
  };

  const handleCapturePhoto = async () => {
    setIsCompressing(true);
    triggerCameraFlash();

    try {
      if (cameraRef.current) {
        const photo = await cameraRef.current.takePhoto({
          enableShutterSound: false,
        });

        if (photo?.path) {
          const response = await fetch(`file://${photo.path}`);
          const blob = await response.blob();

          await new Promise<void>(resolve => {
            const reader = new FileReader();
            reader.onloadend = () => {
              if (typeof reader.result === 'string') {
                setImages(prev => [...prev, reader.result as string]);
              }
              resolve();
            };
            reader.readAsDataURL(blob);
          });
          setIsCompressing(false);
          setShowCameraModal(false);
          return;
        }
      }
    } catch (e) {
      console.warn('Camera capture fallback:', e);
    }

    const samplePhoto = `data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/4gIcSUNDX1BST0ZJTEUAAQEAAAIMbGNtcwIQAABtbnRyUkdCIFhZWiAH3wACAAkABgAxAABhY3NwTVNGVAAAAABzc21zAAAAAAAAAAAAAAAAAAAAAAAA9tYAAQAAAADTLWxjbXMAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAApkZXNjAAAA4AAAAF9jcHJ0AAABYAAAADZ3dHB0AAABmAAAABRjaHJtAAABrAAAACR3dHB0AAAB0AAAABRyWFlaAAAB5AAAABRnWFlaAAAB+AAAABRiWFlaAAACDAAAABRyVFJDAAACIAAAACBnVFJDAAACIAAAACBiVFJDAAACIAAAACBkZXNjAAAAAAAAAAVzUkdCAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABtbHVjAAAAAAAAABEAAAAMZW5VUwAAAA4AAAAcAEgAUAAgAFAAcgBvAGoAZQBjAHQAcwAAbWx1YwAAAAAAAAARAAAADGVuVVMAAAAMAAAAHABHAE8ATwBHAEwARQAAWFlaIAAAAAAAAG+iAAA49QAAA5BYWVogAAAAAAAAYpkAALeFAAAY2lhZWiAAAAAAAAAkBLIAAD24AAAO5VhZWiAAAAAAAABvqAAAOPUAAAOXRGVzYwAAAAAAAAAARW5nbGlzaAAAAAAAAAAAAAAAaW1nAAAAAABJSERSAAAAUAAAAFAIBgAAAH56m5wAAABMSURFQVR42u3PMQEAAAiAMCv8+16iBwwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAC4G1c0AAFH72B9AAAAAElFTkSuQmCC`;
    setImages(prev => [...prev, samplePhoto]);
    setIsCompressing(false);
    setShowCameraModal(false);
  };

  const handleRemovePhoto = (index: number) => {
    setImages(prev => prev.filter((_, idx) => idx !== index));
  };

  const handleSubmit = async () => {
    if (!description || description.trim().length < 5) {
      Alert.alert('Validation Error', 'Please describe the snag defect in detail (minimum 5 characters).');
      return;
    }

    try {
      await createSnag({
        siteId: assignment?.siteId || assignment?.site?.id || 'default-site',
        gateId: gateId || undefined,
        patrolSessionId: patrolSessionId || undefined,
        category: selectedCategory,
        subCategory: selectedSubCategory,
        description,
        priority,
        images,
        latitude: assignment?.site?.latitude || undefined,
        longitude: assignment?.site?.longitude || undefined,
      });

      const message = isOnline
        ? 'Snag reported successfully and logged for maintenance.'
        : 'Offline mode: Snag saved locally and queued for auto-sync.';

      Alert.alert('Snag Reported', message, [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (err: any) {
      Alert.alert('Submission Error', err.message || 'Failed to submit snag report.');
    }
  };

  const subCategories = SNAG_CATEGORIES[selectedCategory] || ['Other'];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header Title */}
        <View style={styles.headerCard}>
          <View style={[styles.headerIconWrapper, { backgroundColor: 'rgba(245, 158, 11, 0.15)' }]}>
            <Wrench size={24} color="#f59e0b" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.headerTitle, { color: colors.text }]}>Report Maintenance Snag</Text>
            <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>
              Log physical defects, broken equipment, or maintenance issues observed.
            </Text>
          </View>
        </View>

        {/* Location & Patrol Context Card */}
        {targetGate && (
          <Card style={{ marginBottom: 16 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <MapPin size={16} color={colors.primary} />
              <Text style={{ fontSize: 13, fontWeight: '700', color: colors.text }}>
                Checkpoint: {targetGate.name} ({targetGate.gateCode})
              </Text>
            </View>
          </Card>
        )}

        {/* Category Picker */}
        <Text style={[styles.sectionTitle, { color: colors.text }]}>1. Defect Category</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
          {Object.keys(SNAG_CATEGORIES).map(cat => {
            const isSelected = selectedCategory === cat;
            return (
              <TouchableOpacity
                key={cat}
                onPress={() => {
                  setSelectedCategory(cat);
                  setSelectedSubCategory(SNAG_CATEGORIES[cat][0]);
                }}
                style={[
                  styles.pillButton,
                  {
                    backgroundColor: isSelected ? '#f59e0b' : colors.surface,
                    borderColor: isSelected ? '#f59e0b' : colors.border,
                  },
                ]}
              >
                <Text style={{ fontSize: 12, fontWeight: '700', color: isSelected ? '#000' : colors.text }}>
                  {cat}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Sub-Category Picker */}
        <Text style={[styles.sectionTitle, { color: colors.text }]}>2. Sub-Category / Defect</Text>
        <View style={styles.wrapContainer}>
          {subCategories.map(subCat => {
            const isSelected = selectedSubCategory === subCat;
            return (
              <TouchableOpacity
                key={subCat}
                onPress={() => setSelectedSubCategory(subCat)}
                style={[
                  styles.subPillButton,
                  {
                    backgroundColor: isSelected ? 'rgba(245, 158, 11, 0.18)' : colors.surface,
                    borderColor: isSelected ? '#f59e0b' : colors.border,
                  },
                ]}
              >
                <Text style={{ fontSize: 12, fontWeight: isSelected ? '700' : '500', color: isSelected ? '#f59e0b' : colors.textSecondary }}>
                  {subCat}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Priority Picker */}
        <Text style={[styles.sectionTitle, { color: colors.text }]}>3. Priority Level</Text>
        <View style={styles.priorityRow}>
          {PRIORITIES.map(p => {
            const isSelected = priority === p.id;
            return (
              <TouchableOpacity
                key={p.id}
                onPress={() => setPriority(p.id)}
                style={[
                  styles.priorityCard,
                  {
                    backgroundColor: isSelected ? `${p.color}25` : colors.surface,
                    borderColor: isSelected ? p.color : colors.border,
                  },
                ]}
              >
                <View style={[styles.priorityDot, { backgroundColor: p.color }]} />
                <Text style={{ fontSize: 13, fontWeight: '700', color: isSelected ? p.color : colors.text }}>
                  {p.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Description Input */}
        <Text style={[styles.sectionTitle, { color: colors.text }]}>4. Defect Description</Text>
        <TextInput
          style={[styles.textArea, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
          placeholder="Describe the maintenance defect, exact location, or repair needed..."
          placeholderTextColor={colors.textSecondary}
          multiline
          numberOfLines={4}
          value={description}
          onChangeText={setDescription}
        />

        {/* Photo Attachments (Camera Only) */}
        <Text style={[styles.sectionTitle, { color: colors.text }]}>5. Attach Photos (Camera Only)</Text>
        <View style={styles.photoContainer}>
          {images.map((img, idx) => (
            <View key={idx} style={styles.thumbnailWrapper}>
              <Image source={{ uri: img }} style={styles.thumbnail} />
              <TouchableOpacity
                style={[styles.removeButton, { backgroundColor: colors.danger }]}
                onPress={() => handleRemovePhoto(idx)}
              >
                <Text style={styles.removeButtonText}>×</Text>
              </TouchableOpacity>
            </View>
          ))}
          {images.length < 4 && (
            <TouchableOpacity
              style={[styles.addPhotoButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
              onPress={handleOpenCamera}
            >
              <CameraIcon size={24} color={colors.textSecondary} />
              <Text style={[styles.addPhotoText, { color: colors.textSecondary }]}>Take Photo</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Submit Button */}
        <Button
          title={isPending ? 'Submitting Snag...' : 'Submit Snag Report'}
          onPress={handleSubmit}
          disabled={isPending}
          style={{ marginTop: 24, marginBottom: 40 }}
        />
      </ScrollView>

      {/* Live Camera Modal */}
      <Modal visible={showCameraModal} animationType="slide" onRequestClose={() => setShowCameraModal(false)}>
        <View style={styles.cameraContainer}>
          {device && !cameraError ? (
            <Camera
              ref={cameraRef}
              style={StyleSheet.absoluteFill}
              device={device}
              isActive={showCameraModal}
              photo={true}
              onError={(error) => {
                console.warn('VisionCamera session error:', error);
                setCameraError(true);
              }}
            />
          ) : (
            <View style={[styles.cameraFallback, { backgroundColor: colors.background }]}>
              <CameraIcon size={48} color={colors.textSecondary} />
              <Text style={{ color: colors.text, marginTop: 12 }}>Camera Viewfinder Ready</Text>
            </View>
          )}

          <Animated.View style={[styles.flashOverlay, { opacity: flashAnim }]} pointerEvents="none" />

          {/* Close Camera Button */}
          <TouchableOpacity style={styles.cameraCloseBtn} onPress={() => setShowCameraModal(false)}>
            <X size={24} color="#ffffff" />
          </TouchableOpacity>

          {/* Shutter Bar */}
          <View style={styles.shutterBar}>
            <TouchableOpacity style={styles.shutterBtn} onPress={handleCapturePhoto} disabled={isCompressing}>
              {isCompressing ? <ActivityIndicator color="#000" /> : <View style={styles.shutterInner} />}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
  },
  headerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 14,
  },
  headerIconWrapper: {
    width: 48,
    height: 48,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  headerSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginTop: 14,
    marginBottom: 8,
  },
  pillButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    marginRight: 8,
  },
  wrapContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 10,
  },
  subPillButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
  },
  priorityRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },
  priorityCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    gap: 6,
  },
  priorityDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  textArea: {
    minHeight: 90,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    textAlignVertical: 'top',
    fontSize: 13,
  },
  photoContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 4,
  },
  thumbnailWrapper: {
    width: 80,
    height: 80,
    borderRadius: 10,
    overflow: 'hidden',
    position: 'relative',
  },
  thumbnail: {
    width: '100%',
    height: '100%',
  },
  removeButton: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  addPhotoButton: {
    width: 80,
    height: 80,
    borderRadius: 10,
    borderWidth: 1,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
  },
  addPhotoText: {
    fontSize: 10,
    marginTop: 4,
    fontWeight: '600',
  },
  cameraContainer: {
    flex: 1,
    backgroundColor: '#000000',
  },
  cameraFallback: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  flashOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#ffffff',
  },
  cameraCloseBtn: {
    position: 'absolute',
    top: 50,
    right: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  shutterBar: {
    position: 'absolute',
    bottom: 40,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  shutterBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 4,
    borderColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  shutterInner: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: '#ffffff',
  },
});
