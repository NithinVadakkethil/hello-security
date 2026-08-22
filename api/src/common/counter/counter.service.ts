import { counterRepository } from './counter.repository';

export class CounterService {
  async next(entity: string, clientId?: string): Promise<number> {
    const counter = await counterRepository.getNext(entity, clientId);

    return counter.value;
  }
}

export const counterService = new CounterService();
