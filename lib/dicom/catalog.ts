export interface UltrasoundConnector {
  id: 'hotfolder-us-dicom'
  modality: 'ultrasound'
  connectorType: 'filewatch'
  capabilities: Array<'receive-dicom' | 'upload-file'>
}

export const ultrasoundConnector: UltrasoundConnector = {
  id: 'hotfolder-us-dicom',
  modality: 'ultrasound',
  connectorType: 'filewatch',
  capabilities: ['receive-dicom', 'upload-file'],
}
