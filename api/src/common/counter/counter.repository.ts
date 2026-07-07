import { prisma } from '../../database/prisma';

export class CounterRepository {
  async getNext(entity: string) {
    return prisma.counter.upsert({
      where: {
        entity,
      },
      update: {
        value: {
          increment: 1,
        },
      },
      create: {
        entity,
        value: 1,
      },
    });
  }
}

export const counterRepository = new CounterRepository();
