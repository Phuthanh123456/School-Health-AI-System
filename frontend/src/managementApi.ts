import { getAccessToken, signOut } from './auth'

export function dateText(value: string) {
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(value))
}

export type AccountRef = { id: string; email: string; full_name: string | null; phone: string | null }
export type Checkup = {
  session_id: string; title: string; checkup_date: string; status: string
  height_cm: number | null; weight_kg: number | null; bmi: number | null
  vision: string | null; notes: string | null; updated_at: string
}
export type ChildHealth = {
  id: string; full_name: string; class_name: string; date_of_birth: string | null
  relationship: string | null; allergies: string | null; medical_notes: string | null
  latest_checkup: Checkup | null
}
export type HealthRecord = ChildHealth & { parents: AccountRef[]; nurse: AccountRef | null; assignment_version: string }
export type ParentOverview = {
  parent: AccountRef & { relationship: string | null }
  children: (ChildHealth & { checkups: Checkup[] })[]
}
export type RecordPage = { items: HealthRecord[]; total: number; page: number; page_size: number }
export type ManagementOptions = { classes: { id: string; name: string }[]; parents: AccountRef[]; nurses: AccountRef[] }

type JsonObject = Record<string, unknown>
function object(value: unknown): value is JsonObject { return value !== null && typeof value === 'object' && !Array.isArray(value) }
function text(value: unknown): value is string { return typeof value === 'string' }
function nullableText(value: unknown) { return value === null || text(value) }
function numeric(value: unknown) { return value === null || (typeof value === 'number' && Number.isFinite(value)) }
function validDate(value: unknown) { return text(value) && Number.isFinite(Date.parse(value)) }
function account(value: unknown): boolean {
  return object(value) && text(value.id) && text(value.email) && nullableText(value.full_name) && nullableText(value.phone)
}
function checkup(value: unknown): boolean {
  return object(value) && text(value.session_id) && text(value.title) && validDate(value.checkup_date)
    && text(value.status) && numeric(value.height_cm) && numeric(value.weight_kg) && numeric(value.bmi)
    && nullableText(value.vision) && nullableText(value.notes) && validDate(value.updated_at)
}
function child(value: unknown): boolean {
  return object(value) && text(value.id) && text(value.full_name) && text(value.class_name)
    && (value.date_of_birth === null || validDate(value.date_of_birth)) && nullableText(value.relationship)
    && nullableText(value.allergies) && nullableText(value.medical_notes)
    && (value.latest_checkup === null || checkup(value.latest_checkup))
}
function healthRecord(value: unknown): boolean {
  return child(value) && object(value) && Array.isArray(value.parents) && value.parents.every(account)
    && (value.nurse === null || account(value.nurse)) && text(value.assignment_version)
}
function validResponse(path: string, value: unknown): boolean {
  if (!object(value)) return false
  if (path === '/api/parent/dashboard') return account(value.parent) && object(value.parent) && nullableText(value.parent.relationship)
    && Array.isArray(value.children) && value.children.every(row => child(row) && object(row) && Array.isArray(row.checkups) && row.checkups.every(checkup))
  if (path.endsWith('/options')) return Array.isArray(value.classes) && value.classes.every(row => object(row) && text(row.id) && text(row.name))
    && Array.isArray(value.parents) && value.parents.every(account) && Array.isArray(value.nurses) && value.nurses.every(account)
  if (path.startsWith('/api/admin/health-records')) return Array.isArray(value.items) && value.items.every(healthRecord)
    && Number.isSafeInteger(value.total) && Number(value.total) >= 0 && Number.isSafeInteger(value.page) && Number(value.page) >= 1
    && Number.isSafeInteger(value.page_size) && Number(value.page_size) >= 1
  return healthRecord(value)
}

export class ManagementError extends Error {
  status: number
  constructor(status: number, message: string) { super(message); this.status = status }
}

export async function managementRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getAccessToken()
  if (!token) throw new ManagementError(401, 'Your session has expired. Please sign in again.')
  const headers = new Headers(options.headers)
  headers.set('Authorization', `Bearer ${token}`)
  const signals = [AbortSignal.timeout(20000)]
  if (options.signal) signals.push(options.signal)
  let response: Response
  try {
    response = await fetch(path, { ...options, headers, cache: 'no-store', signal: AbortSignal.any(signals) })
  } catch (failure) {
    if (options.signal?.aborted) throw failure
    throw new ManagementError(0, 'The request could not be confirmed. Check your connection and refresh before trying again.')
  }
  if (response.status === 401) {
    signOut()
    window.location.replace('/login')
    throw new ManagementError(401, 'Your session has expired. Please sign in again.')
  }
  const messages: Record<number, string> = {
    403: 'Your account does not have permission to view or change this information.',
    404: 'This record is no longer available to your account. Refresh the page.',
    409: 'Someone changed this assignment. Reload the table before making another change.',
    422: 'Choose a valid existing account and check the selected fields.',
    428: 'Reload the table before changing this assignment.',
  }
  if (!response.ok) throw new ManagementError(response.status, messages[response.status] || 'The service is unavailable. Please try again later.')
  try {
    const value: unknown = await response.json()
    if (!validResponse(path, value)) throw new Error('Invalid response')
    return value as T
  } catch { throw new ManagementError(502, 'The service returned an invalid response. Please refresh.') }
}
