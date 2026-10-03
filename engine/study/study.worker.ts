import { buildStudy } from '@/engine/study/build-study'
import type { CineFrame } from '@/lib/intelligence/sample-cine'

interface StudyWorkerScope {
  onmessage: ((event: MessageEvent<{ frames: CineFrame[]; organId: string }>) => void) | null
  postMessage: (message: unknown) => void
}

const scope = self as unknown as StudyWorkerScope

scope.onmessage = (event) => {
  void buildStudy(event.data.frames, 'pass', event.data.organId)
    .then((built) => scope.postMessage(built))
    .catch((error: unknown) => {
      scope.postMessage({ error: error instanceof Error ? error.message : 'сборка не вышла' })
    })
}
