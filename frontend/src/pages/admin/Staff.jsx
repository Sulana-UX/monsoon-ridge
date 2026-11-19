import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ShieldCheck, UserPlus, Trash2, Crown, Clock, MailWarning, History, RefreshCw, ConciergeBell, KeyRound } from 'lucide-react'
import { api, friendlyError } from '../../lib/firebase'
import { useAuth } from '../../context/AuthContext'
import { Person } from './Avatar'
import { useDialog } from '../../components/Dialog'

const ROLES = [
  { value: 'frontdesk', label: 'Front desk', icon: ConciergeBell, sub: 'Bookings, calendar, check-in/out, walk-ins, blocked dates, guests, inbox' },
  { value: 'admin', label: 'Admin', icon: KeyRound, sub: 'Everything, plus rooms, prices & promos, reports, staff and the activity log' },
]
const roleLabel = (r) => ROLES.find((x) => x.value === r)?.label ?? r

const since = (iso) => {
  if (!iso) return null
  const d = new Date(iso)
  const days = Math.floor((Date.now() - d.getTime()) / 86400000)
  return days < 1 ? 'today' : days === 1 ? 'yesterday' : days < 30 ? `${days} days ago` : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function accountState(m) {
  if (!m.account) return { cls: 'status status--out', label: 'No account yet', hint: 'Access starts when they sign up with this email and verify it.' }
  if (m.account.disabled) return { cls: 'status status--bad', label: 'Account disabled', hint: '' }
  if (!m.account.verified) return { cls: 'status status--out', label: 'Email not verified', hint: 'They must click the link in the verification email first.' }
  return { cls: 'status status--in', label: 'Active', hint: m.account.lastSignIn ? `Last signed in ${since(m.account.lastSignIn)}` : '' }
}

export default function Staff() {
  const dialog = useDialog()
  const { user } = useAuth()
  const me = (user?.email || '').toLowerCase()
  const [members, setMembers] = useState(null)
  const [loadErr, setLoadErr] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('frontdesk')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState(null)

  const load = useCallback(async () => {
    setLoadErr('')
    try {
      const { data } = await api.listStaff()
      setMembers(data.members)
    } catch (e) {
      setLoadErr(friendlyError(e))
    }
  }, [])
  useEffect(() => { load() }, [load])

  const add = async (e) => {
    e.preventDefault()
    setBusy(true)
    setMsg(null)
    try {
      const { data } = await api.addStaff(email.trim(), role)
      setMsg({ ok: true, text: data.hasAccount
        ? `${data.email} now has ${roleLabel(data.role)} access. They may need to sign out and back in once.`
        : `${data.email} added as ${roleLabel(data.role)}. Access starts when they sign up with this email and verify it.` })
      setEmail('')
      load()
    } catch (e2) {
      setMsg({ ok: false, text: friendlyError(e2) })
    }
    setBusy(false)
  }

  const changeRole = async (m, next) => {
    if (next === m.role) return
    const warn = next === 'frontdesk' ? ' They will be signed out and must sign in again.' : ' They may need to sign out and back in once.'
    if (!(await dialog.confirm({ title: `Make ${m.email} ${roleLabel(next)}?`, message: warn.trim(), confirmLabel: `Change to ${roleLabel(next)}` }))) return
    setMsg(null)
    try {
      await api.setStaffRole(m.email, next)
      setMsg({ ok: true, text: `${m.email} is now ${roleLabel(next)}.` })
      load()
    } catch (e) {
      setMsg({ ok: false, text: friendlyError(e) })
    }
  }

  const remove = async (m) => {
    if (!(await dialog.confirm({ title: 'Remove dashboard access?', message: `${m.email} is signed out on every device straight away. You can add them again later.`, confirmLabel: 'Remove access', danger: true }))) return
    setMsg(null)
    try {
      await api.removeStaff(m.email)
      setMsg({ ok: true, text: `${m.email} no longer has dashboard access.` })
      load()
    } catch (e) {
      setMsg({ ok: false, text: friendlyError(e) })
    }
  }

  const owners = members?.filter((m) => m.owner) ?? []
  const staff = members?.filter((m) => !m.owner) ?? []

  return (
    <>
      <div className="admin-head">
        <div>
          <span className="eyebrow">Settings</span>
          <h1>Staff</h1>
          <p>Who can open this dashboard. Front desk sees day-to-day work only; Admins see everything, including prices, reports and this page.</p>
        </div>
        <Link to="/admin/activity" className="btn btn-outline btn-sm"><History size={16} /> Activity log</Link>
      </div>

      <div className="admin-grid">
        <form className="admin-card admin-card--5 room-editor staff-add" onSubmit={add} noValidate>
          <h3><UserPlus size={18} /> Add staff</h3>
          <p className="muted small">Enter their email. They sign in on the website with it (email + password or Google) and land on the dashboard.</p>
          <label className="field"><span>Email</span>
            <div className="input-wrap"><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="frontdesk@example.com" maxLength={254} autoComplete="off" /></div>
          </label>
          <fieldset className="role-pick">
            <legend>Role</legend>
            {ROLES.map(({ value, label, icon: Icon, sub }) => (
              <label key={value} className={`role-opt ${role === value ? 'is-on' : ''}`}>
                <input type="radio" name="role" value={value} checked={role === value} onChange={() => setRole(value)} />
                <Icon size={20} />
                <span><strong>{label}</strong><small>{sub}</small></span>
              </label>
            ))}
          </fieldset>
          {msg && <p className={`auth-msg ${msg.ok ? '' : 'auth-msg--err'}`} role="status">{msg.text}</p>}
          <button className="btn btn-gold btn-block" disabled={busy || !email.includes('@')}>
            {busy ? <span className="spinner spinner--sm" /> : <UserPlus size={17} />} Give access
          </button>
          <ul className="staff-notes">
            <li><ShieldCheck size={15} /> Only verified emails get in, so nobody can claim someone else's address.</li>
            <li><Trash2 size={15} /> Removing someone signs them out on every device immediately.</li>
            <li><History size={15} /> Every change here is written to the activity log.</li>
          </ul>
        </form>

        <section className="admin-card admin-card--7">
          <div className="admin-card-head">
            <div>
              <h3>People with access</h3>
              <p className="muted small">{members ? `${members.length} ${members.length === 1 ? 'person' : 'people'}` : 'Loading…'}</p>
            </div>
            <button className="icon-btn" onClick={load} title="Refresh" aria-label="Refresh"><RefreshCw size={15} /></button>
          </div>
          {loadErr ? <p className="auth-msg auth-msg--err">{loadErr}</p> : !members ? <p className="muted small">Loading…</p> : (
            <ul className="staff-list">
              {[...owners, ...staff].map((m) => {
                const st = accountState(m)
                return (
                  <li key={m.email} className="staff-row">
                    <Person name={m.name || m.email.split('@')[0]} detail={m.email} />
                    <div className="staff-meta">
                      <span className="staff-role">
                        {m.owner ? <><Crown size={13} /> Owner · Admin</> : m.email === me ? roleLabel(m.role) : (
                          <select className="role-select" value={m.role} onChange={(e) => changeRole(m, e.target.value)} aria-label={`Role for ${m.email}`}>
                            {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                          </select>
                        )}
                        {m.email === me && <span className="staff-you">You</span>}
                      </span>
                      <small>{m.owner ? 'Set in server settings (ADMIN_EMAILS)' : `Added by ${m.addedBy || 'staff'}${m.addedAt ? `, ${since(m.addedAt)}` : ''}`}</small>
                    </div>
                    <div className="staff-state">
                      <span className={st.cls}>{st.label}</span>
                      {st.hint && <small>{!m.account || !m.account.verified ? <MailWarning size={12} /> : <Clock size={12} />} {st.hint}</small>}
                    </div>
                    {m.owner || m.email === me ? <span className="staff-lock" title={m.owner ? 'Owners are changed in the server settings' : "You can't remove yourself"} /> : (
                      <button className="icon-btn" title={`Remove ${m.email}`} aria-label={`Remove ${m.email}`} onClick={() => remove(m)}><Trash2 size={15} /></button>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      </div>
    </>
  )
}
