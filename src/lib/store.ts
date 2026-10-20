'use client';

// ═══════════════════════════════════════════════════════════════
// STORE GLOBAL — navigation SPA (hash routing), thème, session admin
// ═══════════════════════════════════════════════════════════════
import { create } from 'zustand';
import { initLocale } from './i18n';
import type { SiteBootstrap, AdminUser } from './types';

// ─── Routing par hash ──────────────────────────────────────────
export interface Route {
  view: 'home' | 'article' | 'category' | 'videos' | 'video' | 'podcasts' | 'search'
    | 'contact' | 'page' | 'newsletter' | 'announcers' | 'favorites' | 'admin';
  param: string;
  query: Record<string, string>;
}

export function parseHash(hash: string): Route {
  const raw = (hash || '#/').replace(/^#/, '');
  const [pathPart, queryPart] = raw.split('?');
  const query: Record<string, string> = {};
  new URLSearchParams(queryPart || '').forEach((v, k) => { query[k] = v; });
  const segs = pathPart.split('/').filter(Boolean);
  if (segs.length === 0) return { view: 'home', param: '', query };
  const view = segs[0];
  const param = segs.slice(1).join('/');
  const knownViews = ['article', 'category', 'videos', 'video', 'podcasts', 'search', 'contact', 'page', 'newsletter', 'announcers', 'favorites', 'admin'];
  if (knownViews.includes(view)) return { view: view as Route['view'], param, query };
  return { view: 'home', param: '', query };
}

export function navigate(path: string) {
  if (typeof window !== 'undefined') {
    window.location.hash = path.startsWith('#') ? path : `#${path}`;
  }
}

// ─── Clé lecteur anonyme (favoris, popup) ──────────────────────
function getReaderKey(): string {
  if (typeof window === 'undefined') return '';
  let key = localStorage.getItem('bh_reader_key');
  if (!key) {
    key = crypto.randomUUID();
    localStorage.setItem('bh_reader_key', key);
  }
  return key;
}

// ─── Store ─────────────────────────────────────────────────────
interface MagazineState {
  route: Route;
  bootstrap: SiteBootstrap | null;
  bootstrapLoading: boolean;
  adminUser: AdminUser | null;
  adminToken: string | null;
  theme: 'light' | 'dark';
  readerKey: string;
  favorites: string[];
  searchOpen: boolean;
  mobileMenuOpen: boolean;

  setRoute: (route: Route) => void;
  loadBootstrap: () => Promise<void>;
  setAdminSession: (token: string, user: AdminUser) => void;
  clearAdminSession: () => void;
  loadAdminSession: () => Promise<boolean>;
  setTheme: (theme: 'light' | 'dark') => void;
  toggleTheme: () => void;
  setFavorites: (ids: string[]) => void;
  toggleFavoriteLocal: (id: string) => boolean;
  setSearchOpen: (open: boolean) => void;
  setMobileMenuOpen: (open: boolean) => void;
}

export const useMagazineStore = create<MagazineState>((set, get) => ({
  route: { view: 'home', param: '', query: {} },
  bootstrap: null,
  bootstrapLoading: true,
  adminUser: null,
  adminToken: null,
  theme: 'light',
  readerKey: '',
  favorites: [],
  searchOpen: false,
  mobileMenuOpen: false,

  setRoute: (route) => set({ route, searchOpen: false, mobileMenuOpen: false }),

  loadBootstrap: async () => {
    try {
      const { publicApi } = await import('./api');
      const data = await publicApi.bootstrap();
      set({ bootstrap: data, bootstrapLoading: false });
    } catch (e) {
      console.error('Bootstrap error', e);
      set({ bootstrapLoading: false });
    }
  },

  setAdminSession: (token, user) => {
    localStorage.setItem('bh_admin_token', token);
    set({ adminToken: token, adminUser: user });
  },

  clearAdminSession: () => {
    localStorage.removeItem('bh_admin_token');
    set({ adminToken: null, adminUser: null });
  },

  loadAdminSession: async () => {
    const token = localStorage.getItem('bh_admin_token');
    if (!token) return false;
    try {
      const { authApi } = await import('./api');
      const { user } = await authApi.me();
      set({ adminToken: token, adminUser: user });
      return true;
    } catch {
      localStorage.removeItem('bh_admin_token');
      set({ adminToken: null, adminUser: null });
      return false;
    }
  },

  setTheme: (theme) => {
    if (typeof document !== 'undefined') {
      document.documentElement.classList.toggle('dark', theme === 'dark');
      localStorage.setItem('bh_theme', theme);
    }
    set({ theme });
  },

  toggleTheme: () => {
    const next = get().theme === 'light' ? 'dark' : 'light';
    get().setTheme(next);
  },

  setFavorites: (ids) => set({ favorites: ids }),

  toggleFavoriteLocal: (id) => {
    const cur = get().favorites;
    const has = cur.includes(id);
    set({ favorites: has ? cur.filter((x) => x !== id) : [...cur, id] });
    return !has;
  },

  setSearchOpen: (open) => set({ searchOpen: open }),
  setMobileMenuOpen: (open) => set({ mobileMenuOpen: open }),
}));

// ─── Init client (thème, hash, favoris) ────────────────────────
export function initClient() {
  if (typeof window === 'undefined') return;
  initLocale();
  const store = useMagazineStore.getState();
  if (!store.readerKey) {
    useMagazineStore.setState({ readerKey: getReaderKey() });
  }
  const savedTheme = localStorage.getItem('bh_theme') as 'light' | 'dark' | null;
  const prefersDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches;
  store.setTheme(savedTheme || (prefersDark ? 'dark' : 'light'));

  const applyRoute = () => store.setRoute(parseHash(window.location.hash));
  applyRoute();
  window.addEventListener('hashchange', applyRoute);
}
