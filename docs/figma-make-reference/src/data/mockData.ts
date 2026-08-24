export type Role = 'user' | 'buddy' | 'admin'

export interface User {
  id: string
  name: string
  email: string
  role: Role
  credits: number
  avatar: string
  location?: string
  joinedAt: string
  isBuddy?: boolean
}

export interface Buddy {
  id: string
  name: string
  avatar: string
  bio: string
  topics: string[]
  timezone: string
  zoomLink: string
  active: boolean
  rating: number
  totalLessons: number
  languages: string[]
}

export interface Lesson {
  id: string
  buddyId: string
  buddyName: string
  buddyAvatar: string
  date: string
  time: string
  status: 'upcoming' | 'completed' | 'cancelled'
  zoomLink: string
  creditsUsed: number
}

export interface Notification {
  id: string
  type: 'booking' | 'cancellation' | 'reminder' | 'credit' | 'system'
  title: string
  body: string
  timestamp: string
  read: boolean
}

export interface CreditPack {
  id: string
  size: number
  price: number
  currency: string
  popular?: boolean
}

export const currentUser: User = {
  id: 'u1',
  name: 'Mei Lin',
  email: 'mei.lin@example.com',
  role: 'user',
  credits: 7,
  avatar: 'https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?w=80&h=80&fit=crop&auto=format',
  location: 'NZ',
  joinedAt: '2024-11-01',
  isBuddy: true,
}

export const buddies: Buddy[] = [
  {
    id: 'b1',
    name: 'Sarah Mitchell',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=80&h=80&fit=crop&auto=format',
    bio: 'Native speaker from Auckland. I love helping members gain confidence in everyday conversation and pronunciation.',
    topics: ['Pronunciation', 'Daily Conversation', 'Job Interviews'],
    timezone: 'Pacific/Auckland',
    zoomLink: 'https://zoom.us/j/123456789',
    active: true,
    rating: 4.9,
    totalLessons: 312,
    languages: ['English'],
  },
  {
    id: 'b2',
    name: 'James Okafor',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=80&h=80&fit=crop&auto=format',
    bio: 'Business English specialist. I help professionals communicate clearly in meetings, emails, and presentations.',
    topics: ['Business English', 'Presentations', 'Writing'],
    timezone: 'Pacific/Auckland',
    zoomLink: 'https://zoom.us/j/987654321',
    active: true,
    rating: 4.8,
    totalLessons: 198,
    languages: ['English'],
  },
  {
    id: 'b3',
    name: 'Aroha Tūhoe',
    avatar: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=80&h=80&fit=crop&auto=format',
    bio: 'Patient and encouraging. My sessions focus on building vocabulary and natural flow in conversation.',
    topics: ['Vocabulary', 'Storytelling', 'Everyday English'],
    timezone: 'Pacific/Auckland',
    zoomLink: 'https://zoom.us/j/456789123',
    active: true,
    rating: 5.0,
    totalLessons: 87,
    languages: ['English', 'Te Reo Māori'],
  },
  {
    id: 'b4',
    name: 'Tom Bergström',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=80&h=80&fit=crop&auto=format',
    bio: 'IELTS and exam preparation specialist. I have helped 50+ students achieve their target scores.',
    topics: ['IELTS', 'Exam Prep', 'Academic English'],
    timezone: 'Pacific/Auckland',
    zoomLink: 'https://zoom.us/j/321654987',
    active: true,
    rating: 4.7,
    totalLessons: 241,
    languages: ['English'],
  },
]

export const upcomingLessons: Lesson[] = [
  {
    id: 'l1',
    buddyId: 'b1',
    buddyName: 'Sarah Mitchell',
    buddyAvatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=80&h=80&fit=crop&auto=format',
    date: 'Thu 15 Aug',
    time: '10:00 AM',
    status: 'upcoming',
    zoomLink: 'https://zoom.us/j/123456789',
    creditsUsed: 1,
  },
  {
    id: 'l2',
    buddyId: 'b3',
    buddyName: 'Aroha Tūhoe',
    buddyAvatar: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=80&h=80&fit=crop&auto=format',
    date: 'Fri 16 Aug',
    time: '2:30 PM',
    status: 'upcoming',
    zoomLink: 'https://zoom.us/j/456789123',
    creditsUsed: 1,
  },
]

export const pastLessons: Lesson[] = [
  {
    id: 'l3',
    buddyId: 'b2',
    buddyName: 'James Okafor',
    buddyAvatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=80&h=80&fit=crop&auto=format',
    date: 'Mon 5 Aug',
    time: '9:00 AM',
    status: 'completed',
    zoomLink: '',
    creditsUsed: 1,
  },
  {
    id: 'l4',
    buddyId: 'b1',
    buddyName: 'Sarah Mitchell',
    buddyAvatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=80&h=80&fit=crop&auto=format',
    date: 'Thu 1 Aug',
    time: '10:00 AM',
    status: 'completed',
    zoomLink: '',
    creditsUsed: 1,
  },
  {
    id: 'l5',
    buddyId: 'b4',
    buddyName: 'Tom Bergström',
    buddyAvatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=80&h=80&fit=crop&auto=format',
    date: 'Tue 23 Jul',
    time: '4:00 PM',
    status: 'cancelled',
    zoomLink: '',
    creditsUsed: 0,
  },
]

export const notifications: Notification[] = [
  {
    id: 'n1',
    type: 'reminder',
    title: 'Lesson in 10 minutes',
    body: 'Your session with Sarah Mitchell starts at 10:00 AM. Get ready!',
    timestamp: '10 min ago',
    read: false,
  },
  {
    id: 'n2',
    type: 'booking',
    title: 'Booking confirmed',
    body: 'Your lesson with Aroha Tūhoe on Fri 16 Aug at 2:30 PM is confirmed.',
    timestamp: '2h ago',
    read: false,
  },
  {
    id: 'n3',
    type: 'credit',
    title: 'Credits added',
    body: 'You purchased a 10-credit pack. Your balance is now 7 credits.',
    timestamp: 'Yesterday',
    read: true,
  },
  {
    id: 'n4',
    type: 'cancellation',
    title: 'Lesson cancelled — credit refunded',
    body: 'Tom Bergström cancelled your session on 23 Jul. 1 credit has been refunded.',
    timestamp: '15 Jul',
    read: true,
  },
]

export const creditPacks: CreditPack[] = [
  { id: 'cp1', size: 1, price: 8, currency: 'NZD' },
  { id: 'cp2', size: 10, price: 70, currency: 'NZD', popular: true },
  { id: 'cp3', size: 20, price: 130, currency: 'NZD' },
  { id: 'cp4', size: 30, price: 180, currency: 'NZD' },
]

export const buddyAvailability = [
  { day: 'Mon', slots: ['9:00 AM', '10:00 AM', '2:00 PM', '3:00 PM'] },
  { day: 'Tue', slots: ['9:00 AM', '11:00 AM'] },
  { day: 'Wed', slots: ['10:00 AM', '1:00 PM', '4:00 PM'] },
  { day: 'Thu', slots: ['9:00 AM', '10:00 AM', '11:00 AM', '3:00 PM'] },
  { day: 'Fri', slots: ['2:00 PM', '3:00 PM', '4:00 PM'] },
]
