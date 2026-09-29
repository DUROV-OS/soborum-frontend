import { apiRequest } from '@/shared/lib/httpClient'
import { AgentRun, AgentShift, AgentsStats, ShiftApproval } from './types'

export function createAgentRun(text: string): Promise<AgentRun> {
  return apiRequest<AgentRun>({ section: 'agents', path: '/runs', method: 'POST', body: { text } })
}

export function getAgentRuns(limit = 40): Promise<AgentRun[]> {
  return apiRequest<AgentRun[]>({ section: 'agents', path: '/runs', query: { limit } })
}

export function getAgentStats(): Promise<AgentsStats> {
  return apiRequest<AgentsStats>({ section: 'agents', path: '/stats' })
}

export function createAgentShift(): Promise<AgentShift> {
  return apiRequest<AgentShift>({ section: 'agents', path: '/shifts', method: 'POST' })
}

export function getLatestShift(): Promise<AgentShift | null> {
  return apiRequest<AgentShift | null>({ section: 'agents', path: '/shifts/latest' })
}

export function decideApproval(
  id: number,
  status: 'approved' | 'rejected',
  subjectHash: string,
): Promise<ShiftApproval> {
  return apiRequest<ShiftApproval>({
    section: 'agents',
    path: `/approvals/${id}/decision`,
    method: 'POST',
    body: { status, subject_hash: subjectHash },
  })
}
