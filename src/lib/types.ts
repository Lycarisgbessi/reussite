// ═══════════════════════════════════════════════════════════════
// TYPES PARTAGÉS — Plateforme Magazine Réussite Magazine
// Contrat unique entre front-office, back-office et API.
// ═══════════════════════════════════════════════════════════════

// ─── Utilisateurs back-office ──────────────────────────────────
export type AdminRole =
  | 'ADMIN'
  | 'EDITOR_IN_CHIEF'
  | 'WRITER'
  | 'COMMUNITY_MANAGER'
  | 'AD_MANAGER';

export interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: AdminRole;
  bio: string;
  avatarUrl: string;
  twitter: string;
  linkedin: string;
  active: boolean;
  createdAt: string;
  articleCount?: number;
}

export interface AuthSession {
  token: string;
  user: AdminUser;
}

// ─── Catégories ────────────────────────────────────────────────
export interface Category {
  id: string;
  name: string;
  slug: string;
  description: string;
  imageUrl: string;
  color: string;
  parentId: string | null;
  order: number;
  showInMenu: boolean;
  showInHome: boolean;
  articleCount?: number;
  children?: Category[];
}

// ─── Blocs de contenu riche (block editor) ─────────────────────
export type ContentBlock =
  | { id: string; type: 'paragraph'; text: string }
  | { id: string; type: 'heading'; level: 2 | 3; text: string }
  | { id: string; type: 'quote'; text: string; author?: string }
  | { id: string; type: 'image'; url: string; alt?: string; caption?: string }
  | { id: string; type: 'video'; youtubeId: string; title?: string }
  | { id: string; type: 'list'; items: string[]; ordered?: boolean }
  | { id: string; type: 'callout'; title?: string; text: string }
  | { id: string; type: 'divider' };

export type ArticleStatus = 'DRAFT' | 'REVIEW' | 'SCHEDULED' | 'PUBLISHED' | 'ARCHIVED';

// ─── Articles ──────────────────────────────────────────────────
export interface ArticleAuthor {
  id: string;
  name: string;
  bio: string;
  avatarUrl: string;
  twitter: string;
  linkedin: string;
}

export interface ArticleSummary {
  id: string;
  slug: string;
  title: string;
  subtitle: string;
  coverImage: string;
  status: ArticleStatus;
  views: number;
  likes: number;
  readingTime: number;
  featured: boolean;
  featuredOrder: number;
  trending: boolean;
  publishedAt: string | null;
  category: { id: string; name: string; slug: string; color: string };
  author: { id: string; name: string; avatarUrl: string };
  tags: string[];
  commentCount?: number;
}

export interface ArticleFull extends ArticleSummary {
  excerpt: string;
  content: ContentBlock[];
  coverCredit: string;
  seoTitle: string;
  seoDescription: string;
  scheduledAt: string | null;
  createdAt: string;
  updatedAt: string;
  authorFull?: ArticleAuthor;
}

export interface ArticlesResponse {
  articles: ArticleSummary[];
  total: number;
  page: number;
  totalPages: number;
}

export interface ArticleVersion {
  id: string;
  articleId: string;
  title: string;
  content: string;
  savedBy: string;
  createdAt: string;
}

// ─── Médias ────────────────────────────────────────────────────
export interface MediaItem {
  id: string;
  url: string;
  publicId: string;
  filename: string;
  alt: string;
  caption: string;
  credit: string;
  tags: string;
  type: string;
  createdAt: string;
}

// ─── Vidéos & Podcasts ─────────────────────────────────────────
export interface VideoItem {
  id: string;
  title: string;
  description: string;
  youtubeId: string;
  thumbnailUrl: string;
  duration: string;
  playlist: string;
  published: boolean;
  views: number;
  publishedAt: string;
}

export interface PodcastItem {
  id: string;
  title: string;
  description: string;
  audioUrl: string;
  duration: string;
  season: number;
  episode: number;
  collectionId: string | null;
  collectionTitle: string | null;
  coverImage: string;
  guests: string;
  published: boolean;
  plays: number;
  publishedAt: string;
}

/** Collection de podcasts (hiérarchie mère/fille renommable). */
export interface PodcastCollection {
  id: string;
  title: string;
  description: string;
  parentId: string | null;
  order: number;
  podcastCount?: number;
  children?: PodcastCollection[];
}

// ─── Pages statiques ───────────────────────────────────────────
export interface StaticPageItem {
  id: string;
  slug: string;
  title: string;
  content: string;
  seoTitle: string;
  seoDescription: string;
  published: boolean;
  updatedAt: string;
}

// ─── Menus ─────────────────────────────────────────────────────
export interface MenuItem {
  id: string;
  label: string;
  url: string;
  location: 'header' | 'footer';
  parentId: string | null;
  order: number;
  active: boolean;
}

// ─── Commentaires ──────────────────────────────────────────────
export interface CommentItem {
  id: string;
  articleId: string;
  authorName: string;
  authorEmail: string;
  content: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  reply: string;
  createdAt: string;
  articleTitle?: string;
  articleSlug?: string;
}

// ─── Newsletter ────────────────────────────────────────────────
export interface NewsletterSubscriber {
  id: string;
  email: string;
  name: string;
  interests: string;
  source: string;
  active: boolean;
  createdAt: string;
}

export interface NewsletterCampaign {
  id: string;
  subject: string;
  intro: string;
  articleIds: string;
  status: 'DRAFT' | 'SCHEDULED' | 'SENT';
  scheduledAt: string | null;
  sentAt: string | null;
  recipients: number;
  openRate: number;
  clickRate: number;
  createdAt: string;
}

// ─── Publicité ─────────────────────────────────────────────────
export const AD_PLACEMENT_KEYS = [
  'HEADER_BANNER',
  'SIDEBAR_TOP',
  'SIDEBAR_STICKY',
  'IN_ARTICLE',
  'NATIVE',
  'FOOTER_BANNER',
  'INTERSTITIAL',
  'STICKY_MOBILE',
] as const;
export type AdPlacementKey = (typeof AD_PLACEMENT_KEYS)[number];

export interface AdPlacement {
  id: string;
  key: AdPlacementKey;
  label: string;
  format: string;
  active: boolean;
  campaignCount?: number;
}

export type AdMediaType = 'IMAGE' | 'GIF' | 'VIDEO';

export interface AdCampaign {
  id: string;
  placementId: string;
  placementKey?: AdPlacementKey;
  name: string;
  advertiser: string;
  imageUrl: string;
  htmlCode: string;
  mediaType: AdMediaType;
  videoUrl: string;
  targetUrl: string;
  weight: number;
  deviceTargeting: 'ALL' | 'MOBILE' | 'DESKTOP';
  categoryTargeting: string;
  startDate: string | null;
  endDate: string | null;
  active: boolean;
  impressions: number;
  clicks: number;
  ctr?: number;
  createdAt: string;
}

export interface AdBanner {
  id: string;
  imageUrl: string;
  htmlCode: string;
  mediaType: AdMediaType;
  videoUrl: string;
  targetUrl: string;
  advertiser: string;
}

// ─── Réglages site ─────────────────────────────────────────────
export interface SiteSettings {
  siteName: string;
  tagline: string;
  logoText: string;
  contactEmail: string;
  contactPhone: string;
  contactAddress: string;
  contactHours: string;
  facebook: string;
  twitter: string;
  linkedin: string;
  youtube: string;
  whatsapp: string;
  seoTitle: string;
  seoDescription: string;
  ogImage: string;
  commentsEnabled: boolean;
  darkModeEnabled: boolean;
  readerAccountsEnabled: boolean;
  flashInfoEnabled: boolean;
  flashInfoAuto: boolean;
  autoFeature: boolean;
  newsletterPopupEnabled: boolean;
  newsletterPopupTitle: string;
  newsletterPopupText: string;
  newsletterPopupTrigger: 'TIME' | 'SCROLL' | 'EXIT';
  newsletterPopupDelay: number;
  newsletterPopupScroll: number;
  newsletterPopupFrequency: 'SESSION' | 'DAY' | 'WEEK' | 'ALWAYS';
  newsletterHeroTitle: string;
  newsletterHeroText: string;
  partnersTitle: string;
  partnersLogos: string;
  footerAbout: string;
  adsHeaderEnabled: boolean;
  adsSidebarEnabled: boolean;
  adsInArticleEnabled: boolean;
  adsFooterEnabled: boolean;
  adsStickyMobileEnabled: boolean;
  adsNativeEnabled: boolean;
  adsInterstitialEnabled: boolean;
  themeColor: string;
}

// ─── Flash info ────────────────────────────────────────────────
export interface FlashInfoItem {
  id: string;
  text: string;
  link: string;
  active: boolean;
  order: number;
}

// ─── Configuration page d'accueil ──────────────────────────────
export interface HomeBlockConfig {
  id: string;
  type: string;
  title: string;
  categorySlug: string;
  enabled: boolean;
  order: number;
}

// ─── Pop-up newsletter (config) ────────────────────────────────
export interface NewsletterPopupConfig {
  enabled: boolean;
  title: string;
  text: string;
  trigger: 'TIME' | 'SCROLL' | 'EXIT';
  delaySeconds: number;
  scrollPercent: number;
  frequency: 'SESSION' | 'DAY' | 'WEEK' | 'ALWAYS';
}

// ─── Bootstrap (chargement initial du site public) ─────────────
export interface SiteBootstrap {
  settings: SiteSettings;
  menus: { header: MenuItem[]; footer: MenuItem[] };
  categories: Category[];
  flashInfos: FlashInfoItem[];
  homeBlocks: HomeBlockConfig[];
  popup: NewsletterPopupConfig;
}

// ─── Statistiques dashboard ────────────────────────────────────
export interface DashboardStats {
  visits30d: number;
  visits7d: number;
  articlesPublished: number;
  articlesDraft: number;
  commentsPending: number;
  newsletterSubscribers: number;
  newsletterActive: number;
  adImpressions30d: number;
  adClicks30d: number;
  /** Ratio clics/impressions (0,0136 = 1,36 %) — à passer à formatPercent. */
  adCtr: number;
  totalViews: number;
  videos: number;
  podcasts: number;
  adsActive: number;
}

export interface AnalyticsPoint {
  date: string;
  views: number;
  visits: number;
}

export interface AdStatRow {
  campaignId: string;
  name: string;
  advertiser: string;
  placementLabel: string;
  impressions: number;
  clicks: number;
  ctr: number;
}

export interface TopArticleRow {
  id: string;
  title: string;
  slug: string;
  views: number;
  categoryName: string;
}

export interface TrafficSourceRow {
  source: string;
  count: number;
}

export interface AdminStats {
  overview: DashboardStats;
  chart: AnalyticsPoint[];
  topArticles: TopArticleRow[];
  adStats: AdStatRow[];
  trafficSources: TrafficSourceRow[];
  devices?: { device: string; count: number }[];
}

// ─── Journal d'audit ───────────────────────────────────────────
export interface AuditLogItem {
  id: string;
  userId: string;
  userName: string;
  action: string;
  details: string;
  createdAt: string;
}

// ─── Réponses API génériques ───────────────────────────────────
export interface ApiError {
  error: string;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  totalPages: number;
}
