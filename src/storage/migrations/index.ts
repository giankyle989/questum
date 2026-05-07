import { MIGRATION_001 } from './001_initial';

export interface Migration {
  version: number;
  sql: string;
}

export const MIGRATIONS: ReadonlyArray<Migration> = [{ version: 1, sql: MIGRATION_001 }];
