import {
  Calendar,
  Camera,
  CheckCircle2,
  CheckSquare,
  ChevronDown,
  ChevronUp,
  Clock,
  FileText,
  Mic,
  User,
  XCircle,
} from 'lucide-react';
import { useState } from 'react';
import { resolveImageUrl } from '../../../../lib/image';

export interface SubTaskResult {
  id: string;
  title: string;
  description?: string | null;
  isRequired?: boolean;
  role?: string | null;
  answer?: 'YES' | 'NO' | null;
  remarks?: string | null;
  images?: string[];
  completedAt?: string | null;
}

interface TaskVerificationChecklistProps {
  scanned: boolean;
  configuredSubTasks?: any[];
  subTaskResponses?: any[];
  checkpointImages?: string[];
  employeeRole?: string;
  employeeName?: string;
  scannedAt?: string;
}

const ROLE_BADGES: Record<
  string,
  { label: string; bg: string; color: string; icon: string }
> = {
  SECURITY: {
    label: 'Security Guard',
    bg: 'rgba(59, 130, 246, 0.15)',
    color: '#3b82f6',
    icon: '🛡️',
  },
  TECHNICIAN: {
    label: 'Technician',
    bg: 'rgba(245, 158, 11, 0.15)',
    color: '#f59e0b',
    icon: '🔧',
  },
  CLEANER: {
    label: 'House Keeping',
    bg: 'rgba(16, 185, 129, 0.15)',
    color: '#10b981',
    icon: '🧹',
  },
  SERVICE_ENGINEER: {
    label: 'Service Engineer',
    bg: 'rgba(139, 92, 246, 0.15)',
    color: '#8b5cf6',
    icon: '⚡',
  },
  PLUMBER: {
    label: 'Plumber',
    bg: 'rgba(6, 182, 212, 0.15)',
    color: '#06b6d4',
    icon: '🚰',
  },
  LIFE_GUARD: {
    label: 'Lifeguard',
    bg: 'rgba(236, 72, 153, 0.15)',
    color: '#ec4899',
    icon: '🏊',
  },
};

export default function TaskVerificationChecklist({
  scanned,
  configuredSubTasks = [],
  subTaskResponses = [],
  checkpointImages = [],
  employeeRole = 'SECURITY',
  employeeName,
  scannedAt,
}: TaskVerificationChecklistProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [roleFilter] = useState<'EMPLOYEE' | 'ALL' | string>('EMPLOYEE');

  // Map of recorded responses for fast lookup
  const responseMap = new Map<string, any>();
  if (Array.isArray(subTaskResponses)) {
    subTaskResponses.forEach((res) => {
      const key = res.gateSubTaskId || res.id;
      responseMap.set(key, res);
    });
  }

  // Combine configured subtasks with recorded responses
  const taskMap = new Map<string, SubTaskResult>();

  // 1. Populate from configured sub-tasks
  if (Array.isArray(configuredSubTasks)) {
    configuredSubTasks.forEach((st: any) => {
      if (st.isActive !== false) {
        const stRole = st.role || 'SECURITY';
        const hasResponse = responseMap.has(st.id);

        let shouldInclude = false;
        if (roleFilter === 'ALL') {
          shouldInclude = true;
        } else if (roleFilter === 'EMPLOYEE') {
          // Include if role matches employee role OR if a response was submitted for this task
          shouldInclude = stRole === employeeRole || hasResponse;
        } else {
          // Specific role selected
          shouldInclude = stRole === roleFilter || hasResponse;
        }

        if (shouldInclude) {
          taskMap.set(st.id, {
            id: st.id,
            title: st.taskName,
            description: st.description,
            isRequired: st.isRequired,
            role: stRole,
            answer: null,
            remarks: null,
            completedAt: null,
          });
        }
      }
    });
  }

  // 2. Overlay recorded responses
  if (Array.isArray(subTaskResponses)) {
    subTaskResponses.forEach((res: any) => {
      const subTaskId = res.gateSubTaskId || res.id;
      const title =
        res.gateSubTask?.taskName || res.title || 'Verification Task';
      const description = res.gateSubTask?.description || res.description;
      const stRole = res.gateSubTask?.role || 'SECURITY';

      const taskImgs =
        res.images && res.images.length > 0
          ? res.images
          : checkpointImages && checkpointImages.length > 0
          ? checkpointImages
          : [];

      const existing = taskMap.get(subTaskId);
      if (existing) {
        existing.answer = res.answer;
        existing.remarks = res.remarks;
        existing.images = taskImgs;
        existing.role = stRole || existing.role;
        existing.completedAt = res.answeredAt || res.createdAt;
      } else {
        const shouldInclude =
          roleFilter === 'ALL' ||
          roleFilter === 'EMPLOYEE' ||
          roleFilter === stRole;

        if (shouldInclude) {
          taskMap.set(subTaskId, {
            id: subTaskId,
            title,
            description,
            role: stRole,
            answer: res.answer,
            remarks: res.remarks,
            images: taskImgs,
            completedAt: res.answeredAt || res.createdAt,
          });
        }
      }
    });
  }

  const tasksList = Array.from(taskMap.values());
  const totalTasks = tasksList.length;
  const completedCount = tasksList.filter(
    (t) => t.answer === 'YES' || t.answer === 'NO',
  ).length;
  const yesCount = tasksList.filter((t) => t.answer === 'YES').length;
  const noCount = tasksList.filter((t) => t.answer === 'NO').length;
  const completionPct =
    totalTasks > 0 ? Math.round((completedCount / totalTasks) * 100) : 0;

  const currentRoleBadge = ROLE_BADGES[employeeRole] || {
    label: employeeRole,
    bg: 'var(--bg-secondary)',
    color: 'var(--text-secondary)',
    icon: '📋',
  };

  if (totalTasks === 0 && configuredSubTasks.length === 0) {
    return (
      <div
        style={{
          marginTop: '16px',
          padding: '20px',
          borderRadius: '12px',
          backgroundColor: 'var(--bg-secondary)',
          border: '1px dashed var(--border-color)',
          display: 'flex',
          alignItems: 'center',
          gap: '14px',
        }}
      >
        <div
          style={{
            width: '40px',
            height: '40px',
            borderRadius: '10px',
            backgroundColor: 'var(--surface-color)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--text-muted)',
            flexShrink: 0,
          }}
        >
          <CheckSquare size={20} />
        </div>
        <div>
          <h5
            style={{
              margin: '0 0 2px 0',
              fontSize: '0.88rem',
              fontWeight: 600,
              color: 'var(--text-primary)',
            }}
          >
            Task Verification Checklist
          </h5>
          <p
            style={{
              margin: 0,
              fontSize: '0.8rem',
              color: 'var(--text-muted)',
            }}
          >
            No inspection tasks were configured for this checkpoint.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        marginTop: '16px',
        borderRadius: '12px',
        backgroundColor: 'var(--surface-color)',
        border: '1px solid var(--border-color)',
        overflow: 'hidden',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
        transition: 'all 0.2s ease-in-out',
      }}
    >
      {/* Card Header & Summary Bar */}
      <div
        style={{
          padding: '16px 20px',
          backgroundColor: 'rgba(255, 255, 255, 0.02)',
          borderBottom: isExpanded ? '1px solid var(--border-color)' : 'none',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '14px',
        }}
      >
        {/* Left Title */}
        <div
          onClick={() => setIsExpanded(!isExpanded)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            cursor: 'pointer',
            flex: 1,
          }}
        >
          <div
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '8px',
              backgroundColor: 'rgba(59, 130, 246, 0.12)',
              color: 'var(--primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '1px solid rgba(59, 130, 246, 0.25)',
            }}
          >
            <CheckSquare size={18} />
          </div>
          <div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                flexWrap: 'wrap',
              }}
            >
              <h5
                style={{
                  margin: 0,
                  fontSize: '0.95rem',
                  fontWeight: 700,
                  color: 'var(--text-primary)',
                }}
              >
                Task Verification Checklist
              </h5>
              <span
                style={{
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  padding: '2px 8px',
                  borderRadius: '12px',
                  backgroundColor: 'var(--bg-secondary)',
                  color: 'var(--text-secondary)',
                  border: '1px solid var(--border-color)',
                }}
              >
                {totalTasks} {totalTasks === 1 ? 'Task' : 'Tasks'}
              </span>
            </div>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              Role-based verification sub-tasks for field employees
            </span>
          </div>
        </div>

        {/* Right Controls & Summary */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            flexWrap: 'wrap',
          }}
        >
          {/* Inspection Summary Card Widget */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '6px 12px',
              borderRadius: '8px',
              backgroundColor: 'var(--bg-primary)',
              border: '1px solid var(--border-color)',
            }}
          >
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
                paddingRight: '8px',
                borderRight: '1px solid var(--border-color)',
              }}
            >
              <span
                style={{
                  fontSize: '0.65rem',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  color: 'var(--text-muted)',
                  fontWeight: 700,
                }}
              >
                Completed
              </span>
              <span
                style={{
                  fontSize: '0.85rem',
                  fontWeight: 700,
                  color: 'var(--text-primary)',
                }}
              >
                {completedCount} / {totalTasks}
              </span>
            </div>

            <div
              style={{
                display: 'flex',
                gap: '6px',
                alignItems: 'center',
                paddingLeft: '4px',
              }}
            >
              <span
                style={{
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  padding: '2px 7px',
                  borderRadius: '6px',
                  backgroundColor: 'rgba(16, 185, 129, 0.15)',
                  color: '#10b981',
                  border: '1px solid rgba(16, 185, 129, 0.3)',
                }}
              >
                YES: {yesCount}
              </span>
              <span
                style={{
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  padding: '2px 7px',
                  borderRadius: '6px',
                  backgroundColor: 'rgba(239, 68, 68, 0.15)',
                  color: '#ef4444',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                }}
              >
                NO: {noCount}
              </span>
              <span
                style={{
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  padding: '2px 7px',
                  borderRadius: '6px',
                  backgroundColor:
                    completionPct === 100
                      ? 'rgba(16, 185, 129, 0.2)'
                      : 'rgba(59, 130, 246, 0.2)',
                  color: completionPct === 100 ? '#10b981' : 'var(--primary)',
                  border: `1px solid ${completionPct === 100 ? 'rgba(16, 185, 129, 0.4)' : 'rgba(59, 130, 246, 0.4)'}`,
                }}
              >
                {completionPct}%
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            style={{
              border: 'none',
              background: 'none',
              color: 'var(--text-muted)',
              display: 'flex',
              alignItems: 'center',
              padding: '4px',
              cursor: 'pointer',
            }}
          >
            {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </button>
        </div>
      </div>

      {/* Expandable Sub Tasks List */}
      {isExpanded && (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {totalTasks === 0 ? (
            <div
              style={{
                padding: '16px 20px',
                fontSize: '0.82rem',
                color: 'var(--text-muted)',
                fontStyle: 'italic',
              }}
            >
              No sub-tasks configured for role:{' '}
              {roleFilter === 'EMPLOYEE' ? currentRoleBadge.label : roleFilter}.
            </div>
          ) : (
            tasksList.map((task, idx) => {
              const isYes = task.answer === 'YES';
              const isNo = task.answer === 'NO';
              const roleMeta = ROLE_BADGES[task.role || 'SECURITY'] || {
                label: task.role || 'Security',
                bg: 'var(--bg-secondary)',
                color: 'var(--text-secondary)',
                icon: '📋',
              };

              return (
                <div
                  key={task.id || idx}
                  className="subtask-row-hover"
                  style={{
                    padding: '16px 20px',
                    borderBottom:
                      idx === tasksList.length - 1
                        ? 'none'
                        : '1px solid var(--border-color)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px',
                    transition: 'background-color 0.15s ease',
                  }}
                >
                  {/* Task Header & Body Row */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', width: '100%' }}>
                    {/* Left & Center: Status Icon, Task Name, Role Badge, Description, Remarks */}
                    <div
                      style={{
                        display: 'flex',
                        gap: '14px',
                        flex: 1,
                        alignItems: 'flex-start',
                      }}
                    >
                      <div style={{ marginTop: '2px', flexShrink: 0 }}>
                        {isYes ? (
                          <CheckCircle2 size={18} style={{ color: '#10b981' }} />
                        ) : isNo ? (
                          <XCircle size={18} style={{ color: '#ef4444' }} />
                        ) : (
                          <Clock
                            size={18}
                            style={{ color: 'var(--text-muted)' }}
                          />
                        )}
                      </div>

                      <div
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '4px',
                          flex: 1,
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            flexWrap: 'wrap',
                          }}
                        >
                          <span
                            style={{
                              fontSize: '0.9rem',
                              fontWeight: 600,
                              color: 'var(--text-primary)',
                              lineHeight: '1.3',
                            }}
                          >
                            {task.title}
                          </span>

                          {/* Role Tag */}
                          <span
                            style={{
                              fontSize: '0.68rem',
                              fontWeight: 700,
                              padding: '2px 7px',
                              borderRadius: '6px',
                              backgroundColor: roleMeta.bg,
                              color: roleMeta.color,
                              border: `1px solid ${roleMeta.color}35`,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                            }}
                          >
                            <span>{roleMeta.icon}</span>
                            <span>{roleMeta.label}</span>
                          </span>

                          {task.isRequired && (
                            <span
                              style={{
                                fontSize: '0.65rem',
                                fontWeight: 700,
                                padding: '1px 5px',
                                borderRadius: '4px',
                                backgroundColor: 'rgba(239, 68, 68, 0.12)',
                                color: '#dc2626',
                                border: '1px solid rgba(239, 68, 68, 0.25)',
                              }}
                            >
                              REQUIRED
                            </span>
                          )}
                        </div>

                        {task.description && (
                          <span
                            style={{
                              fontSize: '0.8rem',
                              color: 'var(--text-muted)',
                              margin: '2px 0 0 0',
                            }}
                          >
                            {task.description}
                          </span>
                        )}

                        {task.remarks && (
                          <div
                            style={{
                              marginTop: '6px',
                              padding: '8px 12px',
                              borderRadius: '6px',
                              backgroundColor: 'var(--bg-secondary)',
                              borderLeft: `3px solid ${isNo ? '#ef4444' : 'var(--primary)'}`,
                              fontSize: '0.8rem',
                              color: 'var(--text-secondary)',
                              display: 'flex',
                              alignItems: 'flex-start',
                              gap: '8px',
                            }}
                          >
                            <FileText
                              size={14}
                              style={{
                                marginTop: '2px',
                                color: 'var(--text-muted)',
                                flexShrink: 0,
                              }}
                            />
                            <div>
                              <strong
                                style={{
                                  color: 'var(--text-muted)',
                                  fontSize: '0.75rem',
                                  display: 'block',
                                  marginBottom: '2px',
                                }}
                              >
                                Employee Remarks:
                              </strong>
                              <span>{task.remarks}</span>
                            </div>
                          </div>
                        )}

                        {task.images && task.images.length > 0 && (
                          <div
                            style={{
                              marginTop: '10px',
                              padding: '10px 12px',
                              borderRadius: '8px',
                              backgroundColor: 'var(--bg-primary)',
                              border: '1px solid var(--border-color)',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '8px',
                            }}
                          >
                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                              }}
                            >
                              <Camera
                                size={14}
                                style={{ color: 'var(--text-muted)' }}
                              />
                              <span
                                style={{
                                  fontSize: '0.75rem',
                                  fontWeight: 700,
                                  color: 'var(--text-muted)',
                                  textTransform: 'uppercase',
                                  letterSpacing: '0.5px',
                                }}
                              >
                                Live Camera Evidence ({task.images.length})
                              </span>
                            </div>
                            <div
                              style={{
                                display: 'flex',
                                gap: '10px',
                                flexWrap: 'wrap',
                                alignItems: 'center',
                              }}
                            >
                              {task.images.map((imgUrl, imgIdx) => {
                                const fullUrl = resolveImageUrl(imgUrl);
                                return (
                                  <a
                                    key={imgIdx}
                                    href={fullUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    title="Click to view full photo evidence"
                                    style={{
                                      display: 'inline-block',
                                      borderRadius: '8px',
                                      overflow: 'hidden',
                                      border: '1px solid var(--border-color)',
                                      boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
                                    }}
                                  >
                                    <img
                                      src={fullUrl}
                                      alt={`Task evidence ${imgIdx + 1}`}
                                      style={{
                                        width: '90px',
                                        height: '90px',
                                        objectFit: 'cover',
                                        display: 'block',
                                      }}
                                    />
                                  </a>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Right: Answer Badge */}
                    <div
                      style={{
                        flexShrink: 0,
                        textAlign: 'right',
                        marginTop: '2px',
                      }}
                    >
                      {isYes ? (
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px',
                            fontSize: '0.78rem',
                            fontWeight: 800,
                            padding: '4px 12px',
                            borderRadius: '6px',
                            backgroundColor: 'rgba(16, 185, 129, 0.15)',
                            color: '#10b981',
                            border: '1px solid rgba(16, 185, 129, 0.35)',
                            boxShadow: '0 2px 6px rgba(16, 185, 129, 0.1)',
                          }}
                        >
                          <CheckCircle2 size={13} />
                          <span>YES</span>
                        </span>
                      ) : isNo ? (
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px',
                            fontSize: '0.78rem',
                            fontWeight: 800,
                            padding: '4px 12px',
                            borderRadius: '6px',
                            backgroundColor: 'rgba(239, 68, 68, 0.15)',
                            color: '#ef4444',
                            border: '1px solid rgba(239, 68, 68, 0.35)',
                            boxShadow: '0 2px 6px rgba(239, 68, 68, 0.1)',
                          }}
                        >
                          <XCircle size={13} />
                          <span>NO</span>
                        </span>
                      ) : (
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            padding: '4px 10px',
                            borderRadius: '6px',
                            backgroundColor: 'var(--bg-secondary)',
                            color: 'var(--text-muted)',
                            border: '1px solid var(--border-color)',
                          }}
                        >
                          <span>UNANSWERED</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Task Evidence Metadata Footer (Employee Name, Timestamp, Voice Note Indicator) */}
                  {(isYes || isNo || task.remarks || (task.images && task.images.length > 0)) && (
                    <div
                      style={{
                        paddingTop: '8px',
                        borderTop: '1px dashed var(--border-color)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        flexWrap: 'wrap',
                        gap: '10px',
                        fontSize: '0.75rem',
                        color: 'var(--text-muted)',
                        marginTop: '4px',
                      }}
                    >
                      {/* Left: Employee Name & Timestamp */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
                        {employeeName && (
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '5px',
                              fontWeight: 600,
                              color: 'var(--text-primary)',
                            }}
                          >
                            <User size={13} style={{ color: 'var(--primary)' }} />
                            <span>Submitted by: {employeeName}</span>
                          </span>
                        )}

                        {(task.completedAt || scannedAt) && (
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '5px',
                              color: 'var(--text-muted)',
                            }}
                          >
                            <Calendar size={13} />
                            <span>Recorded: {new Date(task.completedAt || scannedAt!).toLocaleString()}</span>
                          </span>
                        )}
                      </div>

                      {/* Right: Voice Note Badge (UI Placeholder) */}
                      <div
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          fontSize: '0.72rem',
                          color: 'var(--text-muted)',
                          backgroundColor: 'var(--bg-secondary)',
                          padding: '2px 8px',
                          borderRadius: '4px',
                          border: '1px solid var(--border-color)',
                        }}
                        title="Voice note recording feature support in future release"
                      >
                        <Mic size={12} style={{ color: 'var(--text-muted)' }} />
                        <span>Voice Note: None</span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
