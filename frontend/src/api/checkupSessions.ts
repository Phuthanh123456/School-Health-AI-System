export type StudentSummary = {
  id: string
  full_name: string
  class_name: string
}

export type CheckupSessionSummary = {
  id: string
  title: string
  checkup_date: string
  class_name: string | null
  participant_count: number
}

export type CheckupSessionDetail = CheckupSessionSummary & {
  students: StudentSummary[]
}

const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000'
).replace(/\/+$/, '')

async function getJson<T>(path: string, authorization: string, signal?: AbortSignal): Promise<T> {
  let response: Response

  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      headers: { Accept: 'application/json', Authorization: authorization },
      signal,
    })
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') throw error
    throw new Error('Could not connect to the SchoolHealth API. Check the backend and try again.')
  }

  if (!response.ok) {
    if (response.status === 401) throw new Error('Your Nurse session has expired. Please sign in again.')
    if (response.status === 404) throw new Error('This checkup session could not be found.')
    throw new Error('Could not load checkup session data. Please try again later.')
  }

  return (await response.json()) as T
}

export function listCheckupSessions(authorization: string, signal?: AbortSignal): Promise<CheckupSessionSummary[]> {
  return getJson<CheckupSessionSummary[]>('/checkups/sessions', authorization, signal)
}

export function getCheckupSession(
  sessionId: string,
  authorization: string,
  signal?: AbortSignal,
): Promise<CheckupSessionDetail> {
  return getJson<CheckupSessionDetail>(
    `/checkups/sessions/${encodeURIComponent(sessionId)}`,
    authorization,
    signal,
  )
}
