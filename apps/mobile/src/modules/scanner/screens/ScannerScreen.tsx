import { useNavigation } from '@react-navigation/native';
import { Zap, ZapOff } from 'lucide-react-native';
import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
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
import { useTheme } from '../../../app/hooks/useTheme';
import { Button } from '../../../components/Button';
import { useActiveAssignments } from '../../assignment/hooks/useAssignment';
import { Card } from '../../dashboard/components/WidgetCard';
import { patrolApi } from '../../patrol/api/patrol.api';
import { usePatrolStore } from '../../patrol/store/patrol-store';

export function ScannerScreen() {
  const { colors } = useTheme();
  const navigation = useNavigation<any>();
  const { data: assignmentsList } = useActiveAssignments();
  const activeAssignments = assignmentsList || [];
  const { scannedGateIds, activeSession } = usePatrolStore();

  const { hasPermission, requestPermission } = useCameraPermission();
  const [manualCode, setManualCode] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [flashEnabled, setFlashEnabled] = useState(false);
  const [isProcessingCode, setIsProcessingCode] = useState(false);

  const laserTranslateY = useRef(new Animated.Value(0)).current;
  const device = useCameraDevice('back');

  useEffect(() => {
    if (!hasPermission) {
      requestPermission();
    }
  }, [hasPermission]);

  useEffect(() => {
    if (hasPermission) {
      const startLaserAnimation = () => {
        laserTranslateY.setValue(0);
        Animated.loop(
          Animated.sequence([
            Animated.timing(laserTranslateY, {
              toValue: 180,
              duration: 2000,
              useNativeDriver: true,
            }),
            Animated.timing(laserTranslateY, {
              toValue: 0,
              duration: 2000,
              useNativeDriver: true,
            }),
          ]),
        ).start();
      };
      startLaserAnimation();
    }
  }, [hasPermission, laserTranslateY]);

  const handleGrantPermission = async () => {
    const granted = await requestPermission();
    if (!granted) {
      Alert.alert(
        'Permission Required',
        'Hello Orbit requires Camera permission to scan physical QRs.',
      );
    }
  };

  const handleProcessScan = async (code: string) => {
    // Avoid double trigger scans in same tick
    if (isProcessingCode) return;
    setIsProcessingCode(true);

    setErrorMessage(null);
    setSuccessMessage(null);

    const cleanCode = code.trim();
    if (!cleanCode) {
      setIsProcessingCode(false);
      return;
    }

    let matchedGate: any = null;
    let matchedAssignment: any = null;

    // Search across employee active assignments (supports Security, Cleaner, Technician, Service Engineer, Plumber, Lifeguard)
    for (const ass of activeAssignments) {
      const routeGates =
        ass.assignmentGates && ass.assignmentGates.length > 0
          ? ass.assignmentGates.map((ag: any, idx: number) => ({
              id: ag.id,
              gateId: ag.gateId,
              gate: ag.gate,
              sequence: ag.sequence || idx + 1,
            }))
          : ass.patrolRoute?.routeGates || [];

      const found = routeGates.find(
        (rg: any) =>
          cleanCode === rg.gate?.gateCode ||
          cleanCode === rg.gateId ||
          cleanCode === rg.gate?.qrCode ||
          cleanCode === rg.gate?.nfcTag,
      );

      if (found) {
        matchedGate = found;
        matchedAssignment = ass;
        break;
      }
    }

    // Workflow Rule 1: If checkpoint is NOT assigned to logged-in employee, DO NOT unlock and REMAIN on scanner screen
    if (!matchedGate) {
      const errorMsg = 'You are not assigned to this checkpoint.';
      setErrorMessage(errorMsg);
      Alert.alert('Access Blocked', errorMsg, [
        {
          text: 'OK',
          onPress: () => {
            setTimeout(() => setIsProcessingCode(false), 1500);
          },
        },
      ]);
      // Remain on Scanner screen and re-enable scanner after 2s
      setTimeout(() => setIsProcessingCode(false), 2000);
      return;
    }

    // Workflow Rule 2: If checkpoint is already verified and locked
    if (scannedGateIds.includes(matchedGate.gateId)) {
      const gateName = matchedGate.gate?.name || cleanCode;
      const completedMsg = `Checkpoint "${gateName}" is already completed.`;
      setErrorMessage(completedMsg);
      Alert.alert('Checkpoint Already Completed', completedMsg, [
        {
          text: 'OK',
          onPress: () => {
            setTimeout(() => setIsProcessingCode(false), 1500);
          },
        },
      ]);
      // Remain on Scanner screen
      setTimeout(() => setIsProcessingCode(false), 2000);
      return;
    }

    const gateId =
      matchedGate.gateId || matchedGate.gate?.id || matchedGate.id;
    const gateName = matchedGate.gate?.name || cleanCode;

    try {
      // Auto-start patrol session if not yet active
      const currentActiveSession = usePatrolStore.getState().activeSession;
      if (!currentActiveSession && matchedAssignment?.id) {
        try {
          const startedSession = await patrolApi.startPatrol(
            matchedAssignment.id,
          );
          await usePatrolStore.getState().startSession(startedSession);
        } catch (e) {
          console.warn('Auto start patrol session fallback:', e);
        }
      }

      // Unlock checkpoint immediately
      await usePatrolStore.getState().unlockCheckpoint(gateId);

      setSuccessMessage(`✓ Checkpoint Unlocked: "${gateName}"`);
      setManualCode('');

      // Workflow Rule 3: Navigate directly to Checkpoint Verification screen (PatrolTab) and do NOT return to Home
      setTimeout(() => {
        navigation.navigate('PatrolTab');
        setIsProcessingCode(false);
      }, 400);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to unlock checkpoint.');
      setIsProcessingCode(false);
    }
  };

  // Configure Code Scanner Hook for Camera View (Vision Camera v4)
  const codeScanner = useCodeScanner({
    codeTypes: ['qr'],
    onCodeScanned: (codes) => {
      const scannedValue = codes[0]?.value;
      if (scannedValue) {
        handleProcessScan(scannedValue);
      }
    },
  });

  if (!hasPermission) {
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
        <Text style={[styles.permTitle, { color: colors.text }]}>
          Camera Permission Required
        </Text>
        <Text style={[styles.permDesc, { color: colors.textSecondary }]}>
          Hello Orbit requires camera access to scan QR check-points located at
          gates and stations.
        </Text>
        <Button
          title="Authorize Camera Access"
          onPress={handleGrantPermission}
        />
      </View>
    );
  }

  const primaryAssignment = activeAssignments[0];
  const routeGates =
    primaryAssignment?.assignmentGates &&
    primaryAssignment.assignmentGates.length > 0
      ? primaryAssignment.assignmentGates.map((ag: any, idx: number) => ({
          id: ag.id,
          gateId: ag.gateId,
          gate: ag.gate,
          sequence: ag.sequence || idx + 1,
        }))
      : primaryAssignment?.patrolRoute?.routeGates || [];
  const nextGateToScan = routeGates.find(
    (rg: any) => !scannedGateIds.includes(rg.gateId),
  );

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: '#121214' }]}
      contentContainerStyle={styles.scrollContent}
    >
      <View style={styles.headerRow}>
        <Text style={[styles.title, { color: '#ffffff' }]}>
          Scan Checkpoint QR
        </Text>
        <TouchableOpacity
          style={styles.flashButton}
          onPress={() => setFlashEnabled(!flashEnabled)}
        >
          {flashEnabled ? (
            <Zap size={22} color="#f59e0b" />
          ) : (
            <ZapOff size={22} color="#8e8e9a" />
          )}
        </TouchableOpacity>
      </View>

      {nextGateToScan && (
        <View style={styles.targetBanner}>
          <Text style={styles.targetLabel}>Target Checkpoint:</Text>
          <Text style={styles.targetName}>{nextGateToScan.gate?.name}</Text>
          <Text style={styles.targetSub}>
            Sequence Order: {nextGateToScan.sequence}
          </Text>
        </View>
      )}

      <View style={styles.viewfinderContainer}>
        <View style={[styles.reticle, flashEnabled && styles.reticleFlash]}>
          {device ? (
            <Camera
              style={StyleSheet.absoluteFill}
              device={device}
              isActive={true}
              codeScanner={codeScanner}
              torch={flashEnabled ? 'on' : 'off'}
            />
          ) : (
            <View
              style={[
                StyleSheet.absoluteFill,
                {
                  backgroundColor: '#000000',
                  justifyContent: 'center',
                  alignItems: 'center',
                },
              ]}
            >
              <Text style={{ color: '#8e8e9a', fontSize: 11 }}>
                Camera Feed Unavailable
              </Text>
            </View>
          )}

          <View
            style={[
              styles.corner,
              styles.topLeft,
              { borderColor: colors.primary },
            ]}
          />
          <View
            style={[
              styles.corner,
              styles.topRight,
              { borderColor: colors.primary },
            ]}
          />
          <View
            style={[
              styles.corner,
              styles.bottomLeft,
              { borderColor: colors.primary },
            ]}
          />
          <View
            style={[
              styles.corner,
              styles.bottomRight,
              { borderColor: colors.primary },
            ]}
          />

          <Animated.View
            style={[
              styles.laser,
              {
                backgroundColor: colors.primary,
                transform: [{ translateY: laserTranslateY }],
              },
            ]}
          />
        </View>
      </View>

      {errorMessage && (
        <Card
          style={[
            styles.feedbackCard,
            {
              borderColor: colors.danger,
              backgroundColor: colors.danger + '10',
            },
          ]}
        >
          <Text style={[styles.feedbackText, { color: colors.danger }]}>
            ⚠️ {errorMessage}
          </Text>
        </Card>
      )}

      {successMessage && (
        <Card
          style={[
            styles.feedbackCard,
            {
              borderColor: colors.success,
              backgroundColor: colors.success + '10',
            },
          ]}
        >
          <Text style={[styles.feedbackText, { color: colors.success }]}>
            {successMessage}
          </Text>
        </Card>
      )}

      <Card
        style={[
          styles.quickScanCard,
          { backgroundColor: '#1a1a1e', borderColor: '#2d2d34' },
        ]}
      >
        <Text style={styles.cardTitle}>Simulate QR Check-in</Text>
        <Text style={styles.cardDesc}>
          Select a route checkpoint to simulate scanning its QR code:
        </Text>

        <View style={styles.buttonList}>
          {routeGates.map((rg: any) => {
            const isScanned = scannedGateIds.includes(rg.gateId);
            const isNext = nextGateToScan?.gateId === rg.gateId;

            return (
              <TouchableOpacity
                key={rg.id}
                style={[
                  styles.scanOption,
                  {
                    backgroundColor: isScanned
                      ? '#2d2d34'
                      : isNext
                      ? colors.primary + '25'
                      : '#121214',
                    borderColor: isScanned
                      ? '#3e3e4a'
                      : isNext
                      ? colors.primary
                      : '#2d2d34',
                  },
                ]}
                onPress={() =>
                  handleProcessScan(rg.gate?.gateCode || rg.gateId)
                }
              >
                <Text
                  style={[
                    styles.optionText,
                    {
                      color: isScanned
                        ? '#8e8e9a'
                        : isNext
                        ? '#ffffff'
                        : '#b3b3c2',
                    },
                  ]}
                >
                  {rg.gate?.name}{' '}
                  {isScanned ? '(Completed)' : isNext ? '★ (Next Target)' : ''}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={[styles.divider, { backgroundColor: '#2d2d34' }]} />

        <Text style={styles.inputLabel}>Or Enter Manual Code Payload:</Text>
        <View style={styles.inputRow}>
          <TextInput
            style={[
              styles.input,
              {
                borderColor: '#2d2d34',
                color: '#ffffff',
                backgroundColor: '#121214',
              },
            ]}
            placeholder="e.g. GATE-001"
            placeholderTextColor="#8e8e9a"
            value={manualCode}
            onChangeText={setManualCode}
            autoCapitalize="none"
          />
          <TouchableOpacity
            style={[styles.inputButton, { backgroundColor: colors.primary }]}
            onPress={() => handleProcessScan(manualCode)}
          >
            <Text style={styles.inputButtonText}>Verify</Text>
          </TouchableOpacity>
        </View>
      </Card>
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
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  flashButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#1a1a1e',
    borderWidth: 1,
    borderColor: '#2d2d34',
  },
  targetBanner: {
    backgroundColor: '#1a1a1e',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#2d2d34',
  },
  targetLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#f59e0b',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  targetName: {
    fontSize: 16,
    fontWeight: '800',
    color: '#ffffff',
    marginTop: 2,
  },
  targetSub: {
    fontSize: 11,
    color: '#8e8e9a',
    marginTop: 2,
  },
  viewfinderContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 12,
  },
  reticle: {
    width: 240,
    height: 240,
    borderRadius: 20,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#000000',
    borderWidth: 1,
    borderColor: '#2d2d34',
  },
  reticleFlash: {
    borderColor: '#f59e0b',
  },
  corner: {
    position: 'absolute',
    width: 24,
    height: 24,
  },
  topLeft: {
    top: 12,
    left: 12,
    borderTopWidth: 3,
    borderLeftWidth: 3,
  },
  topRight: {
    top: 12,
    right: 12,
    borderTopWidth: 3,
    borderRightWidth: 3,
  },
  bottomLeft: {
    bottom: 12,
    left: 12,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
  },
  bottomRight: {
    bottom: 12,
    right: 12,
    borderBottomWidth: 3,
    borderRightWidth: 3,
  },
  laser: {
    position: 'absolute',
    left: 20,
    right: 20,
    height: 2,
    shadowColor: '#f97316',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 6,
  },
  feedbackCard: {
    padding: 14,
    borderRadius: 12,
    marginVertical: 10,
    borderWidth: 1,
  },
  feedbackText: {
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },
  quickScanCard: {
    padding: 16,
    borderRadius: 16,
    marginTop: 16,
    borderWidth: 1,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#ffffff',
    marginBottom: 4,
  },
  cardDesc: {
    fontSize: 12,
    color: '#8e8e9a',
    marginBottom: 12,
  },
  buttonList: {
    gap: 8,
  },
  scanOption: {
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  optionText: {
    fontSize: 13,
    fontWeight: '700',
  },
  divider: {
    height: 1,
    marginVertical: 16,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#b3b3c2',
    marginBottom: 8,
  },
  inputRow: {
    flexDirection: 'row',
    gap: 10,
  },
  input: {
    flex: 1,
    height: 44,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    fontSize: 13,
  },
  inputButton: {
    paddingHorizontal: 18,
    height: 44,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  inputButtonText: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 13,
  },
  permTitle: {
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 8,
    textAlign: 'center',
  },
  permDesc: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
});
