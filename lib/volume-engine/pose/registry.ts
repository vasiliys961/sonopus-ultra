export interface PoseModelDescriptor {
  id: string
  provider: string
  version: string
  domain: string
  inputWidth: number | null
  inputHeight: number | null
  outputType: '6dof'
  units: {
    translation: 'mm'
    rotation: 'rad'
  } | null
  checkpoint?: string
  license?: string
}

/** Размеры входа и лицензия не заполнены: checkpoint не проверен и в репозиторий не вложен. */
export const POSE_MODELS: readonly PoseModelDescriptor[] = [
  {
    id: 'tus-rec-2024',
    provider: 'tus-rec',
    version: '2024',
    domain: 'forearm',
    inputWidth: null,
    inputHeight: null,
    outputType: '6dof',
    units: null,
  },
  {
    id: 'tus-rec-2025',
    provider: 'tus-rec',
    version: '2025',
    domain: 'forearm',
    inputWidth: null,
    inputHeight: null,
    outputType: '6dof',
    units: null,
  },
  {
    id: 'custom-sonopus-pose-v1',
    provider: 'sonopus',
    version: '1',
    domain: 'unspecified',
    inputWidth: null,
    inputHeight: null,
    outputType: '6dof',
    units: null,
  },
]

export function poseModelById(id: string): PoseModelDescriptor | null {
  return POSE_MODELS.find((model) => model.id === id) ?? null
}
