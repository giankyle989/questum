export const MIGRATION_002 = `
ALTER TABLE missions ADD COLUMN generated_for TEXT NOT NULL DEFAULT '';
CREATE INDEX idx_missions_generated_for ON missions(type, generated_for, completed_at);
`;
