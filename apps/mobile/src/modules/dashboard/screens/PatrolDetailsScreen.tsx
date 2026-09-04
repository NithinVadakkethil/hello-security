import { RouteProp, useRoute } from '@react-navigation/native';
import {
  Building,
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  Edit2,
  FileText,
  MapPin,
  Navigation,
  ShieldAlert,
  User,
  X,
  XCircle,
} from 'lucide-react-native';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useTheme } from '../../../app/hooks/useTheme';
import { AppTabParamList } from '../../../app/navigation/types';
import { resolveImageUrl } from '../../../app/utils/image';
import { dashboardApi } from '../api/dashboard.api';
import { formatPatrolDateTime } from '../../../app/utils/date-formatter';
import { Card } from '../components/WidgetCard';
import { usePatrolDetail } from '../hooks/useDashboard';

type PatrolDetailsRouteProp = RouteProp<AppTabParamList, 'PatrolDetails'>;

const ROLE_LABELS: Record<string, string> = {
  SECURITY: 'Security Guard',
  TECHNICIAN: 'Technician',
  CLEANER: 'House Keeping',
  SERVICE_ENGINEER: 'Service Engineer',
  PLUMBER: 'Plumber',
  LIFE_GUARD: 'Lifeguard',
};

function getRoleLabel(role?: string | null): string {
  if (!role) return 'Security Guard';
  const u = role.toUpperCase();
  return ROLE_LABELS[u] || role;
}

function getSubTaskBadgeColor(status?: string | null): string {
  if (!status) return '#10B981';
  const s = status.toUpperCase();
  if (s === 'FAIL' || s === 'REJECTED' || s === 'FAILED') return '#EF4444';
  if (s === 'PENDING' || s === 'IN_PROGRESS') return '#F59E0B';
  return '#10B981';
}

export function PatrolDetailsScreen() {
  const { colors } = useTheme();
  const route = useRoute<PatrolDetailsRouteProp>();
  const { patrolId } = route.params;

  const { data: patrol, isLoading, refetch } = usePatrolDetail(patrolId);
  const [supervisorRemarks, setSupervisorRemarks] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // State for inline checkpoint sweep note editing
  const [editingCpId, setEditingCpId] = useState<string | null>(null);
  const [editingRemarks, setEditingRemarks] = useState('');
  const [isSavingCp, setIsSavingCp] = useState(false);

  // State for full-screen photo preview modal
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  // Initialize supervisor remarks when data is loaded
  React.useEffect(() => {
    if (patrol?.supervisorRemarks) {
      setSupervisorRemarks(patrol.supervisorRemarks);
    }
  }, [patrol?.supervisorRemarks]);

  if (isLoading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
          Loading patrol details...
        </Text>
      </View>
    );
  }

  if (!patrol) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Text style={[styles.errorText, { color: colors.text }]}>
          Patrol details not found
        </Text>
      </View>
    );
  }

  const assignment = patrol.assignment || {};
  const guard = assignment.employee || {};
  const site = assignment.site || {};
  const shift = assignment.shift || {};
  const routeInfo = assignment.patrolRoute || {};
  const checkpoints = patrol.checkpoints || [];
  const incidents = patrol.incidents || [];
  const verifiedBy = patrol.verifiedBy || {};
  const verifierName = verifiedBy.employee
    ? `${verifiedBy.employee.firstName} ${verifiedBy.employee.lastName}`
    : verifiedBy.email || 'Supervisor';

  const isAlreadyReviewed =
    patrol.verificationStatus === 'VERIFIED' ||
    patrol.verificationStatus === 'NOT_VERIFIED';

  const handleVerify = async (status: 'VERIFIED' | 'NOT_VERIFIED') => {
    try {
      setIsSubmitting(true);
      await dashboardApi.verifyPatrolSession(patrolId, {
        verificationStatus: status,
        supervisorRemarks: supervisorRemarks.trim() || undefined,
      });
      Alert.alert(
        'Patrol Verified',
        `Patrol status successfully set to ${
          status === 'VERIFIED' ? 'Verified' : 'Not Verified'
        }.`,
      );
      refetch();
    } catch (error: any) {
      Alert.alert(
        'Error',
        error?.response?.data?.error?.message ||
          'Failed to update verification status.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveCpRemarks = async (cpId: string) => {
    try {
      setIsSavingCp(true);
      await dashboardApi.updateCheckpointRemarks(cpId, editingRemarks.trim());
      Alert.alert('Success', 'Checkpoint sweep note updated successfully.');
      setEditingCpId(null);
      refetch();
    } catch (error: any) {
      Alert.alert(
        'Error',
        error?.response?.data?.error?.message || 'Failed to update sweep note.',
      );
    } finally {
      setIsSavingCp(false);
    }
  };

  const formatTime = (dateStr?: string) => {
    if (!dateStr) return 'N/A';
    return formatPatrolDateTime(dateStr);
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.content}
    >
      {/* Verification Status Header Card */}
      <Card
        style={[
          styles.verificationCard,
          {
            borderLeftWidth: 6,
            borderLeftColor:
              patrol.verificationStatus === 'VERIFIED'
                ? colors.success
                : patrol.verificationStatus === 'NOT_VERIFIED'
                ? colors.danger
                : colors.warning,
          },
        ]}
      >
        <View style={styles.badgeRow}>
          {patrol.verificationStatus === 'VERIFIED' ? (
            <View
              style={[styles.badge, { backgroundColor: colors.success + '20' }]}
            >
              <CheckCircle2 size={16} color={colors.success} />
              <Text style={[styles.badgeText, { color: colors.success }]}>
                VERIFIED BY SUPERVISOR
              </Text>
            </View>
          ) : patrol.verificationStatus === 'NOT_VERIFIED' ? (
            <View
              style={[styles.badge, { backgroundColor: colors.danger + '20' }]}
            >
              <XCircle size={16} color={colors.danger} />
              <Text style={[styles.badgeText, { color: colors.danger }]}>
                MARKED NOT VERIFIED
              </Text>
            </View>
          ) : (
            <View
              style={[styles.badge, { backgroundColor: colors.warning + '20' }]}
            >
              <Clock size={16} color={colors.warning} />
              <Text style={[styles.badgeText, { color: colors.warning }]}>
                PENDING VERIFICATION
              </Text>
            </View>
          )}
        </View>

        {patrol.verificationTime && (
          <View style={styles.verifiedMeta}>
            <Text style={[styles.metaText, { color: colors.textSecondary }]}>
              Verified By:{' '}
              <Text style={{ color: colors.text, fontWeight: '700' }}>
                {verifierName}
              </Text>
            </Text>
            <Text style={[styles.metaText, { color: colors.textSecondary }]}>
              Verified At:{' '}
              <Text style={{ color: colors.text }}>
                {formatTime(patrol.verificationTime)}
              </Text>
            </Text>
          </View>
        )}

        {patrol.supervisorRemarks && (
          <View
            style={[
              styles.remarksBox,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <Text
              style={[styles.remarksLabel, { color: colors.textSecondary }]}
            >
              Supervisor Remarks:
            </Text>
            <Text style={[styles.remarksContent, { color: colors.text }]}>
              {patrol.supervisorRemarks}
            </Text>
          </View>
        )}
      </Card>

      {/* Assignment & Guard Details Card */}
      <Text style={[styles.sectionTitle, { color: colors.text }]}>
        Assignment Information
      </Text>
      <Card style={styles.infoCard}>
        <View style={styles.gridRow}>
          <View style={styles.gridItem}>
            <User size={16} color={colors.primary} />
            <View style={{ marginLeft: 8 }}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>
                Guard Name
              </Text>
              <Text style={[styles.value, { color: colors.text }]}>
                {guard.firstName} {guard.lastName}
              </Text>
            </View>
          </View>
          <View style={styles.gridItem}>
            <FileText size={16} color={colors.primary} />
            <View style={{ marginLeft: 8 }}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>
                Employee Code
              </Text>
              <Text style={[styles.value, { color: colors.text }]}>
                {guard.employeeNumber || 'N/A'}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.gridRow}>
          <View style={styles.gridItem}>
            <Building size={16} color={colors.primary} />
            <View style={{ marginLeft: 8 }}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>
                Site Location
              </Text>
              <Text style={[styles.value, { color: colors.text }]}>
                {site.name || 'N/A'}
              </Text>
            </View>
          </View>
          <View style={styles.gridItem}>
            <Clock size={16} color={colors.primary} />
            <View style={{ marginLeft: 8 }}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>
                Shift
              </Text>
              <Text style={[styles.value, { color: colors.text }]}>
                {shift.name
                  ? `${shift.name} (${shift.startTime}-${shift.endTime})`
                  : 'N/A'}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.gridRow}>
          <View style={styles.gridItem}>
            <Navigation size={16} color={colors.primary} />
            <View style={{ marginLeft: 8 }}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>
                Patrol Route
              </Text>
              <Text style={[styles.value, { color: colors.text }]}>
                {routeInfo.name || 'Custom Route'}
              </Text>
            </View>
          </View>
          <View style={styles.gridItem}>
            <Calendar size={16} color={colors.primary} />
            <View style={{ marginLeft: 8 }}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>
                Status
              </Text>
              <Text
                style={[
                  styles.value,
                  { color: colors.primary, fontWeight: '700' },
                ]}
              >
                {patrol.status}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.divider} />

        <View style={styles.timeRow}>
          <Text style={[styles.timeLabel, { color: colors.textSecondary }]}>
            Started:{' '}
            <Text style={{ color: colors.text }}>
              {formatTime(patrol.startedAt)}
            </Text>
          </Text>
          <Text style={[styles.timeLabel, { color: colors.textSecondary }]}>
            Ended:{' '}
            <Text style={{ color: colors.text }}>
              {formatTime(patrol.endedAt)}
            </Text>
          </Text>
        </View>
      </Card>

      {/* Checkpoint Timeline Section */}
      <Text style={[styles.sectionTitle, { color: colors.text }]}>
        Checkpoint Timeline ({checkpoints.length})
      </Text>
      {checkpoints.length > 0 ? (
        checkpoints.map((cp: any, index: number) => {
          // Extract subtasks hierarchy for this checkpoint
          const subTaskResponses = cp.subTaskResponses || [];
          const gateSubTasks = cp.gate?.subTasks || [];

          // Merge configured subtasks with officer responses
          const mergedSubtasks: any[] = [];

          if (gateSubTasks.length > 0) {
            gateSubTasks.forEach((gst: any) => {
              const resp = subTaskResponses.find(
                (r: any) =>
                  r.gateSubTaskId === gst.id ||
                  r.subTaskId === gst.id ||
                  r.gateSubTask?.id === gst.id,
              );
              const subtaskTitle =
                gst.taskName ||
                gst.title ||
                gst.name ||
                gst.description ||
                resp?.gateSubTask?.taskName ||
                resp?.gateSubTask?.title ||
                resp?.gateSubTask?.description ||
                'Subtask';

              mergedSubtasks.push({
                id: gst.id,
                title: subtaskTitle,
                role: gst.role,
                isRequired: gst.isRequired,
                status: resp ? resp.status || 'COMPLETED' : 'COMPLETED',
                remarks: resp?.remarks || resp?.notes,
                images: resp?.images || [],
              });
            });
          } else if (subTaskResponses.length > 0) {
            subTaskResponses.forEach((resp: any) => {
              const subtaskTitle =
                resp.gateSubTask?.taskName ||
                resp.gateSubTask?.title ||
                resp.gateSubTask?.name ||
                resp.gateSubTask?.description ||
                resp.taskName ||
                resp.title ||
                'Inspection Subtask';

              mergedSubtasks.push({
                id: resp.id,
                title: subtaskTitle,
                role: resp.gateSubTask?.role || resp.role,
                isRequired: resp.gateSubTask?.isRequired || false,
                status: resp.status || 'COMPLETED',
                remarks: resp.remarks || resp.notes,
                images: resp.images || [],
              });
            });
          }

          const cpImages = cp.images || [];

          return (
            <View key={cp.id || index} style={styles.timelineItem}>
              <View
                style={[
                  styles.timelineNode,
                  { backgroundColor: colors.primary },
                ]}
              >
                <Text style={styles.timelineNodeText}>{index + 1}</Text>
              </View>

              <Card style={styles.timelineCard}>
                <View style={styles.timelineHeader}>
                  <Text style={[styles.cpName, { color: colors.text }]}>
                    {cp.gate?.name || `Checkpoint #${index + 1}`}
                  </Text>
                  <Text
                    style={[styles.cpTime, { color: colors.textSecondary }]}
                  >
                    {formatTime(cp.scannedAt)}
                  </Text>
                </View>

                <Text style={[styles.cpCode, { color: colors.textSecondary }]}>
                  Code: {cp.gate?.gateCode || 'N/A'}
                </Text>

                {cp.status && (
                  <View
                    style={[
                      styles.statusPill,
                      { backgroundColor: colors.surface },
                    ]}
                  >
                    <Text
                      style={[styles.statusPillText, { color: colors.primary }]}
                    >
                      Gate Status: {cp.status}
                    </Text>
                  </View>
                )}

                {cp.latitude && cp.longitude && (
                  <View style={styles.rowAlign}>
                    <MapPin size={14} color={colors.textSecondary} />
                    <Text
                      style={[styles.geoText, { color: colors.textSecondary }]}
                    >
                      GPS: {cp.latitude.toFixed(5)}, {cp.longitude.toFixed(5)}
                    </Text>
                  </View>
                )}

                {/* Sweep Note Editing for Supervisors */}
                <View
                  style={[
                    styles.guardRemarkBox,
                    {
                      backgroundColor: colors.surface,
                      borderColor: colors.border,
                    },
                  ]}
                >
                  <View style={styles.sweepNoteHeader}>
                    <Text
                      style={[
                        styles.guardRemarkLabel,
                        { color: colors.textSecondary },
                      ]}
                    >
                      Sweep Note / Checkpoint Remarks:
                    </Text>

                    {editingCpId !== cp.id && (
                      <TouchableOpacity
                        style={styles.editNoteBtn}
                        onPress={() => {
                          setEditingCpId(cp.id);
                          setEditingRemarks(cp.remarks || '');
                        }}
                      >
                        <Edit2 size={12} color={colors.primary} />
                        <Text
                          style={[
                            styles.editNoteBtnText,
                            { color: colors.primary },
                          ]}
                        >
                          Edit Sweep Note
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>

                  {editingCpId === cp.id ? (
                    <View style={styles.editInputContainer}>
                      <TextInput
                        style={[
                          styles.cpInput,
                          {
                            color: colors.text,
                            borderColor: colors.border,
                            backgroundColor: colors.background,
                          },
                        ]}
                        value={editingRemarks}
                        onChangeText={setEditingRemarks}
                        placeholder="Enter sweep note..."
                        placeholderTextColor={colors.textSecondary}
                        multiline
                      />
                      <View style={styles.cpActionRow}>
                        <TouchableOpacity
                          style={[
                            styles.cpSmallBtn,
                            { backgroundColor: colors.success },
                          ]}
                          onPress={() => handleSaveCpRemarks(cp.id)}
                          disabled={isSavingCp}
                        >
                          {isSavingCp ? (
                            <ActivityIndicator size="small" color="#fff" />
                          ) : (
                            <>
                              <Check size={14} color="#fff" />
                              <Text style={styles.cpSmallBtnText}>Save</Text>
                            </>
                          )}
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[
                            styles.cpSmallBtn,
                            { backgroundColor: colors.border },
                          ]}
                          onPress={() => setEditingCpId(null)}
                          disabled={isSavingCp}
                        >
                          <X size={14} color={colors.text} />
                          <Text
                            style={[
                              styles.cpSmallBtnText,
                              { color: colors.text },
                            ]}
                          >
                            Cancel
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ) : (
                    <Text
                      style={[styles.guardRemarkText, { color: colors.text }]}
                    >
                      {cp.remarks ? cp.remarks : 'No sweep note entered yet.'}
                    </Text>
                  )}
                </View>

                {/* 2. INSPECTION SUBTASKS HIERARCHY */}
                {mergedSubtasks.length > 0 && (
                  <View
                    style={[
                      styles.subtaskContainer,
                      {
                        backgroundColor: colors.surface,
                        borderColor: colors.border,
                      },
                    ]}
                  >
                    <View style={styles.subtaskHeader}>
                      <CheckCircle2 size={13} color={colors.primary} />
                      <Text
                        style={[
                          styles.subtaskHeaderTitle,
                          { color: colors.text },
                        ]}
                      >
                        Checkpoint Subtasks ({mergedSubtasks.length})
                      </Text>
                    </View>

                    {mergedSubtasks.map((st: any, stIdx: number) => {
                      const badgeColor = getSubTaskBadgeColor(st.status);
                      return (
                        <View
                          key={st.id || stIdx}
                          style={[
                            styles.subtaskRow,
                            { borderColor: colors.border },
                          ]}
                        >
                          <View style={{ flex: 1 }}>
                            <View
                              style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                gap: 6,
                              }}
                            >
                              <Text
                                style={[
                                  styles.subtaskTitle,
                                  { color: colors.text },
                                ]}
                              >
                                {st.title}
                              </Text>
                            </View>

                            <Text
                              style={[
                                styles.subtaskRole,
                                { color: colors.textSecondary },
                              ]}
                            >
                              Role: {getRoleLabel(st.role)}
                            </Text>

                            {st.remarks && (
                              <Text
                                style={[
                                  styles.subtaskRemarks,
                                  { color: colors.textSecondary },
                                ]}
                              >
                                Note: "{st.remarks}"
                              </Text>
                            )}

                            {st.images && st.images.length > 0 && (
                              <ScrollView
                                horizontal
                                showsHorizontalScrollIndicator={false}
                                style={{ marginTop: 4 }}
                              >
                                {st.images.map((img: string, iIdx: number) => {
                                  const resolved = resolveImageUrl(img);
                                  return (
                                    <TouchableOpacity
                                      key={iIdx}
                                      onPress={() =>
                                        resolved && setPreviewImage(resolved)
                                      }
                                    >
                                      <Image
                                        source={{ uri: resolved || img }}
                                        style={styles.subtaskThumb}
                                      />
                                    </TouchableOpacity>
                                  );
                                })}
                              </ScrollView>
                            )}
                          </View>

                          <View
                            style={[
                              styles.subtaskBadge,
                              { backgroundColor: badgeColor + '18' },
                            ]}
                          >
                            <Text
                              style={[
                                styles.subtaskBadgeText,
                                { color: badgeColor },
                              ]}
                            >
                              {st.status || 'COMPLETED'}
                            </Text>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                )}

                {/* 1. ATTACHED PHOTOS GALLERY WITH TAP PREVIEW */}
                {/* <View style={styles.imagesContainer}>
                  <View style={styles.rowAlign}>
                    <ImageIcon size={14} color={colors.primary} />
                    <Text
                      style={[
                        styles.geoText,
                        { color: colors.text, fontWeight: '700' },
                      ]}
                    >
                      Attached Photos ({cpImages.length})
                    </Text>
                  </View>

                  {cpImages.length > 0 ? (
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      style={styles.imagesScroll}
                    >
                      {cpImages.map((imgUrl: string, idx: number) => {
                        const fullUrl = resolveImageUrl(imgUrl);
                        return (
                          <TouchableOpacity
                            key={idx}
                            onPress={() => fullUrl && setPreviewImage(fullUrl)}
                            activeOpacity={0.8}
                          >
                            <Image
                              source={{ uri: fullUrl || imgUrl }}
                              style={styles.thumbnail}
                            />
                          </TouchableOpacity>
                        );
                      })}
                    </ScrollView>
                  ) : (
                    <Text
                      style={[
                        styles.emptyPhotosText,
                        { color: colors.textSecondary },
                      ]}
                    >
                      No attached photos for this checkpoint
                    </Text>
                  )}
                </View> */}
              </Card>
            </View>
          );
        })
      ) : (
        <Card style={styles.emptyCard}>
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
            No checkpoints scanned yet
          </Text>
        </Card>
      )}

      {/* Reported Incidents */}
      {incidents.length > 0 && (
        <>
          <Text style={[styles.sectionTitle, { color: colors.danger }]}>
            Reported Incidents ({incidents.length})
          </Text>
          {incidents.map((inc: any) => (
            <Card
              key={inc.id}
              style={[
                styles.infoCard,
                { borderLeftWidth: 4, borderLeftColor: colors.danger },
              ]}
            >
              <View style={styles.rowAlign}>
                <ShieldAlert size={18} color={colors.danger} />
                <Text style={[styles.incidentTitle, { color: colors.text }]}>
                  {inc.type} (Severity: {inc.severity})
                </Text>
              </View>
              <Text
                style={[styles.incidentDesc, { color: colors.textSecondary }]}
              >
                {inc.description}
              </Text>
            </Card>
          ))}
        </>
      )}

      {/* Supervisor Review & Verification Section */}
      <Text style={[styles.sectionTitle, { color: colors.text }]}>
        Supervisor Review & Verification
      </Text>
      <Card style={styles.verificationActionCard}>
        {!isAlreadyReviewed ? (
          <>
            <Text style={[styles.inputLabel, { color: colors.text }]}>
              Supervisor Remarks
            </Text>
            <TextInput
              style={[
                styles.textArea,
                {
                  color: colors.text,
                  borderColor: colors.border,
                  backgroundColor: colors.surface,
                },
              ]}
              placeholder="Add comments or review notes for audit..."
              placeholderTextColor={colors.textSecondary}
              multiline
              numberOfLines={3}
              value={supervisorRemarks}
              onChangeText={setSupervisorRemarks}
            />

            <View style={styles.actionButtonsRow}>
              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: colors.success }]}
                onPress={() => handleVerify('VERIFIED')}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <CheckCircle2 size={18} color="#fff" />
                    <Text style={styles.actionBtnText}>Verify Patrol</Text>
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: colors.danger }]}
                onPress={() => handleVerify('NOT_VERIFIED')}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <XCircle size={18} color="#fff" />
                    <Text style={styles.actionBtnText}>Mark Not Verified</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </>
        ) : (
          <View style={styles.alreadyReviewedBox}>
            <View style={styles.rowAlign}>
              {patrol.verificationStatus === 'VERIFIED' ? (
                <CheckCircle2 size={20} color={colors.success} />
              ) : (
                <XCircle size={20} color={colors.danger} />
              )}
              <Text
                style={[
                  styles.alreadyReviewedTitle,
                  {
                    color:
                      patrol.verificationStatus === 'VERIFIED'
                        ? colors.success
                        : colors.danger,
                  },
                ]}
              >
                Patrol Status:{' '}
                {patrol.verificationStatus === 'VERIFIED'
                  ? 'VERIFIED'
                  : 'NOT VERIFIED'}
              </Text>
            </View>
            {patrol.supervisorRemarks && (
              <Text
                style={[
                  styles.guardRemarkText,
                  { color: colors.text, marginTop: 6 },
                ]}
              >
                Remarks: "{patrol.supervisorRemarks}"
              </Text>
            )}
          </View>
        )}
      </Card>

      {/* FULL SCREEN PHOTO PREVIEW MODAL */}
      {previewImage && (
        <Modal
          visible
          transparent
          animationType="fade"
          onRequestClose={() => setPreviewImage(null)}
        >
          <View style={styles.modalPhotoOverlay}>
            <TouchableOpacity
              style={styles.modalCloseBtn}
              onPress={() => setPreviewImage(null)}
            >
              <X size={24} color="#fff" />
            </TouchableOpacity>

            <Image
              source={{ uri: previewImage }}
              style={styles.fullPreviewImg}
              resizeMode="contain"
            />
          </View>
        </Modal>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
  },
  errorText: {
    fontSize: 16,
    fontWeight: '600',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginTop: 20,
    marginBottom: 10,
  },
  verificationCard: {
    padding: 16,
    marginBottom: 8,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    gap: 6,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '800',
  },
  verifiedMeta: {
    marginTop: 10,
    gap: 4,
  },
  metaText: {
    fontSize: 12,
  },
  remarksBox: {
    marginTop: 10,
    padding: 10,
    borderRadius: 6,
    borderWidth: 1,
  },
  remarksLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  remarksContent: {
    fontSize: 13,
    marginTop: 2,
  },
  infoCard: {
    padding: 16,
    gap: 12,
  },
  gridRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  gridItem: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  label: {
    fontSize: 11,
  },
  value: {
    fontSize: 13,
    fontWeight: '600',
  },
  divider: {
    height: 1,
    backgroundColor: '#3332',
    marginVertical: 4,
  },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  timeLabel: {
    fontSize: 12,
  },
  timelineItem: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  timelineNode: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
    marginTop: 4,
  },
  timelineNodeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  timelineCard: {
    flex: 1,
    padding: 14,
    gap: 8,
  },
  timelineHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cpName: {
    fontSize: 14,
    fontWeight: '700',
  },
  cpTime: {
    fontSize: 11,
  },
  cpCode: {
    fontSize: 11,
  },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    alignSelf: 'flex-start',
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: '600',
  },
  rowAlign: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  geoText: {
    fontSize: 11,
  },
  guardRemarkBox: {
    marginTop: 4,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  sweepNoteHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  guardRemarkLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  editNoteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  editNoteBtnText: {
    fontSize: 11,
    fontWeight: '700',
  },
  guardRemarkText: {
    fontSize: 12,
    marginTop: 2,
  },
  editInputContainer: {
    marginTop: 4,
    gap: 8,
  },
  cpInput: {
    borderWidth: 1,
    borderRadius: 6,
    padding: 8,
    fontSize: 12,
    minHeight: 50,
  },
  cpActionRow: {
    flexDirection: 'row',
    gap: 8,
  },
  cpSmallBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
    gap: 4,
  },
  cpSmallBtnText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  subtaskContainer: {
    marginTop: 4,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    gap: 8,
  },
  subtaskHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
    paddingBottom: 6,
  },
  subtaskHeaderTitle: {
    fontSize: 12,
    fontWeight: '800',
  },
  subtaskRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 6,
    borderBottomWidth: 0.5,
    gap: 8,
  },
  subtaskTitle: {
    fontSize: 12,
    fontWeight: '700',
  },
  requiredStar: {
    fontSize: 10,
    color: '#EF4444',
    fontWeight: '700',
  },
  subtaskRole: {
    fontSize: 10,
    marginTop: 2,
  },
  subtaskRemarks: {
    fontSize: 11,
    fontStyle: 'italic',
    marginTop: 2,
  },
  subtaskBadge: {
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
  },
  subtaskBadgeText: {
    fontSize: 9,
    fontWeight: '800',
  },
  subtaskThumb: {
    width: 44,
    height: 44,
    borderRadius: 6,
    marginRight: 6,
    backgroundColor: '#222',
  },
  imagesContainer: {
    marginTop: 6,
    gap: 4,
  },
  imagesScroll: {
    marginTop: 4,
  },
  thumbnail: {
    width: 75,
    height: 75,
    borderRadius: 8,
    marginRight: 8,
    backgroundColor: '#222',
  },
  emptyPhotosText: {
    fontSize: 11,
    fontStyle: 'italic',
    marginTop: 4,
  },
  incidentTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  incidentDesc: {
    fontSize: 12,
    marginTop: 4,
  },
  emptyCard: {
    padding: 16,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 13,
  },
  verificationActionCard: {
    padding: 16,
    gap: 12,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  textArea: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    fontSize: 13,
    textAlignVertical: 'top',
    minHeight: 70,
  },
  actionButtonsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
  },
  actionBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  alreadyReviewedBox: {
    gap: 4,
  },
  alreadyReviewedTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  modalPhotoOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.92)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCloseBtn: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 10,
    padding: 10,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 20,
  },
  fullPreviewImg: {
    width: '94%',
    height: '80%',
  },
});
