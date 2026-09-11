import { demoStorageKey } from './demoMode'
import type { TeamAnnouncement, TeamChatMessage } from './stallOps'

function chatKey(userName: string) {
  return demoStorageKey(`nasta-chat-last-read-v1:${userName.trim().toLowerCase()}`)
}

function annKey(userName: string) {
  return demoStorageKey(`nasta-ann-last-read-v1:${userName.trim().toLowerCase()}`)
}

export function getChatLastRead(userName: string): string {
  try {
    return localStorage.getItem(chatKey(userName)) || ''
  } catch {
    return ''
  }
}

export function setChatLastRead(userName: string, iso: string) {
  try {
    localStorage.setItem(chatKey(userName), iso)
  } catch {
    /* ignore */
  }
}

export function getAnnLastRead(userName: string): string {
  try {
    return localStorage.getItem(annKey(userName)) || ''
  } catch {
    return ''
  }
}

export function setAnnLastRead(userName: string, iso: string) {
  try {
    localStorage.setItem(annKey(userName), iso)
  } catch {
    /* ignore */
  }
}

export function countUnreadChat(
  messages: TeamChatMessage[],
  userName: string,
  lastReadIso: string,
): number {
  const me = userName.trim().toLowerCase()
  // Unknown last-read (new device / first login) = caught up. Only newer messages badge.
  if (!lastReadIso) return 0
  return messages.filter((m) => {
    if ((m.from || '').trim().toLowerCase() === me) return false
    return (m.createdAt || '') > lastReadIso
  }).length
}

export function countUnreadAnnouncements(
  items: TeamAnnouncement[],
  lastReadIso: string,
): number {
  if (!lastReadIso) return 0
  return items.filter((a) => (a.createdAt || '') > lastReadIso).length
}

/** First visit on this device: treat existing history as already read. */
export function seedLastReadIfNeeded(
  userName: string,
  chat: { createdAt: string }[],
  anns: { createdAt: string }[],
): { chat: string; ann: string } {
  let chatIso = getChatLastRead(userName)
  let annIso = getAnnLastRead(userName)
  if (!chatIso) {
    chatIso = latestIso(chat) || new Date().toISOString()
    setChatLastRead(userName, chatIso)
  }
  if (!annIso) {
    annIso = latestIso(anns) || new Date().toISOString()
    setAnnLastRead(userName, annIso)
  }
  return { chat: chatIso, ann: annIso }
}

export function latestIso(items: { createdAt: string }[]): string {
  let max = ''
  for (const i of items) {
    if (i.createdAt && i.createdAt > max) max = i.createdAt
  }
  return max || new Date().toISOString()
}
