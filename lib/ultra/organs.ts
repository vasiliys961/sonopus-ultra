import type { Locale } from '@/lib/i18n/locales'

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

const EXTRA_NAME: Record<string, Partial<Record<Locale, string>>> = {
  liver: { es: 'Hígado', fr: 'Foie', ar: 'الكبد', hi: 'यकृत', 'pt-BR': 'Fígado', id: 'Hati', ms: 'Hati', tr: 'Karaciğer', 'zh-CN': '肝脏' },
  gallbladder: { es: 'Vesícula biliar', fr: 'Vésicule biliaire', ar: 'المرارة', hi: 'पित्ताशय', 'pt-BR': 'Vesícula biliar', id: 'Kandung empedu', ms: 'Pundi hempedu', tr: 'Safra kesesi', 'zh-CN': '胆囊' },
  'bile-ducts': { es: 'Vías biliares', fr: 'Voies biliaires', ar: 'القنوات الصفراوية', hi: 'पित्त नलिकाएँ', 'pt-BR': 'Vias biliares', id: 'Saluran empedu', ms: 'Saluran hempedu', tr: 'Safra yolları', 'zh-CN': '胆管' },
  pancreas: { es: 'Páncreas', fr: 'Pancréas', ar: 'البنكرياس', hi: 'अग्न्याशय', 'pt-BR': 'Pâncreas', id: 'Pankreas', ms: 'Pankreas', tr: 'Pankreas', 'zh-CN': '胰腺' },
  spleen: { es: 'Bazo', fr: 'Rate', ar: 'الطحال', hi: 'प्लीहा', 'pt-BR': 'Baço', id: 'Limpa', ms: 'Limpa', tr: 'Dalak', 'zh-CN': '脾脏' },
  'right-kidney': { es: 'Riñón derecho', fr: 'Rein droit', ar: 'الكلية اليمنى', hi: 'दायाँ वृक्क', 'pt-BR': 'Rim direito', id: 'Ginjal kanan', ms: 'Ginjal kanan', tr: 'Sağ böbrek', 'zh-CN': '右肾' },
  'left-kidney': { es: 'Riñón izquierdo', fr: 'Rein gauche', ar: 'الكلية اليسرى', hi: 'बायाँ वृक्क', 'pt-BR': 'Rim esquerdo', id: 'Ginjal kiri', ms: 'Ginjal kiri', tr: 'Sol böbrek', 'zh-CN': '左肾' },
  aorta: { es: 'Aorta abdominal', fr: 'Aorte abdominale', ar: 'الأبهر البطني', hi: 'उदर महाधमनी', 'pt-BR': 'Aorta abdominal', id: 'Aorta abdomen', ms: 'Aorta abdomen', tr: 'Abdominal aorta', 'zh-CN': '腹主动脉' },
  ivc: { es: 'Vena cava inferior', fr: 'Veine cave inférieure', ar: 'الوريد الأجوف السفلي', hi: 'अधो महाशिरा', 'pt-BR': 'Veia cava inferior', id: 'Vena cava inferior', ms: 'Vena kava inferior', tr: 'İnferior vena kava', 'zh-CN': '下腔静脉' },
  'free-fluid': { es: 'Líquido libre', fr: 'Épanchement libre', ar: 'سائل حر', hi: 'मुक्त द्रव', 'pt-BR': 'Líquido livre', id: 'Cairan bebas', ms: 'Cecair bebas', tr: 'Serbest sıvı', 'zh-CN': '游离液体' },
  lung: { es: 'Pulmones', fr: 'Poumons', ar: 'الرئتان', hi: 'फेफड़े', 'pt-BR': 'Pulmões', id: 'Paru-paru', ms: 'Paru-paru', tr: 'Akciğerler', 'zh-CN': '肺' },
  pleura: { es: 'Pleura', fr: 'Plèvre', ar: 'الجنب', hi: 'फुस्फुस', 'pt-BR': 'Pleura', id: 'Pleura', ms: 'Pleura', tr: 'Plevra', 'zh-CN': '胸膜' },
  heart: { es: 'Corazón', fr: 'Cœur', ar: 'القلب', hi: 'हृदय', 'pt-BR': 'Coração', id: 'Jantung', ms: 'Jantung', tr: 'Kalp', 'zh-CN': '心脏' },
  thyroid: { es: 'Tiroides', fr: 'Thyroïde', ar: 'الغدة الدرقية', hi: 'थायरॉइड', 'pt-BR': 'Tireoide', id: 'Tiroid', ms: 'Tiroid', tr: 'Tiroid', 'zh-CN': '甲状腺' },
  bladder: { es: 'Vejiga urinaria', fr: 'Vessie', ar: 'المثانة', hi: 'मूत्राशय', 'pt-BR': 'Bexiga urinária', id: 'Kandung kemih', ms: 'Pundi kencing', tr: 'Mesane', 'zh-CN': '膀胱' },
  uterus: { es: 'Útero', fr: 'Utérus', ar: 'الرحم', hi: 'गर्भाशय', 'pt-BR': 'Útero', id: 'Uterus', ms: 'Uterus', tr: 'Uterus', 'zh-CN': '子宫' },
  ovaries: { es: 'Ovarios', fr: 'Ovaires', ar: 'المبيضان', hi: 'अंडाशय', 'pt-BR': 'Ovários', id: 'Ovarium', ms: 'Ovari', tr: 'Yumurtalıklar', 'zh-CN': '卵巢' },
  prostate: { es: 'Próstata', fr: 'Prostate', ar: 'البروستاتا', hi: 'प्रोस्टेट', 'pt-BR': 'Próstata', id: 'Prostat', ms: 'Prostat', tr: 'Prostat', 'zh-CN': '前列腺' },
}

const GROUP_EXTRA: Record<Exclude<Locale, 'ru' | 'en'>, Record<OrganGroup, string>> = {
  es: { abdomen: 'Abdomen', chest: 'Tórax', neck: 'Cuello', pelvis: 'Pelvis' },
  fr: { abdomen: 'Abdomen', chest: 'Thorax', neck: 'Cou', pelvis: 'Petit bassin' },
  ar: { abdomen: 'البطن', chest: 'الصدر', neck: 'العنق', pelvis: 'الحوض' },
  hi: { abdomen: 'उदर', chest: 'वक्ष', neck: 'गर्दन', pelvis: 'श्रोणि' },
  'pt-BR': { abdomen: 'Abdome', chest: 'Tórax', neck: 'Pescoço', pelvis: 'Pelve' },
  id: { abdomen: 'Abdomen', chest: 'Dada', neck: 'Leher', pelvis: 'Panggul' },
  ms: { abdomen: 'Abdomen', chest: 'Dada', neck: 'Leher', pelvis: 'Pelvis' },
  tr: { abdomen: 'Karın', chest: 'Göğüs', neck: 'Boyun', pelvis: 'Pelvis' },
  'zh-CN': { abdomen: '腹部', chest: '胸部', neck: '颈部', pelvis: '盆腔' },
}

const SEEN: Record<Locale, string> = {
  ru: 'Что видно',
  en: 'What is seen',
  es: 'Qué se ve',
  fr: 'Ce qui est vu',
  ar: 'ما يُرى',
  hi: 'क्या दिखता है',
  'pt-BR': 'O que se vê',
  id: 'Yang terlihat',
  ms: 'Apa yang kelihatan',
  tr: 'Ne görülüyor',
  'zh-CN': '所见',
}

export function organLabel(item: UltrasoundLocalization, locale: Locale): string {
  if (locale === 'ru') return item.ru
  if (locale === 'en') return item.en
  return EXTRA_NAME[item.id]?.[locale] ?? item.en
}

export function groupLabel(group: OrganGroup, locale: Locale): string {
  if (locale === 'ru' || locale === 'en') return GROUP_LABEL[locale][group]
  return GROUP_EXTRA[locale][group]
}

export function organQuestion(item: UltrasoundLocalization, locale: Locale): string {
  if (locale === 'ru' || locale === 'en') return item.question[locale]
  return `${SEEN[locale]}: ${organLabel(item, locale)}?`
}

export function customQuestion(name: string, locale: Locale): string {
  if (locale === 'ru') return `Что видно: ${name}?`
  if (locale === 'en') return `What is seen: ${name}?`
  return `${SEEN[locale]}: ${name}?`
}

export function organNames(item: UltrasoundLocalization): string[] {
  const extra = Object.values(EXTRA_NAME[item.id] ?? {}).filter((name): name is string => Boolean(name))
  return [item.ru, item.en, ...extra]
}

export function localizationsByGroup(): Array<{ group: OrganGroup; items: UltrasoundLocalization[] }> {
  return GROUP_ORDER.map((group) => ({
    group,
    items: LOCALIZATIONS.filter((item) => item.group === group),
  }))
}
