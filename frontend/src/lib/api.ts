const API_BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:4000';

export class ApiError extends Error {
  status: number;
  body: unknown;

  constructor(status: number, body: unknown) {
    super(typeof body === 'object' && body && 'error' in body ? String((body as { error: unknown }).error) : 'Request failed');
    this.status = status;
    this.body = body;
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  const body = await res.json().catch(() => undefined);
  if (!res.ok) throw new ApiError(res.status, body);
  return body as T;
}

export interface SignupPayload {
  name: string;
  email: string;
  password: string;
  phoneNumber: string;
  location: string;
  nationality: string;
  dateOfBirth: string;
  learningGoals: string[];
  learningGoalOther?: string;
}

export function signup(payload: SignupPayload) {
  return request<{ id: string; email: string }>('/auth/signup', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function login(email: string, password: string) {
  return request<{ token: string; id: string; role: string }>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

export interface OnboardingAnswers {
  referralSource: string;
  selfRatedLevel: number;
  motivation: string;
  lessonsPerWeekGoal: string;
}

export function submitOnboarding(token: string, answers: OnboardingAnswers) {
  return request<{ onboardingCompleted: boolean }>('/api/onboarding', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(answers),
  });
}

export function resendConfirmation(email: string) {
  return request<{ sent: boolean }>('/auth/resend-confirmation', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
}

export function confirmEmail(token: string) {
  return request<{ confirmed: boolean }>(`/auth/confirm-email?token=${encodeURIComponent(token)}`);
}

export function forgotPassword(email: string) {
  return request<{ sent: boolean }>('/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
}

export function resetPassword(token: string, newPassword: string) {
  return request<{ reset: boolean }>('/auth/reset-password', {
    method: 'POST',
    body: JSON.stringify({ token, newPassword }),
  });
}

export function loginWithGoogle(idToken: string) {
  return request<{ token: string; id: string; role: string }>('/auth/google', {
    method: 'POST',
    body: JSON.stringify({ idToken }),
  });
}

export function fetchMe(token: string) {
  return request<{
    id: string;
    role: string;
    onboardingCompleted: boolean;
    credits: number;
    isNZLocated: boolean;
  }>('/api/me', {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export interface ProvisionBuddyPayload {
  name: string;
  email: string;
  password: string;
}

export function provisionBuddy(token: string, payload: ProvisionBuddyPayload) {
  return request<{ id: string; email: string; role: string }>('/api/admin/buddies', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  });
}

export interface AvailabilityBlock {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
}

export interface BuddyProfile {
  id: string;
  name?: string;
  email: string;
  picture?: string;
  bio?: string;
  location?: string;
  timezone?: string;
  zoomLink?: string;
  availabilityBlocks: AvailabilityBlock[];
}

export function fetchBuddyProfile(token: string) {
  return request<BuddyProfile>('/api/buddy/profile', {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export interface BuddyProfileUpdate {
  name?: string;
  picture?: string;
  bio?: string;
  location?: string;
  timezone?: string;
  zoomLink?: string;
}

export function updateBuddyProfile(token: string, update: BuddyProfileUpdate) {
  return request<BuddyProfile>('/api/buddy/profile', {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(update),
  });
}

export function updateBuddyAvailability(token: string, blocks: AvailabilityBlock[]) {
  return request<{ availabilityBlocks: AvailabilityBlock[] }>('/api/buddy/availability', {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ blocks }),
  });
}

export interface CreditPack {
  size: number;
  priceCents: number;
}

export function fetchCreditPacks(token: string) {
  return request<{ packs: CreditPack[] }>('/api/credit-packs', {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export function adminUpdateCreditPackPrice(token: string, size: number, priceCents: number) {
  return request<CreditPack>(`/api/admin/credit-packs/${size}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ priceCents }),
  });
}

export function startStripeCheckout(token: string, packSize: number) {
  return request<{ checkoutUrl: string; sessionId: string }>('/api/payments/stripe/checkout', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ packSize }),
  });
}

export function confirmStripePayment(token: string, sessionId: string) {
  return request<{ status: 'succeeded' | 'failed'; credits?: number }>('/api/payments/stripe/confirm', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ sessionId }),
  });
}

export function startPoliCheckout(token: string, packSize: number) {
  return request<{ navigateUrl: string; token: string }>('/api/payments/poli/checkout', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ packSize }),
  });
}

export function confirmPoliPayment(token: string, poliToken: string) {
  return request<{ status: 'succeeded' | 'failed' | 'pending'; credits?: number }>(
    '/api/payments/poli/confirm',
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ token: poliToken }),
    },
  );
}

export interface BookableBuddy {
  id: string;
  name?: string;
  picture?: string;
  bio?: string;
  location?: string;
}

// The directory endpoints report favourite state; /api/buddies/available (part
// of the booking flow) does not, hence the separate type.
export interface DirectoryBuddy extends BookableBuddy {
  isFavourite: boolean;
}

export interface BuddyDetail extends DirectoryBuddy {
  bookable: boolean;
}

export function fetchBookableBuddies(token: string) {
  return request<{ buddies: DirectoryBuddy[] }>('/api/buddies', {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export function fetchBuddySlots(token: string, buddyId: string, date: string, viewerTimezone: string) {
  return request<{ slots: string[] }>(
    `/api/buddies/${buddyId}/slots?${new URLSearchParams({ date, viewerTimezone })}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
}

export function fetchAvailableBuddies(token: string, startTime: string) {
  return request<{ buddies: BookableBuddy[] }>(
    `/api/buddies/available?${new URLSearchParams({ startTime })}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
}

export interface Lesson {
  id: string;
  buddyId: string;
  userId: string;
  startTime: string;
  durationMinutes: number;
  status: 'upcoming' | 'cancelled' | 'completed';
  zoomLink: string;
}

export function bookLesson(token: string, buddyId: string, startTime: string) {
  return request<{ lesson: Lesson; creditsRemaining: number }>('/api/lessons', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ buddyId, startTime }),
  });
}

export type RecurringFrequency = { type: 'daily' } | { type: 'weekly' } | { type: 'everyXDays'; days: number };

export interface RecurringBookingPayload {
  buddyId?: string;
  startTime: string;
  frequency: RecurringFrequency;
  includeWeekends: boolean;
  occurrenceCount: number;
  timezone: string;
}

export function bookRecurringLessons(token: string, payload: RecurringBookingPayload) {
  return request<{
    booked: Lesson[];
    skipped: { startTime: string; reason: string }[];
    creditsDeducted: number;
    creditsRemaining: number;
  }>('/api/lessons/recurring', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  });
}

export interface LessonWithBuddy extends Lesson {
  buddyName: string;
  joinable: boolean;
}

export function fetchUserLessons(token: string) {
  return request<{ upcoming: LessonWithBuddy[]; previous: LessonWithBuddy[] }>('/api/lessons', {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export function cancelLesson(token: string, lessonId: string) {
  return request<{ lesson: Lesson; refunded: boolean; creditsRemaining: number }>(
    `/api/lessons/${lessonId}/cancel`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    },
  );
}

export interface AppNotification {
  id: string;
  type: string;
  message: string;
  read: boolean;
  createdAt: string;
}

export function fetchNotifications(token: string) {
  return request<{ notifications: AppNotification[]; unreadCount: number }>('/api/notifications', {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export function markNotificationRead(token: string, notificationId: string) {
  return request<{ notification: AppNotification; unreadCount: number }>(
    `/api/notifications/${notificationId}/read`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    },
  );
}

export interface LessonWithUser extends Lesson {
  userName: string;
}

export function fetchTeachingLessons(token: string) {
  return request<{ upcoming: LessonWithUser[]; previous: LessonWithUser[] }>('/api/lessons/teaching', {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export function buddyCancelLesson(token: string, lessonId: string) {
  return request<{ lesson: Lesson; creditsRemaining: number }>(`/api/lessons/${lessonId}/buddy-cancel`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
}

export interface UserProfile {
  id: string;
  name?: string;
  email: string;
  pendingEmail?: string;
  picture?: string;
  phoneNumber?: string;
  location?: string;
  nationality?: string;
  dateOfBirth?: string;
  learningGoals: string[];
  learningGoalOther?: string;
  hasPassword: boolean;
}

export interface UserProfileUpdate {
  name?: string;
  email?: string;
  picture?: string;
  phoneNumber?: string;
  location?: string;
  nationality?: string;
  dateOfBirth?: string;
  learningGoals?: string[];
  learningGoalOther?: string;
}

export function fetchProfile(token: string) {
  return request<UserProfile>('/api/profile', {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export function updateProfile(token: string, update: UserProfileUpdate) {
  return request<UserProfile>('/api/profile', {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(update),
  });
}

export function changePassword(token: string, currentPassword: string, newPassword: string) {
  return request<{ updated: boolean }>('/api/profile/password', {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ currentPassword, newPassword }),
  });
}

export function fetchRecentBuddies(token: string) {
  return request<{ buddies: DirectoryBuddy[] }>('/api/buddies/recent', {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export function fetchFavouriteBuddies(token: string) {
  return request<{ buddies: DirectoryBuddy[] }>('/api/buddies/favourites', {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export function fetchBuddy(token: string, buddyId: string) {
  return request<BuddyDetail>(`/api/buddies/${buddyId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export function setBuddyFavourite(token: string, buddyId: string, favourited: boolean) {
  return request<{ favourited: boolean; buddy: DirectoryBuddy }>(
    `/api/buddies/${buddyId}/favourite`,
    {
      method: favourited ? 'POST' : 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    },
  );
}

export interface AdminBuddy {
  id: string;
  name?: string;
  email: string;
  active: boolean;
  hasZoomLink: boolean;
}

export function fetchAdminBuddies(token: string) {
  return request<{ buddies: AdminBuddy[] }>('/api/admin/buddies', {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export function setBuddyActive(token: string, buddyId: string, active: boolean) {
  return request<AdminBuddy & { cancelledLessons: number }>(`/api/admin/buddies/${buddyId}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ active }),
  });
}
