import { ArrowLeft, CheckCircle2 } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { AdminPageHeading } from "../../components/admin/AdminUI";
import { ApplicationStatePanel, applicationStatePresets, } from "../../components/system/ApplicationStatePanel";
export function AdminSystemStatesPage() {
    const [selected, setSelected] = useState("offline");
    const [actionComplete, setActionComplete] = useState(false);
    const entries = Object.entries(applicationStatePresets);
    return (<div>
      <AdminPageHeading eyebrow="System states" title="Application state library" description="Reusable, accessible feedback for every critical transport scenario." actions={<Link className="button button--secondary" to="/admin/settings">
            <ArrowLeft /> Back to settings
          </Link>}/>
      <div className="state-library-layout">
        <nav className="state-library-picker" aria-label="Application state previews">
          {entries.map(([kind, preset]) => (<button key={kind} aria-pressed={selected === kind} onClick={() => {
                setSelected(kind);
                setActionComplete(false);
            }}>
              <span>{preset.label}</span>
              <small>{preset.tone}</small>
            </button>))}
        </nav>
        <section className="state-library-preview">
          <div className="state-library-preview__header">
            <span>Live component preview</span>
            <strong>{applicationStatePresets[selected].label}</strong>
          </div>
          {actionComplete && (<div className="state-action-feedback" role="status">
              <CheckCircle2 /> Preview action completed.
            </div>)}
          <ApplicationStatePanel kind={selected} onAction={() => setActionComplete(true)}/>
        </section>
      </div>
    </div>);
}
