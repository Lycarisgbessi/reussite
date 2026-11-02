'use client';

// ═══════════════════════════════════════════════════════════════
// CATCH-ALL PUBLIC — toutes les URL réelles (/article/…, /category/…,
// /videos…) servent la même SPA que la racine. Le routeur client
// lit le chemin (voir initClient). /article/:slug reste servi par la
// route de méta-données OG puis redirige ici.
// ═══════════════════════════════════════════════════════════════
import Home from '../page';
export default Home;
