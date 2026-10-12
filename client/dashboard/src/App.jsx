import { useEffect, useState } from "react";
import { Link, NavLink, Route, Routes, useLocation, useNavigate, useParams } from "react-router-dom";

const API = import.meta.env.VITE_API_BASE || "http://localhost:5000";
async function getJson(path) {
  const response = await fetch(`${API}${path}`);
  const json = await response.json();
  if (!response.ok) throw new Error(json?.error?.message || "Request failed");
  return json.data;
}
function fmt(value) { return value ? new Date(value).toLocaleString() : "—"; }
const TOUR_STEPS = [
  {
    title: "Explore sessions",
    description: "Every row represents a browser session. Compare event counts and activity timestamps to understand how visitors use the demo site.",
    selector: '[data-tour="sessions-nav"]',
    path: "/",
  },
  {
    title: "Follow a user journey",
    description: "Open a session to inspect its page views and clicks in chronological order. This is the fastest way to understand an individual visitor's path.",
    selector: '[data-tour="journey-link"]',
    fallback: '[data-tour="sessions-table"]',
    path: "/",
  },
  {
    title: "Explore the click heatmap",
    description: "The heatmap plots recorded click coordinates for a selected page. Use it to see where visitors interacted with the page.",
    selector: '[data-tour="heatmap-nav"]',
    path: "/heatmap",
  },
  {
    title: "Generate your own activity",
    description: "Open the demo website in a new tab, visit a section and click a few elements. Return to Sessions or the heatmap and refresh to inspect the new events.",
    selector: '[data-tour="demo-link"]',
    path: "/heatmap",
  },
];

function ProductTour({ active, stepIndex, setStepIndex, onClose }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [targetRect, setTargetRect] = useState(null);
  const step = TOUR_STEPS[stepIndex];

  useEffect(() => {
    if (!active) return;
    if (location.pathname !== step.path) {
      navigate(step.path);
      return;
    }
    let frame;
    const findTarget = () => {
      const target = document.querySelector(step.selector) || (step.fallback ? document.querySelector(step.fallback) : null);
      if (!target) {
        setTargetRect(null);
        return;
      }
      target.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
      frame = window.requestAnimationFrame(() => {
        const rect = target.getBoundingClientRect();
        setTargetRect({ top: rect.top, left: rect.left, width: rect.width, height: rect.height });
      });
    };
    const timer = window.setTimeout(findTarget, 160);
    const update = () => {
      const target = document.querySelector(step.selector) || (step.fallback ? document.querySelector(step.fallback) : null);
      if (target) {
        const rect = target.getBoundingClientRect();
        setTargetRect({ top: rect.top, left: rect.left, width: rect.width, height: rect.height });
      }
    };
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.clearTimeout(timer);
      if (frame) window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [active, stepIndex, step, location.pathname, navigate]);

  useEffect(() => {
    if (!active) return;
    const onKeyDown = (event) => {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowRight") setStepIndex((index) => Math.min(TOUR_STEPS.length - 1, index + 1));
      if (event.key === "ArrowLeft") setStepIndex((index) => Math.max(0, index - 1));
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [active, onClose, setStepIndex]);

  if (!active) return null;
  const next = () => {
    if (stepIndex === TOUR_STEPS.length - 1) onClose();
    else setStepIndex((index) => index + 1);
  };
  const rect = targetRect;
  const tooltipStyle = rect ? {
    top: Math.min(window.innerHeight - 225, Math.max(16, rect.top + rect.height + 12)),
    left: Math.min(window.innerWidth - 360, Math.max(16, rect.left + Math.min(rect.width / 2, 130) - 130)),
  } : { top: "50%", left: "50%", transform: "translate(-50%, -50%)" };

  return <div className="tour-layer" role="dialog" aria-modal="true" aria-labelledby="tour-title">
    {rect && <div className="tour-spotlight" style={{ top: rect.top - 5, left: rect.left - 5, width: rect.width + 10, height: rect.height + 10 }} />}
    <div className="tour-card" style={tooltipStyle}>
      <div className="tour-card-top"><span>TRACELENS QUICK TOUR</span><button className="tour-close" onClick={onClose} aria-label="Close tour">×</button></div>
      <div className="tour-progress" aria-label={`Step ${stepIndex + 1} of ${TOUR_STEPS.length}`}>
        {TOUR_STEPS.map((item, index) => <span key={item.title} className={index <= stepIndex ? "complete" : ""} />)}
      </div>
      <p className="tour-step-label">STEP {stepIndex + 1} OF {TOUR_STEPS.length}</p>
      <h2 id="tour-title">{step.title}</h2>
      <p className="tour-description">{step.description}</p>
      {stepIndex === TOUR_STEPS.length - 1 && <a className="tour-demo-action" href="http://localhost:5174" target="_blank" rel="noreferrer">Open demo website ↗</a>}
      <div className="tour-actions"><button className="tour-skip" onClick={onClose}>Skip tour</button><div><button className="tour-back" onClick={() => setStepIndex((index) => Math.max(0, index - 1))} disabled={stepIndex === 0}>Back</button><button className="tour-next" onClick={next}>{stepIndex === TOUR_STEPS.length - 1 ? "Finish tour" : "Next →"}</button></div></div>
    </div>
  </div>;
}

function Shell({ children, onStartTour }) {
  return <div className="app-shell"><aside className="sidebar"><div className="brand"><span className="brand-mark">T</span><span>TraceLens<small>PRODUCT ANALYTICS</small></span></div><div className="nav-label">WORKSPACE</div><NavLink data-tour="sessions-nav" to="/" end className={({isActive}) => isActive ? "nav active" : "nav"}>◫ <span>Sessions</span></NavLink><NavLink data-tour="heatmap-nav" to="/heatmap" className={({isActive}) => isActive ? "nav active" : "nav"}>◉ <span>Click heatmap</span></NavLink><div className="sidebar-bottom"><span className="status-dot"/> API-connected analytics<br/><small>Real events · MongoDB</small></div></aside><main className="main"><header className="topbar"><span>Workspace <b>/</b> Analytics</span><div className="topbar-actions"><a data-tour="demo-link" className="demo-shortcut" href="http://localhost:5174" target="_blank" rel="noreferrer">Open demo ↗</a><button className="tour-start" onClick={onStartTour}>▷ Take a tour</button><span className="live-pill"><i/> Event collection</span></div></header><div className="content">{children}</div></main></div>;
}
function Sessions() {
  const [result,setResult] = useState(null), [error,setError] = useState(""), [loading,setLoading] = useState(true), [search,setSearch] = useState("");
  useEffect(() => { getJson("/api/sessions?page=1&limit=100").then(setResult).catch(e=>setError(e.message)).finally(()=>setLoading(false)); }, []);
  const sessions = (result?.items || []).filter(s=>s.session_id.toLowerCase().includes(search.toLowerCase()));
  return <><div className="eyebrow">OVERVIEW</div><div className="page-heading"><div><h1>Sessions</h1><p>Explore visitor activity and understand user journeys.</p></div><button className="refresh" onClick={()=>location.reload()}>↻ Refresh</button></div><div className="stats"><div className="stat"><span>Total sessions</span><strong>{result?.pagination?.total ?? "—"}</strong><small>Recorded browser identifiers</small></div><div className="stat"><span>Sessions on this page</span><strong>{sessions.length}</strong><small>Filtered session records</small></div><div className="stat"><span>Data source</span><strong className="source-value">MongoDB</strong><small>Live API results</small></div></div><section className="panel" data-tour="sessions-table"><div className="panel-heading"><div><h2>Recent sessions</h2><p>Sorted by most recent activity</p></div><input aria-label="Search sessions" placeholder="Search session ID…" value={search} onChange={e=>setSearch(e.target.value)}/></div>{loading ? <div className="state">Loading sessions…</div> : error ? <div className="state error">{error}</div> : !sessions.length ? <div className="state"><div className="empty-icon">⌁</div><h3>No sessions found</h3><p>Visit the demo site and interact with it to generate real analytics.</p><a className="button-link" href="http://localhost:5174" target="_blank" rel="noreferrer">Open demo site ↗</a></div> : <div className="table-wrap"><table><thead><tr><th>SESSION ID</th><th>EVENTS</th><th>FIRST SEEN</th><th>LAST ACTIVITY</th><th/></tr></thead><tbody>{sessions.map(s=><tr key={s.session_id}><td><code>{s.session_id}</code></td><td><span className="count">{s.event_count}</span></td><td>{fmt(s.first_seen)}</td><td>{fmt(s.last_activity)}</td><td><Link data-tour="journey-link" className="view-link" to={`/sessions/${encodeURIComponent(s.session_id)}`}>View journey →</Link></td></tr>)}</tbody></table></div>}</section><p className="footnote">Session IDs are persistent browser identifiers for this assignment, not time-bounded visits.</p></>;
}
function SessionDetail() {
  const {sessionId} = useParams(); const [events,setEvents]=useState([]), [error,setError]=useState(""), [loading,setLoading]=useState(true);
  useEffect(()=>{getJson(`/api/sessions/${encodeURIComponent(sessionId)}/events`).then(d=>setEvents(d.events||[])).catch(e=>setError(e.message)).finally(()=>setLoading(false));},[sessionId]);
  return <><Link className="back-link" to="/">← All sessions</Link><div className="eyebrow">SESSION DETAIL</div><div className="page-heading"><div><h1>User journey</h1><p className="mono">{sessionId}</p></div><span className="count">{events.length} events</span></div><section className="panel" data-tour="journey-timeline"><div className="panel-heading"><div><h2>Event timeline</h2><p>Chronological events recorded by the tracker</p></div></div>{loading?<div className="state">Loading events…</div>:error?<div className="state error">{error}</div>:!events.length?<div className="state">No events recorded for this session.</div>:<div className="timeline">{events.map((e,i)=><div className="timeline-item" key={e._id||`${e.timestamp}-${i}`}><div className={`event-icon ${e.event_type}`}>{e.event_type==="click"?"↖":"◷"}</div><div className="event-body"><div className="event-title">{e.event_type==="page_view"?"Page viewed":"Click recorded"} <span>{fmt(e.timestamp)}</span></div><div className="event-url">{e.page_url}</div>{e.coordinates&&<small>Viewport position: x {e.coordinates.x}, y {e.coordinates.y}</small>}</div></div>)}</div>}</section></>;
}
function Heatmap() {
  const [pages,setPages]=useState([]),[selected,setSelected]=useState(""),[clicks,setClicks]=useState([]),[error,setError]=useState(""),[loading,setLoading]=useState(true);
  useEffect(()=>{getJson("/api/heatmap/pages").then(p=>{setPages(p);if(p[0])setSelected(p[0].page_url);}).catch(e=>setError(e.message)).finally(()=>setLoading(false));},[]);
  useEffect(()=>{if(!selected)return;getJson(`/api/heatmap/clicks?pageUrl=${encodeURIComponent(selected)}`).then(d=>setClicks(d.clicks||[])).catch(e=>setError(e.message));},[selected]);
  return <><div className="eyebrow">BEHAVIOR</div><div className="page-heading"><div><h1>Click heatmap</h1><p>See where visitors clicked on a tracked page.</p></div></div><section className="panel"><div className="panel-heading"><div><h2>Click distribution</h2><p>Coordinates are relative to the viewport at click time.</p></div><select aria-label="Select page URL" value={selected} onChange={e=>setSelected(e.target.value)}><option value="">Select a page</option>{pages.map(p=><option key={p.page_url} value={p.page_url}>{p.page_url}</option>)}</select></div>{loading?<div className="state">Loading pages…</div>:error?<div className="state error">{error}</div>:!selected||!clicks.length?<div className="state"><div className="empty-icon">◎</div><h3>No click data yet</h3><p>Open the demo site, click some elements, then return here.</p><a className="button-link" href="http://localhost:5174" target="_blank" rel="noreferrer">Open demo site ↗</a></div>:<><div className="heatmap-meta"><span>{clicks.length} recorded clicks</span><span>Dots show relative click positions</span></div><div className="heatmap-canvas" aria-label="Click coordinate visualization">{clicks.map((c,i)=><span key={`${c.timestamp}-${i}`} title={`${fmt(c.timestamp)} · x ${c.coordinates.x}, y ${c.coordinates.y}`} className="heat-dot" style={{left:`${Math.min(98,Math.max(1,c.coordinates.x/(c.viewport?.width||window.innerWidth)*100))}%`,top:`${Math.min(98,Math.max(1,c.coordinates.y/(c.viewport?.height||window.innerHeight)*100))}%`,opacity:0.4+0.6*(i<8?1:0.4)}}/>)}</div><p className="footnote">This normalized coordinate canvas is an approximate visualization, not an overlay on the original page. A faithful overlay requires the same page layout and viewport.</p></>}</section></>;
}
export default function App() {
  const [tourActive, setTourActive] = useState(false);
  const [tourStep, setTourStep] = useState(0);
  const startTour = () => { setTourStep(0); setTourActive(true); };
  const closeTour = () => setTourActive(false);
  return <><Shell onStartTour={startTour}><Routes><Route path="/" element={<Sessions/>}/><Route path="/sessions/:sessionId" element={<SessionDetail/>}/><Route path="/heatmap" element={<Heatmap/>}/><Route path="*" element={<div className="state">Page not found. <Link to="/">Return to sessions</Link></div>}/></Routes></Shell><ProductTour active={tourActive} stepIndex={tourStep} setStepIndex={setTourStep} onClose={closeTour}/></>;
}
