import { AppError } from '../../common/errors/AppError';
import { ErrorCodes } from '../../common/errors/ErrorCodes';
import { HttpStatus } from '../../common/errors/HttpStatus';
import { logger } from '../../common/logger/logger';
import { processImagesList } from '../../common/utils/file-upload.util';

import { patrolSessionRepository } from '../patrol-session/patrol-session.repository';

import { prisma } from '../../database/prisma';
import { patrolCheckpointRepository } from './patrol-checkpoint.repository';
import { ScanCheckpointDto } from './patrol-checkpoint.types';

export class PatrolCheckpointService {
  async scan(employeeId: string, dto: ScanCheckpointDto) {
    if (!employeeId) {
      throw new AppError(
        HttpStatus.UNAUTHORIZED,
        ErrorCodes.UNAUTHORIZED,
        'Employee account not found.',
      );
    }

    // -----------------------------------------
    // Find active patrol session for employee
    // -----------------------------------------

    let patrol: any = null;

    if (dto.patrolSessionId && !dto.patrolSessionId.startsWith('temp-')) {
      patrol = await patrolSessionRepository.findFullById(dto.patrolSessionId);
      // Validate employee ownership if found
      if (patrol && patrol.assignment?.employeeId !== employeeId) {
        patrol = null;
      }
    }

    if (!patrol) {
      patrol = await patrolSessionRepository.findActiveByEmployee(employeeId);
    }

    if (!patrol) {
      patrol = (await prisma.patrolSession.findFirst({
        where: {
          status: 'IN_PROGRESS',
        },
        include: {
          assignment: {
            include: {
              employee: true,
              site: true,
              shift: true,
              patrolRoute: {
                include: {
                  routeGates: {
                    include: {
                      gate: {
                        include: {
                          subTasks: {
                            where: { isActive: true },
                            orderBy: { displayOrder: 'asc' },
                          },
                        },
                      },
                    },
                  },
                },
              },
              assignmentGates: {
                include: {
                  gate: {
                    include: {
                      subTasks: {
                        where: { isActive: true },
                        orderBy: { displayOrder: 'asc' },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      })) as any;
    }

    if (!patrol) {
      throw new AppError(
        HttpStatus.BAD_REQUEST,
        ErrorCodes.NOT_FOUND,
        'No patrol in progress.',
      );
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

    // -----------------------------------------
    // Validate Sub Tasks
    // -----------------------------------------

    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      select: { role: true },
    });
    const userRole = employee?.role || 'SECURITY';

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
                scannedAt: new Date(),
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
              },
            });
          }

          if (
            processedSubTaskResponses &&
            processedSubTaskResponses.length > 0
          ) {
            for (const resp of processedSubTaskResponses) {
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
                },
                update: {
                  answer: resp.answer,
                  remarks: resp.remarks?.trim() || null,
                  images: resp.images || [],
                  answeredAt: new Date(),
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

    const total = assignment.patrolRoute
      ? assignment.patrolRoute.routeGates.length
      : assignment.assignmentGates
        ? assignment.assignmentGates.length
        : 0;

    const percentage = total === 0 ? 0 : Math.round((completed / total) * 100);

    return {
      checkpoint,

      progress: {
        completed,
        total,
        percentage,
        remaining: total - completed,
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
