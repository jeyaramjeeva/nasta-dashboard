import type { AuthUser } from '../context/AuthContext'
import { answerFromKnowledgeBase } from './aiHelperKb'
import { teamApiHeaders } from './teamApiHeaders'

export async function askAiCoach(
  user: AuthUser,
  context: string,
  fallbackBriefing?: string,
): Promise<{ briefing: string; source: string }> {
  try {
    const res = await fetch('/api/ai-coach', {
      method: 'POST',
      headers: await teamApiHeaders(user),
      body: JSON.stringify({
        context,
        fallbackBriefing: fallbackBriefing || undefined,
        userName: user.name,
        userEmail: user.email,
      }),
    })
    if (!res.ok) {
      return {
        briefing: fallbackBriefing || 'Coach standing by.',
        source: 'rules',
      }
    }
    return (await res.json()) as { briefing: string; source: string }
  } catch {
    return {
      briefing: fallbackBriefing || 'Coach standing by.',
      source: 'rules',
    }
  }
}

export async function askAiHelper(
  user: AuthUser,
  question: string,
  context?: string,
): Promise<{ answer: string; source: string }> {
  const fallback = answerFromKnowledgeBase(question)
  try {
    const res = await fetch('/api/ai-helper', {
      method: 'POST',
      headers: await teamApiHeaders(user),
      body: JSON.stringify({
        question,
        context: context || undefined,
        userName: user.name,
        userEmail: user.email,
      }),
    })
    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as { error?: string }
      if (res.status === 404 || res.status >= 500) {
        if (context) {
          return {
            answer: `${fallback}\n\n(Sales snapshot)\n${context.slice(0, 900)}`,
            source: 'kb',
          }
        }
        return fallback
      }
      throw new Error(err.error || `Helper error ${res.status}`)
    }
    return (await res.json()) as { answer: string; source: string }
  } catch {
    if (context) {
      return {
        answer: `${fallback}\n\n(Sales snapshot)\n${context.slice(0, 900)}`,
        source: 'kb',
      }
    }
    return fallback
  }
}

export interface AgentLaunchResult {
  agent?: {
    id?: string
    url?: string
    status?: string
    name?: string
  }
  run?: { id?: string; status?: string }
  error?: string
  details?: unknown
}

export async function launchAiCodeAgent(
  user: AuthUser,
  prompt: string,
  agentId?: string,
): Promise<AgentLaunchResult> {
  const res = await fetch('/api/ai-agent', {
    method: 'POST',
    headers: await teamApiHeaders(user),
    body: JSON.stringify({
      prompt,
      agentId,
      userName: user.name,
      userEmail: user.email,
    }),
  })
  const data = (await res.json().catch(() => ({}))) as AgentLaunchResult
  if (!res.ok) {
    throw new Error(data.error || `Agent error ${res.status}`)
  }
  return data
}

export async function fetchAiAgentStatus(
  user: AuthUser,
  agentId: string,
): Promise<AgentLaunchResult> {
  const qs = new URLSearchParams({
    agentId,
    userName: user.name,
    userEmail: user.email,
  })
  const headers = await teamApiHeaders(user)
  const res = await fetch(`/api/ai-agent-status?${qs}`, {
    method: 'GET',
    headers,
  })
  // GET may not send body; also POST fallback
  if (res.status === 405 || res.status === 400) {
    const res2 = await fetch('/api/ai-agent-status', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        agentId,
        userName: user.name,
        userEmail: user.email,
      }),
    })
    const data2 = (await res2.json().catch(() => ({}))) as AgentLaunchResult
    if (!res2.ok) throw new Error(data2.error || 'Status failed')
    return data2
  }
  const data = (await res.json().catch(() => ({}))) as AgentLaunchResult
  if (!res.ok) throw new Error(data.error || 'Status failed')
  return data
}
