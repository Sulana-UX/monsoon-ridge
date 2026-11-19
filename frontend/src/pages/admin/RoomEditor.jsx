import { useEffect, useState } from 'react'
import { Link, useNavigate, useOutletContext, useParams } from 'react-router-dom'
import { ChevronLeft, Save, Trash2, Plus, X, ImageOff, ArrowUp, UploadCloud } from 'lucide-react'
import { uploadRoomPhoto, checkImage } from '../../lib/cloudinary'
import { CATEGORIES } from '../../context/RoomsContext'
import { AMENITIES } from '../../components/Amenity'
import { api, friendlyError } from '../../lib/firebase'
import { formatLKR, priceBreakdown } from '../../utils'
import { useDialog } from '../../components/Dialog'

const EMPTY = {
  name: '', type: 'Double', price: '', guests: 2, units: 1, size: '', beds: '', view: '',
  short: '', description: '', amenities: ['wifi', 'ac'], gallery: [''], featured: false, active: true,
}

// Pick only the fields the form edits
const toForm = (r) => ({
  name: r.name, type: CATEGORIES.includes(r.type) ? r.type : 'Double', price: r.price, guests: r.guests, units: r.units,
  size: r.size, beds: r.beds, view: r.view || '', short: r.short, description: r.description,
  amenities: r.amenities || [], gallery: r.gallery?.length ? r.gallery : [r.image || ''],
  featured: r.featured === true, active: r.active !== false,
})

function Photo({ url }) {
  const [broken, setBroken] = useState(false)
  useEffect(() => setBroken(false), [url])
  if (!/^https:\/\//.test(url)) return <div className="photo-thumb photo-thumb--empty"><ImageOff size={18} /></div>
  return broken
    ? <div className="photo-thumb photo-thumb--empty" title="This link doesn't load as an image"><ImageOff size={18} /></div>
    : <img className="photo-thumb" src={url} alt="" onError={() => setBroken(true)} />
}

/** Remount per room so switching rooms never shows the previous room's form. */
export default function RoomEditorRoute() {
  const { id } = useParams()
  return <RoomEditor key={id || 'new'} id={id} />
}

function RoomEditor({ id }) {
  const dialog = useDialog()
  const isNew = !id
  const { rooms } = useOutletContext()
  const existing = rooms.find((r) => r.id === id)
  const navigate = useNavigate()

  const [form, setForm] = useState(() => (existing ? toForm(existing) : EMPTY))
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState(null) // { type: 'ok' | 'err', text }
  const [uploading, setUploading] = useState(null) // { name, pct }
  const [uploadErr, setUploadErr] = useState('')
  const [dragging, setDragging] = useState(false)

  if (!isNew && !existing) {
    return (
      <div className="empty">
        <h3>Room not found</h3>
        <Link to="/admin/rooms" className="btn btn-outline">Back to rooms</Link>
      </div>
    )
  }

  const set = (k) => (e) => {
    const v = e.target.type === 'checkbox' ? e.target.checked : e.target.value
    setForm((f) => ({ ...f, [k]: v }))
  }
  const toggleAmenity = (a) =>
    setForm((f) => ({ ...f, amenities: f.amenities.includes(a) ? f.amenities.filter((x) => x !== a) : [...f.amenities, a] }))
  const setPhoto = (i, v) => setForm((f) => ({ ...f, gallery: f.gallery.map((g, j) => (j === i ? v : g)) }))
  const addPhoto = () => setForm((f) => ({ ...f, gallery: [...f.gallery, ''] }))

  // Upload one or more files to Cloudinary; each link fills the first empty row or is added at the end
  const uploadFiles = async (fileList) => {
    const files = [...(fileList || [])]
    if (!files.length || uploading) return
    setUploadErr('')
    const room = 8 - form.gallery.filter((g) => g.trim()).length
    if (files.length > room) {
      setUploadErr(`You can add ${room} more photo${room === 1 ? '' : 's'} (8 max).`)
      return
    }
    const problem = files.map(checkImage).find(Boolean)
    if (problem) return setUploadErr(problem)

    for (const file of files) {
      setUploading({ name: file.name, pct: 0 })
      try {
        const url = await uploadRoomPhoto(file, (pct) => setUploading({ name: file.name, pct }))
        setForm((f) => {
          const i = f.gallery.findIndex((g) => !g.trim())
          const gallery = i === -1 ? [...f.gallery, url] : f.gallery.map((g, j) => (j === i ? url : g))
          return { ...f, gallery }
        })
      } catch (err) {
        setUploadErr(err.code ? friendlyError(err) : err.message)
        break
      }
    }
    setUploading(null)
  }
  const removePhoto = (i) => setForm((f) => ({ ...f, gallery: f.gallery.filter((_, j) => j !== i) }))
  const makeMain = (i) => setForm((f) => ({ ...f, gallery: [f.gallery[i], ...f.gallery.filter((_, j) => j !== i)] }))

  const payload = () => ({
    ...form,
    name: form.name.trim(),
    price: Number(form.price),
    guests: Number(form.guests),
    units: Number(form.units),
    size: Number(form.size),
    gallery: form.gallery.map((g) => g.trim()).filter(Boolean),
  })

  const save = async (e) => {
    e.preventDefault()
    setBusy(true)
    setMsg(null)
    try {
      if (isNew) {
        await api.createRoom(payload())
        navigate('/admin/rooms', { replace: true, state: { flash: `"${form.name.trim()}" added. It is now on the website.` } })
        return
      } else {
        await api.updateRoom(id, payload())
        setMsg({ type: 'ok', text: 'Changes saved. The website is already updated.' })
      }
    } catch (err) {
      setMsg({ type: 'err', text: friendlyError(err) })
    }
    setBusy(false)
  }

  const remove = async () => {
    if (!(await dialog.confirm({ title: `Delete ${existing.name}?`, message: 'The room type is removed permanently. This cannot be undone.', confirmLabel: 'Delete room', danger: true }))) return
    setBusy(true)
    setMsg(null)
    try {
      await api.deleteRoom(id)
      navigate('/admin/rooms', { replace: true, state: { flash: `"${existing.name}" deleted.` } })
    } catch (err) {
      setMsg({ type: 'err', text: friendlyError(err) })
      setBusy(false)
    }
  }

  const priceChanged = !isNew && Number(form.price) !== existing.price
  const example = Number(form.price) > 0 ? priceBreakdown(Number(form.price), 2).total : 0

  return (
    <form className="room-editor" onSubmit={save} noValidate>
      <Link to="/admin/rooms" className="back-link"><ChevronLeft size={16} /> All rooms</Link>
      <div className="admin-head">
        <div>
          <h1>{isNew ? 'Add room' : form.name || 'Edit room'}</h1>
          {!isNew && <p className="muted">Changes go live on the website as soon as you save.</p>}
        </div>
      </div>

      <div className="editor-grid">
        <div className="editor-main">
          <section className="admin-card">
            <h3>Basics</h3>
            <div className="form-grid">
              <label className="field"><span>Room name</span>
                <div className="input-wrap"><input value={form.name} onChange={set('name')} maxLength={60} placeholder="e.g. Garden Double Room" required /></div>
              </label>
              <label className="field field--half"><span>Category</span>
                <div className="input-wrap">
                  <select value={form.type} onChange={set('type')}>
                    {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                  </select>
                </div>
              </label>
              <label className="field field--half"><span>Beds</span>
                <div className="input-wrap"><input value={form.beds} onChange={set('beds')} maxLength={60} placeholder="e.g. 1 King Bed" /></div>
              </label>
              <label className="field field--half"><span>Max guests</span>
                <div className="input-wrap"><input type="number" min={1} max={12} value={form.guests} onChange={set('guests')} /></div>
              </label>
              <label className="field field--half"><span>Size (m²)</span>
                <div className="input-wrap"><input type="number" min={5} max={2000} value={form.size} onChange={set('size')} placeholder="30" /></div>
              </label>
              <label className="field"><span>View <em>(optional)</em></span>
                <div className="input-wrap"><input value={form.view} onChange={set('view')} maxLength={60} placeholder="e.g. Garden View" /></div>
              </label>
            </div>
          </section>

          <section className="admin-card">
            <h3>Description</h3>
            <div className="form-grid">
              <label className="field"><span>Short description <em>(on room cards, {form.short.length}/140)</em></span>
                <div className="input-wrap"><input value={form.short} onChange={set('short')} maxLength={140} placeholder="One line that sells the room" /></div>
              </label>
              <label className="field"><span>Full description <em>({form.description.length}/2000)</em></span>
                <div className="input-wrap input-wrap--area"><textarea rows={5} value={form.description} onChange={set('description')} maxLength={2000} /></div>
              </label>
            </div>
          </section>

          <section className="admin-card">
            <h3>Photos</h3>
            <p className="muted small">Upload from your computer (saved to Cloudinary) or paste an image link. The first photo is the main one. Up to 8.</p>

            {form.gallery.filter((g) => g.trim()).length < 8 && (
              <label
                className={`upload-zone ${dragging ? 'is-drag' : ''} ${uploading ? 'is-busy' : ''}`}
                onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
                onDragLeave={() => setDragging(false)}
                onDrop={(e) => { e.preventDefault(); setDragging(false); uploadFiles(e.dataTransfer.files) }}
              >
                <input type="file" accept="image/jpeg,image/png,image/webp,image/avif" multiple disabled={!!uploading}
                  onChange={(e) => { uploadFiles(e.target.files); e.target.value = '' }} />
                {uploading ? (
                  <><span className="spinner" /> <span>Uploading {uploading.name}… {uploading.pct}%</span>
                    <span className="upload-bar"><span style={{ width: `${uploading.pct}%` }} /></span></>
                ) : (
                  <><UploadCloud size={26} /><strong>Upload photos</strong><small>Click or drag images here · JPG, PNG, WebP · max 8 MB each</small></>
                )}
              </label>
            )}
            {uploadErr && <p className="auth-msg auth-msg--err" role="alert">{uploadErr}</p>}

            <div className="photo-list">
              {form.gallery.map((g, i) => (
                <div key={i} className="photo-row">
                  <Photo url={g.trim()} />
                  <div className="input-wrap"><input value={g} onChange={(e) => setPhoto(i, e.target.value)} placeholder="https://images.unsplash.com/…" maxLength={600} /></div>
                  {i === 0 ? <span className="photo-main">Main</span> : (
                    <button type="button" className="icon-btn" title="Make main photo" onClick={() => makeMain(i)}><ArrowUp size={16} /></button>
                  )}
                  {form.gallery.length > 1 && (
                    <button type="button" className="icon-btn" title="Remove photo" onClick={() => removePhoto(i)}><X size={16} /></button>
                  )}
                </div>
              ))}
            </div>
            {form.gallery.length < 8 && (
              <button type="button" className="btn btn-outline btn-sm" onClick={addPhoto}><Plus size={15} /> Add photo link</button>
            )}
          </section>

          <section className="admin-card">
            <h3>Amenities</h3>
            <div className="amenity-picker">
              {Object.entries(AMENITIES).map(([key, { icon: Icon, label }]) => (
                <label key={key} className={`amenity-opt ${form.amenities.includes(key) ? 'is-on' : ''}`}>
                  <input type="checkbox" checked={form.amenities.includes(key)} onChange={() => toggleAmenity(key)} />
                  <Icon size={16} /> {label}
                </label>
              ))}
            </div>
          </section>
        </div>

        <aside className="editor-side">
          <section className="admin-card">
            <h3>Price & availability</h3>
            <div className="form-grid">
              <label className="field"><span>Price per night (LKR)</span>
                <div className="input-wrap"><input type="number" min={1000} step={500} value={form.price} onChange={set('price')} placeholder="18500" /></div>
                {example > 0 && <small className="hint">Base rate: guest pays {formatLKR(example)} for 2 nights incl. service & tax. Season and weekend prices are added on top (Pricing tab).</small>}
              </label>
              <label className="field"><span>Number of rooms of this type</span>
                <div className="input-wrap"><input type="number" min={0} max={200} value={form.units} onChange={set('units')} /></div>
                <small className="hint">0 = can't be booked, still shown</small>
              </label>
            </div>
            {priceChanged && (
              <p className="auth-msg">Existing bookings keep the price they were booked at ({formatLKR(existing.price)}). The new price applies to new bookings only.</p>
            )}
          </section>

          <section className="admin-card">
            <h3>Visibility</h3>
            <label className="switch-row">
              <input type="checkbox" checked={form.active} onChange={set('active')} />
              <span><strong>Show on website</strong><small>Turn off to hide the room from guests</small></span>
            </label>
            <label className="switch-row">
              <input type="checkbox" checked={form.featured} onChange={set('featured')} />
              <span><strong>Featured on home page</strong><small>Shown in "Our rooms" on the home page</small></span>
            </label>
          </section>

          {msg && <p className={`auth-msg ${msg.type === 'err' ? 'auth-msg--err' : ''}`} role="status">{msg.text}</p>}

          <button type="submit" className="btn btn-gold btn-block" disabled={busy || !!uploading}>
            {busy ? <span className="spinner spinner--sm" /> : <Save size={17} />} {isNew ? 'Add room' : 'Save changes'}
          </button>
          {!isNew && (
            <button type="button" className="btn btn-block btn-danger-outline" onClick={remove} disabled={busy}>
              <Trash2 size={16} /> Delete room
            </button>
          )}
        </aside>
      </div>
    </form>
  )
}
