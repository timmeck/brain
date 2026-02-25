import { EventEmitter } from 'node:events';

export interface BrainEvents {
  'error:reported': { errorId: number; projectId: number; fingerprint: string };
  'error:resolved': { errorId: number; solutionId: number };
  'solution:applied': { errorId: number; solutionId: number; success: boolean };
  'solution:created': { solutionId: number };
  'module:registered': { moduleId: number; projectId: number };
  'module:updated': { moduleId: number };
  'synapse:created': { synapseId: number; sourceType: string; targetType: string };
  'synapse:strengthened': { synapseId: number; newWeight: number };
  'insight:created': { insightId: number; type: string };
  'rule:learned': { ruleId: number; pattern: string };
  'terminal:connected': { terminalId: number; uuid: string };
  'terminal:disconnected': { terminalId: number };
}

export type BrainEventName = keyof BrainEvents;

export class TypedEventBus extends EventEmitter {
  emit<K extends BrainEventName>(event: K, data: BrainEvents[K]): boolean {
    return super.emit(event, data);
  }

  on<K extends BrainEventName>(event: K, listener: (data: BrainEvents[K]) => void): this {
    return super.on(event, listener);
  }

  once<K extends BrainEventName>(event: K, listener: (data: BrainEvents[K]) => void): this {
    return super.once(event, listener);
  }

  off<K extends BrainEventName>(event: K, listener: (data: BrainEvents[K]) => void): this {
    return super.off(event, listener);
  }
}

let busInstance: TypedEventBus | null = null;

export function getEventBus(): TypedEventBus {
  if (!busInstance) {
    busInstance = new TypedEventBus();
  }
  return busInstance;
}
