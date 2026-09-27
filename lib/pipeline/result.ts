import { DIAGNOSTIC_SCHEMA_VERSION, type DiagnosticOutcome, type DiagnosticResult } from '@/lib/domain/types'

export function shellResult(
  studyId: string,
  question: string,
  outcome: DiagnosticOutcome,
  reasons: string[],
  acquisitionRequests: string[] = [],
): DiagnosticResult {
  return {
    schemaVersion: DIAGNOSTIC_SCHEMA_VERSION,
    studyId,
    question,
    views: [],
    observations: [],
    differential: [],
    outcome,
    whyCannotAssess: reasons,
    acquisitionRequests,
    formulaSource: 'published-literature',
    clinicallyValidated: false,
  }
}
