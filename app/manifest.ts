import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Doctor Opus Sono',
    short_name: 'Sono',
    description: 'A consultative ultrasound draft: frame quality, measurement, and physician review.',
    start_url: '/',
    display: 'standalone',
    background_color: '#07110e',
    theme_color: '#07110e',
  }
}
