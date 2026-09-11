import { AppError } from '../../common/errors/AppError';
import { ErrorCodes } from '../../common/errors/ErrorCodes';
import { HttpStatus } from '../../common/errors/HttpStatus';
import { logger } from '../../common/logger/logger';
import { processImagesList } from '../../common/utils/file-upload.util';

import { UserRole } from '@prisma/client';
import { patrolSessionRepository } from '../patrol-session/patrol-session.repository';

import { prisma } from '../../database/prisma';
import { patrolCheckpointRepository } from './patrol-checkpoint.repository';
import { ScanCheckpointDto } from './patrol-checkpoint.types';
import { ensureGateSubTasksFromMaster } from '../gate-sub-task/gate-sub-task.service';

export class PatrolCheckpointService {
  async authorizeManagerScan(employeeId: string, gateIdInput: string, clientContextId?: string) {
    if (!employeeId) {
      throw new AppError(
        HttpStatus.UNAUTHORIZED,
        ErrorCodes.UNAUTHORIZED,
        'Employee account not found.',
      );
    }

    const userOrEmp = await prisma.user.findFirst({
      where: { OR: [{ id: employeeId }, { employeeId: employeeId }] },
      include: { employee: true },
    });

    if (!userOrEmp) {
      throw new AppError(HttpStatus.NOT_FOUND, ErrorCodes.NOT_FOUND, 'User account not found.');
    }

    let gateRecord = await prisma.gate.findFirst({
      where: {
        OR: [{ id: gateIdInput }, { gateCode: gateIdInput }, { qrCode: gateIdInput }],
      },
      include: { site: true },
    });

    if (!gateRecord) {
      throw new AppError(HttpStatus.NOT_FOUND, ErrorCodes.NOT_FOUND, 'Checkpoint gate not found.');
    }

    if (gateRecord.isActive === false) {
      throw new AppError(
        HttpStatus.BAD_REQUEST,
        ErrorCodes.VALIDATION_ERROR,
        'This checkpoint is inactive and cannot be inspected.',
      );
    }

    const checkpointClientId = gateRecord.site.clientId;

    const hasMembership = await prisma.managerClientMembership.findFirst({
      where: {
        managerUserId: userOrEmp.id,
        clientId: checkpointClientId,
        isActive: true,
      },
    });

    if (!hasMembership && userOrEmp.role !== UserRole.SUPER_ADMIN) {
      throw new AppError(
        HttpStatus.FORBIDDEN,
        ErrorCodes.FORBIDDEN,
        'Access denied. This checkpoint is not part of an organization assigned to your Manager account.',
      );
    }

    if (
      clientContextId &&
      clientContextId !== checkpointClientId &&
      userOrEmp.role !== UserRole.SUPER_ADMIN
    ) {
      throw new AppError(
        HttpStatus.FORBIDDEN,
        ErrorCodes.FORBIDDEN,
        'This checkpoint belongs to another organization. Finish the current patrol or switch organization before scanning.',
      );
    }

    let patrol = await prisma.patrolSession.findFirst({
      where: {
        managerUserId: userOrEmp.id,
        status: 'IN_PROGRESS',
      },
    });

    if (patrol) {
      if (patrol.clientId !== checkpointClientId && userOrEmp.role !== UserRole.SUPER_ADMIN) {
        throw new AppError(
          HttpStatus.FORBIDDEN,
          ErrorCodes.FORBIDDEN,
          'This checkpoint belongs to another organization. Finish the current patrol or switch organization before scanning.',
        );
      }
    } else {
      const patrolCode = await patrolSessionRepository.getNextPatrolCode(checkpointClientId);
      patrol = await prisma.patrolSession.create({
        data: {
          clientId: checkpointClientId,
          managerUserId: userOrEmp.id,
          status: 'IN_PROGRESS',
          startedAt: new Date(),
          patrolCode,
        },
      });
    }

    const fullSession = await patrolSessionRepository.findFullById(patrol.id);

    return {
      checkpoint: {
        gateId: gateRecord.id,
        gate: gateRecord,
      },
      patrolSession: fullSession || patrol,
    };
  }

  async scan(employeeId: string, dto: ScanCheckpointDto, clientContextId?: string) {
    if (!employeeId) {
      throw new AppError(
        HttpStatus.UNAUTHORIZED,
        ErrorCodes.UNAUTHORIZED,
        'Employee account not found.',
      );
    }

    // -----------------------------------------
    // Check if user/employee is a Manager
    // -----------------------------------------
    const userOrEmp = await prisma.user.findFirst({
      where: { OR: [{ id: employeeId }, { employeeId: employeeId }] },
      include: { employee: true },
    });
    const isManagerUser =
      userOrEmp?.role === UserRole.MANAGER || userOrEmp?.employee?.role === UserRole.MANAGER;

    let patrol: any = null;

    if (isManagerUser && userOrEmp) {
      let gateRecord = await prisma.gate.findFirst({
        where: {
          OR: [{ id: dto.gateId }, { gateCode: dto.gateId }, { qrCode: dto.gateId }],
        },
        include: { site: true },
      });
      if (!gateRecord) {
        throw new AppError(HttpStatus.NOT_FOUND, ErrorCodes.NOT_FOUND, 'Checkpoint gate not found.');
      }

      if (gateRecord.isActive === false) {
        throw new AppError(
          HttpStatus.BAD_REQUEST,
          ErrorCodes.VALIDATION_ERROR,
          'This checkpoint is inactive and cannot be inspected.',
        );
      }

      const checkpointClientId = gateRecord.site.clientId;

      // 1. Verify if Manager has an active membership for this checkpoint's client
      const hasMembership = await prisma.managerClientMembership.findFirst({
        where: {
          managerUserId: userOrEmp.id,
          clientId: checkpointClientId,
          isActive: true,
        },
      });

      if (!hasMembership && userOrEmp.role !== UserRole.SUPER_ADMIN) {
        throw new AppError(
          HttpStatus.FORBIDDEN,
          ErrorCodes.FORBIDDEN,
          'Access denied. This checkpoint is not part of an organization assigned to your Manager account.',
        );
      }

      // 2. Verify if selected client context matches this checkpoint's client
      if (
        clientContextId &&
        clientContextId !== checkpointClientId &&
        userOrEmp.role !== UserRole.SUPER_ADMIN
      ) {
        throw new AppError(
          HttpStatus.FORBIDDEN,
          ErrorCodes.FORBIDDEN,
          'This checkpoint belongs to another organization. Finish the current patrol or switch organization before scanning.',
        );
      }

      const activeManagerSession = await prisma.patrolSession.findFirst({
        where: {
          managerUserId: userOrEmp.id,
          status: 'IN_PROGRESS',
        },
      });

      if (activeManagerSession) {
        if (activeManagerSession.clientId !== checkpointClientId && userOrEmp.role !== UserRole.SUPER_ADMIN) {
          throw new AppError(
            HttpStatus.FORBIDDEN,
            ErrorCodes.FORBIDDEN,
            'This checkpoint belongs to another organization. Finish the current patrol or switch organization before scanning.',
          );
        }
        patrol = activeManagerSession;
      } else {
        const patrolCode = await patrolSessionRepository.getNextPatrolCode(checkpointClientId);
        patrol = await prisma.patrolSession.create({
          data: {
            clientId: checkpointClientId,
            managerUserId: userOrEmp.id,
            status: 'IN_PROGRESS',
            startedAt: new Date(),
            patrolCode,
          },
        });
      }
    } else {
      // -----------------------------------------
      // Find active patrol session for standard employee
      // -----------------------------------------

      if (dto.patrolSessionId && !dto.patrolSessionId.startsWith('temp-') && !dto.patrolSessionId.startsWith('offline-')) {
        const foundSession = await patrolSessionRepository.findFullById(dto.patrolSessionId);
        if (foundSession) {
          const isOwner =
            foundSession.assignment?.employeeId === employeeId ||
            foundSession.managerUserId === userOrEmp?.id ||
            (foundSession as any).employeeId === employeeId ||
            (userOrEmp && userOrEmp.employeeId === employeeId);

          if (isOwner) {
            patrol = foundSession;
          }
        }
      }

      if (!patrol) {
        patrol = await patrolSessionRepository.findActiveByEmployee(employeeId);
      }

      if (!patrol) {
        throw new AppError(
          HttpStatus.BAD_REQUEST,
          ErrorCodes.NOT_FOUND,
          'No active patrol session in progress for this employee.',
        );
      }
    }

    const assignment = patrol.assignment as any;

    // -----------------------------------------
    // Verify & Resolve Gate ID
    // -----------------------------------------

    let targetGateId = dto.gateId;

    // 1. Resolve if dto.gateId is a Gate ID, code, or qrCode directly
    let gateRecord = await prisma.gate.findFirst({
      where: {
        OR: [
          { id: targetGateId },
          { gateCode: targetGateId },
          { qrCode: targetGateId },
        ],
      },
    });

    // 2. If not found directly, resolve via GuardAssignmentGate
    if (!gateRecord) {
      const agMatch = await prisma.guardAssignmentGate.findFirst({
        where: {
          OR: [{ id: dto.gateId }, { gateId: dto.gateId }],
        },
        include: { gate: true },
      });
      if (agMatch) {
        gateRecord = agMatch.gate;
        targetGateId = agMatch.gateId;
      }
    }

    // 3. If not found, resolve via PatrolRouteGate
    if (!gateRecord) {
      const rgMatch = await prisma.patrolRouteGate.findFirst({
        where: {
          OR: [{ id: dto.gateId }, { gateId: dto.gateId }],
        },
        include: { gate: true },
      });
      if (rgMatch) {
        gateRecord = rgMatch.gate;
        targetGateId = rgMatch.gateId;
      }
    }

    if (gateRecord) {
      targetGateId = gateRecord.id;
    } else {
      const fallbackGate = await prisma.gate.findFirst({
        where: { id: dto.gateId },
      });
      if (fallbackGate) {
        gateRecord = fallbackGate;
        targetGateId = fallbackGate.id;
      } else {
        const assignedGateId =
          assignment?.assignmentGates?.[0]?.gateId ||
          assignment?.patrolRoute?.routeGates?.[0]?.gateId;
        if (assignedGateId) {
          const agGate = await prisma.gate.findUnique({
            where: { id: assignedGateId },
          });
          if (agGate) {
            gateRecord = agGate;
            targetGateId = agGate.id;
          }
        }
      }
    }

    if (!gateRecord) {
      const firstGate = await prisma.gate.findFirst();
      if (firstGate) {
        targetGateId = firstGate.id;
      }
    }

    // Standardize dto.gateId to actual Gate.id so FK relations persist smoothly
    dto.gateId = targetGateId;

    if (gateRecord && gateRecord.isActive === false) {
      throw new AppError(
        HttpStatus.BAD_REQUEST,
        ErrorCodes.VALIDATION_ERROR,
        'This checkpoint is inactive and cannot be scanned.',
      );
    }

    // -----------------------------------------
    // Validate Sub Tasks
    // -----------------------------------------

    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      select: { role: true },
    });
    const userRole = isManagerUser ? UserRole.MANAGER : (employee?.role || 'SECURITY');

    await ensureGateSubTasksFromMaster(
      dto.gateId,
      userRole,
      (gateRecord as any)?.site?.clientId,
    );

    const activeSubTasks = await prisma.gateSubTask.findMany({
      where: {
        gateId: dto.gateId,
        isActive: true,
        role: userRole,
      },
    });

    const subTaskMap = new Map(
      (dto.subTaskResponses || []).map((r) => [r.gateSubTaskId, r]),
    );
    const missingRequiredTasks = activeSubTasks.filter(
      (st) => st.isRequired && !subTaskMap.has(st.id),
    );

    if (missingRequiredTasks.length > 0) {
      const missingNames = missingRequiredTasks
        .map((st) => `"${st.taskName}"`)
        .join(', ');
      throw new AppError(
        HttpStatus.BAD_REQUEST,
        ErrorCodes.VALIDATION_ERROR,
        `All required sub-tasks must be answered. Missing: ${missingNames}`,
      );
    }

    // -----------------------------------------
    // Pre-process Base64 Images into Static Files
    // -----------------------------------------
    const submissionStartTime = Date.now();
    const requestId = `cp-scan-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;

    const existing = await patrolCheckpointRepository.findBySessionAndGate(
      patrol.id,
      dto.gateId,
    );

    const processedDtoImages = await processImagesList(dto.images, 'cp-main');
    const processedSubTaskResponses = dto.subTaskResponses
      ? await Promise.all(
          dto.subTaskResponses.map(async (st) => ({
            ...st,
            images: await processImagesList(st.images, 'cp-subtask'),
          })),
        )
      : [];

    const subTaskImagesList = processedSubTaskResponses
      .flatMap((st) => st.images || [])
      .filter(Boolean);

    const allImages = Array.from(
      new Set([...processedDtoImages, ...subTaskImagesList]),
    );

    logger.info(
      {
        requestId,
        employeeId,
        patrolSessionId: patrol.id,
        gateId: dto.gateId,
        dtoImagesCount: dto.images?.length || 0,
        subTaskResponsesCount: processedSubTaskResponses.length,
        processedTotalImagesCount: allImages.length,
      },
      '[CheckpointScan] Submission initiated',
    );

    const checkpoint = await prisma
      .$transaction(
        async (tx) => {
          let scannedAt = new Date();
          if (dto.scannedAt) {
            const parsed = new Date(dto.scannedAt);
            if (!isNaN(parsed.getTime())) {
              const maxFuture = Date.now() + 5 * 60 * 1000;
              scannedAt = parsed.getTime() > maxFuture ? new Date() : parsed;
            }
          }

          let cp;
          if (existing) {
            cp = await tx.patrolCheckpoint.update({
              where: { id: existing.id },
              data: {
                latitude: dto.latitude,
                longitude: dto.longitude,
                remarks: dto.remarks,
                status: dto.status,
                images: allImages,
                scannedAt,
              },
            });
          } else {
            cp = await tx.patrolCheckpoint.create({
              data: {
                patrolSessionId: patrol.id,
                gateId: dto.gateId,
                latitude: dto.latitude,
                longitude: dto.longitude,
                remarks: dto.remarks,
                status: dto.status,
                images: allImages,
                scannedAt,
              },
            });
          }

          if (
            processedSubTaskResponses &&
            processedSubTaskResponses.length > 0
          ) {
            for (const resp of processedSubTaskResponses) {
              let answeredAt = scannedAt;
              if (resp.answeredAt) {
                const parsedAns = new Date(resp.answeredAt);
                if (!isNaN(parsedAns.getTime())) {
                  const maxFuture = Date.now() + 5 * 60 * 1000;
                  answeredAt = parsedAns.getTime() > maxFuture ? scannedAt : parsedAns;
                }
              }

              await tx.patrolSubTaskResponse.upsert({
                where: {
                  patrolCheckpointId_gateSubTaskId: {
                    patrolCheckpointId: cp.id,
                    gateSubTaskId: resp.gateSubTaskId,
                  },
                },
                create: {
                  patrolCheckpointId: cp.id,
                  gateSubTaskId: resp.gateSubTaskId,
                  answer: resp.answer,
                  remarks: resp.remarks?.trim() || null,
                  images: resp.images || [],
                  answeredAt,
                },
                update: {
                  answer: resp.answer,
                  remarks: resp.remarks?.trim() || null,
                  images: resp.images || [],
                  answeredAt,
                },
              });

              // AUTOMATIC OBSERVATION REPORT (INCIDENT) GENERATION IF TASK ANSWER IS NO
              if (resp.answer === 'NO') {
                const subTaskInfo = await tx.gateSubTask.findUnique({
                  where: { id: resp.gateSubTaskId },
                });

                const taskTitle =
                  subTaskInfo?.taskName || 'Verification Sub-Task';
                const taskDesc = subTaskInfo?.description || '';
                const subTaskImages =
                  resp.images && resp.images.length > 0
                    ? resp.images
                    : processedDtoImages;

                const observationDescription = `Sub-Task Answer: NO (${taskTitle})\nTask Description: ${taskDesc || 'N/A'}\nOfficer Role: ${userRole}\nRemarks: ${resp.remarks?.trim() || 'No remarks provided'}\nCheckpoint: ${gateRecord?.name || 'Gate'} (${gateRecord?.gateCode || targetGateId})\nPatrol Session: ${patrol.patrolCode || patrol.id}`;

                const activeClientId = assignment?.clientId || patrol.clientId;

                if (activeClientId) {
                  const existingIncident = await tx.incident.findFirst({
                    where: {
                      patrolSessionId: patrol.id,
                      gateId: targetGateId,
                      description: { contains: taskTitle },
                    },
                  });

                  if (!existingIncident) {
                    await tx.incident.create({
                      data: {
                        clientId: activeClientId,
                        employeeId: employeeId,
                        type: taskTitle,
                        severity: 'MEDIUM',
                        status: 'OPEN',
                        description: observationDescription,
                        images: subTaskImages,
                        patrolSessionId: patrol.id,
                        gateId: targetGateId,
                        latitude: dto.latitude || null,
                        longitude: dto.longitude || null,
                      },
                    });
                  }
                }
              }
            }
          }

          return tx.patrolCheckpoint.findUnique({
            where: { id: cp.id },
            include: {
              gate: true,
              subTaskResponses: {
                include: {
                  gateSubTask: true,
                },
              },
            },
          });
        },
        {
          maxWait: 10000,
          timeout: 20000,
        },
      )
      .catch((err) => {
        logger.error(
          {
            requestId,
            employeeId,
            gateId: dto.gateId,
            durationMs: Date.now() - submissionStartTime,
            error: err.message,
            stack: err.stack,
          },
          '[CheckpointScan] DB Transaction failed',
        );
        throw err;
      });

    logger.info(
      {
        requestId,
        employeeId,
        checkpointId: checkpoint?.id,
        durationMs: Date.now() - submissionStartTime,
      },
      '[CheckpointScan] Submission completed successfully',
    );

    // -----------------------------------------
    // Progress
    // -----------------------------------------

    const completed = await patrolCheckpointRepository.countBySession(
      patrol.id,
    );

    const total = assignment?.patrolRoute
      ? assignment.patrolRoute.routeGates?.length || 0
      : assignment?.assignmentGates
        ? assignment.assignmentGates.length
        : 0;

    const percentage = total === 0 ? 0 : Math.round((completed / total) * 100);

    const fullSession = await patrolSessionRepository.findFullById(patrol.id);

    return {
      checkpoint,
      patrolSession: fullSession || patrol,

      progress: {
        completed,
        total: total || completed,
        percentage,
        remaining: Math.max(0, total - completed),
      },
    };
  }

  async history(sessionId: string) {
    return patrolCheckpointRepository.listBySession(sessionId);
  }

  async updateRemarks(checkpointId: string, remarks: string) {
    const checkpoint = await patrolCheckpointRepository.findById(checkpointId);

    if (!checkpoint) {
      throw new AppError(
        HttpStatus.NOT_FOUND,
        ErrorCodes.NOT_FOUND,
        'Patrol checkpoint not found.',
      );
    }

    return patrolCheckpointRepository.update(checkpointId, { remarks });
  }
}

export const patrolCheckpointService = new PatrolCheckpointService();
