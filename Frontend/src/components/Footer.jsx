import { Link } from 'react-router-dom';
import { Brand } from './Brand';
export function Footer() {
    return (<footer className="footer">
      <div className="container footer__main">
        <div><Brand light/><p>Safer commutes. Smarter campus.<br />Built for Indus University.</p></div>
        <div><strong>Explore</strong><a href="#features">Features</a><a href="#operations">Operations</a><a href="#safety">Safety & privacy</a><Link to="/help">Help center</Link></div>
        <div><strong>Get started</strong><Link to="/track">Track my bus</Link><Link to="/signup">Create student account</Link><Link to="/login">Sign in to a portal</Link><a href="mailto:transport@indusuni.ac.in">Contact transport office</a></div>
      </div>
      <div className="container footer__bottom"><span>© 2026 SmartTransit at Indus University</span><Link to="/privacy">Privacy</Link></div>
    </footer>);
}
