export type DataSource = 'mock' | 'api'
export type MockScenario = 'full' | 'partial' | 'empty' | 'error' | 'agent-offline' | 'scanning' | 'selected' | 'mixed'

const requestedSource = import.meta.env.VITE_DATA_SOURCE

export const dataSource: DataSource = import.meta.env.PROD || requestedSource === 'api' ? 'api' : 'mock'
export const isMockMode = dataSource === 'mock'

export function getMockScenario(): MockScenario {
  const requested = new URLSearchParams(window.location.search).get('scenario')
    || import.meta.env.VITE_MOCK_SCENARIO
    || 'full'

  return isMockScenario(requested) ? requested : 'full'
}

function isMockScenario(value: string): value is MockScenario {
  return ['full', 'partial', 'empty', 'error', 'agent-offline', 'scanning', 'selected', 'mixed'].includes(value)
}
