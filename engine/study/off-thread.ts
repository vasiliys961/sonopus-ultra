import { buildStudy, type StudyBuild } from '@/engine/study/build-study'
import type { CineFrame } from '@/lib/intelligence/sample-cine'

/** Сборка в воркере. Если поток не открылся, та же функция считается на странице. */
export function buildStudyOffThread(frames: readonly CineFrame[], organId: string): Promise<StudyBuild> {
  if (typeof Worker === 'undefined') return buildStudy(frames, 'pass', organId)
  return new Promise((resolve, reject) => {
    let worker: Worker
    try {
      worker = new Worker(new URL('./study.worker.ts', import.meta.url))
    } catch (error) {
      void buildStudy(frames, 'pass', organId).then(resolve, reject)
      return
    }
    const finish = (run: () => void) => {
      worker.terminate()
      run()
    }
    worker.onmessage = (event: MessageEvent<StudyBuild | { error: string }>) => {
      const payload = event.data
      if (payload && typeof payload === 'object' && 'error' in payload) {
        finish(() => reject(new Error(payload.error)))
        return
      }
      finish(() => resolve(payload))
    }
    worker.onerror = () => {
      finish(() => {
        void buildStudy(frames, 'pass', organId).then(resolve, reject)
      })
    }
    worker.postMessage({ frames, organId })
  })
}
