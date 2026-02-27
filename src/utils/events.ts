import { TypedEventBus as GenericEventBus } from '@timmeck/brain-core';

export type BrainEvents = {
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
};

export type BrainEventName = keyof BrainEvents;

export class TypedEventBus extends GenericEventBus<BrainEvents> {}

let busInstance: TypedEventBus | null = null;

export function getEventBus(): TypedEventBus {
  if (!busInstance) {
    busInstance = new TypedEventBus();
  }
  return busInstance;
}
