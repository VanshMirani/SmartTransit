import { Component, Suspense } from 'react';
import { useLocation } from 'react-router-dom';

export class PageLoadBoundary extends Component {
    state = { failed: false };

    static getDerivedStateFromError() {
        return { failed: true };
    }

    render() {
        if (this.state.failed)
            return <section className="placeholder__card" role="alert">
              <h1>This page could not be loaded</h1>
              <p>Check your connection and reload the page. Your saved transport records have not been changed.</p>
              <button className="button button--primary" onClick={() => window.location.reload()}>Reload page</button>
              <a className="text-link" href="/help">Get help</a>
            </section>;
        return this.props.children;
    }
}

export function DeferredPage({ children }) {
    const { pathname } = useLocation();
    return <PageLoadBoundary key={pathname}>
      <Suspense fallback={<p role="status" aria-live="polite">Loading page...</p>}>
        {children}
      </Suspense>
    </PageLoadBoundary>;
}
