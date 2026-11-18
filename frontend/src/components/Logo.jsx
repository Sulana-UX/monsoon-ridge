export default function Logo({ light = false }) {
  return (
    <span className={`logo ${light ? 'logo--light' : ''}`}>
      <svg viewBox="0 0 64 64" width="38" height="38" aria-hidden="true">
        <rect width="64" height="64" rx="16" className="logo-mark" />
        {/* mountain ridge with monsoon rain */}
        <path d="M10 46 L24 26 L31 35 L39 22 L54 46" stroke="#d4a857" strokeWidth="4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M22 14v5M32 11v5M42 14v5" stroke="#d4a857" strokeWidth="3" strokeLinecap="round" opacity=".55" />
      </svg>
      <span className="logo-text">
        <strong>Monsoon Ridge</strong>
        <small>Jungle Resort &amp; Spa</small>
      </span>
    </span>
  )
}
