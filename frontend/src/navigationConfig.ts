import type { UserRole } from './auth'

export type NavigationItem =
  | { label: string; href: string; description: string }
  | { label: string; section: 'profiles' | 'checkups'; description: string }

export const navigationConfig: Record<UserRole, NavigationItem[]> = {
  admin: [
    { label: 'Health management', href: '/admin', description: 'Search student records and manage assignments' },
    { label: 'School overview & AI insights', href: '/admin/overview', description: 'School totals, status distribution, and AI insights' },
  ],
  nurse: [
    { label: 'Student profiles', section: 'profiles', description: 'Find and manage student profiles' },
    { label: 'Checkup sessions', section: 'checkups', description: 'Select a session, student, and enter results' },
  ],
  parent: [
    { label: 'Family health', href: '/parent', description: 'View your profile and linked children' },
  ],
}
