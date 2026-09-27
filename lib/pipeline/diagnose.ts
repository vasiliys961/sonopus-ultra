import { anonymizeRaster } from '@/lib/anonymization/anonymize-frame'
import { arbitrate } from '@/lib/diagnostic-arbiter/arbiter'
import { lockOperatorDecisions } from '@/lib/diagnostic-arbiter/review'
import type {
  CalibrationState,
  DiagnosticResult,
  ManualMeasurement,
  Raster,
  SourceType,
  StudyView,
} from '@/lib/domain/types'
import { encodePng } from '@/lib/image/png-encode'
import { bytesToBase64 } from '@/lib/image/base64'
import type { LlmClient } from '@/lib/llm-pipeline/llm-client'
import { runBrain1 } from '@/lib/llm-pipeline/sono-brain1'
import { runBrain2 } from '@/lib/llm-pipeline/sono-brain2'
import { BRAIN1_PROMPT_VERSION } from '@/lib/prompts/ultrasound-entity-extraction'
import { BRAIN2_PROMPT_VERSION } from '@/lib/prompts/sonographer-differential'
import { getOrganModule } from '@/lib/ultrasound-modules/registry'
import { shellResult } from '@/lib/pipeline/result'
import { protocolOutline, protocolReference } from '@/lib/ultra/protocol-samples'

export interface DiagnoseFrame {
  evidenceId: string
  timestamp: number
  sequenceNumber: number
  raster: Raster
  qualityScore: number
}

export interface DiagnoseCommand {
  studyId: string
  moduleId: string
  question: string
  bodyRegion?: { name: string; confirmedByOperator: boolean }
  views: Array<StudyView & { qualityScore: number }>
  calibration: CalibrationState
  manual?: ManualMeasurement
  frames: DiagnoseFrame[]
  diameterSeriesPx?: number[]
  sourceType: SourceType
  operatorNote?: string
  reportLanguage?: 'en' | 'ru' | 'es' | 'fr' | 'ar' | 'hi' | 'pt-BR' | 'id' | 'ms' | 'tr' | 'zh-CN'
  previousResult?: DiagnosticResult | null
}

export interface DiagnoseDependencies {
  brain1: LlmClient
  brain2: LlmClient
  brain1Model: string
  brain2Model: string
  now?: () => string
}

export function prepareFramesForModel(frames: DiagnoseFrame[]): DiagnoseFrame[] {
  return frames.map((frame) => ({ ...frame, raster: anonymizeRaster(frame.raster) }))
}

export async function runDiagnosticPipeline(
  command: DiagnoseCommand,
  deps: DiagnoseDependencies,
): Promise<DiagnosticResult> {
  const module = getOrganModule(command.moduleId)
  if (!module) {
    return shellResult(command.studyId, command.question, 'unsupported_mode', [
      `Модуль «${command.moduleId}» не поддерживается.`,
    ])
  }

  const requests = module.requiredViews.map((view) => `Нужна подтверждённая проекция: ${view}`)
  const acceptable = command.frames.filter((frame) => frame.qualityScore >= module.qualityThreshold)
  if (acceptable.length === 0) {
    return shellResult(
      command.studyId,
      command.question,
      'insufficient_evidence',
      ['Кадр ниже порога качества. В модель он не отправляется.'],
      requests,
    )
  }
  const knownIds = new Set(acceptable.map((frame) => frame.evidenceId))
  const qualityNotes = command.frames
    .filter((frame) => frame.qualityScore < module.qualityThreshold)
    .map((frame) => `Кадр ${frame.evidenceId} ниже порога качества и в модель не отправляется.`)
  if (!command.bodyRegion?.confirmedByOperator || !command.bodyRegion.name.trim()) {
    return shellResult(command.studyId, command.question, 'insufficient_evidence', [
      'Область исследования не подтверждена врачом.',
    ])
  }

  const measurement = module.computeMeasurement({
    frames: acceptable.map((frame) => ({
      imageData: frame.raster,
      timestamp: frame.timestamp,
      sequenceNumber: frame.sequenceNumber,
    })),
    calibration: command.calibration,
    manual: command.manual,
    viewQuality: Object.fromEntries(command.views.map((view) => [view.name, view.qualityScore])),
    diameterSeriesPx: command.diameterSeriesPx,
  })

  const anonymized = prepareFramesForModel(acceptable)
  const images = anonymized.map((frame) => ({
    mimeType: 'image/png' as const,
    base64: bytesToBase64(encodePng(frame.raster)),
  }))
  const findings = module.toFindingsPayload(measurement)

  let observations
  try {
    observations = await runBrain1(deps.brain1, {
      model: deps.brain1Model,
      question: command.question,
      moduleTitle: module.title,
      measurement: findings,
      evidenceIds: [...knownIds],
      images,
      operatorNote: command.operatorNote,
    })
  } catch (error) {
    return shellResult(command.studyId, command.question, 'error', [
      error instanceof Error ? error.message : 'сбой извлечения наблюдений',
    ])
  }

  if (observations.length === 0) {
    return shellResult(command.studyId, command.question, 'insufficient_evidence', [
      'Наблюдения без привязки к кадру отброшены. Дифференциал не строился.',
    ])
  }

  let draft
  try {
    draft = await runBrain2(deps.brain2, {
      model: deps.brain2Model,
      question: command.question,
      bodyRegion: command.bodyRegion,
      views: command.views.map((view) => ({
        name: view.name,
        evidenceIds: view.evidenceIds,
        operatorConfirmed: view.operatorConfirmed,
      })),
      observations,
      measurement: findings,
      operatorNote: command.operatorNote,
      reportLanguage: command.reportLanguage ?? 'ru',
      protocolOutline: protocolOutline(command.bodyRegion?.name, command.reportLanguage === 'ru' ? 'ru' : 'en'),
      protocolReference: protocolReference(command.bodyRegion?.name, command.reportLanguage === 'ru' ? 'ru' : 'en'),
      images,
    })
  } catch (error) {
    const failed = shellResult(command.studyId, command.question, 'error', [
      error instanceof Error ? error.message : 'сбой дифференциала',
    ])
    return { ...failed, observations }
  }

  const limitations = command.sourceType === 'synthetic' ? ['Источник — синтетический демонстрационный кадр.'] : []
  const result = arbitrate({
    studyId: command.studyId,
    question: command.question,
    bodyRegion: command.bodyRegion,
    views: command.views,
    requiredViews: module.requiredViews,
    observations,
    proposals: draft.proposals,
    knownEvidenceIds: knownIds,
    modelProvenance: {
      provider: deps.brain2.providerId,
      model: `${deps.brain1Model} + ${deps.brain2Model}`,
      promptVersion: `${BRAIN1_PROMPT_VERSION}+${BRAIN2_PROMPT_VERSION}`,
      createdAt: deps.now ? deps.now() : new Date().toISOString(),
    },
    studyLimitations: limitations,
    qualityNotes,
  })
  const withReport = draft.report ? { ...result, sonographerReport: draft.report } : result
  return lockOperatorDecisions(command.previousResult ?? null, withReport)
}
