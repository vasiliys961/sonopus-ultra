import { LOCALIZATIONS, organNames } from '@/lib/ultra/organs'

export type ReportLanguage = 'ru' | 'en'

const GENERIC: Record<ReportLanguage, string> = {
  ru: ['Область', 'Что видно на кадрах', 'Размер, только если он уже назван', 'Заключение'].join('\n'),
  en: ['Region', 'What is seen on the frames', 'Size only if it was already stated', 'Conclusion'].join('\n'),
}

const SAMPLES: Record<string, Record<ReportLanguage, string>> = {
  liver: {
    ru: ['Печень', 'Контуры', 'Эхогенность и эхоструктура', 'Сосудистый рисунок и внутрипеченочные протоки', 'Очаг, если виден', 'Заключение'].join('\n'),
    en: ['Liver', 'Margins', 'Echogenicity and echotexture', 'Vascular pattern and intrahepatic ducts', 'Focal lesion, if seen', 'Conclusion'].join('\n'),
  },
  gallbladder: {
    ru: ['Желчный пузырь', 'Форма и контуры', 'Стенка', 'Содержимое и конкремент, если виден', 'Заключение'].join('\n'),
    en: ['Gallbladder', 'Shape and margins', 'Wall', 'Contents and calculus, if seen', 'Conclusion'].join('\n'),
  },
  'bile-ducts': {
    ru: ['Желчные протоки', 'Внутрипеченочные протоки', 'Общий желчный проток', 'Просвет, если виден', 'Заключение'].join('\n'),
    en: ['Bile ducts', 'Intrahepatic ducts', 'Common bile duct', 'Lumen, if seen', 'Conclusion'].join('\n'),
  },
  pancreas: {
    ru: ['Поджелудочная железа', 'Головка, тело и хвост, если видны', 'Контуры', 'Эхогенность и эхоструктура', 'Вирсунгов проток, если виден', 'Заключение'].join('\n'),
    en: ['Pancreas', 'Head, body and tail, if seen', 'Margins', 'Echogenicity and echotexture', 'Pancreatic duct, if seen', 'Conclusion'].join('\n'),
  },
  spleen: {
    ru: ['Селезёнка', 'Контуры', 'Эхоструктура', 'Очаг, если виден', 'Заключение'].join('\n'),
    en: ['Spleen', 'Margins', 'Echotexture', 'Focal lesion, if seen', 'Conclusion'].join('\n'),
  },
  'right-kidney': {
    ru: ['Правая почка', 'Контуры и паренхима', 'Синус и чашечно-лоханочная система', 'Конкремент или очаг, если виден', 'Заключение'].join('\n'),
    en: ['Right kidney', 'Margins and parenchyma', 'Sinus and collecting system', 'Calculus or focal lesion, if seen', 'Conclusion'].join('\n'),
  },
  'left-kidney': {
    ru: ['Левая почка', 'Контуры и паренхима', 'Синус и чашечно-лоханочная система', 'Конкремент или очаг, если виден', 'Заключение'].join('\n'),
    en: ['Left kidney', 'Margins and parenchyma', 'Sinus and collecting system', 'Calculus or focal lesion, if seen', 'Conclusion'].join('\n'),
  },
  aorta: {
    ru: ['Брюшная аорта', 'Ход и стенка', 'Просвет', 'Диаметр, только если он уже назван', 'Заключение'].join('\n'),
    en: ['Abdominal aorta', 'Course and wall', 'Lumen', 'Diameter only if it was already stated', 'Conclusion'].join('\n'),
  },
  ivc: {
    ru: ['Нижняя полая вена', 'Просвет', 'Изменение на вдохе, если видно', 'Диаметр, только если он уже назван', 'Заключение'].join('\n'),
    en: ['Inferior vena cava', 'Lumen', 'Respiratory change, if seen', 'Diameter only if it was already stated', 'Conclusion'].join('\n'),
  },
  'free-fluid': {
    ru: ['Свободная жидкость', 'Правое подреберье', 'Левое подреберье', 'Таз', 'У сердца, если это окно есть', 'Заключение'].join('\n'),
    en: ['Free fluid', 'Right upper quadrant', 'Left upper quadrant', 'Pelvis', 'By the heart, if that window is present', 'Conclusion'].join('\n'),
  },
  lung: {
    ru: ['Лёгкие', 'Плевральная линия и скольжение', 'Вертикальные яркие линии, если видны', 'Жидкость у плевры, если видна', 'Заключение'].join('\n'),
    en: ['Lungs', 'Pleural line and sliding', 'Vertical bright lines, if seen', 'Pleural fluid, if seen', 'Conclusion'].join('\n'),
  },
  pleura: {
    ru: ['Плевра', 'Линия плевры', 'Жидкость или воздух, если видны', 'Заключение'].join('\n'),
    en: ['Pleura', 'Pleural line', 'Fluid or air, if seen', 'Conclusion'].join('\n'),
  },
  heart: {
    ru: ['Сердце', 'Парастернальная длинная ось, если есть', 'Парастернальная короткая ось, если есть', 'Апикальное окно, если есть', 'Субкостальное окно, если есть', 'Жидкость у перикарда, если видна', 'Заключение'].join('\n'),
    en: ['Heart', 'Parasternal long axis, if present', 'Parasternal short axis, if present', 'Apical window, if present', 'Subcostal window, if present', 'Pericardial fluid, if seen', 'Conclusion'].join('\n'),
  },
  thyroid: {
    ru: ['Щитовидная железа', 'Правая доля, если видна', 'Левая доля, если видна', 'Перешеек, если виден', 'Узел, если виден', 'Заключение'].join('\n'),
    en: ['Thyroid', 'Right lobe, if seen', 'Left lobe, if seen', 'Isthmus, if seen', 'Nodule, if seen', 'Conclusion'].join('\n'),
  },
  bladder: {
    ru: ['Мочевой пузырь', 'Форма и стенка', 'Содержимое', 'Объём, только если он уже посчитан или назван', 'Заключение'].join('\n'),
    en: ['Urinary bladder', 'Shape and wall', 'Contents', 'Volume only if it was already calculated or stated', 'Conclusion'].join('\n'),
  },
  uterus: {
    ru: ['Матка', 'Положение и контуры', 'Миометрий', 'Эндометрий, если виден', 'Узел, если виден', 'Заключение'].join('\n'),
    en: ['Uterus', 'Position and margins', 'Myometrium', 'Endometrium, if seen', 'Mass, if seen', 'Conclusion'].join('\n'),
  },
  ovaries: {
    ru: ['Яичники', 'Правый, если виден', 'Левый, если виден', 'Образование, если видно', 'Заключение'].join('\n'),
    en: ['Ovaries', 'Right, if seen', 'Left, if seen', 'Mass, if seen', 'Conclusion'].join('\n'),
  },
  prostate: {
    ru: ['Предстательная железа', 'Контуры', 'Эхоструктура', 'Очаг, если виден', 'Заключение'].join('\n'),
    en: ['Prostate', 'Margins', 'Echotexture', 'Focal lesion, if seen', 'Conclusion'].join('\n'),
  },
}

const NO_REFERENCE: Record<ReportLanguage, string> = {
  ru: 'Числовой референс в этот образец не заложен.',
  en: 'No numeric reference is attached to this sample.',
}

const REFERENCES: Record<string, Record<ReportLanguage, string>> = {
  liver: {
    ru: 'Продольный размер по срединно-ключичной линии: обзор предлагает ориентир меньше 16 см и прямо пишет, что он оценён недостаточно (Sienz, Z Gastroenterol, 2010). В протокол, если сравниваешь, пиши коротко: референс: до 16 см.',
    en: 'Midclavicular longitudinal span: a review suggests under 16 cm and states the figure is not well validated (Sienz, Z Gastroenterol, 2010). If you compare, write only: reference: up to 16 cm.',
  },
  gallbladder: {
    ru: 'Стенка натощак толще 3 мм считается утолщённой (AIUM, J Ultrasound Med, 2022). Длина, ширина и передне-задний размер в обзоре приводятся как меньше 10 × 4 × 4 см (Sienz, PMC12193774). В протокол: референс: до 3 мм или референс: до 10 × 4 × 4 см.',
    en: 'A fasting wall thicker than 3 mm is abnormal (AIUM, J Ultrasound Med, 2022). Length, width and depth are cited under 10 × 4 × 4 cm (Sienz, PMC12193774). In the report: reference: up to 3 mm or reference: up to 10 × 4 × 4 cm.',
  },
  ivc: {
    ru: 'Диаметр больше 2,1 см у места впадения — порог повышенного давления в правом предсердии в рекомендациях ASE (Rudski, J Am Soc Echocardiogr, 2010). В протокол: референс: до 2,1 см. Процент спадения не пиши.',
    en: 'A diameter greater than 2.1 cm at the cavoatrial junction is the ASE threshold for elevated right-atrial pressure (Rudski, J Am Soc Echocardiogr, 2010). In the report: reference: up to 2.1 cm. Do not write a collapse percent.',
  },
  aorta: {
    ru: 'В руководстве Society for Vascular Surgery аневризма брюшной аорты — диаметр от 3 см (Chaikof, J Vasc Surg, 2018). В протокол: референс: до 3 см.',
    en: 'The Society for Vascular Surgery defines an abdominal aortic aneurysm as a diameter of 3 cm or more (Chaikof, J Vasc Surg, 2018). In the report: reference: up to 3 cm.',
  },
  thyroid: {
    ru: 'Объём железы у взрослого: ориентир ВОЗ до 25 мл у мужчин и до 18 мл у женщин (WHO, 2007). Пиши его только если объём уже посчитан из названных размеров. В протокол: референс: до 25 мл или референс: до 18 мл.',
    en: 'Adult thyroid volume: the WHO upper figure is 25 ml in men and 18 ml in women (WHO, 2007). Use it only when the volume was already calculated from stated sizes. In the report: reference: up to 25 ml or reference: up to 18 ml.',
  },
}

export function protocolReference(regionName: string | undefined, language: ReportLanguage): string {
  const name = regionName?.trim().toLowerCase()
  const match = LOCALIZATIONS.find((item) => organNames(item).some((label) => label.toLowerCase() === name))
  if (!match) return NO_REFERENCE[language]
  return REFERENCES[match.id]?.[language] ?? NO_REFERENCE[language]
}

export function protocolOutline(regionName: string | undefined, language: ReportLanguage): string {
  const name = regionName?.trim().toLowerCase()
  const match = LOCALIZATIONS.find((item) => organNames(item).some((label) => label.toLowerCase() === name))
  return match ? SAMPLES[match.id][language] : GENERIC[language]
}

export function protocolSampleIds(): string[] {
  return LOCALIZATIONS.map((item) => item.id)
}
