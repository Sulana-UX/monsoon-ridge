import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { AlertTriangle, HelpCircle, Info, Wrench, X } from 'lucide-react'

/*
 * Site-styled replacements for window.confirm / window.prompt / window.alert.
 *
 *   const dialog = useDialog()
 *   if (!(await dialog.confirm({ title: 'Cancel booking?', message: '…', confirmLabel: 'Cancel booking', danger: true }))) return
 *   const note = await dialog.prompt({ title: 'Out of order', label: 'Reason', suggestions: ['AC repair'] })  // null = cancelled
 *   await dialog.alert({ title: "Couldn't cancel", message: err })
 *
 * Esc / backdrop / ✕ = cancel, Enter = confirm. Focus goes into the dialog and back afterwards.
 */
const DialogContext = createContext(null)

export function DialogProvider({ children }) {
  const [dlg, setDlg] = useState(null) // { kind, opts, resolve }

  const open = useCallback((kind, opts) => new Promise((resolve) => setDlg({ kind, opts: opts || {}, resolve })), [])
  const api = useRef({
    confirm: (opts) => open('confirm', typeof opts === 'string' ? { message: opts } : opts),
    prompt: (opts) => open('prompt', typeof opts === 'string' ? { message: opts } : opts),
    alert: (opts) => open('alert', typeof opts === 'string' ? { message: opts } : opts),
  }).current

  const close = (value) => {
    dlg?.resolve(value)
    setDlg(null)
  }

  return (
    <DialogContext.Provider value={api}>
      {children}
      {dlg && <DialogBox {...dlg} onClose={close} />}
    </DialogContext.Provider>
  )
}

export const useDialog = () => useContext(DialogContext)

function DialogBox({ kind, opts, onClose }) {
  const {
    title, message, confirmLabel, cancelLabel = 'Cancel', danger = false, icon,
    label, placeholder, defaultValue = '', required = false, maxLength = 200, suggestions = [],
  } = opts
  const [value, setValue] = useState(defaultValue)
  const boxRef = useRef(null)
  const inputRef = useRef(null)
  const okRef = useRef(null)
  const back = useRef(document.activeElement)

  const cancelValue = kind === 'confirm' ? false : kind === 'prompt' ? null : undefined
  const okValue = () => (kind === 'confirm' ? true : kind === 'prompt' ? value.trim() : undefined)
  const blocked = kind === 'prompt' && required && !value.trim()

  useEffect(() => {
    const prev = back.current
    ;(inputRef.current || okRef.current)?.focus()
    const onKey = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); onClose(cancelValue) }
      // keep Tab inside the dialog
      if (e.key === 'Tab' && boxRef.current) {
        const f = boxRef.current.querySelectorAll('button:not(:disabled), input, [tabindex="0"]')
        if (!f.length) return
        const first = f[0], last = f[f.length - 1]
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
      }
    }
    document.addEventListener('keydown', onKey)
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = overflow
      prev?.focus?.()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const Icon = icon || (danger ? AlertTriangle : kind === 'prompt' ? Wrench : kind === 'alert' ? Info : HelpCircle)
  const submit = (e) => {
    e.preventDefault()
    if (!blocked) onClose(okValue())
  }

  return (
    <div className="dlg-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(cancelValue) }}>
      <form ref={boxRef} className={`dlg ${danger ? 'dlg--danger' : ''}`} role={kind === 'alert' ? 'alertdialog' : 'dialog'}
        aria-modal="true" aria-labelledby="dlg-title" aria-describedby={message ? 'dlg-msg' : undefined} onSubmit={submit}>
        <button type="button" className="dlg-x" aria-label="Close" onClick={() => onClose(cancelValue)}><X size={18} /></button>
        <span className="dlg-icon"><Icon size={22} /></span>
        <h2 id="dlg-title">{title || (kind === 'confirm' ? 'Are you sure?' : kind === 'prompt' ? 'Enter a value' : 'Notice')}</h2>
        {message && <p id="dlg-msg" className="dlg-msg">{message}</p>}

        {kind === 'prompt' && (
          <>
            <label className="dlg-field">
              {label && <span>{label}</span>}
              <input ref={inputRef} value={value} maxLength={maxLength} placeholder={placeholder} onChange={(e) => setValue(e.target.value)} />
            </label>
            {suggestions.length > 0 && (
              <div className="dlg-chips" aria-label="Suggestions">
                {suggestions.map((s) => (
                  <button key={s} type="button" className={`dlg-chip ${value === s ? 'is-on' : ''}`} onClick={() => { setValue(s); inputRef.current?.focus() }}>{s}</button>
                ))}
              </div>
            )}
          </>
        )}

        <div className="dlg-actions">
          {kind !== 'alert' && <button type="button" className="btn btn-outline" onClick={() => onClose(cancelValue)}>{cancelLabel}</button>}
          <button ref={okRef} type="submit" className={`btn ${danger ? 'btn-danger' : 'btn-gold'}`} disabled={blocked}>
            {confirmLabel || (kind === 'alert' ? 'OK' : kind === 'prompt' ? 'Save' : 'Yes, continue')}
          </button>
        </div>
      </form>
    </div>
  )
}
