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
  // FormData bodies (file uploads) need the browser to set its own
  // multipart Content-Type with boundary — setting one ourselves breaks it.
  const isFormData = options.body instanceof FormData;
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
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
  phoneNumber?: string;
  location?: string;
  nationality?: string;
  dateOfBirth?: string;
  learningGoals?: string[];
  learningGoalOther?: string;
}

export function signup(payload: SignupPayload) {
  return request<{ token: string; id: string; email: string }>('/auth/signup', {
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
  return request<{ confirmed: boolean; email: string; token: string }>(`/auth/confirm-email?token=${encodeURIComponent(token)}`);
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

export function loginWithFacebook(code: string) {
  return request<{ token: string; id: string; role: string }>('/auth/facebook', {
    method: 'POST',
    body: JSON.stringify({ code }),
  });
}

export function fetchMe(token: string) {
  return request<{
    id: string;
    name?: string;
    email?: string;
    pendingEmail?: string;
    role: string;
    onboardingCompleted: boolean;
    emailConfirmed: boolean;
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
  meetingLink?: string;
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
  meetingLink?: string;
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

export interface PaymentHistoryEntry {
  id: string;
  provider: 'stripe' | 'poli';
  packSize: number;
  priceCentsAtPurchase: number;
  status: 'pending' | 'succeeded' | 'failed';
  createdAt: string;
}

export function fetchPaymentHistory(token: string) {
  return request<{ payments: PaymentHistoryEntry[] }>('/api/payments/history', {
    headers: { Authorization: `Bearer ${token}` },
  });
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
  meetingLink: string;
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
  // Missing only for a Facebook sign-up that shared no email.
  email?: string;
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

// Shared across roles — POST /api/me/picture uploads to Cloudflare R2 and
// saves the returned URL on the caller's own Account, whether User or Buddy.
export function uploadPicture(token: string, file: File) {
  const formData = new FormData();
  formData.append('picture', file);
  return request<{ picture: string }>('/api/me/picture', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });
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
  hasMeetingLink: boolean;
  // Upcoming, not-cancelled Lessons — what deactivating would cancel.
  upcomingLessons: number;
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

export function rescheduleLesson(token: string, lessonId: string, startTime: string) {
  return request<{ lesson: Lesson }>(`/api/lessons/${lessonId}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ startTime }),
  });
}

// Admin-only member tags — never fetched by any User-facing screen.
export interface AdminTag {
  id: string;
  name: string;
  memberCount: number;
}

export interface AdminMemberTag {
  id: string;
  name: string;
  addedAt: string;
  addedBy: { id: string; name: string };
}

export interface AdminMember {
  id: string;
  name?: string;
  email?: string;
  joinedAt: string;
  credits: number;
  tags: AdminMemberTag[];
}

export function fetchAdminTags(token: string) {
  return request<{ tags: AdminTag[] }>('/api/admin/tags', {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export function createAdminTag(token: string, name: string) {
  return request<AdminTag>('/api/admin/tags', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ name }),
  });
}

export function renameAdminTag(token: string, tagId: string, name: string) {
  return request<AdminTag>(`/api/admin/tags/${tagId}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ name }),
  });
}

export function deleteAdminTag(token: string, tagId: string) {
  return request<{ removedFromMembers: number }>(`/api/admin/tags/${tagId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
}

export function fetchAdminMembers(token: string, filters: { q?: string; tagId?: string }) {
  const params = new URLSearchParams();
  if (filters.q) params.set('q', filters.q);
  if (filters.tagId) params.set('tagId', filters.tagId);
  return request<{ members: AdminMember[] }>(`/api/admin/members?${params.toString()}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export function addMemberTag(token: string, memberId: string, tagId: string) {
  return request<AdminMember>(`/api/admin/members/${memberId}/tags`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ tagId }),
  });
}

export function removeMemberTag(token: string, memberId: string, tagId: string) {
  return request<AdminMember>(`/api/admin/members/${memberId}/tags/${tagId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
}

// Admin-only, read-only history of Admin changes.
export interface AuditLogEntry {
  id: string;
  action: string;
  admin: { id: string; name: string };
  target: { type: string; id?: string; label: string };
  details: Record<string, unknown>;
  createdAt: string;
}

export function fetchAuditLog(token: string, filters: { category?: string; before?: string }) {
  const params = new URLSearchParams();
  if (filters.category) params.set('category', filters.category);
  if (filters.before) params.set('before', filters.before);
  return request<{ entries: AuditLogEntry[]; nextCursor: string | null }>(`/api/admin/audit-log?${params.toString()}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}
