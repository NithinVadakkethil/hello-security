import { AppError } from '../../common/errors/AppError';
import { ErrorCodes } from '../../common/errors/ErrorCodes';
import { HttpStatus } from '../../common/errors/HttpStatus';
import { auditLogRepository } from '../audit-log/audit-log.repository';
import { snagRepository } from './snag.repository';
import { AddSnagCommentDto, AssignSnagDto, CreateSnagDto, SnagFilterDto, UpdateSnagStatusDto } from './snag.types';

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

  async list(clientId: string, filters: SnagFilterDto = {}) {
    return snagRepository.list(clientId, filters);
  }

  async getStats(clientId: string) {
    return snagRepository.getStats(clientId);
  }

  async get(id: string, clientId: string) {
    const snag = await snagRepository.findById(id);

    if (!snag || snag.clientId !== clientId) {
      throw new AppError(
        HttpStatus.NOT_FOUND,
        ErrorCodes.NOT_FOUND,
        'Snag report not found.',
      );
    }

    return snag;
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
