import { useEffect, useRef } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';
import { pageMetadata } from '../utils/navigation';

export function NavigationEffects() {
    const location = useLocation();
    const navigationType = useNavigationType();
    const previousPath = useRef(location.pathname);
    useEffect(() => {
        const metadata = pageMetadata(location.pathname);
        document.title = metadata.title;
        let robots = document.querySelector('meta[name="robots"]');
        if (!robots) { robots = document.createElement('meta'); robots.name = 'robots'; document.head.append(robots); }
        robots.content = metadata.robots;
        let canonical = document.querySelector('link[rel="canonical"]');
        if (metadata.canonical) {
            if (!canonical) { canonical = document.createElement('link'); canonical.rel = 'canonical'; document.head.append(canonical); }
            canonical.href = metadata.canonical;
        } else canonical?.remove();
        const changed = previousPath.current !== location.pathname;
        previousPath.current = location.pathname;
        if (!changed || navigationType === 'POP' || location.hash) return;
        window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
        const focusHeading = () => {
            const heading = document.querySelector('main h1, main h2');
            if (!heading) return false;
            heading.tabIndex = -1;
            heading.focus({ preventScroll: true });
            return true;
        };
        if (focusHeading()) return;
        // A lazily loaded route may render its heading after navigation commits.
        const observer = new MutationObserver(() => { if (focusHeading()) observer.disconnect(); });
        observer.observe(document.getElementById('root'), { childList: true, subtree: true });
        return () => observer.disconnect();
    }, [location.pathname, location.hash, navigationType]);
    return null;
}
