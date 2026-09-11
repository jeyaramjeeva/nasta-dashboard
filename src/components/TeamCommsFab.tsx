import { Megaphone, MessageCircle, Pin, Send, Trash2, X } from 'lucide-react'
import { FabDisclose } from './FabDisclose'
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { useAuth } from '../context/AuthContext'
import { useStallOps } from '../context/StallOpsContext'
import { useStallOpsPoll } from '../hooks/useStallOpsPoll'
import { isGuestUser } from '../lib/guestAuth'
import { formatGermanyDateTime } from '../lib/germanyTime'
import {
  countUnreadAnnouncements,
  countUnreadChat,
  getAnnLastRead,
  getChatLastRead,
  latestIso,
  seedLastReadIfNeeded,
  setAnnLastRead,
  setChatLastRead,
} from '../lib/teamChatUnread'

type Panel = 'chat' | 'ann' | null

/** Floating team chat + announcements next to the AI helper. */
export function TeamCommsFab() {
  const { user } = useAuth()
  const {
    teamChat,
    postTeamChat,
    announcements,
    postAnnouncement,
    deleteAnnouncement,
    refreshStallOps,
  } = useStallOps()
  const [panel, setPanel] = useState<Panel>(null)
  const [chatText, setChatText] = useState('')
  const [annTitle, setAnnTitle] = useState('')
  const [annBody, setAnnBody] = useState('')
  const [pin, setPin] = useState(false)
  const [chatLastRead, setChatLastReadState] = useState('')
  const [annLastRead, setAnnLastReadState] = useState('')
  const chatListRef = useRef<HTMLDivElement>(null)
  const seeded = useRef(false)

  useStallOpsPoll(refreshStallOps, panel ? 'chat-open' : 'chat-closed')

  useEffect(() => {
    if (!user) return
    if (seeded.current) return
    const existingChat = getChatLastRead(user.name)
    const existingAnn = getAnnLastRead(user.name)
    if (existingChat && existingAnn) {
      setChatLastReadState(existingChat)
      setAnnLastReadState(existingAnn)
      seeded.current = true
      return
    }
    if (!teamChat.length && !announcements.length) {
      setChatLastReadState(existingChat)
      setAnnLastReadState(existingAnn)
      return
    }
    const seededIso = seedLastReadIfNeeded(user.name, teamChat, announcements)
    setChatLastReadState(seededIso.chat)
    setAnnLastReadState(seededIso.ann)
    seeded.current = true
  }, [user, teamChat, announcements])

  useEffect(() => {
    if (panel !== 'chat' || !user) return
    chatListRef.current?.scrollTo({ top: chatListRef.current.scrollHeight })
    const iso = latestIso(teamChat)
    setChatLastRead(user.name, iso)
    setChatLastReadState(iso)
  }, [panel, teamChat, user])

  useEffect(() => {
    if (panel !== 'ann' || !user) return
    const iso = latestIso(announcements)
    setAnnLastRead(user.name, iso)
    setAnnLastReadState(iso)
  }, [panel, announcements, user])

  useEffect(() => {
    if (!panel) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPanel(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [panel])

  const unreadChat = useMemo(
    () => (user ? countUnreadChat(teamChat, user.name, chatLastRead) : 0),
    [teamChat, user, chatLastRead],
  )
  const unreadAnn = useMemo(
    () => countUnreadAnnouncements(announcements, annLastRead),
    [announcements, annLastRead],
  )

  if (!user || isGuestUser(user)) return null

  function sendChat(e: FormEvent) {
    e.preventDefault()
    postTeamChat(chatText)
    setChatText('')
  }

  function sendAnn(e: FormEvent) {
    e.preventDefault()
    postAnnouncement(annTitle, annBody, pin)
    setAnnTitle('')
    setAnnBody('')
    setPin(false)
  }

  const sortedAnn = [...announcements].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
    return b.createdAt.localeCompare(a.createdAt)
  })
  const chatChrono = [...teamChat].reverse()

  function toggle(next: Panel) {
    setPanel((p) => {
      if (p === next) {
        if (user && next === 'chat') {
          const iso = latestIso(teamChat)
          setChatLastRead(user.name, iso)
          setChatLastReadState(iso)
        }
        if (user && next === 'ann') {
          const iso = latestIso(announcements)
          setAnnLastRead(user.name, iso)
          setAnnLastReadState(iso)
        }
        return null
      }
      return next
    })
  }

  return (
    <>
      <FabDisclose open={panel === 'ann'} className="ai-fab-panel team-fab-panel">
          <div className="ai-fab-panel__head">
            <div>
              <strong>
                <Megaphone size={16} style={{ verticalAlign: -3, marginRight: 6 }} />
                Announcements
              </strong>
              <div className="hint-inline" style={{ fontSize: 12 }}>
                Team-wide notes
              </div>
            </div>
            <button type="button" className="icon-btn" onClick={() => setPanel(null)} aria-label="Close">
              <X size={16} />
            </button>
          </div>
          <div className="team-fab-panel__body">
            <form className="team-fab-ann-form" onSubmit={sendAnn}>
              <input
                value={annTitle}
                onChange={(e) => setAnnTitle(e.target.value)}
                placeholder="Title"
              />
              <textarea
                rows={2}
                value={annBody}
                onChange={(e) => setAnnBody(e.target.value)}
                placeholder="Message…"
                required
              />
              <label className="hint-inline" style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <input type="checkbox" checked={pin} onChange={(e) => setPin(e.target.checked)} />
                Pin
              </label>
              <button type="submit" className="btn" disabled={!annBody.trim()}>
                Post
              </button>
            </form>
            <div className="team-fab-ann-list">
              {sortedAnn.length === 0 && <p className="hint-inline">No announcements yet.</p>}
              {sortedAnn.map((a) => (
                <div key={a.id} className={`team-fab-ann${a.pinned ? ' is-pinned' : ''}`}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 6 }}>
                    <strong>
                      {a.pinned && <Pin size={12} style={{ verticalAlign: -1, marginRight: 4 }} />}
                      {a.title}
                    </strong>
                    <button
                      type="button"
                      className="icon-btn"
                      aria-label="Delete"
                      onClick={() => {
                        if (confirm('Delete?')) deleteAnnouncement(a.id)
                      }}
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                  <p style={{ margin: '0.3rem 0 0', whiteSpace: 'pre-wrap', fontSize: '0.9rem' }}>
                    {a.body}
                  </p>
                  <div className="hint-inline" style={{ fontSize: 10, marginTop: 4 }}>
                    {a.from} · {formatGermanyDateTime(a.createdAt)}
                  </div>
                </div>
              ))}
            </div>
          </div>
      </FabDisclose>

      <FabDisclose open={panel === 'chat'} className="ai-fab-panel team-fab-panel">
          <div className="ai-fab-panel__head">
            <div>
              <strong>
                <MessageCircle size={16} style={{ verticalAlign: -3, marginRight: 6 }} />
                Team chat
              </strong>
              <div className="hint-inline" style={{ fontSize: 12 }}>
                {user.name}
              </div>
            </div>
            <button type="button" className="icon-btn" onClick={() => setPanel(null)} aria-label="Close">
              <X size={16} />
            </button>
          </div>
          <div className="team-chat ai-fab-panel__chat" ref={chatListRef}>
            {chatChrono.length === 0 && (
              <p className="hint-inline">Say hi — first message starts the thread.</p>
            )}
            {chatChrono.map((m) => {
              const mine = m.from === user.name
              return (
                <div
                  key={m.id}
                  className={`team-chat__bubble${mine ? ' team-chat__bubble--me' : ''}`}
                >
                  <div className="hint-inline" style={{ fontSize: 11 }}>
                    {m.from} · {formatGermanyDateTime(m.createdAt)}
                  </div>
                  <div>{m.text}</div>
                </div>
              )
            })}
          </div>
          <form className="ai-fab-panel__form" onSubmit={sendChat}>
            <input
              value={chatText}
              onChange={(e) => setChatText(e.target.value)}
              placeholder="Message…"
              maxLength={1000}
              aria-label="Team message"
            />
            <button type="submit" className="btn" disabled={!chatText.trim()} aria-label="Send">
              <Send size={14} />
            </button>
          </form>
      </FabDisclose>

      <button
        type="button"
        className={`ai-fab-btn ai-fab-btn--sm${panel === 'ann' ? ' is-open' : ''}${
          unreadAnn > 0 && panel !== 'ann' ? ' has-alert' : ''
        }`}
        onClick={() => toggle('ann')}
        aria-label={
          panel === 'ann'
            ? 'Close announcements'
            : unreadAnn
              ? `${unreadAnn} new announcements`
              : 'Announcements'
        }
        title={unreadAnn ? `${unreadAnn} new announcement${unreadAnn > 1 ? 's' : ''}` : 'Announcements'}
      >
        {panel === 'ann' ? <X size={18} /> : <Megaphone size={18} />}
        {unreadAnn > 0 && panel !== 'ann' ? (
          <span className="ai-fab-badge">{unreadAnn > 9 ? '9+' : unreadAnn}</span>
        ) : null}
      </button>
      <button
        type="button"
        className={`ai-fab-btn ai-fab-btn--sm${panel === 'chat' ? ' is-open' : ''}${
          unreadChat > 0 && panel !== 'chat' ? ' has-alert' : ''
        }`}
        onClick={() => toggle('chat')}
        aria-label={
          panel === 'chat'
            ? 'Close team chat'
            : unreadChat
              ? `${unreadChat} new messages`
              : 'Team chat'
        }
        title={unreadChat ? `${unreadChat} new message${unreadChat > 1 ? 's' : ''}` : 'Team chat'}
      >
        {panel === 'chat' ? <X size={18} /> : <MessageCircle size={18} />}
        {unreadChat > 0 && panel !== 'chat' ? (
          <span className="ai-fab-badge">{unreadChat > 9 ? '9+' : unreadChat}</span>
        ) : null}
      </button>
    </>
  )
}
