import { useEffect, useMemo, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { Inbox as InboxIcon, Mail, Phone, Reply, Archive, ArchiveRestore, Trash2, MailOpen, ChevronLeft, Search, Send, CheckCircle2 } from 'lucide-react'
import { api, friendlyError } from '../../lib/firebase'
import { Person } from './Avatar'
import { useDialog } from '../../components/Dialog'

const FOLDERS = [
  { key: 'inbox', label: 'Inbox', test: (m) => m.status !== 'archived' },
  { key: 'new', label: 'Unread', test: (m) => m.status === 'new' },
  { key: 'archived', label: 'Archived', test: (m) => m.status === 'archived' },
]
const STATUS_LABEL = { new: 'New', read: 'Read', replied: 'Replied', archived: 'Archived' }

const when = (d) => {
  if (!d) return 'just now'
  const sameDay = d.toDateString() === new Date().toDateString()
  return sameDay
    ? d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
    : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: d.getFullYear() === new Date().getFullYear() ? undefined : 'numeric' })
}
const full = (d) => (d ? d.toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '')

export default function Inbox() {
  const dialog = useDialog()
  const { messages, messagesError } = useOutletContext()
  const [folder, setFolder] = useState('inbox')
  const [q, setQ] = useState('')
  const [openId, setOpenId] = useState(null)
  const [err, setErr] = useState('')

  const shown = useMemo(() => {
    const f = FOLDERS.find((x) => x.key === folder)
    const s = q.trim().toLowerCase()
    return messages.filter((m) => f.test(m) && (!s || [m.name, m.email, m.subject, m.message].some((v) => (v || '').toLowerCase().includes(s))))
  }, [messages, folder, q])
  const open = messages.find((m) => m.id === openId)

  // Opening a new message marks it read
  useEffect(() => {
    if (open?.status === 'new') api.setMessageStatus(open.id, 'read').catch(() => {})
  }, [open?.id, open?.status])

  const act = async (fn) => {
    setErr('')
    try { await fn() } catch (e) { setErr(friendlyError(e)) }
  }
  const counts = Object.fromEntries(FOLDERS.map((f) => [f.key, messages.filter(f.test).length]))

  return (
    <>
      <div className="admin-head">
        <div>
          <span className="eyebrow">Guests</span>
          <h1>Inbox</h1>
          <p>Messages sent from the Contact page. Type a reply here and it's emailed to the guest straight away.</p>
        </div>
      </div>

      {messagesError ? (
        <div className="empty"><h3>Couldn't load messages</h3><p className="muted">Deploy the latest database rules (firebase deploy --only firestore), then refresh.</p></div>
      ) : (
        <div className={`inbox ${open ? 'has-open' : ''}`}>
          <section className="admin-card inbox-list">
            <div className="inbox-tools">
              <div className="admin-filters" role="tablist" aria-label="Folder">
                {FOLDERS.map((f) => (
                  <button key={f.key} role="tab" aria-selected={folder === f.key} className={`chip ${folder === f.key ? 'is-active' : ''}`}
                    onClick={() => { setFolder(f.key); setOpenId(null) }}>
                    {f.label}{counts[f.key] > 0 && <span className="chip-count">{counts[f.key]}</span>}
                  </button>
                ))}
              </div>
              <label className="inbox-search"><Search size={15} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search messages" aria-label="Search messages" /></label>
            </div>
            {shown.length === 0 ? (
              <p className="today-empty"><InboxIcon size={16} /> {q ? 'No messages match.' : folder === 'archived' ? 'Nothing archived.' : folder === 'new' ? 'All caught up. No unread messages.' : 'No messages yet.'}</p>
            ) : (
              <ul className="msg-list">
                {shown.map((m) => (
                  <li key={m.id}>
                    <button className={`msg-row ${m.status === 'new' ? 'is-new' : ''} ${m.id === openId ? 'is-open' : ''}`} onClick={() => setOpenId(m.id)}>
                      <span className="msg-dot" aria-label={m.status === 'new' ? 'Unread' : undefined} />
                      <span className="msg-main">
                        <span className="msg-top"><strong>{m.name}</strong><time>{when(m.createdAt)}</time></span>
                        <span className="msg-subject">{m.subject || 'No subject'}</span>
                        <span className="msg-snippet">{m.message}</span>
                      </span>
                      {m.status === 'replied' && <Reply size={14} className="msg-replied" aria-label="Replied" />}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="admin-card inbox-view">
            {!open ? (
              <div className="inbox-placeholder"><MailOpen size={34} /><p>Choose a message to read it.</p></div>
            ) : (
              <>
                <button className="back-link inbox-back" onClick={() => setOpenId(null)}><ChevronLeft size={16} /> Messages</button>
                <div className="msg-head">
                  <h2>{open.subject || 'No subject'}</h2>
                  <span className={`status ${open.status === 'new' ? 'status--ok' : open.status === 'replied' ? 'status--in' : 'status--out'}`}>{STATUS_LABEL[open.status]}</span>
                </div>
                <div className="msg-from">
                  <Person name={open.name} detail={full(open.createdAt)} />
                  <ul className="bd-list">
                    <li><Mail size={16} /> <a href={`mailto:${open.email}`}>{open.email}</a></li>
                    {open.phone && <li><Phone size={16} /> <a href={`tel:${open.phone.replace(/[^\d+]/g, '')}`}>{open.phone}</a></li>}
                  </ul>
                </div>
                <div className="msg-body">{open.message}</div>
                {(open.replies || []).length > 0 && (
                  <ul className="msg-replies">
                    {open.replies.map((r, i) => (
                      <li key={i}>
                        <span className="msg-reply-head"><CheckCircle2 size={14} /> Emailed by {r.by} · {full(r.at?.toDate?.())}</span>
                        <div>{r.text}</div>
                      </li>
                    ))}
                  </ul>
                )}
                <ReplyBox key={open.id} message={open} />
                {err && <p className="auth-msg auth-msg--err" role="alert">{err}</p>}
                <div className="msg-actions">
                  {open.status !== 'new' && open.status !== 'archived' && (
                    <button className="btn btn-outline btn-sm" onClick={() => { act(() => api.setMessageStatus(open.id, 'new')); setOpenId(null) }}><Mail size={15} /> Mark unread</button>
                  )}
                  {open.status === 'archived' ? (
                    <button className="btn btn-outline btn-sm" onClick={() => act(() => api.setMessageStatus(open.id, 'read'))}><ArchiveRestore size={15} /> Move to inbox</button>
                  ) : (
                    <button className="btn btn-outline btn-sm" onClick={() => { act(() => api.setMessageStatus(open.id, 'archived')); setOpenId(null) }}><Archive size={15} /> Archive</button>
                  )}
                  <button className="btn btn-outline btn-sm msg-delete"
                    onClick={async () => {
                      if (await dialog.confirm({ title: 'Delete this message?', message: `From ${open.name}. It's removed for everyone and can't be undone (the activity log keeps a note of it).`, confirmLabel: 'Delete message', danger: true })) {
                        act(async () => { await api.deleteMessage(open.id); setOpenId(null) })
                      }
                    }}>
                    <Trash2 size={15} /> Delete
                  </button>
                </div>
                {open.statusBy && <p className="muted small">Last updated by {open.statusBy}</p>}
              </>
            )}
          </section>
        </div>
      )}
    </>
  )
}

/** Write a reply; the server emails it (greeting, signature and the guest's message are added). */
function ReplyBox({ message }) {
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState(null)
  const send = async (e) => {
    e.preventDefault()
    if (!text.trim() || busy) return
    setBusy(true)
    setMsg(null)
    try {
      const { data } = await api.replyMessage(message.id, text.trim())
      setText('')
      setMsg({ ok: true, text: `Sent to ${data.sentTo}.` })
    } catch (e2) {
      setMsg({ ok: false, text: friendlyError(e2) })
    }
    setBusy(false)
  }
  return (
    <form className="msg-reply" onSubmit={send}>
      <label htmlFor="msg-reply-text"><Reply size={15} /> Reply to {message.name}</label>
      <div className="msg-reply-box">
        <span className="msg-reply-greet">Dear {message.name},</span>
        <textarea id="msg-reply-text" value={text} onChange={(e) => setText(e.target.value)} rows={5} maxLength={5000}
          placeholder="Write your answer…" disabled={busy}
          onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) send(e) }} />
        <span className="msg-reply-greet">Kind regards, Monsoon Ridge Jungle Resort &amp; Spa</span>
      </div>
      <div className="msg-reply-foot">
        <small className="muted">Goes to {message.email}. Their message is quoted under your reply. Ctrl+Enter sends.</small>
        <button type="submit" className="btn btn-gold btn-sm" disabled={busy || !text.trim()}>
          {busy ? <span className="spinner spinner--sm" /> : <Send size={15} />} Send reply
        </button>
      </div>
      {msg && <p className={`auth-msg ${msg.ok ? '' : 'auth-msg--err'}`} role="status">{msg.text}</p>}
    </form>
  )
}
