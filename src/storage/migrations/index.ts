import { MIGRATION_001 } from './001_initial';
import { MIGRATION_002 } from './002_missions_generated_for';

export interface Migration {
  version: number;
  sql: string;
}

export const MIGRATIONS: ReadonlyArray<Migration> = [
  { version: 1, sql: MIGRATION_001 },
  { version: 2, sql: MIGRATION_002 },
];
