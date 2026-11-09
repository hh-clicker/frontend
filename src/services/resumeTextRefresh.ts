import type { ResumeProfile } from '../api/contracts/resumes'

type Target = Pick<ResumeProfile, 'id' | 'accountId' | 'hhResumeId'>
interface Ports {
  prepare(accountId: string): Promise<void>
  read(accountId: string, hhResumeId: string): Promise<string>
  save(resumeId: string, plainText: string): Promise<ResumeProfile>
}
/** Persist only a completed, nonempty read of the explicitly selected resume. */
export async function refreshResumeTextFromHh(target: Target, ports: Ports): Promise<ResumeProfile> {
  const { id, accountId, hhResumeId } = target
  await ports.prepare(accountId)
  const text = (await ports.read(accountId, hhResumeId)).trim()
  if (!text || text.length > 100000) throw new Error('Агент не вернул допустимый текст резюме.')
  return ports.save(id, text)
}
