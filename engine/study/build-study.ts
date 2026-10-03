import type { SpatialPreview } from '@/lib/intelligence/build-preview'
import { reconstructUltrasound } from '@/engine/spatial/us-volume-reconstructor'
import type { CineFrame } from '@/lib/intelligence/sample-cine'
import { aiFrameBudget } from '@/engine/ai/frame-budget'
import { selectKeyFrames } from '@/engine/cine/cine-keyframes'
import { motionFromSimilarities } from '@/engine/cine/cine-motion'
import { qualityFromGray } from '@/engine/cine/cine-quality'
import { windowsAround } from '@/engine/cine/resample'
import { temporalSequences } from '@/engine/cine/cine-sequence'
import { atlasPrior, atlasTitle } from '@/engine/atlas/catalog'
import { admitPathology } from '@/engine/pathology/gate'
import { scanFrameArtifacts } from '@/engine/pathology/frame-artifacts'
import { scanCandidates } from '@/engine/pathology/candidates'
import { probeTravel } from '@/lib/intelligence/parallel-stack'
import { inPlaneShift } from '@/engine/temporal/shift'
import { structuredReport } from '@/engine/report/structured-report'
import { tissueFromCandidates } from '@/engine/tissue/echo'
import { sampleCine } from '@/lib/intelligence/sample-cine'
import type { USFrame } from '@/types/spatial-ultrasound'
import type { UltrasoundStudy } from '@/types/study'

export interface StudyBuild {
  preview: SpatialPreview
  study: UltrasoundStudy
  budget: { minimum: number; maximum: number; priority: string[] }
}

export async function buildStudy(frames: readonly CineFrame[], studyId = 'pass', organId = 'liver'): Promise<StudyBuild> {
  let preview = await reconstructUltrasound(frames)
  let studyFrames: USFrame[] = framesOf(preview)
  let scan = readScan(preview, studyFrames)
  let resampled = false
  if (scan.candidates.length > 0) {
    const windows = windowsAround(scan.candidates.map((item) => item.provenance.timestamp))
    if (windows.length > 0 && sampleCine(frames, { windows }).length > sampleCine(frames).length) {
      preview = await reconstructUltrasound(frames, { windows })
      studyFrames = framesOf(preview)
      scan = readScan(preview, studyFrames)
      resampled = true
    }
  }
  const suspect = scan.candidates.flatMap((item) => item.provenance.frames)
  const keyFrames = selectKeyFrames(studyFrames, suspect)
  const sequences = temporalSequences(studyFrames)
  const temporal = motionFromSimilarities(preview.slices.map((slice) => slice.similarity))
  const frameNotes = scanFrameArtifacts(preview.slices)
  const artifacts = [...scan.artifacts, ...frameNotes]
  const anatomy = atlasPrior(organId)
  const shift = inPlaneShift(preview.slices.map((slice) => ({ gray: slice.gray, width: slice.width, height: slice.height })))
  const report = structuredReport({
    accepted: preview.accepted,
    coverage: preview.coverage,
    note: preview.note,
    temporal,
    anatomy,
    candidates: scan.candidates,
    artifacts,
    dataStatus: scan.status,
    resampled,
    organTitle: atlasTitle(organId),
    probe: probeTravel(preview.slices),
  })
  const study: UltrasoundStudy = {
    id: studyId,
    organ: organId,
    shift,
    frames: studyFrames,
    keyFrames,
    sequences,
    temporal,
    acceptedFrames: preview.accepted,
    coverage: preview.coverage,
    pose: 'VIDEO_ESTIMATION',
    measuresAllowed: false,
    anatomy,
    candidates: scan.candidates,
    tissue: tissueFromCandidates(scan.candidates),
    resampled,
    artifacts,
    dataStatus: scan.status,
    report,
  }
  const budget = aiFrameBudget(studyFrames.map((frame) => frame.id), suspect)
  return { preview, study, budget }
}

function framesOf(preview: SpatialPreview): USFrame[] {
  return preview.slices.map((slice) => ({
    id: slice.id,
    timestamp: slice.timestamp,
    width: slice.width,
    height: slice.height,
    source: 'LIVE_CAPTURE',
    quality: qualityFromGray(slice.gray, slice.quality),
    pose: {
      position: [slice.probeX, slice.probeY, slice.depth],
      rotation: { x: 0, y: 0, z: 0 },
      confidence: slice.confidence,
      source: 'VIDEO_ESTIMATION',
    },
  }))
}

function readScan(preview: SpatialPreview, frames: readonly USFrame[]) {
  if (!admitPathology(frames, preview.accepted)) {
    return { status: 'INSUFFICIENT DATA' as const, candidates: [], artifacts: [] }
  }
  return scanCandidates(preview.volume, preview.slices, preview.slices[0]?.timestamp ?? 0)
}
