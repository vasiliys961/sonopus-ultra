export function dictationLine(transcript: string): string {
  return transcript.replace(/снимок|snapshot/gi, ' ').replace(/\s+/g, ' ').trim()
}
