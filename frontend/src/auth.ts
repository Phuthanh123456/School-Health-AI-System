export type UserRole = 'admin' | 'nurse' | 'parent'

export type AuthenticatedUser = {
  id: string
  email: string
  role: UserRole
}

type LoginResponse = {
  access_token: string
  token_type: 'bearer'
  expires_in: number
  user: AuthenticatedUser
}

type StoredSession = {
  accessToken: string
  expiresAt: number
}

export type RestoredSession = {
  user: AuthenticatedUser
  expiresAt: number
}

export type LoginCredentials = {
  email: string
  password: string
}

export class AuthError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AuthError'
  }
}

export const roleLandingPaths: Record<UserRole, string> = {
  admin: '/admin',
  nurse: '/nurse',
  parent: '/parent',
}

const api = (import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000').replace(/\/$/, '')
const sessionKey = 'schoolhealth.auth-session'

function isUserRole(value: unknown): value is UserRole {
  return value === 'admin' || value === 'nurse' || value === 'parent'
}

function isAuthenticatedUser(value: unknown): value is AuthenticatedUser {
  if (!value || typeof value !== 'object') return false
  const user = value as Partial<AuthenticatedUser>
  return (
    typeof user.id === 'string' &&
    typeof user.email === 'string' &&
    isUserRole(user.role)
  )
}

function isStoredSession(value: unknown): value is StoredSession {
  if (!value || typeof value !== 'object') return false
  const session = value as Partial<StoredSession>
  return (
    typeof session.accessToken === 'string' &&
    session.accessToken.length > 0 &&
    typeof session.expiresAt === 'number' &&
    Number.isFinite(session.expiresAt)
  )
}

function isLoginResponse(value: unknown): value is LoginResponse {
  if (!value || typeof value !== 'object') return false
  const response = value as Partial<LoginResponse>
  return (
    typeof response.access_token === 'string' &&
    response.token_type === 'bearer' &&
    typeof response.expires_in === 'number' &&
    isAuthenticatedUser(response.user)
  )
}

export async function signIn(credentials: LoginCredentials): Promise<AuthenticatedUser> {
  signOut()

  let response: Response
  try {
    response = await fetch(`${api}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(credentials),
    })
  } catch {
    throw new AuthError('Cannot connect to the SchoolHealth sign-in service. Please try again.')
  }

  if (response.status === 401) {
    throw new AuthError('Email or password is incorrect. Please try again.')
  }
  if (response.status === 503) {
    throw new AuthError('The sign-in service is not configured yet. Please contact the project team.')
  }
  if (!response.ok) {
    throw new AuthError('Unable to sign in right now. Please try again later.')
  }

  let result: unknown
  try {
    result = await response.json()
  } catch {
    throw new AuthError('The sign-in service returned an invalid response.')
  }

  if (!isLoginResponse(result)) {
    throw new AuthError('The sign-in service returned an invalid response.')
  }

  sessionStorage.setItem(
    sessionKey,
    JSON.stringify({
      accessToken: result.access_token,
      user: result.user,
      expiresAt: Date.now() + result.expires_in * 1000,
    }),
  )
  return result.user
}

export async function restoreSession(): Promise<RestoredSession | null> {
  let storedValue: string | null
  try {
    storedValue = sessionStorage.getItem(sessionKey)
  } catch {
    signOut()
    return null
  }

  if (!storedValue) return null

  let parsedSession: unknown
  try {
    parsedSession = JSON.parse(storedValue)
  } catch {
    signOut()
    return null
  }

  if (!isStoredSession(parsedSession) || parsedSession.expiresAt <= Date.now()) {
    signOut()
    return null
  }

  let response: Response
  try {
    response = await fetch(`${api}/auth/me`, {
      headers: { Authorization: `Bearer ${parsedSession.accessToken}` },
    })
  } catch {
    throw new AuthError('Cannot connect to the SchoolHealth sign-in service. Please try again.')
  }

  if (response.status === 401) {
    signOut()
    return null
  }
  if (!response.ok) {
    throw new AuthError('Unable to verify your session right now. Please try again.')
  }

  let user: unknown
  try {
    user = await response.json()
  } catch {
    signOut()
    return null
  }

  if (!isAuthenticatedUser(user)) {
    signOut()
    return null
  }
  if (parsedSession.expiresAt <= Date.now()) {
    signOut()
    return null
  }

  return { user, expiresAt: parsedSession.expiresAt }
}

export function signOut(): void {
  try {
    sessionStorage.removeItem(sessionKey)
  } catch {
    // The session may be unavailable in restricted browser contexts.
  }
}

export async function authenticatedFetch(path: string, options: RequestInit = {}): Promise<Response> {
  let value: string | null = null
  try {
    value = sessionStorage.getItem(sessionKey)
  } catch {
    signOut()
  }

  let session: unknown
  try {
    session = value ? JSON.parse(value) : null
  } catch {
    signOut()
  }
  if (!isStoredSession(session) || session.expiresAt <= Date.now()) {
    signOut()
    window.location.assign('/login')
    throw new AuthError('Your session has expired. Please sign in again.')
  }

  const headers = new Headers(options.headers)
  headers.set('Authorization', `Bearer ${session.accessToken}`)
  const response = await fetch(`${api}${path}`, { ...options, headers })
  if (response.status === 401) {
    signOut()
    window.location.assign('/login')
    throw new AuthError('Your session is no longer valid. Please sign in again.')
  }
  return response
}
