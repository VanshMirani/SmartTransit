import { BusFront } from 'lucide-react';
import { Link } from 'react-router-dom';
export function Brand({ light = false }) {
    return (<Link className={`brand ${light ? 'brand--light' : ''}`} to="/" aria-label="SmartTransit home">
      <span className="brand__mark"><BusFront aria-hidden="true"/></span>
      <span>Smart<span>Transit</span></span>
    </Link>);
}

export function BrandLogo({ className = "" }) {
    return (<img className={`brand-logo ${className}`.trim()} src="/brand/smarttransit-indus-logo.jpeg" alt="SmartTransit logo with Indus University branding" decoding="async"/>);
}
