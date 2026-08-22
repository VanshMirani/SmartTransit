import { Menu, X } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Brand } from './Brand';
export function PublicHeader() {
    const [open, setOpen] = useState(false);
    const close = () => setOpen(false);
    return (<header className="site-header">
      <div className="container header-inner">
        <Brand light/>
        <button className="menu-button" onClick={() => setOpen(!open)} aria-expanded={open} aria-controls="public-nav" aria-label={open ? 'Close navigation' : 'Open navigation'}>
          {open ? <X /> : <Menu />}
        </button>
        <nav id="public-nav" className={`public-nav ${open ? 'public-nav--open' : ''}`} aria-label="Primary navigation">
          <a href="#features" onClick={close}>Features</a>
          <a href="#operations" onClick={close}>Operations</a>
          <a href="#safety" onClick={close}>Safety</a>
          <a href="#help" onClick={close}>Help</a>
          <Link className="public-signup-link" to="/signup" onClick={close}>Create account</Link>
          <Link className="button button--small button--accent" to="/login" onClick={close}>Sign in</Link>
        </nav>
      </div>
    </header>);
}
