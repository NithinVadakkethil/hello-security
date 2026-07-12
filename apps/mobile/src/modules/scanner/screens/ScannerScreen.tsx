import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated, TextInput, TouchableOpacity, Alert, ScrollView } from 'react-native';
import { useTheme } from '../../../app/hooks/useTheme';
import { useScanGate } from '../hooks/useScanner';
import { usePatrolStore } from '../../patrol/store/patrol-store';
import { useActiveAssignment } from '../../assignment/hooks/useAssignment';
import { storage } from '../../../app/utils/mmkv-storage';
import { Card } from '../../dashboard/components/WidgetCard';
import { Button } from '../../../components/Button';
import { useNavigation } from '@react-navigation/native';

const PERMISSION_KEY = 'camera_permission_granted';

export function ScannerScreen() {
  const { colors } = useTheme();
  const navigation = useNavigation();
  const { data: assignment } = useActiveAssignment();
  const { scannedGateIds } = usePatrolStore();
  const { mutateAsync: scanGate, isPending: isScanning } = useScanGate();

  const [hasPermission, setHasPermission] = useState(storage.getBoolean(PERMISSION_KEY) || false);
  const [manualCode, setManualCode] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

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
    const matchedGate = routeGates.find(
      (rg: any) => rg.gate?.gateCode === cleanCode || rg.gateId === cleanCode
    );

    if (!matchedGate) {
      setErrorMessage(`Invalid QR Code: "${cleanCode}" is not registered on this patrol route.`);
      return;
    }

    const gateId = matchedGate.gateId;
    const gateName = matchedGate.gate?.name || 'Gate';

    if (scannedGateIds.includes(gateId)) {
      setErrorMessage(`Duplicate Checkpoint: "${gateName}" has already been scanned.`);
      return;
    }

    try {
      await scanGate({
        gateId,
        latitude: assignment?.site?.latitude || undefined,
        longitude: assignment?.site?.longitude || undefined,
      });

      setSuccessMessage(`Success: ${gateName} verified.`);
      setManualCode('');
      
      setTimeout(() => {
        navigation.goBack();
      }, 1500);
    } catch (err: any) {
      setErrorMessage(err.message || 'API connection failed. Please try again.');
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

  return (
    <ScrollView style={[styles.container, { backgroundColor: '#121214' }]} contentContainerStyle={styles.scrollContent}>
      <Text style={[styles.title, { color: '#ffffff' }]}>QR Viewfinder</Text>

      <View style={styles.viewfinderContainer}>
        <View style={styles.reticle}>
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
          <Text style={[styles.feedbackText, { color: colors.success }]}>✓ {successMessage}</Text>
        </Card>
      )}

      <Card style={[styles.quickScanCard, { backgroundColor: '#1a1a1e', borderColor: '#2d2d34' }]}>
        <Text style={styles.cardTitle}>Simulate QR Check-in</Text>
        <Text style={styles.cardDesc}>Select a route checkpoint to simulate a scan on this device:</Text>

        <View style={styles.buttonList}>
          {routeGates.map((rg: any) => {
            const isScanned = scannedGateIds.includes(rg.gateId);
            return (
              <TouchableOpacity
                key={rg.id}
                style={[
                  styles.scanOption,
                  {
                    backgroundColor: isScanned ? '#2d2d34' : colors.primary + '30',
                    borderColor: isScanned ? '#3e3e4a' : colors.primary,
                  },
                ]}
                onPress={() => handleProcessScan(rg.gate?.gateCode || rg.gateId)}
                disabled={isScanning}
              >
                <Text style={[styles.optionText, { color: isScanned ? '#8e8e9a' : '#ffffff' }]}>
                  {rg.gate?.name} {isScanned ? '(Scanned)' : ''}
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
            placeholder="e.g. INVALID_GATE_CODE"
            placeholderTextColor="#8e8e9a"
            value={manualCode}
            onChangeText={setManualCode}
            autoCapitalize="none"
          />
          <TouchableOpacity
            style={[styles.inputButton, { backgroundColor: colors.primary }]}
            onPress={() => handleProcessScan(manualCode)}
            disabled={isScanning}
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
  title: {
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 20,
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
