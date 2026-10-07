import { NavLink } from 'react-router-dom'

const links = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/generate', label: 'Generate Certificates' },
  { to: '/jobs', label: 'Jobs / History' },
  { to: '/templates', label: 'Templates' },
]

export function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark">CH</div>
        <div>
          <strong>CertifyHub</strong>
          <p>Bulk Certificate Generator</p>
        </div>
      </div>
      <nav className="nav">
        {links.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            end={link.end}
            className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
          >
            {link.label}
          </NavLink>
        ))}
        <a className="nav-link" href="/docs" target="_blank" rel="noreferrer">
          API Docs
        </a>
      </nav>
    </aside>
  )
}
