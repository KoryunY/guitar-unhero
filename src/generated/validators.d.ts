import type { ErrorObject } from 'ajv';
interface StandaloneValidator {
  (data: unknown): boolean;
  errors?: ErrorObject[] | null;
}
export const validateScoreSchema: StandaloneValidator;
export const validateScoreV2Schema: StandaloneValidator;
export const validateManifestSchema: StandaloneValidator;
