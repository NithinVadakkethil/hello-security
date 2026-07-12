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

  async list(clientId: string) {
    return incidentRepository.list(clientId);
  }

  async findById(id: string) {
    return incidentRepository.findById(id);
  }
}

export const incidentService = new IncidentService();
