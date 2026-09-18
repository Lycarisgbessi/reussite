// ═══════════════════════════════════════════════════════════════
// CLIENT API — Plateforme Magazine Réussite Magazine
// Toutes les routes commencent par /api. Le token admin est envoyé
// via l'en-tête Authorization: Bearer <token>.
// ═══════════════════════════════════════════════════════════════
import type {
  AdminUser, AuthSession, ArticlesResponse, ArticleFull, ArticleSummary,
  ArticleVersion, ArticleStatus, Category, MediaItem, VideoItem, PodcastItem, StaticPageItem,
  MenuItem, CommentItem, NewsletterSubscriber, NewsletterCampaign,
  AdPlacement, AdCampaign, AdBanner, SiteSettings, FlashInfoItem,
  HomeBlockConfig, SiteBootstrap, AdminStats, AuditLogItem, ContentBlock,
} from './types';

const TOKEN_KEY = 'bh_admin_token';

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null) {
  if (typeof window === 'undefined') return;
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const token = getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(path, { ...options, headers });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: 'Erreur réseau' }));
    throw new Error((body as { error?: string }).error || `Erreur ${res.status}`);
  }
  return res.json() as Promise<T>;
}

function qs(params: Record<string, string | number | boolean | undefined | null>): string {
  const sp = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') sp.set(k, String(v));
  });
  const s = sp.toString();
  return s ? `?${s}` : '';
}

// ═══════════════ PUBLIC — BOOTSTRAP ═══════════════
export const publicApi = {
  bootstrap: () => request<SiteBootstrap>('/api/site'),

  homepage: () => request<{
    featured: ArticleSummary[];
    latest: ArticleSummary[];
    popular: ArticleSummary[];
    categoryBlocks: { category: Category; articles: ArticleSummary[] }[];
    latestVideos: VideoItem[];
    latestPodcasts: PodcastItem[];
    partners: AdBanner[];
  }>('/api/public/homepage'),

  articles: (params: {
    category?: string; tag?: string; search?: string; page?: number;
    limit?: number; sort?: 'RECENT' | 'POPULAR' | 'AZ'; exclude?: string;
  }) => request<ArticlesResponse>(`/api/public/articles${qs(params)}`),

  article: (slug: string) => request<{ article: ArticleFull; related: ArticleSummary[]; approvedComments: PublicComment[] }>(`/api/public/articles/${slug}`),

  likeArticle: (id: string) => request<{ likes: number }>(`/api/public/articles/${id}/like`, { method: 'POST' }),

  videos: (params: { playlist?: string; page?: number; limit?: number } = {}) =>
    request<PaginatedVideos>(`/api/public/videos${qs(params)}`),

  podcasts: (params: { page?: number; limit?: number } = {}) =>
    request<PaginatedPodcasts>(`/api/public/podcasts${qs(params)}`),

  incrementPodcastPlay: (id: string) => request<{ ok: boolean }>(`/api/public/podcasts/${id}/play`, { method: 'POST' }),

  page: (slug: string) => request<{ page: StaticPageItem }>(`/api/public/pages/${slug}`),

  comments: (articleId: string) => request<{ comments: PublicComment[] }>(`/api/public/articles/${articleId}/comments`),

  postComment: (data: { articleId: string; authorName: string; authorEmail: string; content: string }) =>
    request<{ ok: boolean; pending: boolean }>('/api/public/comments', { method: 'POST', body: JSON.stringify(data) }),

  subscribeNewsletter: (data: { email: string; name?: string; interests?: string; source?: string }) =>
    request<{ ok: boolean; message: string }>('/api/public/newsletter', { method: 'POST', body: JSON.stringify(data) }),

  contact: (data: { name: string; email: string; subject: string; message: string }) =>
    request<{ ok: boolean; message: string }>('/api/public/contact', { method: 'POST', body: JSON.stringify(data) }),

  ad: (placement: string, category?: string) => request<{ banner: AdBanner | null }>(`/api/public/ads${qs({ placement, category })}`),

  adClick: (campaignId: string) => request<{ ok: boolean }>(`/api/public/ads/${campaignId}/click`, { method: 'POST' }),

  track: (type: string, path: string, meta?: Record<string, unknown>) =>
    request<{ ok: boolean }>('/api/public/track', { method: 'POST', body: JSON.stringify({ type, path, meta }) }).catch(() => ({ ok: true })),

  search: (q: string, filters?: { category?: string; type?: string }) =>
    request<SearchResults>(`/api/public/search${qs({ q, ...filters })}`),

  favorites: (readerKey: string) => request<{ articles: ArticleSummary[] }>(`/api/public/favorites${qs({ readerKey })}`),

  toggleFavorite: (readerKey: string, articleId: string) =>
    request<{ favorited: boolean }>(`/api/public/favorites`, { method: 'POST', body: JSON.stringify({ readerKey, articleId }) }),

  suggest: (q: string) => request<{ suggestions: { slug: string; title: string; type: string }[] }>(`/api/public/suggest${qs({ q })}`),
};

export interface PaginatedVideos { items: VideoItem[]; total: number; page: number; totalPages: number }
export interface PaginatedPodcasts { items: PodcastItem[]; total: number; page: number; totalPages: number }
export interface PublicComment {
  id: string;
  authorName: string;
  content: string;
  reply: string;
  createdAt: string;
}
export interface SearchResults {
  articles: ArticleSummary[];
  videos: VideoItem[];
  podcasts: PodcastItem[];
  pages: { slug: string; title: string }[];
  total: number;
}

// ═══════════════ AUTH ═══════════════
export const authApi = {
  login: (email: string, password: string) =>
    request<AuthSession>('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  me: () => request<{ user: AdminUser }>('/api/auth/me'),
  changePassword: (currentPassword: string, newPassword: string) =>
    request<{ ok: boolean }>('/api/auth/password', { method: 'POST', body: JSON.stringify({ currentPassword, newPassword }) }),
};

// ═══════════════ ADMIN ═══════════════
export const adminApi = {
  // Stats
  stats: () => request<AdminStats>('/api/admin/stats'),
  analytics: (days?: number) => request<AdminStats>(`/api/admin/analytics${qs({ days })}`),
  auditLogs: (page?: number) => request<PaginatedResponse<AuditLogItem>>(`/api/admin/audit-logs${qs({ page })}`),

  // Articles
  articles: (params: { page?: number; limit?: number; status?: string; search?: string; categoryId?: string; authorId?: string } = {}) =>
    request<PaginatedResponse<ArticleSummary & { scheduledAt?: string | null; seoTitle?: string; seoDescription?: string }>>(`/api/admin/articles${qs(params)}`),
  article: (id: string) => request<{ article: ArticleFull }>(`/api/admin/articles/${id}`),
  createArticle: (data: ArticlePayload) => request<{ article: ArticleFull }>('/api/admin/articles', { method: 'POST', body: JSON.stringify(data) }),
  updateArticle: (id: string, data: Partial<ArticlePayload>) => request<{ article: ArticleFull }>(`/api/admin/articles/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteArticle: (id: string) => request<{ ok: boolean }>(`/api/admin/articles/${id}`, { method: 'DELETE' }),
  articleVersions: (id: string) => request<{ versions: ArticleVersion[] }>(`/api/admin/articles/${id}/versions`),
  restoreVersion: (id: string, versionId: string) => request<{ article: ArticleFull }>(`/api/admin/articles/${id}/versions`, { method: 'POST', body: JSON.stringify({ versionId }) }),
  bulkArticles: (action: 'PUBLISH' | 'ARCHIVE' | 'DELETE', ids: string[]) =>
    request<{ ok: boolean }>(`/api/admin/articles/bulk`, { method: 'POST', body: JSON.stringify({ action, ids }) }),

  // Catégories
  categories: () => request<{ categories: Category[] }>('/api/admin/categories'),
  createCategory: (data: Partial<Category>) => request<{ category: Category }>('/api/admin/categories', { method: 'POST', body: JSON.stringify(data) }),
  updateCategory: (id: string, data: Partial<Category>) => request<{ category: Category }>(`/api/admin/categories/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteCategory: (id: string) => request<{ ok: boolean }>(`/api/admin/categories/${id}`, { method: 'DELETE' }),
  reorderCategories: (ids: string[]) => request<{ ok: boolean }>('/api/admin/categories/reorder', { method: 'POST', body: JSON.stringify({ ids }) }),

  // Tags
  tags: () => request<{ tags: string[] }>('/api/admin/tags'),

  // Médias
  media: (params: { search?: string; page?: number } = {}) =>
    request<PaginatedResponse<MediaItem>>(`/api/admin/media${qs(params)}`),
  createMedia: (data: Partial<MediaItem>) => request<{ media: MediaItem }>('/api/admin/media', { method: 'POST', body: JSON.stringify(data) }),
  updateMedia: (id: string, data: Partial<MediaItem>) => request<{ media: MediaItem }>(`/api/admin/media/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteMedia: (id: string) => request<{ ok: boolean }>(`/api/admin/media/${id}`, { method: 'DELETE' }),

  // Vidéos
  videos: (params: { page?: number; published?: string; search?: string } = {}) =>
    request<PaginatedResponse<VideoItem>>(`/api/admin/videos${qs(params)}`),
  createVideo: (data: Partial<VideoItem>) => request<{ video: VideoItem }>('/api/admin/videos', { method: 'POST', body: JSON.stringify(data) }),
  updateVideo: (id: string, data: Partial<VideoItem>) => request<{ video: VideoItem }>(`/api/admin/videos/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteVideo: (id: string) => request<{ ok: boolean }>(`/api/admin/videos/${id}`, { method: 'DELETE' }),
  fetchYouTubeMeta: (urlOrId: string) => request<{ title: string; thumbnailUrl: string; duration: string }>(`/api/admin/youtube${qs({ urlOrId })}`),

  // Podcasts
  podcasts: (params: { page?: number; search?: string } = {}) =>
    request<PaginatedResponse<PodcastItem>>(`/api/admin/podcasts${qs(params)}`),
  createPodcast: (data: Partial<PodcastItem>) => request<{ podcast: PodcastItem }>('/api/admin/podcasts', { method: 'POST', body: JSON.stringify(data) }),
  updatePodcast: (id: string, data: Partial<PodcastItem>) => request<{ podcast: PodcastItem }>(`/api/admin/podcasts/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deletePodcast: (id: string) => request<{ ok: boolean }>(`/api/admin/podcasts/${id}`, { method: 'DELETE' }),

  // Pages statiques
  pages: () => request<{ pages: StaticPageItem[] }>('/api/admin/pages'),
  page: (id: string) => request<{ page: StaticPageItem }>(`/api/admin/pages/${id}`),
  createPage: (data: Partial<StaticPageItem>) => request<{ page: StaticPageItem }>('/api/admin/pages', { method: 'POST', body: JSON.stringify(data) }),
  updatePage: (id: string, data: Partial<StaticPageItem>) => request<{ page: StaticPageItem }>(`/api/admin/pages/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deletePage: (id: string) => request<{ ok: boolean }>(`/api/admin/pages/${id}`, { method: 'DELETE' }),

  // Menus
  menus: () => request<{ items: MenuItem[] }>('/api/admin/menus'),
  createMenuItem: (data: Partial<MenuItem>) => request<{ item: MenuItem }>('/api/admin/menus', { method: 'POST', body: JSON.stringify(data) }),
  updateMenuItem: (id: string, data: Partial<MenuItem>) => request<{ item: MenuItem }>(`/api/admin/menus/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteMenuItem: (id: string) => request<{ ok: boolean }>(`/api/admin/menus/${id}`, { method: 'DELETE' }),
  reorderMenu: (ids: string[]) => request<{ ok: boolean }>('/api/admin/menus/reorder', { method: 'POST', body: JSON.stringify({ ids }) }),

  // Commentaires
  comments: (params: { status?: string; page?: number } = {}) =>
    request<PaginatedResponse<CommentItem>>(`/api/admin/comments${qs(params)}`),
  updateComment: (id: string, data: { status?: string; reply?: string }) =>
    request<{ comment: CommentItem }>(`/api/admin/comments/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteComment: (id: string) => request<{ ok: boolean }>(`/api/admin/comments/${id}`, { method: 'DELETE' }),

  // Newsletter
  subscribers: (params: { page?: number; search?: string; active?: string } = {}) =>
    request<PaginatedResponse<NewsletterSubscriber>>(`/api/admin/newsletter/subscribers${qs(params)}`),
  updateSubscriber: (id: string, data: { active?: boolean }) =>
    request<{ subscriber: NewsletterSubscriber }>(`/api/admin/newsletter/subscribers/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteSubscriber: (id: string) => request<{ ok: boolean }>(`/api/admin/newsletter/subscribers/${id}`, { method: 'DELETE' }),
  campaigns: () => request<{ campaigns: NewsletterCampaign[] }>('/api/admin/newsletter/campaigns'),
  createCampaign: (data: Partial<NewsletterCampaign>) => request<{ campaign: NewsletterCampaign }>('/api/admin/newsletter/campaigns', { method: 'POST', body: JSON.stringify(data) }),
  updateCampaign: (id: string, data: Partial<NewsletterCampaign>) => request<{ campaign: NewsletterCampaign }>(`/api/admin/newsletter/campaigns/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteCampaign: (id: string) => request<{ ok: boolean }>(`/api/admin/newsletter/campaigns/${id}`, { method: 'DELETE' }),
  sendCampaign: (id: string) => request<{ campaign: NewsletterCampaign }>(`/api/admin/newsletter/campaigns/${id}/send`, { method: 'POST' }),

  // Publicité
  adPlacements: () => request<{ placements: AdPlacement[] }>('/api/admin/ads/placements'),
  updateAdPlacement: (id: string, data: Partial<AdPlacement>) => request<{ placement: AdPlacement }>(`/api/admin/ads/placements/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  adCampaigns: (params: { placementId?: string; active?: string } = {}) =>
    request<{ campaigns: AdCampaign[] }>(`/api/admin/ads/campaigns${qs(params)}`),
  createAdCampaign: (data: Partial<AdCampaign>) => request<{ campaign: AdCampaign }>('/api/admin/ads/campaigns', { method: 'POST', body: JSON.stringify(data) }),
  updateAdCampaign: (id: string, data: Partial<AdCampaign>) => request<{ campaign: AdCampaign }>(`/api/admin/ads/campaigns/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteAdCampaign: (id: string) => request<{ ok: boolean }>(`/api/admin/ads/campaigns/${id}`, { method: 'DELETE' }),
  adStats: () => request<{ stats: { campaignId: string; name: string; advertiser: string; placementLabel: string; impressions: number; clicks: number; ctr: number }[] }>('/api/admin/ads/stats'),

  // Flash info
  flashInfos: () => request<{ items: FlashInfoItem[] }>('/api/admin/flash-info'),
  createFlashInfo: (data: Partial<FlashInfoItem>) => request<{ item: FlashInfoItem }>('/api/admin/flash-info', { method: 'POST', body: JSON.stringify(data) }),
  updateFlashInfo: (id: string, data: Partial<FlashInfoItem>) => request<{ item: FlashInfoItem }>(`/api/admin/flash-info/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteFlashInfo: (id: string) => request<{ ok: boolean }>(`/api/admin/flash-info/${id}`, { method: 'DELETE' }),

  // Blocs page d'accueil
  homeBlocks: () => request<{ blocks: HomeBlockConfig[] }>('/api/admin/homepage'),
  saveHomeBlocks: (blocks: HomeBlockConfig[]) => request<{ blocks: HomeBlockConfig[] }>('/api/admin/homepage', { method: 'PUT', body: JSON.stringify({ blocks }) }),
  saveFeatured: (articleIds: string[]) => request<{ ok: boolean }>('/api/admin/homepage/featured', { method: 'PUT', body: JSON.stringify({ articleIds }) }),

  // Réglages
  settings: () => request<{ settings: SiteSettings }>('/api/admin/settings'),
  saveSettings: (settings: Partial<SiteSettings>) => request<{ settings: SiteSettings }>('/api/admin/settings', { method: 'PUT', body: JSON.stringify(settings) }),

  // Utilisateurs
  users: () => request<{ users: AdminUser[] }>('/api/admin/users'),
  createUser: (data: { email: string; name: string; password: string; role: string; bio?: string }) =>
    request<{ user: AdminUser }>('/api/admin/users', { method: 'POST', body: JSON.stringify(data) }),
  updateUser: (id: string, data: { name?: string; role?: string; bio?: string; password?: string; active?: boolean; twitter?: string; linkedin?: string; avatarUrl?: string }) =>
    request<{ user: AdminUser }>(`/api/admin/users/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteUser: (id: string) => request<{ ok: boolean }>(`/api/admin/users/${id}`, { method: 'DELETE' }),

  // Export
  export: (type: 'articles' | 'subscribers' | 'comments', format: 'json' | 'csv') =>
    request<{ data: string }>(`/api/admin/export${qs({ type, format })}`),
};

export interface PaginatedResponse<T> { items: T[]; total: number; page: number; totalPages: number }

// ─── Payload création/édition article ──────────────────────────
export interface ArticlePayload {
  title: string;
  slug?: string;
  subtitle: string;
  content: ContentBlock[];
  coverImage: string;
  coverCredit: string;
  status: ArticleStatus | string;
  categoryId: string;
  authorId?: string;
  featured?: boolean;
  featuredOrder?: number;
  trending?: boolean;
  readingTime?: number;
  seoTitle?: string;
  seoDescription?: string;
  scheduledAt?: string | null;
  tags?: string[];
}
