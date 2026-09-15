import { AppError } from '../../common/errors/AppError';
import { ErrorCodes } from '../../common/errors/ErrorCodes';
import { HttpStatus } from '../../common/errors/HttpStatus';
import { CurrentUser } from '../../common/auth/current-user';
import { getSupervisorScope } from '../../common/auth/supervisor-scope';
import { incidentRepository } from './incident.repository';

export class IncidentService {
  async create(clientId: string, employeeId: string, data: {
    type: string;
    severity: string;
    description: string;
    images?: string[];
  }) {
    return incidentRepository.create({
      clientId,
      employeeId,
      ...data,
    });
  }

  async list(clientId: string, user?: CurrentUser) {
    const scope = user?.role === 'SUPERVISOR' ? getSupervisorScope(user) : null;
    return incidentRepository.list(clientId, scope);
  }

  async findById(id: string, user?: CurrentUser) {
    const incident = await incidentRepository.findById(id);
    if (!incident) return null;

    if (user && user.role === 'SUPERVISOR') {
      const scope = getSupervisorScope(user);
      if (scope && incident.employee?.role !== scope.supervisedRole) {
        throw new AppError(
          HttpStatus.FORBIDDEN,
          ErrorCodes.FORBIDDEN,
          'You are not authorized to view observation reports for this employee role.',
        );
      }
    }

    return incident;
  }

  async updateStatus(id: string, status: string) {
    const validStatuses = ['OPEN', 'REVIEWED', 'RESOLVED', 'CLOSED'];
    if (!validStatuses.includes(status.toUpperCase())) {
      throw new AppError(
        HttpStatus.BAD_REQUEST,
        ErrorCodes.VALIDATION_ERROR,
        `Invalid status '${status}'. Must be one of: ${validStatuses.join(', ')}`,
      );
    }

    const incident = await incidentRepository.findById(id);
    if (!incident) {
      throw new AppError(
        HttpStatus.NOT_FOUND,
        ErrorCodes.NOT_FOUND,
        'Observation report not found.',
      );
    }

    return incidentRepository.updateStatus(id, status.toUpperCase());
  }
}

export const incidentService = new IncidentService();
