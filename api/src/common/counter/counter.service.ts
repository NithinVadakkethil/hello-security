import { counterRepository } from './counter.repository';

export class CounterService {
  async next(entity: string, clientId?: string): Promise<number> {
    const counter = await counterRepository.getNext(entity, clientId);

    return counter.value;
  }

  async reserveRange(entity: string, count: number, clientId?: string, tx?: any): Promise<number> {
    return counterRepository.reserveRange(entity, count, clientId, tx);
  }
}

export const counterService = new CounterService();
