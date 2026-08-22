import { prisma } from '../../database/prisma';

export class CounterRepository {
  async getNext(entity: string, clientId?: string) {
    const targetClientId = clientId || 'GLOBAL';

    return prisma.counter.upsert({
      where: {
        entity_clientId: {
          entity,
          clientId: targetClientId,
        },
      },
      update: {
        value: {
          increment: 1,
        },
      },
      create: {
        entity,
        clientId: targetClientId,
        value: 1,
      },
    });
  }
}

export const counterRepository = new CounterRepository();
