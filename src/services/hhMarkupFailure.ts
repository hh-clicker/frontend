/** Only parsing failures get a route to diagnostics; network/login errors keep their own handling. */
export function isHhMarkupFailure(message: string | null | undefined): boolean {
  return typeof message === 'string' && /(?:не удалось распознать|изменилась разметка|не удалось прочитать текст резюме|не удалось распознать обязательные поля)/i.test(message)
}
