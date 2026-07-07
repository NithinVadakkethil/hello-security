import { counterRepository } from './counter.repository';

export class CounterService {
  async next(entity: string): Promise<number> {
    const counter = await counterRepository.getNext(entity);

    return counter.value;
  }
}

export const counterService = new CounterService();
