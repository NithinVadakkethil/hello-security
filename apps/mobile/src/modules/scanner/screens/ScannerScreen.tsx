import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated, TextInput, TouchableOpacity, Alert, ScrollView } from 'react-native';
import { useTheme } from '../../../app/hooks/useTheme';
import { usePatrolStore } from '../../patrol/store/patrol-store';
import { useActiveAssignment } from '../../assignment/hooks/useAssignment';
import { storage } from '../../../app/utils/mmkv-storage';
import { Card } from '../../dashboard/components/WidgetCard';
import { Button } from '../../../components/Button';
import { useNavigation } from '@react-navigation/native';
import { Zap, ZapOff, RefreshCw } from 'lucide-react-native';

const PERMISSION_KEY = 'camera_permission_granted';

export function ScannerScreen() {
  const { colors } = useTheme();
  const navigation = useNavigation();
  const { data: assignment } = useActiveAssignment();
  const { scannedGateIds } = usePatrolStore();

  const [hasPermission, setHasPermission] = useState(storage.getBoolean(PERMISSION_KEY) || false);
  const [manualCode, setManualCode] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [flashEnabled, setFlashEnabled] = useState(false);

  const laserTranslateY = useRef(new Animated.Value(0)).current;

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
          ])
        ).start();
      };
      startLaserAnimation();
    }
  }, [hasPermission, laserTranslateY]);

  const handleGrantPermission = () => {
    storage.set(PERMISSION_KEY, true);
    setHasPermission(true);
  };

  const handleProcessScan = async (code: string) => {
    setErrorMessage(null);
    setSuccessMessage(null);

    const cleanCode = code.trim();
    if (!cleanCode) return;

    const routeGates = assignment?.patrolRoute?.routeGates || [];
    
    // Find the next incomplete checkpoint in sequence
    const nextGate = routeGates.find(
      (rg: any) => !scannedGateIds.includes(rg.gateId)
    );

    if (!nextGate) {
      setErrorMessage("All checkpoints on this route have already been completed.");
      return;
    }

    // Verify code matches nextGate
    const isMatch = 
      cleanCode === nextGate.gate?.gateCode || 
      cleanCode === nextGate.gateId || 
      cleanCode === nextGate.gate?.qrCode;

    if (!isMatch) {
      // Find if the code belongs to another checkpoint in the route to give specific errors
      const belongingGate = routeGates.find(
        (rg: any) => rg.gate?.gateCode === cleanCode || rg.gateId === cleanCode || rg.gate?.qrCode === cleanCode
      );

      if (belongingGate) {
        if (scannedGateIds.includes(belongingGate.gateId)) {
          setErrorMessage(`Scan Blocked: Checkpoint "${belongingGate.gate?.name}" is already completed.`);
        } else {
          setErrorMessage(`Sequence Violation: You must scan "${nextGate.gate?.name}" next. Skipping checkpoints is prohibited.`);
        }
      } else {
        setErrorMessage(`Invalid QR Code: Scanned code is not registered on this patrol route.`);
      }
      return;
    }

    const gateId = nextGate.gateId;
    const gateName = nextGate.gate?.name || 'Gate';

    try {
      // Set the checkpoint state to Unlocked
      usePatrolStore.getState().unlockCheckpoint(gateId);

      setSuccessMessage(`✓ Checkpoint Unlocked: "${gateName}"`);
      setManualCode('');
      
      // Auto close after successful scan
      setTimeout(() => {
        navigation.goBack();
      }, 1500);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to unlock checkpoint.');
    }
  };

  if (!hasPermission) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, justifyContent: 'center', padding: 24 }]}>
        <Text style={[styles.permTitle, { color: colors.text }]}>Camera Permission Required</Text>
        <Text style={[styles.permDesc, { color: colors.textSecondary }]}>
          Hello Security requires camera access to scan QR check-points located at gates and stations.
        </Text>
        <Button title="Authorize Camera Access" onPress={handleGrantPermission} />
      </View>
    );
  }

  const routeGates = assignment?.patrolRoute?.routeGates || [];
  const nextGateToScan = routeGates.find((rg: any) => !scannedGateIds.includes(rg.gateId));

  return (
    <ScrollView style={[styles.container, { backgroundColor: '#121214' }]} contentContainerStyle={styles.scrollContent}>
      <View style={styles.headerRow}>
        <Text style={[styles.title, { color: '#ffffff' }]}>Scan Checkpoint QR</Text>
        <TouchableOpacity style={styles.flashButton} onPress={() => setFlashEnabled(!flashEnabled)}>
          {flashEnabled ? <Zap size={22} color="#f59e0b" /> : <ZapOff size={22} color="#8e8e9a" />}
        </TouchableOpacity>
      </View>

      {nextGateToScan && (
        <View style={styles.targetBanner}>
          <Text style={styles.targetLabel}>Target Checkpoint:</Text>
          <Text style={styles.targetName}>{nextGateToScan.gate?.name}</Text>
          <Text style={styles.targetSub}>Sequence Order: {nextGateToScan.sequence}</Text>
        </View>
      )}

      <View style={styles.viewfinderContainer}>
        <View style={[styles.reticle, flashEnabled && styles.reticleFlash]}>
          <View style={[styles.corner, styles.topLeft, { borderColor: colors.primary }]} />
          <View style={[styles.corner, styles.topRight, { borderColor: colors.primary }]} />
          <View style={[styles.corner, styles.bottomLeft, { borderColor: colors.primary }]} />
          <View style={[styles.corner, styles.bottomRight, { borderColor: colors.primary }]} />
          
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
        <Card style={[styles.feedbackCard, { borderColor: colors.danger, backgroundColor: colors.danger + '10' }]}>
          <Text style={[styles.feedbackText, { color: colors.danger }]}>⚠️ {errorMessage}</Text>
        </Card>
      )}

      {successMessage && (
        <Card style={[styles.feedbackCard, { borderColor: colors.success, backgroundColor: colors.success + '10' }]}>
          <Text style={[styles.feedbackText, { color: colors.success }]}>{successMessage}</Text>
        </Card>
      )}

      <Card style={[styles.quickScanCard, { backgroundColor: '#1a1a1e', borderColor: '#2d2d34' }]}>
        <Text style={styles.cardTitle}>Simulate QR Check-in</Text>
        <Text style={styles.cardDesc}>Select a route checkpoint to simulate scanning its QR code:</Text>

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
                    backgroundColor: isScanned ? '#2d2d34' : isNext ? colors.primary + '25' : '#121214',
                    borderColor: isScanned ? '#3e3e4a' : isNext ? colors.primary : '#2d2d34',
                  },
                ]}
                onPress={() => handleProcessScan(rg.gate?.gateCode || rg.gateId)}
              >
                <Text style={[styles.optionText, { color: isScanned ? '#8e8e9a' : isNext ? '#ffffff' : '#b3b3c2' }]}>
                  {rg.gate?.name} {isScanned ? '(Completed)' : isNext ? '★ (Next Target)' : ''}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={[styles.divider, { backgroundColor: '#2d2d34' }]} />

        <Text style={styles.inputLabel}>Or Enter Manual Code Payload:</Text>
        <View style={styles.inputRow}>
          <TextInput
            style={[styles.input, { borderColor: '#2d2d34', color: '#ffffff', backgroundColor: '#121214' }]}
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
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#2d2d34',
    marginBottom: 20,
  },
  targetLabel: {
    color: '#8e8e9a',
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  targetName: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
    marginTop: 2,
  },
  targetSub: {
    color: '#8e8e9a',
    fontSize: 11,
    marginTop: 2,
  },
  permTitle: {
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 10,
  },
  permDesc: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 24,
  },
  viewfinderContainer: {
    height: 220,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  reticle: {
    width: 200,
    height: 200,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    position: 'relative',
    overflow: 'hidden',
    backgroundColor: '#000000',
  },
  reticleFlash: {
    borderColor: 'rgba(255, 255, 255, 0.3)',
    shadowColor: '#ffffff',
    shadowOpacity: 0.1,
    shadowRadius: 10,
  },
  corner: {
    width: 20,
    height: 20,
    position: 'absolute',
    borderWidth: 3,
  },
  topLeft: {
    top: 0,
    left: 0,
    borderRightWidth: 0,
    borderBottomWidth: 0,
  },
  topRight: {
    top: 0,
    right: 0,
    borderLeftWidth: 0,
    borderBottomWidth: 0,
  },
  bottomLeft: {
    bottom: 0,
    left: 0,
    borderRightWidth: 0,
    borderTopWidth: 0,
  },
  bottomRight: {
    bottom: 0,
    right: 0,
    borderLeftWidth: 0,
    borderTopWidth: 0,
  },
  laser: {
    height: 2,
    width: '100%',
    position: 'absolute',
  },
  feedbackCard: {
    padding: 12,
    borderWidth: 1,
    marginBottom: 20,
    alignItems: 'center',
  },
  feedbackText: {
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },
  quickScanCard: {
    padding: 18,
  },
  cardTitle: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 4,
  },
  cardDesc: {
    color: '#8e8e9a',
    fontSize: 12,
    marginBottom: 14,
  },
  buttonList: {
    marginBottom: 16,
  },
  scanOption: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    alignItems: 'center',
  },
  optionText: {
    fontSize: 13,
    fontWeight: '700',
  },
  divider: {
    height: 1,
    marginVertical: 14,
  },
  inputLabel: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 8,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    height: 40,
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 12,
    fontSize: 13,
    marginRight: 8,
  },
  inputButton: {
    height: 40,
    paddingHorizontal: 16,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inputButtonText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
});
