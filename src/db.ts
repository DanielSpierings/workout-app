import Dexie, { type Table } from 'dexie';
import type { Exercise, Settings, Template, Workout } from './types';
import { DEFAULT_SETTINGS } from './types';
import { SEED_EXERCISES } from './data/exercises';

class WorkoutDB extends Dexie {
  exercises!: Table<Exercise, string>;
  workouts!: Table<Workout, string>;
  templates!: Table<Template, string>;
  settings!: Table<Settings, string>;

  constructor() {
    super('workout-app');
    this.version(1).stores({
      exercises: 'id, name, muscle',
      workouts: 'id, startedAt, endedAt, templateId',
      templates: 'id, name, updatedAt',
      settings: 'id',
    });
    this.on('populate', (tx) => {
      tx.table('exercises').bulkAdd(SEED_EXERCISES);
      tx.table('settings').add(DEFAULT_SETTINGS);
    });
  }
}

export const db = new WorkoutDB();

export function uid(): string {
  return crypto.randomUUID();
}

export async function getSettings(): Promise<Settings> {
  return (await db.settings.get('settings')) ?? DEFAULT_SETTINGS;
}

/** Vraagt de browser om de opslag niet automatisch op te ruimen. */
export async function requestPersistentStorage(): Promise<boolean> {
  try {
    if (navigator.storage?.persisted && (await navigator.storage.persisted())) return true;
    return (await navigator.storage?.persist?.()) ?? false;
  } catch {
    return false;
  }
}
