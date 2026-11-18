import { Link } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import Reveal from './Reveal'

export default function PageHeader({ title, subtitle, image, crumb }) {
  return (
    <section className="page-header" style={{ backgroundImage: `url(${image})` }}>
      <div className="page-header-overlay" />
      <div className="container page-header-content">
        <Reveal className="crumbs">
          <Link to="/">Home</Link> <ChevronRight size={14} /> <span>{crumb || title}</span>
        </Reveal>
        <Reveal delay={120}><h1>{title}</h1></Reveal>
        {subtitle && <Reveal delay={240}><p>{subtitle}</p></Reveal>}
      </div>
    </section>
  )
}
