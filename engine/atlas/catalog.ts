import { LIVER_STRUCTURES } from '@/engine/atlas/liver'
import type { AnatomyNode } from '@/types/study'

const PRIORS: Record<string, readonly string[]> = {
  liver: LIVER_STRUCTURES,
  gallbladder: ['стенка', 'просвет', 'шейка'],
  'bile-ducts': ['просвет', 'стенка'],
  pancreas: ['контур', 'паренхима', 'проток'],
  spleen: ['контур', 'паренхима'],
  'right-kidney': ['контур', 'паренхима', 'синус'],
  'left-kidney': ['контур', 'паренхима', 'синус'],
  aorta: ['стенка', 'просвет'],
  ivc: ['стенка', 'просвет'],
  'free-fluid': ['карман жидкости'],
  lung: ['плевральная линия'],
  pleura: ['плевральная линия'],
  heart: ['перикард', 'левый желудочек', 'правый желудочек'],
  thyroid: ['доля', 'перешеек', 'контур'],
  bladder: ['стенка', 'просвет'],
  uterus: ['контур', 'полость'],
  ovaries: ['контур'],
  prostate: ['контур', 'зона'],
}

const TITLES: Record<string, string> = {
  liver: 'печень',
  gallbladder: 'желчный пузырь',
  'bile-ducts': 'желчные протоки',
  pancreas: 'поджелудочная железа',
  spleen: 'селезёнка',
  'right-kidney': 'правая почка',
  'left-kidney': 'левая почка',
  aorta: 'брюшная аорта',
  ivc: 'нижняя полая вена',
  'free-fluid': 'свободная жидкость',
  lung: 'лёгкие',
  pleura: 'плевра',
  heart: 'сердце',
  thyroid: 'щитовидная железа',
  bladder: 'мочевой пузырь',
  uterus: 'матка',
  ovaries: 'яичники',
  prostate: 'предстательная железа',
}

/** Список ожидаемых структур. Ни одна не считается увиденной. */
export function atlasPrior(organId: string): AnatomyNode[] {
  const names = PRIORS[organId] ?? ['область осмотра']
  return names.map((name) => ({ name, observed: false, source: 'ATLAS_INFERRED' }))
}

export function atlasTitle(organId: string): string {
  return TITLES[organId] ?? 'выбранная область'
}
