import { useState, type FormEvent } from 'react'
import { AuthError, type LoginCredentials } from './auth'
import { Button, Card, Input } from './components/ui'

type LoginPageProps = {
  onLogin: (credentials: LoginCredentials) => Promise<void>
}

type InvalidFields = {
  email: boolean
  password: boolean
}

function BrandMark() {
  return (
    <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-primary text-white shadow-sm">
      <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="size-6">
        <path d="M12 4.5v15M4.5 12h15" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      </svg>
    </span>
  )
}

function EyeIcon({ hidden }: { hidden: boolean }) {
  return hidden ? (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="size-5">
      <path d="M3 3l18 18M10.6 10.6a2 2 0 0 0 2.8 2.8" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M9.9 5.2A10.7 10.7 0 0 1 12 5c5.2 0 8.5 4.8 9.2 6-.3.6-1.4 2.2-3.2 3.7M6.2 6.2C4.3 7.4 3.2 9.1 2.8 10c.7 1.2 4 6 9.2 6 1 0 1.9-.2 2.7-.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ) : (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="size-5">
      <path d="M2.8 12s3.3-6 9.2-6 9.2 6 9.2 6-3.3 6-9.2 6-9.2-6-9.2-6Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      <circle cx="12" cy="12" r="2.6" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  )
}

export default function LoginPage({ onLogin }: LoginPageProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [invalidFields, setInvalidFields] = useState<InvalidFields>({ email: false, password: false })

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (isLoading) return
    setError('')

    const normalizedEmail = email.trim()
    if (!normalizedEmail || !password) {
      setInvalidFields({ email: !normalizedEmail, password: !password })
      setError('Enter your email and password.')
      return
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      setInvalidFields({ email: true, password: false })
      setError('Enter a valid email address.')
      return
    }

    setInvalidFields({ email: false, password: false })
    setIsLoading(true)
    try {
      await onLogin({ email: normalizedEmail, password })
    } catch (error) {
      setError(error instanceof AuthError ? error.message : 'Unable to sign in right now. Please try again later.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-background text-text">
      <div className="mx-auto grid min-h-screen w-full max-w-7xl items-center gap-8 px-5 py-8 sm:px-8 lg:grid-cols-[1fr_0.92fr] lg:gap-16 lg:px-12 lg:py-12">
        <section className="hidden min-h-[640px] flex-col justify-between overflow-hidden rounded-[28px] bg-primary px-10 py-10 text-white lg:flex xl:px-14 xl:py-12" aria-label="About SchoolHealth">
          <a href="/home" className="flex w-fit items-center gap-3 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-4 focus-visible:ring-offset-primary">
            <BrandMark />
            <span className="font-display text-xl font-extrabold tracking-[-0.04em]">schoolhealth</span>
          </a>

          <div className="relative z-10 max-w-lg py-12">
            <p className="mb-5 text-sm font-semibold uppercase tracking-[0.16em] text-teal-100">School health, connected</p>
            <h1 className="font-display text-4xl font-semibold leading-tight tracking-[-0.04em] xl:text-5xl">
              A clearer view of every student’s health journey.
            </h1>
            <p className="mt-5 max-w-md text-base leading-7 text-teal-50">
              SchoolHealth brings checkup records and the people who support students into one role-based workspace.
            </p>
            <ul className="mt-8 space-y-4 text-sm text-teal-50">
              <li className="flex items-center gap-3"><span className="grid size-6 place-items-center rounded-full bg-white/15" aria-hidden="true">✓</span> Checkup records in one place</li>
              <li className="flex items-center gap-3"><span className="grid size-6 place-items-center rounded-full bg-white/15" aria-hidden="true">✓</span> Separate views for each role</li>
              <li className="flex items-center gap-3"><span className="grid size-6 place-items-center rounded-full bg-white/15" aria-hidden="true">✓</span> School-wide aggregate overview</li>
            </ul>
          </div>

          <div className="rounded-2xl border border-white/20 bg-white/10 p-5 backdrop-blur-sm">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-teal-100">Illustrative preview</p>
                <p className="mt-1 font-semibold">A connected school community</p>
              </div>
              <div className="flex -space-x-2" aria-hidden="true">
                <span className="grid size-10 place-items-center rounded-full border-2 border-primary bg-white text-xs font-bold text-primary">AD</span>
                <span className="grid size-10 place-items-center rounded-full border-2 border-primary bg-teal-100 text-xs font-bold text-primary">NU</span>
                <span className="grid size-10 place-items-center rounded-full border-2 border-primary bg-blue-100 text-xs font-bold text-secondary">PA</span>
              </div>
            </div>
            <p className="mt-3 text-sm leading-6 text-teal-50">Demo visuals use synthetic examples. Access depends on your account role.</p>
          </div>
        </section>

        <section className="mx-auto w-full max-w-[460px]" aria-labelledby="login-title">
          <a href="/" className="mb-7 flex w-fit items-center gap-3 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-4 focus-visible:ring-offset-background lg:hidden">
            <BrandMark />
            <span className="font-display text-xl font-extrabold tracking-[-0.04em]">school<span className="text-primary-strong">health</span></span>
          </a>

          <Card as="div" className="rounded-[24px] p-6 sm:p-9">
            <header className="mb-8">
              <div className="mb-5 inline-flex items-center gap-2 rounded-full bg-primary-soft px-3 py-1.5 text-xs font-semibold text-primary-strong">
                <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" className="size-4"><path d="M10 2.5 4 5v4.4c0 3.6 2.5 6.4 6 8.1 3.5-1.7 6-4.5 6-8.1V5l-6-2.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/><path d="m7.3 9.8 1.8 1.8 3.7-3.8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                Secure access
              </div>
              <h2 id="login-title" className="font-display text-2xl font-semibold tracking-tight sm:text-[28px]">Sign in to SchoolHealth</h2>
              <p className="mt-3 text-sm leading-6 text-muted sm:text-base">Use your school or family account to continue.</p>
            </header>

            <form className="space-y-5" onSubmit={handleSubmit} noValidate aria-busy={isLoading}>
              <div>
                <label htmlFor="login-email" className="mb-2 block text-sm font-semibold text-text">Email</label>
                <Input
                  id="login-email"
                  name="email"
                  type="email"
                  inputMode="email"
                  autoComplete="username"
                  autoCapitalize="none"
                  spellCheck={false}
                  required
                  value={email}
                  onChange={(event) => {
                    setEmail(event.target.value)
                    setError('')
                    setInvalidFields((fields) => ({ ...fields, email: false }))
                  }}
                  placeholder="you@schoolhealth.example"
                  error={invalidFields.email ? 'Check your email address.' : undefined}
                  className="h-12"
                />
              </div>

              <div>
                <label htmlFor="login-password" className="mb-2 block text-sm font-semibold text-text">Password</label>
                <div className="relative">
                  <Input
                    id="login-password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(event) => {
                      setPassword(event.target.value)
                      setError('')
                      setInvalidFields((fields) => ({ ...fields, password: false }))
                    }}
                    placeholder="Enter your password"
                    error={invalidFields.password ? 'Enter your password.' : undefined}
                    className="h-12 pr-12"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((visible) => !visible)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    aria-pressed={showPassword}
                    className="absolute inset-y-0 right-0 grid w-12 cursor-pointer place-items-center rounded-r-control text-subtle transition hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
                  >
                    <EyeIcon hidden={showPassword} />
                  </button>
                </div>
              </div>

              {error && <p id="login-error" role="alert" aria-live="assertive" className="rounded-control border border-rose-200 bg-rose-50 px-4 py-3 text-sm leading-5 text-rose-800">{error}</p>}

              <Button type="submit" size="lg" className="w-full" loading={isLoading} loadingLabel="Signing in…">
                Sign in
              </Button>
            </form>

            <p className="mt-7 text-sm leading-6 text-muted">For administrators, school nurses, and parents.</p>
          </Card>

          <p className="mt-6 text-center text-xs leading-5 text-subtle">SchoolHealth · School health management</p>
        </section>
      </div>
    </main>
  )
}
