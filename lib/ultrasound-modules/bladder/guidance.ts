import type { GuidanceStep } from '@/lib/domain/types'

export const bladderGuidance: readonly GuidanceStep[] = [
  {
    view: 'transverse',
    title: 'Поперечная плоскость',
    text: 'Найдите мочевой пузырь над лобковым симфизом. Удерживайте поперечную плоскость и зафиксируйте ширину, когда кадр стабилен.',
  },
  {
    view: 'longitudinal',
    title: 'Продольная плоскость',
    text: 'Поверните датчик на 90°. В продольной плоскости зафиксируйте длину и высоту.',
  },
]
