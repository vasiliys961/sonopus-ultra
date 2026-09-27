export interface AtlasLink {
  title: string
  url: string
}

export const ATLAS_LINKS: Record<string, AtlasLink> = {
  bladder: {
    title: 'POCUS Atlas: мочевой пузырь',
    url: 'https://www.thepocusatlas.com/renal-genitourinary',
  },
  ivc: {
    title: 'POCUS Atlas: нижняя полая вена',
    url: 'https://www.thepocusatlas.com/ivc',
  },
  efast: {
    title: 'POCUS Atlas: eFAST',
    url: 'https://www.thepocusatlas.com/trauma-atlas',
  },
  lung: {
    title: 'POCUS Atlas: лёгкие',
    url: 'https://www.thepocusatlas.com/pulmonary',
  },
  thyroid: {
    title: 'Radiopaedia: щитовидная железа',
    url: 'https://radiopaedia.org/articles/thyroid-gland',
  },
  'multi-angle': {
    title: 'POCUS Atlas',
    url: 'https://www.thepocusatlas.com/',
  },
  'cardiac-ef': {
    title: 'POCUS Atlas: сердце',
    url: 'https://www.thepocusatlas.com/echocardiography',
  },
}
