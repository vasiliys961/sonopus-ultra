export type OrganGroup = 'abdomen' | 'chest' | 'neck' | 'pelvis'

export interface UltrasoundLocalization {
  id: string
  group: OrganGroup
  moduleId: string
  ru: string
  en: string
  question: { ru: string; en: string }
}

export const GROUP_LABEL: Record<'ru' | 'en', Record<OrganGroup, string>> = {
  ru: { abdomen: 'Живот', chest: 'Грудь', neck: 'Шея', pelvis: 'Малый таз' },
  en: { abdomen: 'Abdomen', chest: 'Chest', neck: 'Neck', pelvis: 'Pelvis' },
}

const GROUP_ORDER: OrganGroup[] = ['abdomen', 'chest', 'neck', 'pelvis']

function ask(ru: string, en: string): { ru: string; en: string } {
  return { ru: `Что видно: ${ru}?`, en: `What is seen: ${en}?` }
}

export const LOCALIZATIONS: UltrasoundLocalization[] = [
  { id: 'liver', group: 'abdomen', moduleId: 'organ-sweep', ru: 'Печень', en: 'Liver', question: ask('печень', 'liver') },
  { id: 'gallbladder', group: 'abdomen', moduleId: 'organ-sweep', ru: 'Желчный пузырь', en: 'Gallbladder', question: ask('желчный пузырь', 'gallbladder') },
  { id: 'bile-ducts', group: 'abdomen', moduleId: 'organ-sweep', ru: 'Желчные протоки', en: 'Bile ducts', question: ask('желчные протоки', 'bile ducts') },
  { id: 'pancreas', group: 'abdomen', moduleId: 'organ-sweep', ru: 'Поджелудочная железа', en: 'Pancreas', question: ask('поджелудочная железа', 'pancreas') },
  { id: 'spleen', group: 'abdomen', moduleId: 'organ-sweep', ru: 'Селезёнка', en: 'Spleen', question: ask('селезёнка', 'spleen') },
  { id: 'right-kidney', group: 'abdomen', moduleId: 'organ-sweep', ru: 'Правая почка', en: 'Right kidney', question: ask('правая почка', 'right kidney') },
  { id: 'left-kidney', group: 'abdomen', moduleId: 'organ-sweep', ru: 'Левая почка', en: 'Left kidney', question: ask('левая почка', 'left kidney') },
  { id: 'aorta', group: 'abdomen', moduleId: 'organ-sweep', ru: 'Брюшная аорта', en: 'Abdominal aorta', question: ask('брюшная аорта', 'abdominal aorta') },
  { id: 'ivc', group: 'abdomen', moduleId: 'ivc', ru: 'Нижняя полая вена', en: 'Inferior vena cava', question: ask('нижняя полая вена', 'inferior vena cava') },
  { id: 'free-fluid', group: 'abdomen', moduleId: 'efast', ru: 'Свободная жидкость', en: 'Free fluid', question: ask('свободная жидкость в животе', 'free fluid in the abdomen') },
  { id: 'lung', group: 'chest', moduleId: 'lung', ru: 'Лёгкие', en: 'Lungs', question: ask('лёгкие', 'lungs') },
  { id: 'pleura', group: 'chest', moduleId: 'organ-sweep', ru: 'Плевра', en: 'Pleura', question: ask('плевра', 'pleura') },
  { id: 'heart', group: 'chest', moduleId: 'cardiac-ef', ru: 'Сердце', en: 'Heart', question: ask('сердце', 'heart') },
  { id: 'thyroid', group: 'neck', moduleId: 'thyroid', ru: 'Щитовидная железа', en: 'Thyroid', question: ask('щитовидная железа', 'thyroid') },
  { id: 'bladder', group: 'pelvis', moduleId: 'bladder', ru: 'Мочевой пузырь', en: 'Urinary bladder', question: ask('мочевой пузырь', 'urinary bladder') },
  { id: 'uterus', group: 'pelvis', moduleId: 'organ-sweep', ru: 'Матка', en: 'Uterus', question: ask('матка', 'uterus') },
  { id: 'ovaries', group: 'pelvis', moduleId: 'organ-sweep', ru: 'Яичники', en: 'Ovaries', question: ask('яичники', 'ovaries') },
  { id: 'prostate', group: 'pelvis', moduleId: 'organ-sweep', ru: 'Предстательная железа', en: 'Prostate', question: ask('предстательная железа', 'prostate') },
]

export function localizationsByGroup(): Array<{ group: OrganGroup; items: UltrasoundLocalization[] }> {
  return GROUP_ORDER.map((group) => ({
    group,
    items: LOCALIZATIONS.filter((item) => item.group === group),
  }))
}
