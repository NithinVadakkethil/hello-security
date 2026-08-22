import { AppError } from '../../common/errors/AppError';
import { ErrorCodes } from '../../common/errors/ErrorCodes';
import { HttpStatus } from '../../common/errors/HttpStatus';
import { OPERATIONAL_ROLES } from '../../common/auth/constants';
import { auditLogRepository } from '../audit-log/audit-log.repository';
import { snagRepository } from './snag.repository';
import { AddSnagCommentDto, AssignSnagDto, CompleteSnagJobDto, CreateSnagDto, SnagFilterDto, UpdateSnagStatusDto } from './snag.types';

export class SnagService {
  async create(clientId: string, employeeId: string, userId: string, dto: CreateSnagDto) {
    const snag = await snagRepository.create(clientId, employeeId, dto);

    await auditLogRepository.create({
      clientId,
      userId,
      action: 'CREATE' as any,
      entity: 'SNAG',
      entityId: snag.id,
    });

    await snagRepository.addHistory(snag.id, userId, 'CREATED', undefined, 'OPEN', 'Snag ticket created by guard inspection.');

    return snag;
  }

  async list(clientId: string, filters: SnagFilterDto = {}, userId?: string, userRole?: string) {
    const isFieldUser = userRole && (OPERATIONAL_ROLES as readonly string[]).includes(userRole);
    if (isFieldUser || filters.assignedToId === 'me') {
      filters.assignedToId = userId;
    }
    return snagRepository.list(clientId, filters);
  }

  async getStats(clientId: string) {
    return snagRepository.getStats(clientId);
  }

  async get(id: string, clientId: string, userId?: string, userRole?: string) {
    const snag = await snagRepository.findById(id);

    if (!snag || snag.clientId !== clientId) {
      throw new AppError(
        HttpStatus.NOT_FOUND,
        ErrorCodes.NOT_FOUND,
        'Snag report not found.',
      );
    }

    const isFieldUser = userRole && (OPERATIONAL_ROLES as readonly string[]).includes(userRole);
    if (isFieldUser && userId) {
      const isAssigned = snag.assignments?.some((a) => a.assignedToId === userId);
      const isReporter = snag.employee?.id && snag.employee.id === userId;
      if (!isAssigned && !isReporter) {
        throw new AppError(
          HttpStatus.FORBIDDEN,
          ErrorCodes.FORBIDDEN,
          'You are not authorized to view this assigned maintenance job.',
        );
      }
    }

    return snag;
  }

  async verifyCheckpointQr(id: string, clientId: string, userId: string, userRole: string, qrCode: string) {
    const snag = await this.get(id, clientId, userId, userRole);

    if (!snag.gate) {
      throw new AppError(
        HttpStatus.BAD_REQUEST,
        ErrorCodes.VALIDATION_ERROR,
        'This snag ticket is not linked to a specific checkpoint gate.',
      );
    }

    const cleanQr = qrCode.trim().toUpperCase();
    const cleanGateCode = (snag.gate.gateCode || '').trim().toUpperCase();
    const cleanGateId = (snag.gate.id || '').trim().toUpperCase();

    const isMatch = cleanQr === cleanGateCode || cleanQr === cleanGateId || cleanQr.includes(cleanGateCode);
    if (!isMatch) {
      throw new AppError(
        HttpStatus.BAD_REQUEST,
        ErrorCodes.INVALID_QR_CODE,
        `Scanned QR code "${qrCode}" does not match checkpoint "${snag.gate.name}" (${snag.gate.gateCode}).`,
      );
    }

    return {
      valid: true,
      snagId: snag.id,
      gate: {
        id: snag.gate.id,
        name: snag.gate.name,
        gateCode: snag.gate.gateCode,
      },
      reportedIssue: {
        id: snag.id,
        category: snag.category,
        subCategory: snag.subCategory,
        description: snag.description,
        priority: snag.priority,
        status: snag.status,
        images: snag.images || [],
        reportedBy: snag.employee ? `${snag.employee.firstName} ${snag.employee.lastName || ''}`.trim() : 'Security Guard',
        reportedAt: snag.createdAt,
      },
    };
  }

  async completeJob(id: string, clientId: string, userId: string, userRole: string, dto: CompleteSnagJobDto) {
    const snag = await this.get(id, clientId, userId, userRole);
    const prevStatus = snag.status;

    if (snag.status === 'RESOLVED' || snag.status === 'CLOSED') {
      return snag;
    }

    const updated = await snagRepository.completeJob(id, userId, dto);

    await auditLogRepository.create({
      clientId,
      userId,
      action: 'UPDATE' as any,
      entity: 'SNAG',
      entityId: id,
    });

    await snagRepository.addHistory(
      id,
      userId,
      'RESOLVED',
      prevStatus,
      'RESOLVED',
      dto.notes || 'Maintenance job verified via checkpoint QR scan and marked RESOLVED.',
    );

    return updated;
  }

  async updateStatus(id: string, clientId: string, userId: string, dto: UpdateSnagStatusDto) {
    const snag = await this.get(id, clientId);
    const prevStatus = snag.status;

    const updated = await snagRepository.updateStatus(id, dto.status);

    await auditLogRepository.create({
      clientId,
      userId,
      action: 'UPDATE' as any,
      entity: 'SNAG',
      entityId: id,
    });

    await snagRepository.addHistory(
      id,
      userId,
      'STATUS_CHANGE',
      prevStatus,
      dto.status,
      dto.notes || `Status changed from ${prevStatus} to ${dto.status}.`,
    );

    return updated;
  }

  async addComment(id: string, clientId: string, userId: string, dto: AddSnagCommentDto) {
    await this.get(id, clientId);

    const comment = await snagRepository.addComment(id, userId, dto.comment);

    await auditLogRepository.create({
      clientId,
      userId,
      action: 'UPDATE' as any,
      entity: 'SNAG_COMMENT',
      entityId: comment.id,
    });

    await snagRepository.addHistory(id, userId, 'COMMENT_ADDED', undefined, undefined, dto.comment);

    return comment;
  }

  async assign(id: string, clientId: string, userId: string, dto: AssignSnagDto) {
    await this.get(id, clientId);

    const assignment = await snagRepository.assign(id, userId, dto);

    await auditLogRepository.create({
      clientId,
      userId,
      action: 'UPDATE' as any,
      entity: 'SNAG_ASSIGNMENT',
      entityId: assignment.id,
    });

    await snagRepository.addHistory(
      id,
      userId,
      'ASSIGNED',
      undefined,
      undefined,
      `Assigned to maintenance user ID ${dto.assignedToId}.${dto.dueDate ? ` Due Date: ${dto.dueDate}` : ''}`,
    );

    return assignment;
  }
}

export const snagService = new SnagService();
