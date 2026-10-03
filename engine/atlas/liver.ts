import type { AnatomyNode } from '@/types/study'

export const LIVER_STRUCTURES = [
  'контур печени',
  'паренхима',
  'воротная вена',
  'печёночные вены',
  'нижняя полая вена',
  'желчный пузырь',
  'диафрагма',
] as const

/** Анатомический prior. Ни одна структура не отмечается как увиденная. */
export function liverPrior(): AnatomyNode[] {
  return LIVER_STRUCTURES.map((name) => ({ name, observed: false, source: 'ATLAS_INFERRED' }))
}
