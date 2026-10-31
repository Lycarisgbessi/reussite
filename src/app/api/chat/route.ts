// ═══════════════════════════════════════════════════════════════
// POST /api/chat — assistant CONVERSATIONNEL de Réussite Magazine.
// Répond vraiment aux questions :
//   • intentions : prix / achat / abonnement / livraison / contact /
//     horaires / rubriques / podcasts / vidéos / aide / identité…
//   • sinon : recherche plein-texte des articles + résumé + liens.
// Renvoie aussi `quickReplies` : options de suivi affichées en menu
// par le widget (l'utilisateur discute sans rien taper).
// Aucune clé externe requise.
// ═══════════════════════════════════════════════════════════════
import type { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import {
  handleRouteError, ok, readBody, clientLimitKey, rateLimit, contentToText, loadSettings,
} from '@/lib/server/utils';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const GREETINGS = /^(bonjour|salut|bonsoir|hello|hi|coucou|hey)/i;

interface Reply {
  reply: string;
  articles?: { title: string; slug: string; category: string; readingTime: number }[];
  quickReplies?: string[];
}

const MENU: string[] = ['Recommande-moi un article', 'Prix du magazine', 'Comment vous contacter ?', 'Podcasts'];

function fmtGnf(n: number) {
  return `${n.toLocaleString('fr-FR')} GNF`;
}

export async function POST(req: NextRequest) {
  try {
    if (!rateLimit(clientLimitKey(req, 'chat'), 30)) {
      return ok(<Reply>{ reply: 'Un instant, je reçois beaucoup de questions — réessayez dans une minute.' });
    }
    const { message } = await readBody<{ message?: string }>(req);
    const q = (message ?? '').trim().toLowerCase();
    if (!q) {
      return ok(<Reply>{
        reply: 'Posez-moi une question : « Que puis-je lire sur la levée de fonds ? », « Combien coûte le magazine ? », « Comment joindre la rédaction ? »…',
        quickReplies: MENU,
      });
    }

    // ─── Salutations / aide / identité ───────────────────────────
    if (GREETINGS.test(q) && q.length < 25) {
      return ok(<Reply>{
        reply: "Bonjour 👋 Je suis l'assistant de Réussite Magazine. Je peux répondre à vos questions (prix, abonnement, contact…), vous recommander des articles, vous parler des podcasts et vidéos. Que souhaitez-vous ?",
        quickReplies: MENU,
      });
    }
    if (/(aide|help|comment.*(marche|fonctionne|utiliser)|que (peux|sais)-tu|vos services)/.test(q)) {
      return ok(<Reply>{
        reply:
          'Voici ce que je sais faire :\n• 📖 Recommander des articles selon un sujet\n• 🛒 Donner les prix du magazine (numérique, papier, abonnement)\n• 📦 Expliquer la livraison du numéro papier\n• 📞 Vous mettre en contact avec la rédaction\n• 🎧 Parler des podcasts et 🎬 vidéos\n\nDécrivez simplement votre besoin.',
        quickReplies: MENU,
      });
    }
    if (/(qui (es|est)-tu|tu es qui|ton nom|présente|presente)/.test(q)) {
      return ok(<Reply>{
        reply: "Je suis l'assistant conversationnel de Réussite Magazine, le trimestriel des décideurs africains. Je connais le catalogue du site et je suis là pour vous orienter, 24h/24.",
        quickReplies: MENU,
      });
    }

    // ─── Boutique : prix / achat / abonnement / livraison ────────
    const wantsShop = /(prix|combien|coûte|coute|tarif|acheter|achat|magazine|numéro|numero|abonn)/.test(q);
    if (wantsShop && /abonn/.test(q)) {
      const plans = await db.subscriptionPlan.findMany({ where: { active: true }, orderBy: { priceCfa: 'asc' } });
      if (plans.length > 0) {
        const lines = plans.map((p) => `• ${p.name} : ${fmtGnf(p.priceCfa)} (≈ ${p.priceEur} $) — ${p.issuesCount} numéro(s) sur ${p.durationMonths} mois`);
        return ok(<Reply>{
          reply: `Nos formules d'abonnement :\n${lines.join('\n')}\n\nRendez-vous dans la Boutique pour commander 👇`,
          quickReplies: ['Acheter un numéro seul', 'Version papier ?', 'Contact'],
        });
      }
    }
    if (wantsShop && /(livraison|papier|imprim|physique|domicile|expédi|expedi)/.test(q)) {
      return ok(<Reply>{
        reply: "La version papier du magazine est livrée à domicile. Les frais de livraison sont à la charge de l'acheteur — vous êtes contacté après la commande pour convenir de l'expédition, et l'adresse se renseigne au moment de l'achat.",
        quickReplies: ['Prix du magazine', 'Version numérique ?', 'Contact'],
      });
    }
    if (wantsShop) {
      const issue = await db.magazineIssue.findFirst({ where: { published: true }, orderBy: { releaseDate: 'desc' } });
      if (issue) {
        return ok(<Reply>{
          reply:
            `Le numéro « ${issue.title} » (N° ${issue.issueNumber}) est en vente :\n• 💻 Numérique (PDF) : ${fmtGnf(issue.priceCfa)} ≈ ${issue.priceEur} $\n• 📰 Papier livré chez vous : ${fmtGnf(issue.pricePrintCfa)} ≈ ${issue.pricePrintEur} $ (frais de port à votre charge)\n\nUn aperçu gratuit des premières pages est disponible dans la Boutique.`,
          quickReplies: ['Aperçu gratuit ?', 'Abonnements', 'Contact'],
        });
      }
      return ok(<Reply>{ reply: "La boutique est en cours d'approvisionnement. Revenez très bientôt !", quickReplies: MENU });
    }
    if (/(aperçu|apercu|feuilleter|première page|premiere page|avant d'acheter)/.test(q)) {
      return ok(<Reply>{
        reply: 'Oui ! Chaque numéro propose un aperçu gratuit : ouvrez la Boutique, cliquez sur « Aperçu » et feuilletez les premières pages (avec zoom jusqu\'à 400 %, page simple ou double).',
        quickReplies: ['Prix du magazine', 'Recommande-moi un article'],
      });
    }

    // ─── Contact / horaires / réseaux ────────────────────────────
    if (/(contact|joindre|téléphon|telephon|email|mail|adresse|horaire|rédação|redaction|appeler)/.test(q)) {
      const st = await loadSettings();
      const lines: string[] = [];
      if (st.contactPhone) lines.push(`📞 ${st.contactPhone}`);
      if (st.contactEmail) lines.push(`✉️ ${st.contactEmail}`);
      if (st.contactAddress) lines.push(`📍 ${st.contactAddress}`);
      if (st.contactHours) lines.push(`🕒 ${st.contactHours}`);
      return ok(<Reply>{
        reply: `Pour joindre la rédaction :\n${lines.join('\n')}\n\nVous pouvez aussi utiliser la page Contact du site.`,
        quickReplies: MENU,
      });
    }
    if (/(facebook|twitter|linkedin|youtube|réseau|reseau|suivre| réseaux)/.test(q)) {
      const st = await loadSettings();
      const links = [st.facebook && 'Facebook', st.twitter && 'X (Twitter)', st.linkedin && 'LinkedIn', st.youtube && 'YouTube'].filter(Boolean);
      return ok(<Reply>{
        reply: `Suivez Réussite Magazine sur : ${links.join(', ')}. Les icônes sont en haut de chaque page du site 👆`,
        quickReplies: MENU,
      });
    }

    // ─── Rubriques / podcasts / vidéos ───────────────────────────
    if (/(rubrique|catégorie|categorie|section|thématique|thematique|quels sujets|quoi lire)/.test(q)) {
      const cats = await db.category.findMany({
        where: { parentId: null, showInMenu: true },
        select: { name: true },
        orderBy: { order: 'asc' },
      });
      return ok(<Reply>{
        reply: `Les rubriques du magazine : ${cats.map((c) => c.name).join(' · ')}.\nLaquelle vous intéresse ? Je vous recommande des articles.`,
        quickReplies: [...cats.slice(0, 4).map((c) => c.name), 'Surprise-moi'],
      });
    }
    if (/(podcast|audio|écoute|ecoute)/.test(q)) {
      const pods = await db.podcast.findMany({ where: { published: true }, orderBy: { createdAt: 'desc' }, take: 3, select: { title: true, guests: true, duration: true } });
      return ok(<Reply>{
        reply: pods.length > 0
          ? `🎧 Nos derniers podcasts :\n${pods.map((p) => `• ${p.title}${p.guests ? ` — ${p.guests}` : ''}${p.duration ? ` (${p.duration})` : ''}`).join('\n')}\n\nTous les épisodes sont dans la rubrique Podcasts.`
          : 'Les podcasts arrivent très bientôt ! En attendant, je peux vous recommander des articles.',
        quickReplies: MENU,
      });
    }
    if (/(vidéo|video|regarder)/.test(q)) {
      return ok(<Reply>{
        reply: '🎬 Toutes nos vidéos (interviews, reportages, analyses) sont dans la rubrique Vidéos, classées par playlist. Certains articles à la une ont même un aperçu vidéo sur leur couverture !',
        quickReplies: MENU,
      });
    }

    // ─── Recommandation : recherche plein-texte classée ──────────
    const wantsReco = /(recommande|suggestion|propose|surprise|quoi lire|lire)/.test(q);
    const words = q
      .split(/[^a-zà-ÿ0-9]+/)
      .filter((w) => w.length > 3)
      .slice(0, 6);

    const candidates = await db.article.findMany({
      where: { status: 'PUBLISHED' },
      select: {
        id: true, title: true, slug: true, subtitle: true, excerpt: true,
        content: true, readingTime: true, publishedAt: true,
        category: { select: { name: true } },
        tags: { include: { tag: true } },
      },
      orderBy: { publishedAt: 'desc' },
      take: 400,
    });

    const scored = candidates
      .map((a) => {
        const haystack = [a.title, a.subtitle, a.excerpt, contentToText(a.content), a.tags.map((t) => t.tag.name).join(' ')]
          .join(' ')
          .toLowerCase();
        let score = 0;
        for (const w of words) {
          const occurrences = haystack.split(w).length - 1;
          if (occurrences > 0) score += 2 + Math.min(occurrences, 4);
        }
        return { a, score };
      })
      .filter((x) => x.score > 0)
      .sort((x, y) => y.score - x.score)
      .slice(0, 4);

    // « Surprise-moi » / recommandation sans mot-clé : les plus récents
    if (wantsReco && scored.length === 0) {
      return ok(<Reply>{
        reply: 'Voici ma sélection du moment — nos articles les plus récents 👇',
        articles: candidates.slice(0, 3).map((a) => ({ title: a.title, slug: a.slug, category: a.category.name, readingTime: a.readingTime })),
        quickReplies: ['Interview', 'Financement', 'Intelligence artificielle'],
      });
    }

    if (scored.length === 0) {
      return ok(<Reply>{
        reply: `Je n'ai pas trouvé d'article sur « ${message} ». Essayez un autre mot-clé, ou parcourez les rubriques du site. Je peux aussi répondre à vos questions sur les prix, l'abonnement ou le contact.`,
        quickReplies: MENU,
      });
    }

    const best = scored[0].a;
    const summary = (best.excerpt || best.subtitle || contentToText(best.content)).slice(0, 280);
    const others = scored.slice(1).map((x) => x.a.title);

    return ok(<Reply>{
      reply:
        `Voici ce que j'ai trouvé sur « ${message} » :\n\n📄 « ${best.title} » — ${best.category.name} · ${best.readingTime} min de lecture\n${summary}${summary.length >= 280 ? '…' : ''}\n\n` +
        (others.length > 0 ? `À lire aussi : ${others.join(' · ')}\n\n` : '') +
        'Bonne lecture !',
      articles: scored.map((x) => ({ title: x.a.title, slug: x.a.slug, category: x.a.category.name, readingTime: x.a.readingTime })),
      quickReplies: ['Prix du magazine', 'Contact'],
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
