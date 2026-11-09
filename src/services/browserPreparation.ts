interface PreparationPorts {
  status(): Promise<{ status: string; browserOpen: boolean; activeProfileId: string | null }>
  profile(accountId: string): Promise<{ id: string }>
  open(accountId: string): Promise<{ authorization?: { status: string; message: string | null } | null }>
  waitReady(profileId: string): Promise<void>
}

/** Coalesce clicks for one account; never race two account switches. */
export class BrowserPreparation {
  private pending: { accountId: string; promise: Promise<void> } | null = null

  async ensure(accountId: string, ports: PreparationPorts): Promise<void> {
    if (this.pending) {
      if (this.pending.accountId !== accountId) throw new Error('Уже открывается браузер другого аккаунта. Дождитесь завершения.')
      return this.pending.promise
    }
    const promise = this.prepare(accountId, ports)
    this.pending = { accountId, promise }
    try { await promise } finally { if (this.pending?.promise === promise) this.pending = null }
  }

  private async prepare(accountId: string, ports: PreparationPorts): Promise<void> {
    const agent = await ports.status()
    if (agent.status !== 'READY' && agent.status !== 'BUSY') throw new Error('Дождитесь готовности Browser Agent.')
    const profile = await ports.profile(accountId)
    // Let the requested action's backend enforce busy/idempotency rules for an already open profile.
    if (agent.browserOpen && agent.activeProfileId === profile.id) return
    if (agent.status !== 'READY') throw new Error('Дождитесь завершения текущей операции перед переключением профиля браузера.')
    const command = await ports.open(accountId)
    if (command.authorization?.status !== 'AUTHORIZED')
      throw new Error(command.authorization?.message || 'Браузер открыт. Завершите вход или проверку HH вручную и повторите действие.')
    await ports.waitReady(profile.id)
  }
}
