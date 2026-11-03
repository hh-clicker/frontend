export interface AiLetterSettings { enabled: boolean; template: string; maxLength: number }
export const AI_MARKER = '#AI_CHANGE#'
export function defaultAiLetter(): AiLetterSettings {
  return { enabled: false, template: 'Здравствуйте!\n\n#AI_CHANGE#\n\nБуду рад обсудить задачи и подробнее рассказать о своём опыте.', maxLength: 1500 }
}
export function aiLetterError(ai: AiLetterSettings): string | null {
  if (!Number.isInteger(ai.maxLength) || ai.maxLength < 200 || ai.maxLength > 5000) return 'Лимит AI-письма — от 200 до 5000 символов.'
  if (ai.template.length > 5000 || ai.template.includes('\0')) return 'Проверьте шаблон: максимум 5000 символов.'
  if (!ai.enabled) return null
  if (ai.template.split(AI_MARKER).length !== 2) return 'В AI-шаблоне должен быть ровно один #AI_CHANGE#.'
  if (ai.maxLength - ai.template.length + AI_MARKER.length < 200) return 'В лимите письма должно оставаться минимум 200 символов для AI-текста.'
  return null
}
