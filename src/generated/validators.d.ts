import type { ErrorObject } from 'ajv';
interface StandaloneValidator {
  (data: unknown): boolean;
  errors?: ErrorObject[] | null;
}
export const validateScoreSchema: StandaloneValidator;
export const validateManifestSchema: StandaloneValidator;
