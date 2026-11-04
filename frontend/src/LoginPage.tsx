import { useState, type FormEvent } from 'react'
import { AuthError, type LoginCredentials } from './auth'

type LoginPageProps = {
  onLogin: (credentials: LoginCredentials) => Promise<void>
}

type InvalidFields = {
  email: boolean
  password: boolean
}

function BrandMark() {
  return (
    <span className="grid size-10 place-items-center rounded-2xl bg-primary text-white shadow-sm">
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
    <main className="flex min-h-screen items-center justify-center bg-background px-5 py-10 text-foreground">
      <div className="w-full max-w-[460px]">
        <a href="/home" className="mx-auto mb-7 flex w-fit cursor-pointer items-center gap-3 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-4 focus-visible:ring-offset-background">
          <BrandMark />
          <span className="font-display text-xl font-extrabold tracking-[-0.04em]">
            school<span className="text-primary-strong">health</span>
          </span>
        </a>

        <section aria-labelledby="login-title" className="rounded-[24px] border border-border bg-white p-6 shadow-[0_24px_80px_rgba(12,74,110,0.12)] sm:p-9">
          <header className="mb-8 text-center">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full bg-primary-soft px-3 py-1.5 text-xs font-semibold text-primary-strong">
              <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" className="size-4">
                <path d="M10 2.5 4 5v4.4c0 3.6 2.5 6.4 6 8.1 3.5-1.7 6-4.5 6-8.1V5l-6-2.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
                <path d="m7.3 9.8 1.8 1.8 3.7-3.8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Secure access
            </div>
            <h1 id="login-title" className="font-display text-2xl font-semibold tracking-tight sm:text-[28px]">
              Sign in to SchoolHealth
            </h1>
            <p className="mt-3 text-sm leading-6 text-muted sm:text-base">
              Enter your account details to continue.
            </p>
          </header>

          <form className="space-y-6" onSubmit={handleSubmit} noValidate aria-busy={isLoading}>
            <div>
              <label htmlFor="login-email" className="mb-2.5 block text-sm font-semibold text-foreground">
                Email
              </label>
              <input
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
                aria-invalid={invalidFields.email}
                aria-describedby={invalidFields.email && error ? 'login-error' : undefined}
                className="h-12 w-full rounded-xl border border-slate-300 bg-white px-4 text-base text-foreground outline-none transition placeholder:text-slate-500 focus:border-primary focus:ring-4 focus:ring-primary/15"
              />
            </div>

            <div>
              <label htmlFor="login-password" className="mb-2.5 block text-sm font-semibold text-foreground">
                Password
              </label>
              <div className="relative">
                <input
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
                  aria-invalid={invalidFields.password}
                  aria-describedby={invalidFields.password && error ? 'login-error' : undefined}
                  className="h-12 w-full rounded-xl border border-slate-300 bg-white px-4 pr-12 text-base text-foreground outline-none transition placeholder:text-slate-500 focus:border-primary focus:ring-4 focus:ring-primary/15"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((visible) => !visible)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  aria-pressed={showPassword}
                  className="absolute inset-y-0 right-0 grid w-12 cursor-pointer place-items-center rounded-r-xl text-subtle transition hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
                >
                  <EyeIcon hidden={showPassword} />
                </button>
              </div>
            </div>

            {error && (
              <p id="login-error" role="alert" aria-live="assertive" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm leading-5 text-rose-800">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="flex min-h-12 w-full cursor-pointer items-center justify-center rounded-xl bg-primary px-5 py-3 text-base font-semibold text-white transition hover:bg-primary-strong focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/30 disabled:cursor-wait disabled:opacity-70"
            >
              {isLoading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          <p className="mt-7 text-center text-sm leading-6 text-muted">
            For administrators, school nurses, and parents.
          </p>

        </section>

        <p className="mt-6 text-center text-xs leading-5 text-subtle">
          SchoolHealth · School health management
        </p>
      </div>
    </main>
  )
}
