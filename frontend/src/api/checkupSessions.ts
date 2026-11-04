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
    throw new Error('Không kết nối được tới SchoolHealth API. Hãy kiểm tra backend rồi thử lại.')
  }

  if (!response.ok) {
    if (response.status === 401) throw new Error('Phiên đăng nhập Nurse đã hết hạn. Hãy đăng nhập lại.')
    if (response.status === 404) throw new Error('Không tìm thấy đợt khám này.')
    throw new Error('Không tải được dữ liệu đợt khám. Hãy thử lại sau.')
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
