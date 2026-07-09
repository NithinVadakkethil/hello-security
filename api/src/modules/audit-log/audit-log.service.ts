import { auditLogRepository } from './audit-log.repository';

export class AuditLogService {
  async list(
    page = 1,
    limit = 10,
    search?: string,
    action?: string,
    entity?: string,
    userId?: string,
    clientId?: string,
    startDateStr?: string,
    endDateStr?: string,
  ) {
    const skip = (page - 1) * limit;

    const startDate = startDateStr ? new Date(startDateStr) : undefined;
    const endDate = endDateStr ? new Date(endDateStr) : undefined;

    const [logs, total] = await Promise.all([
      auditLogRepository.list(
        skip,
        limit,
        search,
        action,
        entity,
        userId,
        clientId,
        startDate,
        endDate,
      ),
      auditLogRepository.count(
        search,
        action,
        entity,
        userId,
        clientId,
        startDate,
        endDate,
      ),
    ]);

    return {
      items: logs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async create(data: {
    clientId?: string;
    userId: string;
    action: 'LOGIN' | 'LOGOUT' | 'CREATE' | 'UPDATE' | 'DELETE' | 'DOWNLOAD';
    entity: string;
    entityId?: string;
    ipAddress?: string;
    userAgent?: string;
  }) {
    return auditLogRepository.create({
      clientId: data.clientId || null,
      userId: data.userId,
      action: data.action,
      entity: data.entity,
      entityId: data.entityId || null,
      ipAddress: data.ipAddress || null,
      userAgent: data.userAgent || null,
    });
  }
}

export const auditLogService = new AuditLogService();
