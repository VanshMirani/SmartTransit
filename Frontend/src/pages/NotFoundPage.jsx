import { ArrowLeft, SearchX } from "lucide-react";
import { Link } from "react-router-dom";
import { Brand } from "../components/Brand";
export function NotFoundPage() {
    return (<main className="not-found-page">
      <Brand light/>
      <section>
        <span>
          <SearchX />
        </span>
        <small>404 · Route not found</small>
        <h1>This stop is not on our route.</h1>
        <p>The page may have moved, or your link may be incorrect.</p>
        <div>
          <Link className="button button--primary" to="/">
            <ArrowLeft /> Public homepage
          </Link>
          <Link className="button button--secondary" to="/login">
            Sign in
          </Link>
        </div>
      </section>
    </main>);
}
