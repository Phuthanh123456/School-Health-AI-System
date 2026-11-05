import { useEffect, useRef, useState } from 'react'
import { Dialog } from './components/ui'
import './LandingPage.css'

const navigation = [
  ['Home', 'home'], ['Features', 'features'], ['How It Works', 'how-it-works'],
  ['Who We Serve', 'who-we-serve'], ['About', 'about'],
] as const

const solutions = [
  { icon: 'record', title: 'Student Health Records', text: 'Organize student profiles, allergies, medical notes and recorded health information in one authorized workspace.', target: 'student-care' },
  { icon: 'checkup', title: 'School Health Checkups', text: 'Select an existing checkup session, find participating students and record or update their examination results.', target: 'nurse-workflows' },
  { icon: 'family', title: 'Family Health Monitoring', text: 'Give parents a dedicated view of their linked children’s health summaries and saved checkup history.', target: 'family-care' },
  { icon: 'school', title: 'School Health Administration', text: 'Look up student health records, filter by class and manage existing Parent and Nurse assignments.', target: 'who-we-serve' },
  { icon: 'insight', title: 'AI-Assisted Health Insights', text: 'Help Admin users understand current school-wide aggregate counts with an optional informational AI summary.', target: 'school-insights' },
]

const benefits = [
  ['record', 'Spend Less Time Managing Records', 'Bring profiles and saved checkup information together so staff can find the records they are authorized to use.'],
  ['checkup', 'Organize School Checkup Results', 'Keep height, weight, vision and notes connected to the right student and checkup session.'],
  ['family', 'Keep Families Better Informed', 'Let parents review the latest recorded measurements and checkup history for their linked children.'],
  ['insight', 'Understand School Health Data', 'Review stored student totals, completed checkup records and the distribution of Nurse-selected statuses.'],
  ['people', 'Support Coordinated Follow-up', 'Keep the recorded follow-up status visible to the people with authorized access to a student’s information.'],
] as const

function Icon({ name }: { name: string }) {
  return <svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.45" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {name === 'record' && <><path d="M10 5h13l4 4v19H8a3 3 0 0 1-3-3V9a4 4 0 0 1 4-4Z"/><path d="M22 5v5h5M11 15h10M11 20h10M11 25h5M16 2v6"/></>}
    {name === 'checkup' && <><rect x="5" y="6" width="22" height="23" rx="2"/><path d="M11 3v6M21 3v6M5 13h22m-15 8 3 3 6-7"/></>}
    {name === 'family' && <><circle cx="12" cy="10" r="4"/><circle cx="24" cy="15" r="3"/><path d="M3 28v-3a9 9 0 0 1 18 0v3H3Zm20-7h1a6 6 0 0 1 6 6v1h-6"/></>}
    {name === 'school' && <><path d="M3 29h26M7 29V12l9-8 9 8v17M2 15h5m18 0h5M13 29v-8h6v8M12 14h8M16 2v5"/></>}
    {name === 'insight' && <><rect x="3" y="5" width="26" height="20" rx="2"/><path d="M10 29h12M16 25v4M8 20v-5m8 5V10m8 10v-8M7 10h3"/></>}
    {name === 'people' && <><circle cx="16" cy="9" r="4"/><path d="M7 27v-4a9 9 0 0 1 18 0v4M4 9a3 3 0 0 1 0 6M2 20v5m26-16a3 3 0 0 0 0 6m2 5v5"/></>}
  </svg>
}

function Arrow() {
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none"><path d="M4 12h15m-6-6 6 6-6 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
}

function Brand({ footer = false }: { footer?: boolean }) {
  return <a className={`landing-brand${footer ? ' landing-brand--footer' : ''}`} href="#home" aria-label="SchoolHealth home">
    <span className="landing-brand-mark" aria-hidden="true"><svg viewBox="0 0 32 32" fill="none"><path d="M16 7v18M7 16h18" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/></svg></span>
    <span>school<span className="landing-brand-accent">health</span><small>CONNECTED SCHOOL CARE</small></span>
  </a>
}

function Photo({ name, alt, hero = false }: { name: string; alt: string; hero?: boolean }) {
  return <img
    src={`/images/landing/${name}-1280.webp`}
    srcSet={`/images/landing/${name}-640.webp 640w, /images/landing/${name}-1280.webp 1280w`}
    sizes="(min-width: 1440px) 560px, (min-width: 768px) 44vw, calc(100vw - 40px)"
    width="1280" height="853" alt={alt} loading={hero ? 'eager' : 'lazy'}
    fetchPriority={hero ? 'high' : 'auto'} decoding="async"
  />
}

export default function LandingPage() {
  const [menuOpen, setMenuOpen] = useState(false)
  const trigger = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const previousTitle = document.title
    const description = document.querySelector<HTMLMetaElement>('meta[name="description"]')
    const previousDescription = description?.content
    document.title = 'SchoolHealth | Connected School Health Management'
    if (description) description.content = 'Connect student health records, school checkups and family access with SchoolHealth.'
    return () => {
      document.title = previousTitle
      if (description && previousDescription !== undefined) description.content = previousDescription
    }
  }, [])

  useEffect(() => {
    const desktop = window.matchMedia('(min-width: 1100px)')
    const closeAtDesktop = () => { if (desktop.matches) setMenuOpen(false) }
    desktop.addEventListener('change', closeAtDesktop)
    return () => desktop.removeEventListener('change', closeAtDesktop)
  }, [])

  function closeMenu() {
    setMenuOpen(false)
    requestAnimationFrame(() => trigger.current?.focus())
  }

  function selectSection(id: string) {
    setMenuOpen(false)
    requestAnimationFrame(() => document.getElementById(id)?.focus({ preventScroll: true }))
  }

  return <div className="schoolhealth-landing">
    <a className="landing-skip" href="#landing-main">Skip to main content</a>
    <div className="landing-utility"><div className="landing-container"><span>Student care. Connected.</span><a href="/login">Existing users <span aria-hidden="true">↗</span></a></div></div>
    <header className="landing-header">
      <div className="landing-container landing-header-inner">
        <Brand />
        <nav aria-label="Public navigation" className="landing-desktop-nav">{navigation.map(([label, id]) => <a key={id} href={`#${id}`}>{label}</a>)}</nav>
        <a className="landing-header-login" href="/login">Login <Arrow /></a>
        <button type="button" className="landing-menu-trigger" onClick={() => setMenuOpen(true)} aria-label="Open public navigation" aria-expanded={menuOpen} aria-haspopup="dialog" ref={trigger}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/></svg>
        </button>
      </div>
    </header>

    <Dialog open={menuOpen} onClose={closeMenu} title="SchoolHealth navigation" closeLabel="Close public navigation" className="landing-menu-dialog">
      <nav aria-label="Mobile public navigation" className="landing-mobile-nav">
        {navigation.map(([label, id]) => <a key={id} href={`#${id}`} onClick={() => selectSection(id)}>{label}<Arrow /></a>)}
        <a href="/login">Login<Arrow /></a>
      </nav>
    </Dialog>

    <main id="landing-main" tabIndex={-1}>
      <section className="landing-hero" id="home" tabIndex={-1} aria-labelledby="landing-title">
        <div className="landing-container">
          <p className="landing-breadcrumb"><span>SchoolHealth</span><span aria-hidden="true">›</span> School Health Management</p>
          <div className="landing-hero-grid">
            <div className="landing-hero-copy">
              <p className="landing-eyebrow">School health management platform</p>
              <h1 id="landing-title">Better Student Care.<br />Smarter School Health Management.</h1>
              <p className="landing-intro">Student health records, school checkups and family access. Connected in one place to help your school deliver better coordinated care.</p>
              <div className="landing-actions"><a className="landing-cta" href="/login">Get Started <Arrow /></a><a className="landing-cta landing-cta--outline" href="#features">Explore Features <Arrow /></a></div>
            </div>
            <figure className="landing-hero-photo"><Photo name="student-care" alt="A healthcare professional listening to a child’s breathing during a checkup" hero /><figcaption>More time for the people who matter.</figcaption></figure>
          </div>
        </div>
      </section>

      <section className="landing-solutions landing-section" id="features" tabIndex={-1} aria-labelledby="solutions-title">
        <div className="landing-container">
          <header className="landing-section-heading"><p className="landing-eyebrow">Connected information. Thoughtful care.</p><h2 id="solutions-title">One Connected Platform<br />for School Health</h2><p>Bring the right information to the right people, from the school health office to the family home.</p></header>
          <div className="landing-solutions-grid">{solutions.map(solution => <article className="landing-solution" key={solution.title}>
            <div className="landing-solution-title"><Icon name={solution.icon} /><h3>{solution.title}</h3></div>
            <p>{solution.text}</p>
            <a href={`#${solution.target}`} className="landing-text-link">Explore this workflow <Arrow /></a>
          </article>)}</div>
        </div>
      </section>

      <section className="landing-benefits landing-section" aria-labelledby="benefits-title">
        <div className="landing-container">
          <header className="landing-section-heading"><p className="landing-eyebrow">Less friction. A clearer picture.</p><h2 id="benefits-title">Simplify School Healthcare.</h2></header>
          <div className="landing-benefits-grid">{benefits.map(([icon, title, text]) => <article key={title}><Icon name={icon} /><h3>{title}</h3><p>{text}</p></article>)}</div>
        </div>
      </section>

      <section className="landing-process landing-section" id="how-it-works" tabIndex={-1} aria-labelledby="process-title">
        <div className="landing-container">
          <header className="landing-section-heading"><p className="landing-eyebrow">How it works</p><h2 id="process-title">A connected workflow.<br />From checkup to follow-up.</h2></header>
          <ol className="landing-process-grid">
            <li><span className="landing-step-number">01</span><h3>Sign in to your workspace</h3><p>Your account role opens the Admin, Nurse or Parent experience with the appropriate access.</p></li>
            <li><span className="landing-step-number">02</span><h3>Keep the record connected</h3><p>School health staff select a session and participating student to save or update checkup results.</p></li>
            <li><span className="landing-step-number">03</span><h3>See the information you need</h3><p>Parents view linked children’s records. Admins review school-wide counts and follow-up statuses.</p></li>
          </ol>
        </div>
      </section>

      <section className="landing-stories landing-section" id="about" tabIndex={-1} aria-labelledby="stories-title">
        <div className="landing-container">
          <header className="landing-section-heading"><p className="landing-eyebrow">Built around student care</p><h2 id="stories-title">Healthy Students, Stronger Schools.</h2></header>
          <article className="landing-story" id="student-care" tabIndex={-1}>
            <figure><Photo name="student-care" alt="A child receiving a checkup in a bright healthcare setting" /></figure>
            <div><p className="landing-eyebrow">The student at the center</p><h3>Health information that stays connected.</h3><p>A student’s health record is part of a bigger story. SchoolHealth brings profiles, recorded measurements and checkup history together so authorized users can see the information available to them.</p><p>A clear record helps school staff and families keep track of what has been documented and where a Nurse has selected a follow-up status.</p><a className="landing-text-link" href="#features">See the connected platform <Arrow /></a></div>
          </article>
          <article className="landing-story landing-story--reverse" id="nurse-workflows" tabIndex={-1}>
            <figure><Photo name="health-professional" alt="A healthcare professional carrying out a child’s examination with a stethoscope" /></figure>
            <div><p className="landing-eyebrow">For school health teams</p><h3>Designed for School Health Professionals.</h3><p>Find a student profile, choose an existing checkup session and record the examination results. Height, weight, calculated BMI, optional vision and notes stay linked to the selected student and session.</p><p>Reopen saved results when an update is needed, and record a Normal or Needs Follow-up status as part of the existing workflow.</p><a className="landing-cta" href="/login">Open your workspace <Arrow /></a></div>
          </article>
          <article className="landing-story" id="family-care" tabIndex={-1}>
            <figure><Photo name="family-learning" alt="A parent supporting her daughter’s learning at a table at home" /></figure>
            <div><p className="landing-eyebrow">A clearer view for parents</p><h3>Connected Care for Families.</h3><p>Give families a dedicated place to review the health information recorded for their linked children, including the latest available measurements, checkup history and recorded follow-up status.</p><p>Each Parent account sees only the children linked to that account. A simple family dashboard makes it easy to switch between children and review their existing records.</p><a className="landing-text-link" href="/login">Sign in to your family dashboard <Arrow /></a></div>
          </article>
        </div>
      </section>

      <section className="landing-roles landing-section" id="who-we-serve" tabIndex={-1} aria-labelledby="roles-title">
        <div className="landing-container">
          <header className="landing-section-heading"><p className="landing-eyebrow">Who we serve</p><h2 id="roles-title">Built for Everyone<br />Supporting Student Health.</h2></header>
          <div className="landing-roles-grid">
            <article><Icon name="school" /><h3>School Administrators</h3><p>Look up authorized student records, manage Parent and Nurse assignments and review school-wide aggregates.</p></article>
            <article><Icon name="checkup" /><h3>School Nurses</h3><p>Manage student profiles, select existing checkup sessions and record or update examination results.</p></article>
            <article><Icon name="family" /><h3>Parents</h3><p>Review linked children’s health summaries, latest recorded measurements and checkup history.</p></article>
          </div>
        </div>
      </section>

      <section className="landing-insights landing-section" id="school-insights" tabIndex={-1} aria-labelledby="insights-title">
        <div className="landing-container landing-insights-inner"><div><p className="landing-eyebrow">A school-wide perspective</p><h2 id="insights-title">Understand the overview.<br />Keep people at the center.</h2></div><div><p>Admin users can review stored student totals, saved checkup records and Nurse-selected status counts, then request an AI summary based on those aggregate counts.</p><p className="landing-scope-note">Only aggregate statistics are sent for AI insights. AI summaries provide general information, not individual diagnoses or treatment advice.</p><a className="landing-text-link" href="/login">Explore your school overview <Arrow /></a></div></div>
      </section>

      <section className="landing-final-cta landing-section" aria-labelledby="final-title"><div className="landing-container"><p className="landing-eyebrow">Connected care starts with a clear view</p><h2 id="final-title">A Healthier School Community<br />Starts Here.</h2><p>Bring student health information and school healthcare workflows together.</p><a className="landing-cta" href="/login">Get Started with SchoolHealth <Arrow /></a></div></section>
    </main>

    <footer className="landing-footer"><div className="landing-container">
      <div className="landing-footer-grid"><div className="landing-footer-brand"><Brand footer /><p>A connected workspace for student records, school checkups and family access.</p><a className="landing-cta" href="/login">Get Started <Arrow /></a></div>
        <div><h2>Explore SchoolHealth</h2><a href="#home">Home</a><a href="#features">Features</a><a href="#how-it-works">How It Works</a></div>
        <div><h2>Who We Serve</h2><a href="#who-we-serve">School Administrators</a><a href="#nurse-workflows">School Nurses</a><a href="#family-care">Parents</a></div>
        <div><h2>Your Workspace</h2><a href="/login">Login</a><a href="#about">About SchoolHealth</a><a href="#school-insights">AI-Assisted Insights</a></div>
      </div>
      <div className="landing-footer-bottom"><span>SchoolHealth AI System</span><span>Student health. Shared understanding.</span></div>
    </div></footer>
  </div>
}
