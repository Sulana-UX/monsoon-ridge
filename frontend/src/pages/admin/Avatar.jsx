/** Initials avatar; the tint is picked from the name so a guest always gets the same one. */
export const initialsOf = (name = '') =>
  name.split(/[\s@.]+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('') || '?'

const toneOf = (name = '') => [...name].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7) % 4

export default function Avatar({ name }) {
  return <span className={`avatar-sm tone-${toneOf(name)}`} aria-hidden="true">{initialsOf(name)}</span>
}

/** Avatar + name + one line of detail */
export function Person({ name, detail, children }) {
  return (
    <div className="person">
      <Avatar name={name} />
      <div>
        <strong>{name}</strong>
        {detail && <small>{detail}</small>}
        {children}
      </div>
    </div>
  )
}
