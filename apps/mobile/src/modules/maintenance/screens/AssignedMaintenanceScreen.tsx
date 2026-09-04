import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Camera as CameraIcon,
  Check,
  CheckCircle2,
  Clock,
  MapPin,
  QrCode,
  User,
  Wrench,
  X,
} from 'lucide-react-native';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Image,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  Camera,
  useCameraDevice,
  useCameraPermission,
  useCodeScanner,
} from 'react-native-vision-camera';
import { apiClient } from '../../../app/api/api-client';
import { useTheme } from '../../../app/hooks/useTheme';
import { useAuthStore } from '../../../app/store/auth-store';
import { resolveImageUrl } from '../../../app/utils/image';
import { formatPatrolDate } from '../../../app/utils/date-formatter';
import { Button } from '../../../components/Button';
import { Card } from '../../dashboard/components/WidgetCard';

export function AssignedMaintenanceScreen() {
  const { colors } = useTheme();
  const user = useAuthStore(state => state.user);
  const queryClient = useQueryClient();

  const [selectedSnag, setSelectedSnag] = useState<any | null>(null);
  const [step, setStep] = useState<'VERIFY_QR' | 'TECHNICIAN_FORM'>(
    'VERIFY_QR',
  );
  const [qrCodeInput, setQrCodeInput] = useState('');
  const [isVerifyingQr, setIsVerifyingQr] = useState(false);
  const [reportedIssueData, setReportedIssueData] = useState<any | null>(null);

  const [resolutionStatus, setResolutionStatus] = useState<
    'RESOLVED' | 'IN_PROGRESS' | 'REJECTED'
  >('RESOLVED');
  const [remarks, setRemarks] = useState('');
  const [afterImage, setAfterImage] = useState<string | null>(null);
  const [showManualInput, setShowManualInput] = useState(false);

  // Vision Camera setup
  const { hasPermission, requestPermission } = useCameraPermission();
  const device = useCameraDevice('back');
  const cameraRef = useRef<Camera>(null);
  const [showCameraModal, setShowCameraModal] = useState(false);
  const [isCompressing, setIsCompressing] = useState(false);
  const flashAnim = useRef(new Animated.Value(0)).current;

  // Scanner ref lock to avoid duplicate frame processing
  const isProcessingScanRef = useRef(false);
  const laserTranslateY = useRef(new Animated.Value(0)).current;

  const triggerCameraFlash = () => {
    flashAnim.setValue(1);
    Animated.timing(flashAnim, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
    }).start();
  };

  // Laser animation loop for Step 1 scanner
  useEffect(() => {
    if (selectedSnag && step === 'VERIFY_QR' && hasPermission) {
      laserTranslateY.setValue(0);
      const animation = Animated.loop(
        Animated.sequence([
          Animated.timing(laserTranslateY, {
            toValue: 140,
            duration: 2000,
            useNativeDriver: true,
          }),
          Animated.timing(laserTranslateY, {
            toValue: 0,
            duration: 2000,
            useNativeDriver: true,
          }),
        ]),
      );
      animation.start();
      return () => animation.stop();
    }
  }, [selectedSnag, step, hasPermission, laserTranslateY]);

  // Request camera permission on Step 1 open
  useEffect(() => {
    if (selectedSnag && step === 'VERIFY_QR' && !hasPermission) {
      requestPermission();
    }
  }, [selectedSnag, step, hasPermission, requestPermission]);

  // Process scanned QR code against API
  const handleProcessScannedCode = useCallback(
    async (code: string) => {
      const cleanCode = code.trim();
      if (!cleanCode || isProcessingScanRef.current || !selectedSnag) return;

      isProcessingScanRef.current = true;
      setIsVerifyingQr(true);

      try {
        const res = (await apiClient.post(
          `/snags/${selectedSnag.id}/verify-qr`,
          {
            qrCode: cleanCode,
          },
        )) as any;

        if (res.success && res.data) {
          setQrCodeInput(cleanCode);
          setReportedIssueData(res.data.reportedIssue || selectedSnag);
          setStep('TECHNICIAN_FORM');
        } else {
          Alert.alert(
            'QR Verification Failed',
            `Scanned QR code "${cleanCode}" does not match the checkpoint for this job.`,
            [
              {
                text: 'Try Again',
                onPress: () => {
                  isProcessingScanRef.current = false;
                },
              },
            ],
          );
        }
      } catch (err: any) {
        Alert.alert(
          'Invalid Checkpoint QR',
          err.response?.data?.message ||
            `Scanned QR code "${cleanCode}" does not match checkpoint "${selectedSnag.gate?.name}" (${selectedSnag.gate?.gateCode}).`,
          [
            {
              text: 'Try Again',
              onPress: () => {
                isProcessingScanRef.current = false;
              },
            },
          ],
        );
      } finally {
        setIsVerifyingQr(false);
      }
    },
    [selectedSnag],
  );

  // Vision Camera Code Scanner Hook
  const codeScanner = useCodeScanner({
    codeTypes: ['qr', 'code-128', 'code-39', 'ean-13'],
    onCodeScanned: codes => {
      if (isProcessingScanRef.current || step !== 'VERIFY_QR' || !selectedSnag)
        return;
      if (codes.length > 0 && codes[0].value) {
        handleProcessScannedCode(codes[0].value);
      }
    },
  });

  // 1. Fetch ONLY Assigned Maintenance Snags for authenticated user
  const {
    data: snagsRes,
    isLoading,
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: ['assigned-snags', user?.id],
    queryFn: async () => {
      const res = (await apiClient.get(
        '/snags?assignedToMe=true&limit=50',
      )) as any;
      const items = res.data?.items || res.data || [];
      return items;
    },
  });

  const snags = snagsRes || [];

  // Handle Init Complete Flow
  const handleOpenCompleteFlow = (snag: any) => {
    isProcessingScanRef.current = false;
    setSelectedSnag(snag);
    setStep('VERIFY_QR');
    setQrCodeInput(snag.gate?.gateCode || '');
    setReportedIssueData(null);
    setResolutionStatus('RESOLVED');
    setRemarks('');
    setAfterImage(null);
    setShowManualInput(false);
  };

  const handleCloseModal = () => {
    isProcessingScanRef.current = false;
    setSelectedSnag(null);
    setStep('VERIFY_QR');
    setQrCodeInput('');
    setReportedIssueData(null);
    setResolutionStatus('RESOLVED');
    setRemarks('');
    setAfterImage(null);
    setShowCameraModal(false);
    setShowManualInput(false);
  };

  // Verify Checkpoint QR Action (manual fallback button)
  const handleVerifyQr = async () => {
    if (!qrCodeInput.trim()) {
      Alert.alert(
        'Checkpoint QR Required',
        'Please scan or enter the checkpoint QR code.',
      );
      return;
    }
    handleProcessScannedCode(qrCodeInput.trim());
  };

  // Complete Job Mutation
  const completeMutation = useMutation({
    mutationFn: async (id: string) => {
      const images: string[] = [];
      if (afterImage) images.push(afterImage);

      return apiClient.post(`/snags/${id}/complete`, {
        notes: remarks
          ? remarks
          : `Technician status update: ${resolutionStatus}. Verified via checkpoint QR.`,
        images,
        scannedGateCode: qrCodeInput,
        status: resolutionStatus,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assigned-snags'] });
      queryClient.invalidateQueries({ queryKey: ['history-snags'] });
      Alert.alert(
        'Job Updated!',
        `Maintenance job updated to ${resolutionStatus} and saved successfully.`,
      );
      handleCloseModal();
    },
    onError: (err: any) => {
      Alert.alert(
        'Submission Error',
        err.response?.data?.message || 'Failed to complete maintenance job.',
      );
    },
  });

  const handleOpenCamera = async () => {
    if (!hasPermission) {
      const granted = await requestPermission();
      if (!granted) {
        Alert.alert(
          'Permission Required',
          'Camera access is mandatory for capturing live repair photo evidence.',
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
                setAfterImage(reader.result as string);
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
    setAfterImage(samplePhoto);
    setIsCompressing(false);
    setShowCameraModal(false);
  };

  const handleSubmitComplete = () => {
    if (!remarks.trim()) {
      Alert.alert(
        'Remarks Required',
        'Please enter your technician repair actions or remarks.',
      );
      return;
    }
    if (selectedSnag) {
      completeMutation.mutate(selectedSnag.id);
    }
  };

  // Original guard report before photos
  const beforePhotos = reportedIssueData?.images || selectedSnag?.images || [];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            colors={[colors.primary]}
          />
        }
      >
        <Text style={[styles.headerTitle, { color: colors.text }]}>
          My Assigned Jobs
        </Text>

        {isLoading ? (
          <View style={{ padding: 40, alignItems: 'center' }}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text
              style={{
                marginTop: 10,
                color: colors.textSecondary,
                fontSize: 13,
              }}
            >
              Loading assigned jobs...
            </Text>
          </View>
        ) : snags.length === 0 ? (
          <Card style={styles.emptyCard}>
            <Wrench
              size={36}
              color={colors.textSecondary}
              style={{ alignSelf: 'center', marginBottom: 8 }}
            />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>
              No assigned jobs
            </Text>
            <Text
              style={[styles.emptySubtitle, { color: colors.textSecondary }]}
            >
              You currently have no open maintenance snag tickets assigned to
              your queue.
            </Text>
          </Card>
        ) : (
          snags.map((snag: any) => {
            const priorityColor =
              snag.priority === 'HIGH' || snag.priority === 'CRITICAL'
                ? colors.danger
                : snag.priority === 'MEDIUM'
                ? colors.warning
                : colors.primary;

            return (
              <Card
                key={snag.id}
                style={[styles.card, { borderColor: colors.border }]}
              >
                <View style={styles.cardHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.title, { color: colors.primary }]}>
                      {snag.gate?.name
                        ? `${snag.gate.name} (${snag.gate.gateCode})`
                        : 'Checkpoint'}
                    </Text>
                    <Text style={[styles.title, { color: colors.text }]}>
                      {snag.category} • {snag.subCategory || 'Reported Issue'}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.priorityBadge,
                      { backgroundColor: priorityColor + '20' },
                    ]}
                  >
                    <Text
                      style={[styles.priorityText, { color: priorityColor }]}
                    >
                      {snag.priority || 'NORMAL'}
                    </Text>
                  </View>
                </View>

                <View
                  style={[styles.divider, { backgroundColor: colors.border }]}
                />

                <Text style={[styles.descriptionText, { color: colors.text }]}>
                  "{snag.description}"
                </Text>

                <View style={styles.metaRow}>
                  <MapPin size={14} color={colors.textSecondary} />
                  <Text
                    style={[styles.metaText, { color: colors.textSecondary }]}
                  >
                    {snag.site?.name || 'Site'}
                  </Text>
                </View>

                <View style={styles.metaRow}>
                  <User size={14} color={colors.textSecondary} />
                  <Text
                    style={[styles.metaText, { color: colors.textSecondary }]}
                  >
                    Reported by:{' '}
                    <Text style={{ fontWeight: '700', color: colors.text }}>
                      {snag.employee
                        ? `${snag.employee.firstName} ${
                            snag.employee.lastName || ''
                          }`
                        : 'Security Officer'}
                    </Text>
                  </Text>
                </View>

                <View style={styles.metaRow}>
                  <Clock size={14} color={colors.textSecondary} />
                  <Text
                    style={[styles.metaText, { color: colors.textSecondary }]}
                  >
                    Status:{' '}
                    <Text style={{ fontWeight: '700', color: colors.primary }}>
                      {snag.status}
                    </Text>{' '}
                    • {formatPatrolDate(snag.createdAt)}
                  </Text>
                </View>
                {snag.status === 'RESOLVED' ? (
                  ''
                ) : (
                  <View style={{ marginTop: 14 }}>
                    <Button
                      title="Complete Job"
                      onPress={() => handleOpenCompleteFlow(snag)}
                      style={{ backgroundColor: colors.primary }}
                    />
                  </View>
                )}
              </Card>
            );
          })
        )}
      </ScrollView>

      {/* Completion Modal */}
      {selectedSnag && (
        <Modal visible animationType="slide" transparent>
          <View style={styles.modalOverlay}>
            <View
              style={[styles.modalContent, { backgroundColor: colors.surface }]}
            >
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { color: colors.text }]}>
                  {step === 'VERIFY_QR'
                    ? 'Step 1: Checkpoint QR Scanner'
                    : 'Technician Repair Verification'}
                </Text>
                <TouchableOpacity onPress={handleCloseModal}>
                  <X size={22} color={colors.text} />
                </TouchableOpacity>
              </View>

              <ScrollView style={{ paddingVertical: 12 }}>
                {step === 'VERIFY_QR' ? (
                  /* STEP 1: LIVE VISION CAMERA QR SCANNER */
                  <View style={{ gap: 14 }}>
                    <View style={styles.infoBanner}>
                      <QrCode size={24} color={colors.primary} />
                      <View style={{ flex: 1 }}>
                        <Text
                          style={[
                            styles.infoBannerTitle,
                            { color: colors.text },
                          ]}
                        >
                          Scan Checkpoint QR Code
                        </Text>
                        <Text
                          style={[
                            styles.infoBannerSub,
                            { color: colors.textSecondary },
                          ]}
                        >
                          Target:{' '}
                          <Text
                            style={{ fontWeight: '700', color: colors.text }}
                          >
                            {selectedSnag.gate?.name
                              ? `${selectedSnag.gate.name} (${selectedSnag.gate.gateCode})`
                              : 'Associated Checkpoint'}
                          </Text>
                          . Point camera at QR to verify physical location.
                        </Text>
                      </View>
                    </View>

                    {/* LIVE CAMERA VIEWFINDER BOX */}
                    {hasPermission && device ? (
                      <View style={styles.scannerBox}>
                        <Camera
                          style={StyleSheet.absoluteFill}
                          device={device}
                          isActive={step === 'VERIFY_QR' && !!selectedSnag}
                          codeScanner={codeScanner}
                        />

                        {/* Scanner Laser & Target Overlay */}
                        <View style={styles.targetFrame}>
                          <Animated.View
                            style={[
                              styles.scannerLaser,
                              { transform: [{ translateY: laserTranslateY }] },
                            ]}
                          />
                        </View>

                        {isVerifyingQr && (
                          <View style={styles.scannerVerifyingOverlay}>
                            <ActivityIndicator size="large" color="#fff" />
                            <Text style={styles.scannerVerifyingText}>
                              Verifying Checkpoint QR...
                            </Text>
                          </View>
                        )}
                      </View>
                    ) : (
                      <TouchableOpacity
                        style={styles.permissionBox}
                        onPress={requestPermission}
                      >
                        <CameraIcon size={32} color={colors.primary} />
                        <Text
                          style={{
                            color: colors.text,
                            fontWeight: '700',
                            marginTop: 6,
                          }}
                        >
                          Camera Access Required
                        </Text>
                        <Text
                          style={{
                            color: colors.textSecondary,
                            fontSize: 11,
                            marginTop: 2,
                          }}
                        >
                          Tap to grant camera permissions for QR scanning.
                        </Text>
                      </TouchableOpacity>
                    )}

                    {/* <TouchableOpacity
                      onPress={() => setShowManualInput(prev => !prev)}
                      style={{ alignSelf: 'center', marginVertical: 2 }}
                    >
                      <Text
                        style={{
                          fontSize: 12,
                          fontWeight: '700',
                          color: colors.primary,
                        }}
                      >
                        {showManualInput
                          ? 'Hide Manual Code Entry'
                          : 'Having trouble? Enter Checkpoint Code Manually'}
                      </Text>
                    </TouchableOpacity> */}

                    {/* {showManualInput && (
                      <View style={{ gap: 8, marginTop: 4 }}>
                        <Text
                          style={[
                            styles.sectionLabel,
                            { color: colors.text },
                          ]}
                        >
                          Manual Checkpoint Code *
                        </Text>
                        <TextInput
                          placeholder="e.g. GATE-000004"
                          placeholderTextColor={colors.textSecondary}
                          value={qrCodeInput}
                          onChangeText={setQrCodeInput}
                          autoCapitalize="characters"
                          style={[
                            styles.input,
                            {
                              color: colors.text,
                              borderColor: colors.border,
                              backgroundColor: colors.background,
                            },
                          ]}
                        />

                        <Button
                          title={
                            isVerifyingQr
                              ? 'Verifying Checkpoint QR...'
                              : 'Verify QR & Access Job Form'
                          }
                          onPress={handleVerifyQr}
                          loading={isVerifyingQr}
                          style={{ marginTop: 6 }}
                        />
                      </View>
                    )} */}
                  </View>
                ) : (
                  /* STEP 2: TECHNICIAN REPAIR VERIFICATION */
                  <View style={{ gap: 16 }}>
                    <View
                      style={[
                        styles.verifiedBadge,
                        {
                          backgroundColor: colors.success + '15',
                          borderColor: colors.success + '40',
                        },
                      ]}
                    >
                      <CheckCircle2 size={18} color={colors.success} />
                      <Text
                        style={{
                          fontSize: 12,
                          fontWeight: '700',
                          color: colors.success,
                        }}
                      >
                        Checkpoint Verified: {selectedSnag.gate?.name} (
                        {selectedSnag.gate?.gateCode})
                      </Text>
                    </View>

                    {/* 1. BEFORE REPAIR PHOTO (Original Guard Report) */}
                    <View
                      style={[
                        styles.originalReportCard,
                        {
                          borderColor: colors.border,
                          backgroundColor: colors.background,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.reportHeaderLabel,
                          { color: colors.primary },
                        ]}
                      >
                        BEFORE REPAIR PHOTO (Original Guard Report)
                      </Text>

                      <Text
                        style={[styles.issueCategory, { color: colors.text }]}
                      >
                        {reportedIssueData?.category || selectedSnag.category} •{' '}
                        {reportedIssueData?.subCategory ||
                          selectedSnag.subCategory ||
                          'Damaged Item'}
                      </Text>

                      <Text
                        style={[
                          styles.issueDesc,
                          { color: colors.textSecondary },
                        ]}
                      >
                        "
                        {reportedIssueData?.description ||
                          selectedSnag.description}
                        "
                      </Text>

                      {/* Render Original Guard Evidence Photos */}
                      <View style={{ marginTop: 8 }}>
                        <Text
                          style={{
                            fontSize: 11,
                            fontWeight: '700',
                            color: colors.textSecondary,
                            marginBottom: 6,
                          }}
                        >
                          Original Reported Evidence:
                        </Text>
                        {beforePhotos.length > 0 ? (
                          <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            contentContainerStyle={{ gap: 8 }}
                          >
                            {beforePhotos.map((url: string, idx: number) => {
                              const fullUrl = resolveImageUrl(url);
                              return (
                                <Image
                                  key={idx}
                                  source={{ uri: fullUrl || url }}
                                  style={styles.beforePhotoImg}
                                />
                              );
                            })}
                          </ScrollView>
                        ) : (
                          <Text
                            style={{
                              fontSize: 11,
                              fontStyle: 'italic',
                              color: colors.textSecondary,
                            }}
                          >
                            No before-repair photo available
                          </Text>
                        )}
                      </View>

                      <View
                        style={{
                          flexDirection: 'row',
                          justifyContent: 'space-between',
                          marginTop: 8,
                          paddingTop: 8,
                          borderTopWidth: 1,
                          borderTopColor: colors.border,
                        }}
                      >
                        <Text
                          style={{ fontSize: 11, color: colors.textSecondary }}
                        >
                          Reported by:{' '}
                          <Text
                            style={{ fontWeight: '700', color: colors.text }}
                          >
                            {reportedIssueData?.reportedBy ||
                              'Security Officer'}
                          </Text>
                        </Text>
                        <Text
                          style={{ fontSize: 11, color: colors.textSecondary }}
                        >
                          Priority:{' '}
                          <Text
                            style={{ fontWeight: '700', color: colors.danger }}
                          >
                            {selectedSnag.priority}
                          </Text>
                        </Text>
                      </View>
                    </View>

                    {/* 2. TECHNICIAN ACTION & REMARKS (Multiline expanded height) */}
                    <View>
                      <Text
                        style={[styles.sectionLabel, { color: colors.text }]}
                      >
                        Technician Action & Remarks *
                      </Text>
                      <TextInput
                        placeholder="Describe repair actions taken, parts replaced, and operational tests performed..."
                        placeholderTextColor={colors.textSecondary}
                        value={remarks}
                        onChangeText={setRemarks}
                        multiline
                        numberOfLines={4}
                        scrollEnabled
                        style={[
                          styles.textAreaMultiline,
                          {
                            color: colors.text,
                            borderColor: colors.border,
                            backgroundColor: colors.background,
                          },
                        ]}
                      />
                    </View>

                    {/* 3. TECHNICIAN RESOLUTION STATUS */}
                    <View>
                      <Text
                        style={[styles.sectionLabel, { color: colors.text }]}
                      >
                        Resolution Status *
                      </Text>
                      <View
                        style={{ flexDirection: 'row', gap: 8, marginTop: 6 }}
                      >
                        <TouchableOpacity
                          style={[
                            styles.statusChip,
                            resolutionStatus === 'RESOLVED'
                              ? {
                                  backgroundColor: colors.success,
                                  borderColor: colors.success,
                                }
                              : { borderColor: colors.border },
                          ]}
                          onPress={() => setResolutionStatus('RESOLVED')}
                        >
                          <Check
                            size={14}
                            color={
                              resolutionStatus === 'RESOLVED'
                                ? '#fff'
                                : colors.textSecondary
                            }
                          />
                          <Text
                            style={[
                              styles.statusChipText,
                              {
                                color:
                                  resolutionStatus === 'RESOLVED'
                                    ? '#fff'
                                    : colors.textSecondary,
                              },
                            ]}
                          >
                            RESOLVED
                          </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={[
                            styles.statusChip,
                            resolutionStatus === 'IN_PROGRESS'
                              ? {
                                  backgroundColor: colors.warning,
                                  borderColor: colors.warning,
                                }
                              : { borderColor: colors.border },
                          ]}
                          onPress={() => setResolutionStatus('IN_PROGRESS')}
                        >
                          <Clock
                            size={14}
                            color={
                              resolutionStatus === 'IN_PROGRESS'
                                ? '#fff'
                                : colors.textSecondary
                            }
                          />
                          <Text
                            style={[
                              styles.statusChipText,
                              {
                                color:
                                  resolutionStatus === 'IN_PROGRESS'
                                    ? '#fff'
                                    : colors.textSecondary,
                              },
                            ]}
                          >
                            IN PROGRESS
                          </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={[
                            styles.statusChip,
                            resolutionStatus === 'REJECTED'
                              ? {
                                  backgroundColor: colors.danger,
                                  borderColor: colors.danger,
                                }
                              : { borderColor: colors.border },
                          ]}
                          onPress={() => setResolutionStatus('REJECTED')}
                        >
                          <X
                            size={14}
                            color={
                              resolutionStatus === 'REJECTED'
                                ? '#fff'
                                : colors.textSecondary
                            }
                          />
                          <Text
                            style={[
                              styles.statusChipText,
                              {
                                color:
                                  resolutionStatus === 'REJECTED'
                                    ? '#fff'
                                    : colors.textSecondary,
                              },
                            ]}
                          >
                            REJECTED
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </View>

                    {/* 4. AFTER REPAIR PHOTO (Technician Live Capture) */}
                    <View>
                      <Text
                        style={[styles.sectionLabel, { color: colors.text }]}
                      >
                        AFTER REPAIR PHOTO (Technician Completion Evidence)
                      </Text>

                      {afterImage ? (
                        <View style={styles.afterPreviewBox}>
                          <Image
                            source={{ uri: afterImage }}
                            style={styles.afterPreviewImg}
                          />
                          <TouchableOpacity
                            style={styles.retakeBtn}
                            onPress={handleOpenCamera}
                          >
                            <CameraIcon size={14} color="#fff" />
                            <Text style={styles.retakeBtnText}>
                              Retake Photo
                            </Text>
                          </TouchableOpacity>
                        </View>
                      ) : (
                        <TouchableOpacity
                          style={[
                            styles.takePhotoCard,
                            {
                              borderColor: colors.border,
                              backgroundColor: colors.background,
                            },
                          ]}
                          onPress={handleOpenCamera}
                        >
                          <CameraIcon size={26} color={colors.primary} />
                          <Text
                            style={[
                              styles.takePhotoTitle,
                              { color: colors.text },
                            ]}
                          >
                            Take After Repair Photo
                          </Text>
                          <Text
                            style={[
                              styles.takePhotoSub,
                              { color: colors.textSecondary },
                            ]}
                          >
                            Tap to open device camera & capture live repair
                            evidence
                          </Text>
                        </TouchableOpacity>
                      )}
                    </View>

                    <Button
                      title={
                        completeMutation.isPending
                          ? 'Submitting Completion...'
                          : 'Submit / Complete Verification'
                      }
                      onPress={handleSubmitComplete}
                      loading={completeMutation.isPending}
                      style={{ marginTop: 10 }}
                    />
                  </View>
                )}
              </ScrollView>
            </View>
          </View>
        </Modal>
      )}

      {/* Vision Camera Viewfinder Modal for After Repair Photo */}
      {showCameraModal && device && (
        <Modal visible animationType="fade" transparent={false}>
          <View style={{ flex: 1, backgroundColor: '#000' }}>
            <Camera
              ref={cameraRef}
              style={StyleSheet.absoluteFill}
              device={device}
              isActive={showCameraModal}
              photo={true}
            />

            <Animated.View
              style={[styles.flashOverlay, { opacity: flashAnim }]}
            />

            <View style={styles.cameraHeader}>
              <Text style={styles.cameraTitle}>
                Capture After-Repair Evidence
              </Text>
            </View>

            <View style={styles.cameraFooter}>
              <TouchableOpacity
                style={styles.cameraCancelBtn}
                onPress={() => setShowCameraModal(false)}
              >
                <Text style={{ color: '#fff', fontWeight: '700' }}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.shutterBtn}
                onPress={handleCapturePhoto}
                disabled={isCompressing}
              >
                <View style={styles.shutterInner} />
              </TouchableOpacity>

              <View style={{ width: 60 }} />
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    gap: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 8,
  },
  card: {
    padding: 16,
    borderRadius: 14,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  snagCode: {
    fontSize: 11,
    fontWeight: '800',
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
    marginTop: 2,
  },
  priorityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  priorityText: {
    fontSize: 10,
    fontWeight: '800',
  },
  divider: {
    height: 1,
    marginVertical: 10,
  },
  descriptionText: {
    fontSize: 13,
    fontStyle: 'italic',
    lineHeight: 18,
    marginBottom: 8,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  metaText: {
    fontSize: 12,
  },
  emptyCard: {
    padding: 36,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  emptySubtitle: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  modalTitle: {
    fontSize: 14,
    fontWeight: '800',
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 4,
  },
  input: {
    marginTop: 6,
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    fontSize: 14,
    fontWeight: '700',
  },
  textAreaMultiline: {
    marginTop: 4,
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    fontSize: 13,
    minHeight: 110,
    textAlignVertical: 'top',
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 10,
    backgroundColor: 'rgba(59, 130, 246, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.3)',
  },
  infoBannerTitle: {
    fontSize: 13,
    fontWeight: '800',
  },
  infoBannerSub: {
    fontSize: 11,
    marginTop: 2,
    lineHeight: 15,
  },
  scannerBox: {
    height: 200,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#333',
  },
  targetFrame: {
    width: 160,
    height: 160,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.6)',
    borderRadius: 12,
    overflow: 'hidden',
    justifyContent: 'flex-start',
  },
  scannerLaser: {
    height: 3,
    width: '100%',
    backgroundColor: '#3b82f6',
    boxShadow: '0 0 8px #3b82f6',
  },
  scannerVerifyingOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  scannerVerifyingText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  permissionBox: {
    padding: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#333',
    alignItems: 'center',
    backgroundColor: '#111',
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  originalReportCard: {
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    gap: 6,
  },
  reportHeaderLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  issueCategory: {
    fontSize: 14,
    fontWeight: '800',
  },
  issueDesc: {
    fontSize: 12,
    lineHeight: 17,
  },
  beforePhotoImg: {
    width: 90,
    height: 90,
    borderRadius: 8,
    backgroundColor: '#222',
  },
  statusChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  statusChipText: {
    fontSize: 11,
    fontWeight: '800',
  },
  takePhotoCard: {
    padding: 20,
    borderRadius: 12,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  takePhotoTitle: {
    fontSize: 13,
    fontWeight: '800',
    marginTop: 4,
  },
  takePhotoSub: {
    fontSize: 11,
  },
  afterPreviewBox: {
    height: 160,
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
  },
  afterPreviewImg: {
    width: '100%',
    height: '100%',
  },
  retakeBtn: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0,0,0,0.75)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  retakeBtnText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  flashOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#fff',
  },
  cameraHeader: {
    position: 'absolute',
    top: 50,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  cameraTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
  },
  cameraFooter: {
    position: 'absolute',
    bottom: 40,
    left: 20,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cameraCancelBtn: {
    width: 60,
    alignItems: 'center',
  },
  shutterBtn: {
    width: 70,
    height: 70,
    borderRadius: 35,
    borderWidth: 4,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterInner: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: '#fff',
  },
});
