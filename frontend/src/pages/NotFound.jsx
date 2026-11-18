import { Link } from 'react-router-dom'
import { Compass } from 'lucide-react'

export default function NotFound() {
  return (
    <section className="section notfound">
      <div className="container empty">
        <Compass size={52} />
        <h1>Page not found</h1>
        <p className="muted">Looks like you have drifted off course. Let us take you back.</p>
        <Link to="/" className="btn btn-gold">Back to Home</Link>
      </div>
    </section>
  )
}
