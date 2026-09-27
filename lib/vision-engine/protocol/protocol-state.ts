import type { OrganModule } from '@/lib/domain/types'

export interface ProtocolState {
  protocolId: string
  completed: string[]
  missing: string[]
  completeness: number
}

export function protocolState(module: Pick<OrganModule, 'id' | 'requiredViews'>, confirmedViews: readonly string[]): ProtocolState {
  const required = [...module.requiredViews]
  const completed = required.filter((view) => confirmedViews.includes(view))
  const missing = required.filter((view) => !completed.includes(view))
  return {
    protocolId: module.id,
    completed,
    missing,
    completeness: required.length === 0 ? 0 : completed.length / required.length,
  }
}
