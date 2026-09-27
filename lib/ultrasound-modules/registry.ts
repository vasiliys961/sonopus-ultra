import { cardiacEfModule } from '@/lib/ultrasound-modules/cardiac-ef/cardiac-module'
import { bladderModule } from '@/lib/ultrasound-modules/bladder/bladder-module'
import { efastModule } from '@/lib/ultrasound-modules/efast/efast-module'
import { ivcModule } from '@/lib/ultrasound-modules/ivc/ivc-module'
import { lungModule } from '@/lib/ultrasound-modules/lung/lung-module'
import { multiAngleModule } from '@/lib/ultrasound-modules/multi-angle/multi-angle-module'
import { organSweepModule } from '@/lib/ultrasound-modules/organ-sweep/organ-sweep-module'
import { thyroidModule } from '@/lib/ultrasound-modules/thyroid/thyroid-module'
import type { OrganModule } from '@/lib/domain/types'

export const organModuleRegistry: Record<string, OrganModule> = {
  bladder: bladderModule,
  ivc: ivcModule,
  efast: efastModule,
  lung: lungModule,
  thyroid: thyroidModule,
  'cardiac-ef': cardiacEfModule,
  'multi-angle': multiAngleModule,
  'organ-sweep': organSweepModule,
}

export function getOrganModule(id: string): OrganModule | undefined {
  return organModuleRegistry[id]
}

export function listOrganModules(): OrganModule[] {
  return Object.values(organModuleRegistry)
}
