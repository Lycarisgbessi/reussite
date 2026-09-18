// ═══════════════════════════════════════════════════════════════
// SEED — Réussite Magazine (magazine entrepreneuriat / business / innovation)
// Exécution : cd /home/z/my-project && bun run prisma/seed.ts
// Idempotent : purge toutes les tables puis recrée un jeu de données
// éditorial francophone complet et crédible.
// ═══════════════════════════════════════════════════════════════
import { PrismaClient } from '@prisma/client'
import { randomBytes, scryptSync } from 'node:crypto'

const prisma = new PrismaClient()

// ─── Utilitaires ────────────────────────────────────────────────
const NOW = Date.now()
const DAY = 86_400_000
const daysAgo = (n: number, h = 9, m = 30) => {
  const d = new Date(NOW - n * DAY)
  d.setHours(h, m, Math.floor(Math.random() * 50), 0)
  return d
}
const daysAhead = (n: number, h = 9, m = 30) => {
  const d = new Date(NOW + n * DAY)
  d.setHours(h, m, 0, 0)
  return d
}
const hashPassword = (password: string) => {
  const salt = randomBytes(16).toString('hex')
  const hash = scryptSync(password, salt, 64).toString('hex')
  return `${salt}:${hash}`
}

// ─── Helpers ContentBlock (voir src/lib/types.ts) ──────────────
type Block =
  | { id: string; type: 'paragraph'; text: string }
  | { id: string; type: 'heading'; level: 2 | 3; text: string }
  | { id: string; type: 'quote'; text: string; author?: string }
  | { id: string; type: 'image'; url: string; alt?: string; caption?: string }
  | { id: string; type: 'video'; youtubeId: string; title?: string }
  | { id: string; type: 'list'; items: string[] }
  | { id: string; type: 'callout'; title?: string; text: string }
  | { id: string; type: 'divider' }

let _bid = 0
const bid = () => `blk-${++_bid}`
const p = (text: string): Block => ({ id: bid(), type: 'paragraph', text })
const h2 = (text: string): Block => ({ id: bid(), type: 'heading', level: 2, text })
const h3 = (text: string): Block => ({ id: bid(), type: 'heading', level: 3, text })
const quote = (text: string, author?: string): Block => ({ id: bid(), type: 'quote', text, author })
const img = (url: string, alt: string, caption: string): Block => ({ id: bid(), type: 'image', url, alt, caption })
const video = (youtubeId: string, title: string): Block => ({ id: bid(), type: 'video', youtubeId, title })
const list = (...items: string[]): Block => ({ id: bid(), type: 'list', items })
const callout = (title: string, text: string): Block => ({ id: bid(), type: 'callout', title, text })
const divider = (): Block => ({ id: bid(), type: 'divider' })

// ═══════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════
async function main() {
  console.log('🌱  Seed Réussite Magazine — démarrage')

  // ───────────────────────────────────────────────────────────
  // 1. PURGE (ordre respectant les clés étrangères)
  // ───────────────────────────────────────────────────────────
  console.log('🧹  Purge des tables existantes…')
  await prisma.auditLog.deleteMany()
  await prisma.favorite.deleteMany()
  await prisma.analyticsEvent.deleteMany()
  await prisma.articleVersion.deleteMany()
  await prisma.articleTag.deleteMany()
  await prisma.comment.deleteMany()
  await prisma.article.deleteMany()
  await prisma.category.deleteMany({ where: { parentId: { not: null } } })
  await prisma.category.deleteMany()
  await prisma.tag.deleteMany()
  await prisma.media.deleteMany()
  await prisma.video.deleteMany()
  await prisma.podcast.deleteMany()
  await prisma.staticPage.deleteMany()
  await prisma.menuItem.deleteMany()
  await prisma.newsletterSubscriber.deleteMany()
  await prisma.newsletterCampaign.deleteMany()
  await prisma.adCampaign.deleteMany()
  await prisma.adPlacement.deleteMany()
  await prisma.siteSetting.deleteMany()
  await prisma.flashInfo.deleteMany()
  console.log('   ✔ Base purgée')

  // ───────────────────────────────────────────────────────────
  // 2. UTILISATEURS BACK-OFFICE
  // ───────────────────────────────────────────────────────────
  console.log('👤  Création des utilisateurs back-office…')
  const upsertUser = (email: string, name: string, password: string, role: string, bio: string) =>
    prisma.adminUser.upsert({
      where: { email },
      update: { name, password: hashPassword(password), role, bio, active: true },
      create: { email, name, password: hashPassword(password), role, bio, active: true },
    })
  const camille = await upsertUser('admin@reussitemagazine.com', 'Camille Rousseau', 'admin123', 'ADMIN', 'Directrice de la rédaction')
  const marc = await upsertUser('marc.dupont@reussitemagazine.com', 'Marc Dupont', 'editeur123', 'EDITOR_IN_CHIEF', 'Éditeur en chef, 20 ans de presse économique')
  const claire = await upsertUser('claire.martin@reussitemagazine.com', 'Claire Martin', 'redacteur123', 'WRITER', 'Rédactrice startups & innovation')
  const sophie = await upsertUser('sophie.leroy@reussitemagazine.com', 'Sophie Leroy', 'cm123456', 'COMMUNITY_MANAGER', 'Animation communauté & newsletter')
  const karim = await upsertUser('karim.benali@reussitemagazine.com', 'Karim Benali', 'pub123456', 'AD_MANAGER', 'Régie publicitaire')
  console.log(`   ✔ 5 utilisateurs (ADMIN, EDITOR_IN_CHIEF, WRITER, COMMUNITY_MANAGER, AD_MANAGER)`)

  // ───────────────────────────────────────────────────────────
  // 3. CATÉGORIES (parents puis enfants) + TAGS
  // ───────────────────────────────────────────────────────────
  console.log('📁  Création des catégories…')
  const mkParent = (name: string, slug: string, description: string, color: string, imageUrl: string, order: number, showInMenu: boolean, showInHome: boolean) =>
    prisma.category.create({ data: { name, slug, description, color, imageUrl, order, showInMenu, showInHome } })
  const mkChild = (name: string, slug: string, description: string, color: string, imageUrl: string, order: number, parentId: string) =>
    prisma.category.create({ data: { name, slug, description, color, imageUrl, order, showInMenu: true, showInHome: false, parentId } })

  const cEntrepreneuriat = await mkParent(
    'Entrepreneuriat', 'entrepreneuriat',
    'Passer de l\'idée à l\'entreprise : création, financement, croissance et récits d\'entrepreneurs qui transforment leurs ambitions en réalité.',
    '#C8102E', '/images/cover-entrepreneuriat-1.jpg', 1, true, true)
  const cCreation = await mkChild(
    'Création d\'entreprise', 'creation-entreprise',
    'Statuts, business plan, immatriculation : toutes les clés pour lancer sa société sans faux pas.',
    '#C8102E', '/images/cover-entrepreneuriat-2.jpg', 1, cEntrepreneuriat.id)
  const cFinancement = await mkChild(
    'Financement & Levées de fonds', 'financement-levees-fonds',
    'Capital-risque, business angels, prêts d\'honneur : comprendre et réussir chaque étape de son financement.',
    '#C8102E', '/images/cover-financement-1.jpg', 2, cEntrepreneuriat.id)
  const cSuccess = await mkChild(
    'Success stories', 'success-stories',
    'Des parcours d\'entrepreneurs français et francophones qui ont su faire la différence.',
    '#C8102E', '/images/cover-success-1.jpg', 3, cEntrepreneuriat.id)

  const cBusiness = await mkParent(
    'Business & Économie', 'business-economie',
    'L\'actualité économique décryptée : marchés, secteurs, politiques publiques et grandes tendances qui façonnent l\'économie réelle.',
    '#C8102E', '/images/cover-business-1.jpg', 2, true, true)
  const cActuEco = await mkChild(
    'Actualités économiques', 'actualites-economiques',
    'L\'essentiel de l\'actualité éco française et européenne, expliqué aux décideurs.',
    '#C8102E', '/images/cover-business-2.jpg', 1, cBusiness.id)
  const cMarches = await mkChild(
    'Marchés & Secteurs', 'marches-secteurs',
    'Analyses sectorielles : industrie, services, tech, retail — les dynamiques de chaque marché.',
    '#C8102E', '/images/cover-business-1.jpg', 2, cBusiness.id)

  const cManagement = await mkParent(
    'Management & Leadership', 'management-leadership',
    'Diriger, décider, fédérer : méthodes de management, culture d\'entreprise et développement du leadership.',
    '#C8102E', '/images/cover-management-1.jpg', 3, true, true)
  const cRH = await mkChild(
    'Ressources humaines', 'ressources-humaines',
    'Recrutement, QVCT, télétravail : les bonnes pratiques RH des entreprises qui attirent et fidélisent.',
    '#C8102E', '/images/cover-management-2.jpg', 1, cManagement.id)
  const cStrategie = await mkChild(
    'Stratégie d\'entreprise', 'strategie-entreprise',
    'Positionnement, croissance externe, RSE : les choix stratégiques qui font la différence.',
    '#C8102E', '/images/cover-management-1.jpg', 2, cManagement.id)

  const cStartups = await mkParent(
    'Startups & Innovation', 'startups-innovation',
    'L\'écosystème startup au sens large : levées de fonds, innovations de rupture, tech et deep tech francophones.',
    '#C8102E', '/images/cover-startups-1.jpg', 4, true, true)
  const cTech = await mkChild(
    'Tech & Digital', 'tech-digital',
    'Produit, growth, cybersécurité : la technologie au service des modèles économiques.',
    '#C8102E', '/images/cover-startups-2.jpg', 1, cStartups.id)
  const cIA = await mkChild(
    'Intelligence artificielle', 'intelligence-artificielle',
    'IA générative, automatisation, cas d\'usage concrets : l\'IA appliquée au business, sans hype.',
    '#C8102E', '/images/cover-ia-1.jpg', 2, cStartups.id)

  const cInterviews = await mkParent(
    'Interviews & Portraits', 'interviews-portraits',
    'Rencontres avec celles et ceux qui font l\'économie de demain : fondateurs, dirigeants, investisseurs et talents atypiques.',
    '#C8102E', '/images/cover-interview-1.jpg', 5, true, true)
  const cDossiers = await mkParent(
    'Dossiers & Analyses', 'dossiers-analyses',
    'Enquêtes de fond, grands formats et analyses approfondies pour comprendre les mutations de l\'économie.',
    '#C8102E', '/images/cover-dossier-1.jpg', 6, true, true)
  const cTribune = await mkParent(
    'Tribune Libre', 'tribune-libre',
    'Prises de position, points de vue et contributions d\'experts : les tribunes engagent leurs auteurs.',
    '#C8102E', '/images/cover-tribune-1.jpg', 7, true, true)
  const cEvenements = await mkParent(
    'Événements', 'evenements',
    'Salons, conférences, webinaires : l\'agenda des rendez-vous business à ne pas manquer.',
    '#C8102E', '/images/cover-evenement-1.jpg', 8, true, false)

  const catMap: Record<string, string> = {
    'entrepreneuriat': cEntrepreneuriat.id, 'creation-entreprise': cCreation.id,
    'financement-levees-fonds': cFinancement.id, 'success-stories': cSuccess.id,
    'business-economie': cBusiness.id, 'actualites-economiques': cActuEco.id,
    'marches-secteurs': cMarches.id, 'management-leadership': cManagement.id,
    'ressources-humaines': cRH.id, 'strategie-entreprise': cStrategie.id,
    'startups-innovation': cStartups.id, 'tech-digital': cTech.id,
    'intelligence-artificielle': cIA.id, 'interviews-portraits': cInterviews.id,
    'dossiers-analyses': cDossiers.id, 'tribune-libre': cTribune.id, 'evenements': cEvenements.id,
  }
  console.log(`   ✔ ${await prisma.category.count()} catégories (8 rubriques, 9 sous-rubriques)`)

  console.log('🏷️  Création des tags…')
  const tagNames = ['IA', 'Financement', 'Levée de fonds', 'Leadership', 'E-commerce', 'RSE', 'Productivité', 'Franchise', 'Export', 'DeepTech', 'Fintech', 'Growth', 'RH', 'Innovation', 'Retail']
  for (const name of tagNames) await prisma.tag.create({ data: { name } })
  console.log(`   ✔ ${tagNames.length} tags`)

  // ───────────────────────────────────────────────────────────
  // 4. ARTICLES (20 publiés + 2 brouillons + 1 programmé)
  // ───────────────────────────────────────────────────────────
  console.log('📝  Création des articles…')

  type ArticleSeed = {
    slug: string; title: string; subtitle: string; category: string; authorKey: string;
    tags: string[]; cover: string; status?: string; featured?: number; trending?: boolean;
    views: number; readingTime: number; days: number; hour?: number;
    seoTitle: string; seoDescription: string; scheduledInDays?: number; blocks: Block[];
  }

  const articles: ArticleSeed[] = [
    // 1 ────────────────────────────────────────────────────────
    {
      slug: 'levee-de-fonds-guide-complet-investisseurs-2026', category: 'financement-levees-fonds', authorKey: 'claire',
      title: 'Levée de fonds : le guide complet pour convaincre les investisseurs en 2026',
      subtitle: 'Marché plus sélectif, critères plus stricts, due diligence renforcée : réussir sa levée en 2026 exige une préparation sans faille. Voici la méthode complète, étape par étape.',
      tags: ['Financement', 'Levée de fonds', 'Growth'], cover: '/images/cover-financement-1.jpg',
      featured: 1, views: 9500, readingTime: 12, days: 2, hour: 8,
      seoTitle: 'Levée de fonds 2026 : convaincre les investisseurs',
      seoDescription: 'Méthode complète pour réussir sa levée de fonds en 2026 : pitch, valorisation, term sheet, due diligence et erreurs à éviter.',
      blocks: [
        p('Le marché du capital-risque français a profondément changé de tempo. Après les années d\'abondance, les fonds consacrent désormais trois fois plus de temps à chaque dossier et le taux de conversion des rendez-vous s\'est effondré sous les 5 %. Autant le dire clairement : une levée de fonds en 2026 se gagne bien avant le premier rendez-vous, dans la qualité de la préparation. Ce guide détaille la méthode employée par les fondateurs qui s\'en sortent, du positionnement jusqu\'à la signature du pacte d\'actionnaires.'),
        h2('Comprendre ce que recherchent réellement les investisseurs'),
        p('Contrairement à une idée tenace, un fonds n\'investit pas dans un produit mais dans une trajectoire. Ce qu\'il évalue, c\'est la combinaison entre un marché suffisamment grand, une équipe capable de l\'exécuter et des signaux précoces de traction. Depuis 2024, la rentabilité unitaire est revenue au cœur de l\'analyse : un CAC qui n\'est pas maîtrisé ou une marge brute inférieure à 60 % sur du SaaS suscitent immédiatement des questions. Les associés vérifient aussi la cohérence entre le montant demandé, l\'usage des fonds et les jalons annoncés.'),
        quote('Un investisseur n\'achète pas votre présent, il achète une version future de votre entreprise. Votre travail consiste à rendre cette version crédible, chiffrée et désirable.', 'Élise Fontaine, associée chez Kiarra Ventures'),
        h2('Les étapes clés d\'une levée réussie'),
        list(
          'T+0 à T+4 semaines : consolider les métriques (MRR, churn, CAC/LTV, pipeline) et préparer le data room.',
          'T+4 : construire un pitch deck de 12 à 15 slides orienté problème, marché, traction, équipe.',
          'T+6 : cibler une liste resserrée de 25 à 40 fonds réellement actifs sur votre ticket et votre stade.',
          'T+8 à T+14 : première vague de rendez-vous, en gardant les fonds prioritaires pour la deuxième.',
          'T+16 : term sheet, négociation du pacte, closing — comptez 6 à 10 semaines de plus.'
        ),
        p('Le timing est un facteur trop souvent négligé. Une levée menée en période de clôture trimestrielle des fonds, ou pendant l\'été, rallonge mécaniquement les délais de plusieurs semaines. Les fondateurs expérimentés créent un sentiment de dynamique en organisant les rendez-vous par vagues resserrées, afin que les term sheets arrivent quasiment en même temps. C\'est cette concurrence, et non l\'urgence, qui donne du pouvoir de négociation.'),
        h2('Valorisation : les nouveaux repères du marché'),
        p('Les multiples de valorisation se sont normalisés autour de 4 à 7 fois le chiffre d\'affaires pour une Series A sur le marché français, contre 10 à 15 fois au pic de 2021. Cette correction n\'est pas une punition : elle réaligne les attentes entre fondateurs et investisseurs. Viser une valorisation déconnectée de ses métriques conduit presque toujours à un round à la baisse ultérieur, bien plus destructeur qu\'une valorisation honnête dès le départ.'),
        callout('À retenir', 'Préparez six mois avant, ciblez peu de fonds mais les bons, ancrez chaque promesse sur une métrique vérifiable et négociez le pacte avec autant d\'énergie que la valorisation. Une levée réussie est une levée qui laisse l\'équipe capable de tenir 24 à 30 mois.'),
        p('Trois signaux d\'alarme reviennent systématiquement dans les retours d\'associés : un data room incomplet qui révèle une gouvernance approximative, des projections sans hypothèses documentées, et un fondateur qui refuse de parler de ses faiblesses. Les investisseurs savent que tout plan rencontre des obstacles ; ce qu\'ils jugent, c\'est votre capacité à les identifier et à y répondre. La transparence n\'est pas une option, c\'est un argument de vente.'),
      ],
    },
    // 2 ────────────────────────────────────────────────────────
    {
      slug: 'pme-francaises-export-success-stories', category: 'success-stories', authorKey: 'marc',
      title: 'Ces PME françaises qui cartonnent à l\'export : 5 success stories inspirantes',
      subtitle: 'De la Provence à l\'Asie du Sud-Est, ces PME de moins de 250 salariés réalisent jusqu\'à 80 % de leur chiffre d\'affaires hors de France. Leurs stratégies, décryptées.',
      tags: ['Export', 'Growth', 'Innovation'], cover: '/images/cover-success-1.jpg',
      featured: 2, views: 8600, readingTime: 8, days: 4, hour: 10,
      seoTitle: '5 PME françaises qui cartonnent à l\'export',
      seoDescription: 'Cinq success stories de PME françaises à l\'international : stratégies, marchés et leçons concrètes pour vous lancer à l\'export.',
      blocks: [
        p('On présente souvent l\'export comme l\'affaire des grands groupes. La réalité est tout autre : les PME représentent la majorité des entreprises exportatrices françaises, et certaines en ont fait leur principal moteur de croissance. Nous avons sélectionné cinq trajectoires remarquables, choisies pour la diversité de leurs secteurs et de leurs marchés. Chacune illustre une stratégie reproductible, à condition de s\'y préparer méthodiquement.'),
        h2('Atech Marine, la niche haut de gamme qui conquiert la Scandinavie'),
        p('Ce chantier naval varois de 45 salariés exporte 70 % de ses bateaux de pêche professionnelle vers la Norvège et le Danemark. Sa clé : un positionnement premium assumé, avec des coques adaptées aux mers du Nord et un service après-vente garanti sous 72 heures. « Nous ne sommes pas les moins chers, mais nous sommes les plus rapides », résume son dirigeant. Le service, plus que le produit, constitue le véritable avantage concurrentiel.'),
        h2('Cosmétique naturelle : le pari gagnant du marketplace-first'),
        p('Fondée à Grasse, cette marque de cosmétique naturelle a inversé le parcours classique : plutôt que de chercher des distributeurs, elle a d\'abord construit sa marque sur les marketplaces asiatiques. Résultat, 40 % des ventes réalisées en Corée du Sud et au Japon, avec des données clients en propre qui orientent désormais le développement produit. Le coût d\'acquisition y reste inférieur de 30 % à celui du marché français, saturé.'),
        h2('L\'agroalimentaire qui code ses recettes pour l\'export'),
        list(
          'Une PME de charcuterie alsacienne adapte ses recettes : 30 % de sel en moins pour le marché japonais.',
          'Un producteur de jus normand a créé une marque dédiée au Moyen-Orient, avec un halal certifié dès la conception.',
          'Une biscuiterie bretonne mise sur le bio et le sans-gluten pour percer aux États-Unis.',
          'Un chocolatier lyonnais exporte 60 % de sa production vers les pays du Golfe, via des chefs franchisés.'
        ),
        h2('Tech industrielle : vendre la maintenance prédictive à l\'allemand'),
        p('Cette société grenobloise de capteurs connectés a réussi le tour de force de vendre à des équipementiers allemands, pourtant réputés hermétiques. Sa méthode : trois ans de projets pilotes gratuits pour prouver la fiabilité, puis des contrats pluriannuels adossés à des garanties de performance. La leçon est claire : sur les marchés industriels, la confiance se construit avant la commande, et le premier contrat se mérite souvent à perte.'),
        callout('À retenir', 'Aucune de ces PME n\'a conquis l\'export par hasard : niche premium, digital-first, adaptation produit ou patience industrielle. Point commun : elles ont toutes recruté un profil local sur leur premier marché étranger, dès 500 000 euros de chiffre d\'affaires réalisé.'),
        p('L\'export n\'est pas une ligne de fuite pour conjurer un marché français morose : c\'est un projet d\'entreprise à part entière, qui exige des ressources, de la méthode et de la persévérance. Ces cinq trajectoires le prouvent : la taille n\'est pas un obstacle, le manque de préparation si.'),
      ],
    },
    // 3 ────────────────────────────────────────────────────────
    {
      slug: 'intelligence-artificielle-tpe-rentabilite', category: 'intelligence-artificielle', authorKey: 'claire',
      title: 'Intelligence artificielle : comment les TPE passent de la curiosité à la rentabilité',
      subtitle: 'Loin des démonstrations spectaculaires, des dizaines de milliers de très petites entreprises françaises utilisent déjà l\'IA pour gagner du temps et de la marge. Enquête sur un basculement discret mais massif.',
      tags: ['IA', 'Productivité', 'Innovation'], cover: '/images/cover-ia-1.jpg',
      featured: 3, views: 9200, readingTime: 9, days: 1, hour: 7,
      seoTitle: 'IA en TPE : de la curiosité à la rentabilité',
      seoDescription: 'Comment les TPE françaises rentabilisent l\'intelligence artificielle : cas d\'usage concrets, outils, coûts et retours sur investissement réels.',
      blocks: [
        p('Il y a deux ans, l\'intelligence artificielle relevait encore de la curiosité technologique dans les très petites entreprises. En 2026, elle devient un poste de productivité mesurable : selon notre enquête menée auprès de 400 dirigeants de TPE, 61 % déclarent utiliser au moins un outil d\'IA chaque semaine, et un tiers d\'entre eux chiffrent un gain de temps supérieur à cinq heures hebdomadaires. Le basculement s\'est opéré sans bruit, outil par outil, tâche par tâche.'),
        h2('Les trois usages qui rapportent vraiment'),
        p('Premier usage : la rédaction. Devis, relances clients, publications réseaux sociaux, réponses aux appels d\'offres — les artisans et commerçants automatisent l\'écrit administratif qui polluait leurs soirées. Deuxième usage : l\'analyse de documents. Extraction automatique des données de factures, tri des devis fournisseurs, synthèse de contrats. Troisième usage, en progression rapide : le service client augmenté, avec des réponses pré-rédigées validées par un humain. Ces trois cas d\'usage partagent un point commun : un retour sur investissement visible en moins de trois mois.'),
        h3('Le cas de l\'atelier mécanique des Yvelines'),
        p('Ce garage de six salariés a branché un assistant IA sur son logiciel de gestion : devis rédigés en deux minutes au lieu de vingt, relances de pièces systématiques, planning optimisé. Coût : 89 euros par mois. Gain estimé par le gérant : l\'équivalent d\'un mi-temps administratif, soit près de 1 400 euros mensuels. Ce niveau de rentabilité, toujours vérifiable, explique la vitesse d\'adoption actuelle.'),
        quote('Je ne remplace personne, je récupère mes soirées. L\'IA fait le brouillon, moi je signe.', 'Nadia B., gérante d\'un garage automobile'),
        h2('Ce qui freine encore : données, droit et confiance'),
        p('Les obstacles restent réels. La qualité des données internes, souvent dispersées entre un tableur et une boîte mail, limite la pertinence des résultats. Le cadre juridique — protection des données clients, droits d\'auteur sur les contenus générés — demeure flou pour beaucoup de dirigeants. Et l\'accumulation d\'outils non interconnectés finit par créer une nouvelle forme de friction. Les chambres de commerce et les intégrateurs locaux jouent un rôle croissant pour structurer ces projets.'),
        callout('À retenir', 'Commencez par une tâche répétitive et écrite, mesurez le temps gagné sur un mois, puis étendez. La rentabilité de l\'IA en TPE ne vient pas d\'un projet spectaculaire mais d\'une succession de petits gains cumulés.'),
        p('La prochaine étape sera l\'intégration : des outils capables de lire le planning, la comptabilité et la relation client dans un même flux. Les éditeurs français s\'y mettent, et les TPE qui auront structuré leurs données d\'ici là prendront une avance difficile à rattraper.'),
      ],
    },
    // 4 ────────────────────────────────────────────────────────
    {
      slug: 'creer-son-entreprise-2026-7-erreurs', category: 'creation-entreprise', authorKey: 'marc',
      title: 'Créer son entreprise en 2026 : les 7 erreurs qui coûtent le plus cher',
      subtitle: 'Malgré un accompagnement plus accessible que jamais, deux créations sur trois ne passent pas le cap des trois ans. Ces erreurs sont presque toujours les mêmes — voici comment les éviter.',
      tags: ['Financement', 'Leadership', 'Innovation'], cover: '/images/cover-entrepreneuriat-2.jpg',
      views: 5400, readingTime: 7, days: 6, hour: 9,
      seoTitle: 'Créer son entreprise en 2026 : 7 erreurs à éviter',
      seoDescription: 'Les 7 erreurs les plus coûteuses à la création d\'entreprise en 2026 et comment les éviter : trésorerie, statut, pricing, associés et marketing.',
      blocks: [
        p('Créer une entreprise n\'a jamais été aussi simple sur le plan administratif : guichet unique, statut d\'auto-entrepreneur, banques en ligne. Et pourtant, la mortalité à trois ans reste supérieure à 60 %. L\'explication tient en quelques mots : ce qui tue n\'est presque jamais le papier, c\'est la stratégie. Après avoir interrogé une trentaine d\'experts-comptables et accompagnants, voici les sept erreurs qui reviennent avec une régularité décourageante.'),
        h2('Les erreurs de trésorerie : les numéros un, très loin devant'),
        p('La première erreur consiste à confondre chiffre d\'affaires et trésorerie. Une entreprise rentable sur le papier peut mourir en quelques semaines si ses clients paient à 60 jours et ses fournisseurs à 30. La deuxième : sous-estimer le besoin en fonds de roulement et dimensionner son apport sur les seuls investissements. La règle d\'or des accompagnants : disposer d\'au moins six mois de charges fixes de sécurité, dont trois crédités sur un compte inaccessible.'),
        list(
          'Erreur n°1 : ignorer le décalage entre facturation et encaissement.',
          'Erreur n°2 : choisir son statut juridique en un weekend, sans conseil.',
          'Erreur n°3 : fixer ses prix par rapport aux concurrents plutôt qu\'à sa valeur créée.',
          'Erreur n°4 : s\'associer sans pacte d\'actionnaires écrit.',
          'Erreur n°5 : tout miser sur un seul client dès la première année.',
          'Erreur n°6 : confondre communication et marketing (spend sans cible, sans mesure).',
          'Erreur n°7 : ne pas se payer — ou se payer trop tôt sans prévisionnel.'
        ),
        h2('Le pricing, la faute la plus répandue'),
        p('Fixer ses prix « un peu en dessous du marché » pour être attractif est le piège classique du créateur. Ce raisonnement ignore deux réalités : d\'abord, un prix bas attire une clientèle exigeante et peu fidèle ; ensuite, il ne laisse aucune marge pour absorber les inévitables imprévus. Les entreprises qui tiennent ont presque toutes recommencé leur grille tarifaire au moins une fois, à la hausse, après avoir osé vendre plus cher à leurs dix premiers clients.'),
        video('UF8uR6Z6KLc', 'Steve Jobs à Stanford : « Restez affamés, restez folles » — la leçon d\'audace qui vaut pour tous les créateurs'),
        h2('L\'association : romance et réalité juridique'),
        p('S\'associer avec un ami reste la cause silencieuse d\'une grande partie des conflits d\'entrepreneurs. Sans pacte d\'actionnaires écrit — clauses de sortie, modalités de good leaver et bad leaver, répartition des décisions —, chaque désaccord devient une négociation sous contrainte. Les experts recommandent de traiter la question dans les six premiers mois, quand tout va bien : c\'est le seul moment où la discussion est sereine.'),
        callout('À retenir', 'Aucune de ces erreurs n\'est fatale si elle est corrigée tôt. Faites relire vos hypothèses par un expert-comptable avant le lancement, testez votre prix sur dix clients réels, et mettez par écrit ce que chacun attend de l\'aventure.'),
      ],
    },
    // 5 ────────────────────────────────────────────────────────
    {
      slug: 'management-hybride-federer-equipe-distance', category: 'ressources-humaines', authorKey: 'marc',
      title: 'Management hybride : l\'art de fédérer une équipe à distance',
      subtitle: 'Trois jours au bureau, deux à la maison : le modèle s\'est installé, mais la qualité du management hybride reste inégale. Méthodes concrètes des équipes qui s\'en sortent mieux.',
      tags: ['RH', 'Leadership', 'Productivité'], cover: '/images/cover-management-2.jpg',
      featured: 4, views: 7800, readingTime: 6, days: 3, hour: 11,
      seoTitle: 'Management hybride : fédérer son équipe à distance',
      seoDescription: 'Management hybride : rituels, outils et postures pour fédérer une équipe mixte bureau/télétravail et entretenir la cohésion durablement.',
      blocks: [
        p('Le travail hybride n\'est plus une exception à gérer : c\'est le mode normal de fonctionnement de la plupart des entreprises de plus de dix salariés. Pourtant, beaucoup de managers improvisent encore, alternant entre le présentialisme de confort et la supervision à distance par la messagerie. Les équipes les plus performantes ont au contraire formalisé un véritable système : des rituels, des règles explicites et une attention particulière aux risques d\'exclusion.'),
        h2('Le paradoxe du collaborateur à distance'),
        p('Le premier danger du modèle hybride est asymétrique : celui qui reste à la maison disparaît progressivement des conversations informelles, des décisions prises dans le couloir et des promotions accordées à la visibilité. Les enquêtes internes de plusieurs grands groupes montrent un écart de 15 à 20 points sur la perception d\'équité entre collaborateurs présents quatre jours et ceux présents deux. Corriger cette asymétrie suppose des règles écrites : les réunions importantes se tiennent en visio même si tout le monde est au bureau, et les décisions sont tracées par écrit.'),
        quote('Le management hybride ne consiste pas à surveiller davantage, mais à expliciter ce qui restait implicite quand tout le monde était dans la même pièce.', 'Julien Mercier, consultant en organisation du travail'),
        h2('Quatre rituels qui font la différence'),
        list(
          'Le point d\'équipe hebdomadaire en visio, même tous présents : une même base d\'information pour tous.',
          'La note écrite de décisions, diffusée le jour même : l\'asynchrone remplace le couloir.',
          'Le créneau « sans réunion » partagé, pour protéger le travail de fond à la maison.',
          'La session d\'équipe en présentiel dédiée à la stratégie, jamais au status report.'
        ),
        p('Ces rituels coûtent peu et produisent un effet immédiat : ils remplacent la présence physique par des garanties d\'équité. Les managers qui les instaurent constatent une baisse nette des malentendus et, surtout, une meilleure rétention des profils les plus sollicités sur le marché. À l\'inverse, l\'absence de règles écrites produit une négociation permanente et individualisée, épuisante pour l\'équipe comme pour le manager.'),
        video('u4ZoJKF_VuA', 'Simon Sinek : pourquoi certains managers inspirent-ils davantage que d\'autres ?'),
        callout('À retenir', 'L\'équité se construit par écrit, la confiance se construit en personne. Le bon dosage : des règles communes et transparentes pour l\'organisation, et des moments réguliers de présent réel pour la relation.'),
      ],
    },
    // 6 ────────────────────────────────────────────────────────
    {
      slug: 'french-tech-contraction-capital-risque', category: 'actualites-economiques', authorKey: 'marc',
      title: 'La French Tech face à la contraction du capital-risque : anatomie d\'une résilience',
      subtitle: 'Les montants levés ont reculé d\'un tiers en deux ans, mais l\'écosystème français montre des signes inattendus de maturité. Analyse d\'un repli qui ressemble aussi à une triomphation sélective.',
      tags: ['Financement', 'Levée de fonds', 'DeepTech'], cover: '/images/cover-business-2.jpg',
      trending: true, views: 7400, readingTime: 10, days: 8, hour: 8,
      seoTitle: 'French Tech : résister à la contraction du capital-risque',
      seoDescription: 'Analyse : la French Tech traverse la contraction du capital-risque avec plus de maturité — chiffres, gagnants, deep tech et perspectives.',
      blocks: [
        p('Les chiffres bruts font frissonner : après le pic de 2022, les montants levés par les startups françaises ont reculé de près d\'un tiers, et le nombre de tours de table au-dessus de 100 millions d\'euros s\'est raréfié. Mais derrière cette contraction, la photographie de l\'écosystème est plus nuancée qu\'il n\'y paraît. Le nombre de créations de startups reste soutenu, les fonds seed français ont levé des véhicules records, et la qualité des dossiers financés a remplacé la quantité comme critère de sélection.'),
        h2('Une contraction sélective, pas généralisée'),
        p('Le repli frappe d\'abord les secteurs qui avaient le plus profité de l\'argent abondant : livraison, néobanques grand public, marchés B2C saturés. À l\'inverse, la deep tech, la cybersécurité et les logiciels d\'infrastructure continuent de lever, souvent plus vite qu\'avant. Cette réallocation n\'est pas une anecdote : elle dessine la spécialisation future de l\'écosystème français, davantage orientée vers la technologie de fond que vers la consommation.'),
        quote('Nous ne vivons pas une crise du capital-risque, nous vivons un retour à sa vocation : financer l\'innovation risquée, pas les remises en état de modèles usuels.', 'Franck Sebag, associé chez Exotique Partners'),
        h2('Les signaux de maturité'),
        p('Trois signaux confirment cette évolution. D\'abord, la répartition du capital : les sociétés de gestion françaises captent désormais une part croissante des souscriptions institutionnelles, signe d\'une professionnalisation reconnue. Ensuite, la sortie par le haut : plusieurs acquisitions par des groupes industriels européens se sont conclues à des valorisations raisonnables mais solides. Enfin, la discipline : les fondateurs d\'aujourd\'hui planifient leurs levées à 18 mois, contre 9 en moyenne avant la correction.'),
        list(
          'Seed : le segment le plus résistant, porté par des fonds de 50 à 150 millions d\'euros.',
          'Series A : le goulot d\'étranglement, avec des durations de levée passées à 9-12 mois.',
          'Late stage : dépendance accrue aux fonds souverains et aux investisseurs américains.',
          'Deep tech : en contre-courant, portée par les politiques européennes de souveraineté.'
        ),
        callout('À retenir', 'La contraction actuelle agit comme un filtre de qualité. Les écosystèmes qui en sortiront — français en tête selon plusieurs analystes — seront moins médiatiques mais plus solides : capitalistiquement disciplinés et technologiquement spécialisés.'),
        p('Reste l\'inconnue du retour des investisseurs internationaux, dont l\'absence pèse surtout sur les grands tours. Les prochaines douze mois diront si la résilience française a su créer les champions capables de les faire revenir.'),
      ],
    },
    // 7 ────────────────────────────────────────────────────────
    {
      slug: 'deeptech-fonds-calcul-quantique', category: 'tech-digital', authorKey: 'claire',
      title: 'DeepTech : pourquoi les fonds se ruent sur l\'ère du calcul quantique',
      subtitle: 'Valorisations en forte hausse, recrutements massifs de docteurs, partenariats industriels : le quantique sort du laboratoire. Décryptage d\'une ruée vers l\'or scientifique.',
      tags: ['DeepTech', 'IA', 'Innovation'], cover: '/images/cover-startups-2.jpg',
      trending: true, views: 6900, readingTime: 8, days: 5, hour: 10,
      seoTitle: 'Calcul quantique : pourquoi les fonds investissent',
      seoDescription: 'Pourquoi le calcul quantique attire les investisseurs : acteurs français, cas d\'usage industriels, risques et calendrier réaliste.',
      blocks: [
        p('Il y a cinq ans, parler d\'ordinateur quantique à un comité d\'investissement relevait de la science-fiction. En 2026, les plus grands fonds européens disposent de thèses d\'investissement dédiées, et plusieurs startups françaises du secteur ont bouclé des tours à trois chiffres. Cette bascule s\'explique par un conglomérat de facteurs : des démonstrations industrielles tangibles, la pression géopolitique sur les technologies souveraines et l\'arrivée à maturité d\'une génération de chercheurs-entrepreneurs.'),
        h2('De la physique au P&L : ce qui a changé'),
        p('Le déclic vint des premières applications rentables. La simulation moléculaire pour la chimie, l\'optimisation logistique pour l\'industrie et le post-quantique pour la cybersécurité ne sont plus des promesses de congrès : ce sont des contrats. Les entreprises du secteur français ont adopté une stratégie pragmatique — financer le développement du quantique par des revenus d\'aujourd\'hui, issus du classique accéléré par l\'IA et de la cryptographie post-quantique, un marché en explosion depuis les directives réglementaires européennes.'),
        quote('Le quantique ne remplacera pas l\'informatique classique : il lui ajoutera une couche, comme le GPU l\'a fait pour l\'IA. Ceux qui construisent cette couche aujourd\'hui occupent la position stratégique de la décennie.', 'Sonia Keller, analyste tech'),
        h2('La France, terre de quantique'),
        p('L\'Hexagone concentre un atout rare : une filière de formation d\'excellence, du lycée au doctorat, alimentée par des laboratoires de premier plan mondial. Les startups françaises du secteur revendiquent plusieurs centaines de docteurs recrutés ces trois dernières années, un taux de rétention remarquable et des partenariats avec les grands groupes industriels, aéronautique et énergie en tête. Le plan national de quantique a joué un rôle d\'accélérateur en finançant les plateformes partagées.'),
        list(
          'Cryptographie post-quantique : le premier marché rentable, tiré par la réglementation.',
          'Simulation de matériaux : batteries, catalyseurs, superconducteurs.',
          'Optimisation : routes, chaînes logistiques, allocation d\'énergie.',
          'Capteurs quantiques : navigation inertielle sans GPS, imagerie médicale.'
        ),
        callout('À retenir', 'Investir dans le quantique, c\'est accepter un horizon de dix ans pour l\'ordinateur universel, mais capter dès maintenant les revenus de ses cousins appliqués. La discipline des fonds consiste à financer les revenue d\'aujourd\'hui, pas seulement les rêves de demain.'),
      ],
    },
    // 8 ────────────────────────────────────────────────────────
    {
      slug: 'dossier-e-commerce-francais-10-ans-revolutions', category: 'dossiers-analyses', authorKey: 'camille',
      title: 'Dossier spécial : le e-commerce français, 10 ans de révolutions silencieuses',
      subtitle: 'Du premier clic mobile à l\'IA personnalisée, le commerce en ligne français a traversé une décennie de mutations sans précédent. Notre grand format sur une industrie qui a tout appris, vite.',
      tags: ['E-commerce', 'Retail', 'Growth'], cover: '/images/cover-dossier-1.jpg',
      featured: 5, views: 8900, readingTime: 11, days: 7, hour: 9,
      seoTitle: 'E-commerce français : 10 ans de révolutions',
      seoDescription: 'Grand dossier : une décennie de transformations du e-commerce français — mobile, marketplaces, DNVB, logistique, IA et retour du physique.',
      blocks: [
        p('En dix ans, le e-commerce français a triplé, absorbé des crises successives, vu naître et disparaître des centaines de marques. Derrière les chiffres d\'ensemble, une histoire plus profonde s\'est écrite : celle d\'une industrie qui a industrialisé l\'expérience client, professionalisé la logistique et réinventé ses modèles tous les trois ans. Ce dossier retrace cette décennie de révolutions silencieuses, à travers les témoignages de ceux qui l\'ont faite.'),
        h2('2015-2018 : la révolution mobile qui a tout changé'),
        p('Tout commence par un déplacement du curseur : le mobile dépasse l\'ordinateur dans les commandes françaises vers 2017. Ce basculement contraint toute une industrie à réapprendre son métier — interfaces repensées, tunnels d\'achat raccourcis, paiement en un geste. Les pure players qui tardent paient cher leur inertie, tandis qu\'émergent les DNVB, ces marques nées sur le web qui, en tant que nouvelles venues, n\'ont jamais eu à démanteler d\'anciens réflexes.'),
        img('/images/cover-dossier-2.jpg', 'Entrepôt logistique e-commerce moderne avec préparation automatisée des commandes', 'La logistique, colonne vertébrale méconnue du e-commerce français : plus de 150 000 emplois directs.'),
        h2('2018-2022 : la logistique, nouvelle guerre des géants'),
        p('La deuxième révolution se joue hors écran. Livraison en 24 heures, clic & collect, retours gratuits : la promesse de service devient le vrai champ de bataille, et le coût logistique la première variable du P&L. Les acteurs qui survivent à cette phase ont tous fait le même arbitrage — internaliser la donnée client tout en mutualisant la brique physique. C\'est aussi la décennie où le e-commerce se ruralise : les zones peu denses, longtemps oubliées, deviennent des territoires de croissance.'),
        quote('Nous avons arrêté de vendre des produits en ligne : nous vendons une promesse de livraison et un droit au retour. Le produit, lui, doit tenir seul sa promesse.', 'Directrice e-commerce d\'un enseigne national'),
        h2('2022-2026 : l\'ère de la marge et de l\'intelligence'),
        p('La troisième vague est la plus silencieuse : après la croissance à tout prix, place à la rentabilité unitaire. Coût d\'acquisition maîtrisé, personalisation par l\'IA, précommande prédictive des stocks. Les équipes marketing travaillent désormais avec des modèles qui prévoient la demande à deux semaines, et le service client hybride humain-IA traite la majorité des demandes sans dégrader la satisfaction. Le e-commerce français est devenu une industrie de la donnée, avec la discipline financière qui va avec.'),
        list(
          'Le click & collect représente désormais près d\'un retrait sur deux en volume.',
          'Le mobile concentre plus de 70 % des sessions d\'achat en France.',
          'L\'IA générative rédige une fiche produit sur trois dans les grandes plateformes.',
          'Le commerce unifié (online + magasin) fait retourner le e-commerce vers le physique.'
        ),
        callout('À retenir', 'La prochaine décennie sera celle du commerce unifié : la question ne sera plus « en ligne ou en magasin » mais l\'expérience continue entre les deux. Les gagnants seront ceux qui possèdent la donnée client de bout en bout. Dix ans de révolutions silencieuses ont mûri le secteur plus vite que prévu — restera à la créativité des marques à suivre la rigueur de leurs modèles économiques.'),
      ],
    },
    // 9 ────────────────────────────────────────────────────────
    {
      slug: 'portrait-fondatrice-40-millions-independance', category: 'interviews-portraits', authorKey: 'camille',
      title: 'Portrait : la fondatrice qui a refusé 40 millions pour rester indépendante',
      subtitle: 'À la tête d\'une entreprise de logiciels pour l\'industrie atteignant 12 millions d\'euros de chiffre d\'affaires, elle a dit non à deux rachats et n\'a jamais levé de fonds. Rencontre avec une obstinée.',
      tags: ['Leadership', 'Innovation'], cover: '/images/cover-interview-1.jpg',
      featured: 6, views: 8100, readingTime: 7, days: 9, hour: 8,
      seoTitle: 'Portrait : fondatrice qui a refusé 40 millions',
      seoDescription: 'Rencontre avec la fondatrice qui a refusé deux rachats de 40 millions pour préserver l\'indépendance de son entreprise industrielle.',
      blocks: [
        p('Dans le bureau de cette fondatrice, à Clermont-Ferrand, pas de trophée ni de photo de remise de prix. Juste un plan d\'usine annoté à la main et une étagère de cahiers d\'ingénieur. En vingt ans, son entreprise de supervision industrielle est passée de trois à cent quarante salariés, sans un euro de capital-risque. Et deux fois, elle a refusé une offre de rachat à 40 millions d\'euros. « Ce n\'était pas mon projet, c\'était celui de leurs banquiers », résume-t-elle avec un sourire fatigué.'),
        h2('Refuser, c\'est aussi une stratégie'),
        p('Le premier refus remonte à dix ans, au moment où son secteur traversait une crise brutale. L\'acquéreur proposait un bon prix, mais prévoyait d\'absorber l\'équipe et de fermer le site clermontois. Le second refus, plus récent, tenait à autre chose : la garantie écrite de maintenir la R&D en France, que le potentiel acheteur ne voulait pas signer. À chaque fois, elle a choisi la trajectoire longue plutôt que le chèque. Ses actionnaires salariés l\'en remercient : la valeur de l\'entreprise a quintuplé depuis.'),
        quote('On m\'a dit que j\'étais sentimentale. Je suis rentable depuis vingt ans ; je ne vois pas où est le sentimentalisme. Je refuse ce qui détruit ce que j\'ai construit.', ''),
        h2('Le modèle : croître par les revenus, décider par le terrain'),
        p('Sa recette de croissance tient en trois principes. Réinvestir systématiquement 15 % du chiffre d\'affaires en R&D, sans jamais dépendre d\'un financement externe pour la survie. Recruter lentement, jamais sous pression commerciale, et surtout en alternance. Et décider au plus près du terrain : chaque trimestre, elle passe deux jours en clientèle, carnet en main. Cette proximité lui a permis de sentir avant ses concurrents le basculement des industriels vers la maintenance prédictive.'),
        list(
          'Aucune levée de fonds en vingt ans : croissance financée par les revenus.',
          '140 salariés, dont 60 % d\'ingénieurs, au siège et dans deux filiales européennes.',
          'Churn client inférieur à 4 % par an sur un contrat moyen de 120 000 euros.',
          'Plan d\'épargne salarié ouvert dès la dixième recrue : 40 % du capital aux salariés.'
        ),
        callout('À retenir', 'L\'indépendance n\'est pas une fin en soi mais un choix de gouvernance : elle impose une discipline financière extrême et autorise des décisions que le capital externe interdirait. Ce portrait le démontre : ce choix peut être le plus rentable de tous.'),
      ],
    },
    // 10 ───────────────────────────────────────────────────────
    {
      slug: 'franchise-modele-resiste-crises', category: 'business-economie', authorKey: 'marc',
      title: 'Franchise : le modèle qui résiste à toutes les crises',
      subtitle: 'Covid, inflation, tension des consommations : le taux de survie des franchises françaises reste supérieur de 15 points à celui des entreprises indépendantes comparables. Enquête sur un modèle qui a appris de ses erreurs.',
      tags: ['Franchise', 'Retail'], cover: '/images/cover-business-1.jpg',
      views: 4700, readingTime: 6, days: 12, hour: 9,
      seoTitle: 'Franchise : le modèle qui résiste aux crises',
      seoDescription: 'Pourquoi la franchise résiste mieux aux crises en France : taux de survie, coûts d\'entrée, sélectivité des réseaux et nouvelles formes de franchise.',
      blocks: [
        p('Le chiffre surprend même les professionnels : sur les cinq dernières années, le taux de survie à trois ans des franchisés français dépasse de 15 points celui des commerçants indépendants de secteurs comparables. Dans une période où chaque point de marge compte, ce différentiel explique l\'afflux de candidats : les réseaux enregistrent des records de candidatures, avec une montée en gamme notable des profils — cadres en reconversion, femmes entrepreneures, multi-franchisés.'),
        h2('Pourquoi la franchise amortit mieux les chocs'),
        p('La force du modèle tient en trois étages. D\'abord le pouvoir de négociation : un réseau de 200 points de vente obtient des conditions fournisseurs inaccessibles à un indépendant. Ensuite la mutualisation : marketing, systèmes d\'information, achats — les coûts fixes sont partagés. Enfin, l\'expérimentation : un réseau teste ses nouveautés dans dix pilotes avant de généraliser, quand l\'indépendant joue sa survie sur chaque pari. La crise sanitaire l\'a démontré brutalement : les réseaux ont pivôté vers le drive et le e-commerce en quelques semaines.'),
        quote('La franchise n\'est plus un modèle de reproduction : c\'est un modèle de capitalisation collective. Le franchisé apporte son énergie locale, le réseau sa puissance de feu.', 'Président d\'une fédération de franchise'),
        h2('Un modèle qui s\'est assaini'),
        p('L\'image de la franchise a longtemps souffert de réseaux avides de droits d\'entrée. Le marché s\'est nettement assaini : la sélection des candidats s\'est durcée — certains réseaux refusent aujourd\'hui plus de trois candidats sur quatre —, les documentations d\'information précontractuelles sont plus complètes, et les apports demandés ont augmenté, signe d\'engagement réel. Les réseaux les plus performants publient même leurs taux d\'échec, une transparence encore impensable il y a dix ans.'),
        callout('À retenir', 'La franchise n\'est pas un sésame automatique : sa résistance aux crises repose sur la qualité du réseau ET du franchisé. Avant de signer, rencontrez au moins cinq franchisés en exercice, dont deux qui ne sont pas dans la vitrine du réseau.'),
      ],
    },
    // 11 ───────────────────────────────────────────────────────
    {
      slug: 'rse-greenwashing-nouvelles-normes', category: 'strategie-entreprise', authorKey: 'marc',
      title: 'RSE : au-delà du greenwashing, ce que changent vraiment les nouvelles normes',
      subtitle: 'CSRD, devoir de vigilance, taxonomie verte : la réglementation transforme la RSE en obligation contractuelle. Ce que les PME doivent en retenir, concrètement.',
      tags: ['RSE', 'Leadership', 'Innovation'], cover: '/images/cover-management-1.jpg',
      views: 4300, readingTime: 8, days: 11, hour: 10,
      seoTitle: 'RSE : au-delà du greenwashing, les nouvelles normes',
      seoDescription: 'CSRD, devoir de vigilance, taxonomie : ce que les nouvelles normes RSE changent concrètement pour les entreprises et leurs PME fournisseurs.',
      blocks: [
        p('Pendant vingt ans, la responsabilité sociétale des entreprises a vécu sous le soupçon : rapports décoratifs, engagements symboliques, communication plus rapide que la réalité. Cette ère se referme. La directive européenne CSRD, le devoir de vigilance et la taxonomie verte transforment la RSE en obligation mesurable, auditée et — surtout — contractuelle. Pour les directions d\'entreprise, le sujet quitte le département communication pour rejoindre le comité stratégique.'),
        h2('La chaîne de valeur devient juridiquement solidaire'),
        p('Le changement le plus profond n\'est pas dans les rapports : il est dans les contrats. Les grands groupes doivent publier des données vérifiées sur l\'ensemble de leur chaîne de valeur, y compris leurs émissions dites « scope 3 » — c\'est-à-dire celles de leurs fournisseurs. Concrètement, une PME industrielle de 80 salariés reçoit aujourd\'hui de ses clients grands comptes des questionnaires carbone à remplir, avec des clauses de résiliation en cas de donnée inexacte. La RSE descend la chaîne de valeur par la force contractuelle.'),
        quote('Nous ne demandons pas à nos fournisseurs d\'être parfaits. Nous leur demandons d\'être mesurables. Ce qu\'on ne peut pas mesurer, on ne peut pas l\'améliorer — ni le défendre.', 'Directrice développement durable d\'un groupe industriel'),
        h2('Ce que les PME doivent faire, maintenant'),
        list(
          'Cartographier ses émissions principales (énergie, transport, achats clés) : trois chiffres suffisent pour démarrer.',
          'Constituer un dossier de preuves réutilisable : factures d\'énergie, certifications, politique RH écrite.',
          'Répondre aux questionnaires clients avec des données réelles, jamais estimées « au doigt mouillé ».',
          'Former une personne relais en interne, même à temps partiel, plutôt qu\'externaliser tout le sujet.'
        ),
        p('Loin d\'être une charge pure, cette exigence devient un critère d\'accès aux marchés : les PME déjà prêtes constatent qu\'elles remportent plus facilement les appels d\'offres des grands comptes, leurs données carbone faisant la différence face à des concurrents impréparés. Les plateformes de calcul mutualisées, souvent subventionnées par les filières, réduisent par ailleurs fortement le coût d\'entrée du sujet.'),
        callout('À retenir', 'La nouvelle RSE n\'est pas un exercice de style : c\'est une condition d\'accès aux marchés. Les PME qui instrumentent leurs données dès maintenant transforment une contrainte réglementaire en avantage commercial.'),
      ],
    },
    // 12 ───────────────────────────────────────────────────────
    {
      slug: 'fintech-europeenne-rattrapage-geants-americains', category: 'marches-secteurs', authorKey: 'claire',
      title: 'Fintech européenne : le grand rattrapage face aux géants américains',
      subtitle: 'Paiements, banques en ligne, financement embarqué : après une décennie de complexité réglementaire, la fintech européenne revient en force. Les chiffres d\'un redressement impressionnant.',
      tags: ['Fintech', 'Growth', 'Innovation'], cover: '/images/cover-business-2.jpg',
      trending: true, views: 5800, readingTime: 9, days: 10, hour: 8,
      seoTitle: 'Fintech européenne : le grand rattrapage',
      seoDescription: 'Comment la fintech européenne comble son retard sur les géants américains : paiements, BaaS, réglementation, rentabilité et acteurs à suivre.',
      blocks: [
        p('Pendant dix ans, le constat semblait sans appel : les géants américains du paiement et de la banque numérique capturaient la valeur mondiale, pendant que l\'Europe réglementait. En 2026, le rapport de forces se rééquilibre. Les entreprises européennes du secteur affichent des croissances à deux chiffres, des marges enfin positives et une spécialisation qui les rend difficiles à déloger sur leurs territoires. Retour sur un rattrapage méthodique.'),
        h2('La réglementation, handicap devenu avantage'),
        p('L\'ironie de l\'histoire mérite d\'être soulignée : ce qui pénalisait les fintechs européennes — la conformité stricte, la protection des données, l\'interopérabilité imposée — constitue désormais leur meilleur argument commercial. Les banques et les grandes entreprises d\'Amérique du Nord achètent des solutions européennes précisément parce qu\'elles ont été conçues dans le cadre le plus exigeant au monde. Le PSD2 et l\'open banking ont créé une génération d\'entreprises qui savent encaisser, router et réconcilier des paiements complexes à l\'échelle continentale.'),
        quote('Nous avons grandi dans la juridiction la plus exigeante du monde. Pour nos clients, c\'est une certification de fait : si ça marche ici, ça marche partout.', 'Cofondateur d\'une scale-up parisienne de paiements B2B'),
        h2('Les trois fronts du rattrapage'),
        p('Premier front : les paiements B2B, longtemps délaissés au profit du B2C spectaculaire, où les acteurs européens dominent désormais le segment des entreprises intermédiaires. Deuxième front : le financement embarqué — acheter, payer en plusieurs fois, financer un équipement au moment de l\'achat — porté par les partenaires bancaires traditionnels. Troisième front : l\'infrastructure, avec les plateformes de services financiers « as a service » qui permettent à toute entreprise d\'intégrer des fonctions bancaires sans licence propre.'),
        list(
          'Paiements B2B : automatisation des factures et réconciliation, marché dominé par les Européens.',
          'Buy now, pay later mature : fin de la croissance aveugle, entrée dans l\'ère de la rentabilité.',
          'Banque en tant que service : l\'Europe exporte son modèle vers l\'Amérique latine et l\'Asie.',
          'Crypto régulée : les acteurs conformes captent les volumes institutionnels.'
        ),
        callout('À retenir', 'Le rattrapage européen ne repose pas sur la copie des géants américains mais sur la spécialisation B2B et l\'excellence réglementaire. La rentabilité est désormais le critère de valorisation — et les acteurs européens l\'ont compris avant beaucoup d\'autres.'),
      ],
    },
    // 13 ───────────────────────────────────────────────────────
    {
      slug: 'tribune-entrepreneur-artisan-pas-heros', category: 'tribune-libre', authorKey: 'marc',
      title: 'Tribune : « L\'entrepreneur n\'est pas un héros, c\'est un artisan »',
      subtitle: 'La médiatisation de l\'entrepreneuriat fabrique des héros imaginaires et des candidats mal préparés. Plaidoyer pour un retour à la réalité du métier, signé par un entrepreneur de deuxième génération.',
      tags: ['Leadership', 'Productivité'], cover: '/images/cover-tribune-1.jpg',
      views: 1900, readingTime: 5, days: 14, hour: 9,
      seoTitle: 'Tribune : l\'entrepreneur est un artisan',
      seoDescription: 'Tribune : contre le mythe du héros entrepreneur, une défense de l\'artisanat entrepreneurial — patience, répétition, métier et durée.',
      blocks: [
        p('Nous vivons une époque étrange pour l\'entrepreneuriat. Jamais autant de séries, de podcasts et de conférences n\'ont célébré les fondateurs, et jamais la réalité de leur quotidien n\'a été aussi éloignée de sa représentation. Le mythe du héros — jeune, audacieux, disruptif, couronné de succès rapide — fait des dégâts silencieux : il fabrique des attentes intenables et des candidats déçus. Il est temps de réhabiliter une figure moins glamour et bien plus véridique : celle de l\'artisan.'),
        h2('Ce que fait vraiment un artisan'),
        p('L\'artisan répète des gestes pendant des années pour les améliorer d\'un pour cent. Il connaît ses clients par leur prénom, ses fournisseurs par leur fiabilité, ses marges par cœur. Il construit lentement une réputation que rien ne remplace, ni levée de fonds ni campagne marketing. La grande majorité des entreprises françaises qui durent — boulangeries, agences, ateliers, cabinets, éditeurs de logiciels rentables — fonctionnent exactement ainsi. Personne ne leur filme le quotidien, et pourtant c\'est là que s\'écrit l\'économie réelle.'),
        quote('Le héros improvise l\'exploit. L\'artisan construit un métier. Au bout de dix ans, seuls les seconds existent encore.', ''),
        h2('Les dégâts du mythe héroïque'),
        p('Le premier dégât concerne les candidats eux-mêmes : convaincus que la réussite se joue sur un coup d\'audace, ils négligent l\'apprentissage du métier, la constitution d\'un réseau et la constitution de marges. Le deuxième dégât est culturel : en ne célébrant que les trajectoires fulgurantes, on dévalorise la croissance régulière, qui emploie pourtant dix fois plus de personnes. Le troisième est politique : le mythe alimente des politiques de soutien ciblées sur l\'image, rarement sur les besoins réels des entreprises de deux à cinquante salariés.'),
        callout('À retenir', 'Entreprendre reste l\'une des plus belles expériences professionnelles qui soient — à condition de la commencer comme on apprend un métier : avec un maître, des années de répétition et l\'honnêteté de mesurer ce que l\'on ne sait pas encore faire.'),
      ],
    },
    // 14 ───────────────────────────────────────────────────────
    {
      slug: 'growth-marketing-12-leviers-scale-ups', category: 'tech-digital', authorKey: 'claire',
      title: 'Growth marketing : 12 leviers testés et approuvés par des scale-ups',
      subtitle: 'Nous avons interrogé les équipes growth de douze scale-ups françaises sur les leviers qui produisent réellement des résultats. Voici leur sélection, avec les conditions de réussite de chacun.',
      tags: ['Growth', 'E-commerce', 'Productivité'], cover: '/images/cover-ia-2.jpg',
      trending: true, views: 6500, readingTime: 8, days: 13, hour: 11,
      seoTitle: 'Growth : 12 leviers testés par des scale-ups',
      seoDescription: '12 leviers de growth marketing validés par des scale-ups françaises : SEO programmatique, viralité produit, pricing, rétention et plus.',
      blocks: [
        p('Le growth marketing souffre d\'une abondance de recettes et d\'une pénurie de preuves. Pour y voir clair, nous avons interrogé les responsables growth de douze scale-ups françaises, de la fintech au SaaS industriel, sur les leviers qu\'elles ont réellement testés, mesurés et conservés. Résultat : douze pratiques récurrentes, présentées ici avec leurs conditions de réussite — car aucun levier ne fonctionne partout.'),
        h2('Acquisition : les leviers qui tiennent leurs promesses'),
        p('Le SEO programmatique arrive en tête des retours positifs : générer des milliers de pages utiles à partir de données structurées — comparatifs, calculatrices, annuaires spécialisés — reste le moyen le plus rentable d\'acquérir du trafic qualifié. Vient ensuite la viralité produit : intégrer le partage au cœur de l\'usage, quand le produit s\'y prête vraiment. Enfin, les partenariats de distribution avec des acteurs complémentaires, systématiquement cités comme le canal B2B le plus sous-estimé.'),
        list(
          'SEO programmatique sur données propriétaires : ROI moyen constaté de 4 à 8 sur 18 mois.',
          'Programme de parrainage intégré au produit, avec double récompense côté donneur.',
          'Webinaires sectoriels mensuels, transformés ensuite en bibliothèque de contenu.',
          'Calculatrices et outils gratuits qui capturent l\'intention avant la vente.',
          'Co-marketing avec des éditeurs complémentaires : échange de bases, jamais d\'achat.',
          'Retargeting éditorial : retargeter avec du contenu utile, pas avec la même bannière.'
        ),
        h2('Rétention : là où se cache la vraie croissance'),
        p('Tous les interrogés le confirment : les gains les plus durables viennent de la rétention, pas de l\'acquisition. L\'onboarding repensé en quarante-huit heures d\'accès à la première valeur — le fameux « time to value » — produit les effets les plus visibles. Suivent la segmentation de la communication par niveau de maturité et le programme de succès client proactif, qui détecte les signaux de désengagement avant le mouvement d\'annulation. Un point d\'attention : la qualité perçue du support est revenue dans les entretiens plus souvent que n\'importe quelle tactique d\'acquisition.'),
        callout('À retenir', 'Aucun levier de growth ne compense un produit qui ne retient pas. Testez d\'abord la rétention, investissez ensuite l\'acquisition, et documentez chaque expérience : c\'est la mémoire des tests, plus que les idées, qui fait progresser une équipe growth.'),
      ],
    },
    // 15 ───────────────────────────────────────────────────────
    {
      slug: 'salons-conferences-business-agenda-2026', category: 'evenements', authorKey: 'sophie',
      title: 'Salons & conférences business : notre agenda des rendez-vous incontournables',
      subtitle: 'Tech, retail, finance, industrie : voici les salons et conférences où se noueront les affaires de l\'année, avec nos conseils pour rentabiliser chaque déplacement.',
      tags: ['Innovation', 'Growth'], cover: '/images/cover-evenement-1.jpg',
      views: 620, readingTime: 4, days: 16, hour: 10,
      seoTitle: 'Agenda business : salons et conférences à ne pas manquer',
      seoDescription: 'L\'agenda des salons et conférences business incontournables de l\'année, avec conseils pratiques pour rentabiliser chaque participation.',
      blocks: [
        p('Après deux années de consolidation, le calendrier des événements business a retrouvé sa densité. Entre les méga-salons internationaux et les conférences de niche, le choix n\'a jamais été aussi large — ni le coût d\'une participation mal ciblée aussi élevé. Voici notre sélection des rendez-vous qui comptent, classés par objectif : trouver des clients, recruter, lever des fonds ou simplement comprendre son marché.'),
        h2('Les rendez-vous de la tech et du digital'),
        p('La saison s\'ouvre avec les grandes conférences tech européennes, où les écosystèmes français occupent des stands toujours plus visibles. Les événements spécialisés — cybersécurité, data, IA appliquée — offrent le meilleur ratio qualité des échanges / taille de la foule : c\'est là que les décideurs viennent avec un budget et un problème concret. À l\'inverse, les salons généralistes se transforment progressivement en vitrines médiatiques : utiles pour la marque, moins pour le pipeline commercial.'),
        h2('Retail, industrie, finance : les salons qui font les contrats'),
        list(
          'Salons retail et distribution : les rendez-vous privilégiés des marques qui cherchent des emplacements.',
          'Salons industriels et sous-traitance : deux à trois fois plus de commandes signées que sur les événements 100 % digital.',
          'Conférences finance et capital : le lieu des rencontres investisseurs, à condition d\'obtenir un rendez-vous avant, pas sur place.',
          'Salons de la franchise : l\'entrée la plus concrète dans l\'entrepreneuriat de réseau.'
        ),
        p('Côté budget, la règle empirique des participants réguliers : compter le coût total du déplacement, puis le diviser par le nombre de rendez-vous qualifiés obtenus. En dessous de 150 euros par rendez-vous utile, la participation se justifie ; au-dessus de 400, mieux vaut se demander si le même contact n\'aurait pas pu être pris en visio. Les badges exposant, souvent moins chers que les badges visiteur premium, offrent par ailleurs un accès anticipé précieux pour planifier la journée.'),
        callout('À retenir', 'La règle des participants rentables : trois rendez-vous pris avant l\'événement valent mieux que trois cents cartes de visite collectées dessus. Fixez-vous un objectif chiffré avant d\'y aller, et débriefez-le dans les 48 heures.'),
      ],
    },
    // 16 ───────────────────────────────────────────────────────
    {
      slug: 'recrutement-penurie-talents-pme', category: 'ressources-humaines', authorKey: 'marc',
      title: 'Recrutement en pénurie de talents : ce que font les meilleures PME',
      subtitle: 'Face aux grands groupes, les PME n\'ont ni marque employeur ni salaires mirobolants. Pourtant, certaines recrutent mieux que jamais. Leurs méthodes, décortiquées.',
      tags: ['RH', 'Leadership', 'Productivité'], cover: '/images/cover-management-2.jpg',
      views: 3600, readingTime: 7, days: 15, hour: 9,
      seoTitle: 'Pénurie de talents : comment les PME recrutent',
      seoDescription: 'Pénurie de talents : les méthodes concrètes des PME qui recrutent mieux — sourcing, vitesse, marque employeur locale et fidélisation.',
      blocks: [
        p('La pénurie de talents n\'est plus un sujet de conjoncture : c\'est un état structurel du marché du travail français. Dans ce contexte, les PME partagent un handicap apparent face aux grands groupes : moins de visibilité, des grilles salariales contraintes, et souvent un process de recrutement improvisé. Pourtant, un certain nombre d\'entre elles recrutent remarquablement bien. Leur secret ne tient pas à un budget, mais à une méthode — et à une sincérité que les grandes organisations peinent à imiter.'),
        h2('La vitesse comme arme concurrentielle'),
        p('Le premier facteur différenciant est dérisoirement opérationnel : la rapidité. Là où un grand groupe traîne trois mois entre l\'entretien et l\'offre, les PME performantes bouclent leur process en dix à quinze jours. Ce n\'est pas de la précipitation, c\'est de la préparation : des fiches de poste écrites avant l\'ouverture, des critères de sélection définis à quatre mains, un créneau d\'entretien réservé chaque semaine. Le meilleur candidat est presque toujours celui qu\'on a interviewé en premier — et qu\'on a fait attendre le moins longtemps.'),
        quote('Nous ne gagnons pas contre les grands groupes sur le salaire. Nous gagnons sur le temps de réponse et sur la promesse d\'un métier complet, pas d\'une case dans un organigramme.', 'DG d\'une PME industrielle de 90 salariés'),
        h2('La marque employeur locale, pas nationale'),
        p('Les PME qui recrutent bien ont abandonné l\'idée de rivaliser sur la marque employeur nationale : elles construisent une réputation locale, territoire par territoire. Partenariats avec les lycées et écoles de la zone, présence dans les salons régionaux, témoignages de salariés publiés localement, projets visibles dans la ville. Cette ancrage territorial produit un effet durable : les candidatures spontanées deviennent la première source de recrutement, devant les plateformes d\'emploi.'),
        list(
          'Réponse à chaque candidature sous 72 heures, y compris les refus — personnalisés.',
          'Entretien de suivi à 30, 60 et 90 jours pour sécuriser les recrues (réduction de 40 % des départs précoces).',
          'Transparence totale sur la fourchette de salaire dès l\'annonce : plus de négociation à l\'aveugle.',
          'Découverte du poste en situation réelle, sur une demi-journée, avant la signature.'
        ),
        callout('À retenir', 'En pénurie de talents, la PME ne gagne pas en jouant le jeu des grands : elle gagne en étant plus rapide, plus honnête et plus ancrée localement. Le recrutement devient un projet d\'entreprise, pas une tâche de RH.'),
      ],
    },
    // 17 ───────────────────────────────────────────────────────
    {
      slug: 'retail-proximite-renaissance-centres-villes', category: 'dossiers-analyses', authorKey: 'camille',
      title: 'Le retour du retail de proximité : enquête sur la renaissance des centres-villes',
      subtitle: 'Après des années de vacance commerciale, les commerces de proximité rouvrent, portés par de nouveaux modèles. Notre enquête dans six villes moyennes sur un renouveau que personne n\'avait vu venir.',
      tags: ['Retail', 'E-commerce', 'Franchise'], cover: '/images/cover-dossier-2.jpg',
      trending: true, views: 6200, readingTime: 10, days: 18, hour: 9,
      seoTitle: 'Retail de proximité : la renaissance des centres-villes',
      seoDescription: 'Enquête : comment le commerce de proximité reconquiert les centres-villes français — nouveaux modèles, données, acteurs et conditions de réussite.',
      blocks: [
        p('Le diagnostic semblait acté : centres-villes en perte de vitesse, enseignes en fuite, vitrines condamnées. Sauf que le mouvement s\'est inversé plus vite que prévu. Dans les villes moyennes que nous avons visitées, les taux de vacance commerciale reculent pour la deuxième année consécutive, et de nouveaux commerces ouvrent — souvent portés par des profils inattendus : trentenaires quittant le salariat, artisans revenant au centre, franchises qui redécouvrent la pierre. Cette renaissance a ses règles, et ses fragilités.'),
        img('/images/cover-dossier-1.jpg', 'Rue commerçante animée d\'un centre-ville français en fin de journée', 'Rues commerçantes : le retour du trafic piétonnier change la donne pour les commerces de centre-ville.'),
        h2('Le digital, allié inattendu du magasin'),
        p('La surprise de cette enquête tient au rôle du numérique. Les commerces qui rouvrent ne sont pas des boutiques nostalgiques : ce sont des hybrides. Click & collect, réseaux sociaux locaux, réservation en ligne, livreurs du quartier : le commerce de proximité a adopté les outils du e-commerce sans en subir la logique. Une libraire de 60 mètres carrés réalise désormais 25 % de ses ventes en ligne, avec une marge supérieure à celle du magasin, précisément parce que la commande en ligne draine le client au comptoir.'),
        quote('On nous a dit que le digital tuerait le commerce de proximité. C\'est l\'inverse : il lui a rendu son temps. Le client qui réserve en ligne passe moins de temps à chercher et plus à acheter.', 'Président d\'une union commerciale de ville moyenne'),
        h2('Les nouveaux modèles qui marchent'),
        list(
          'La boutique mutualisée : plusieurs producteurs partagent un même point de vente et ses charges.',
          'Le tiers-lieu commerçant : atelier, vente et événements dans une seule adresse.',
          'La franchise de proximité à format compact : entre 80 et 150 mètres carrés, des investissements divisés par trois.',
          'Le magasin-entrepôt du pur player : le e-commerçant qui ouvre une vitrine physique pour réduire ses retours.'
        ),
        h2('Les fragilités d\'un renouveau'),
        p('Ce retour ne doit rien au hasard, mais tout à trois conditions : des loyers enfin négociés à la baisse, des villes qui investissent dans l\'espace public, et des commerçants qui se regroupent pour animer collectivement. La fragilité demeure : la hausse des charges, la difficulté à recruter des vendeurs qualifiés et la dépendance à l\'énergie rappellent que l\'équilibre reste étroit. Le modèle prospère là où les unions commerciales sont actives, et périclite là où chacun défend son seul comptoir.'),
        callout('À retenir', 'La renaissance du retail de proximité n\'est pas un retour en arrière : c\'est une synthèse inédite entre l\'hyper-local et le numérique. Elle profite aux villes qui traitent le commerce comme un service public économique, pas comme un décor.'),
      ],
    },
    // 18 ───────────────────────────────────────────────────────
    {
      slug: 'portrait-video-autodidacte-formation-en-ligne', category: 'interviews-portraits', authorKey: 'camille',
      title: 'Portrait vidéo : l\'autodidacte qui a démocratisé la formation en ligne',
      subtitle: 'Sans diplôme, il a bâti une plateforme de formation qui compte aujourd\'hui plus d\'un million d\'apprenants francophones. L\'histoire d\'une intuition née d\'un échec scolaire.',
      tags: ['Innovation', 'Productivité', 'IA'], cover: '/images/cover-interview-2.jpg',
      views: 2900, readingTime: 6, days: 17, hour: 8,
      seoTitle: 'Portrait : l\'autodidacte de la formation en ligne',
      seoDescription: 'Portrait vidéo : comment un autodidacte a construit une plateforme de formation en ligne d\'un million d\'apprenants francophones.',
      blocks: [
        p('L\'histoire commence par un échec : sorti du système scolaire à dix-sept ans sans diplôme, il enchaîne les petits boulots et s\'informe le soir sur des forums, faute de pouvoir se payer une formation. Dix-huit ans plus tard, la plateforme qu\'il a fondée compte plus d\'un million d\'apprenants francophones et une équipe de quatre-vingts personnes. Ce portrait vidéo retrace ce parcours improbable, et surtout la conviction qui l\'a porté : la formation doit être accessible, courte et honnête sur ce qu\'elle promet.'),
        video('UF8uR6Z6KLc', 'La vidéo qui l\'a inspiré : le discours de Stanford de Steve Jobs, « connecter les points »'),
        h2('Trois principes contre les promesses creuses'),
        p('Sa plateforme s\'est construite contre les dérives du secteur. Premier principe : chaque formation annonce précisément les compétences acquises, avec des évaluations réelles — pas des quiz décoratifs. Deuxième principe : les contenus sont créés par des praticiens en exercice, payés au succès de leurs cours. Troisième principe : la grille tarifaire est publique et unique, sans ventes flash ni faux rabais. Cette probité, loin de pénaliser la croissance, est devenue son meilleur argument marketing.'),
        quote('J\'ai été ce gamin qui ne pouvait pas payer une formation. Je sais ce que ça fait de vouloir apprendre et de se heurter au prix. Tout mon modèle tient dans ce souvenir.', ''),
        h2('La suite : l\'IA comme tuteur personnel'),
        p('Le prochain chantier de la plateforme est déjà lancé : un tuteur artificiel qui adapte le parcours à chaque apprenant, détecte les blocages et reformule les concepts. L\'équipe y voit moins une révolution qu\'une évidence — la promesse d\'un cours particulier pour tous, enfin tenable économiquement. Les premiers tests montrent une progression des taux de complétion de près de moitié, sur un secteur où l\'abandon reste le grand fléau.'),
        callout('À retenir', 'Ce portrait le démontre : l\'innovation pédagogique naît rarement des institutions, mais de ceux qui ont personnellement manqué d\'accès au savoir. La démocratisation de la formation est un marché — et une mission.'),
      ],
    },
    // 19 ───────────────────────────────────────────────────────
    {
      slug: 'productivite-semaine-4-jours-retour-bureau', category: 'management-leadership', authorKey: 'marc',
      title: 'Productivité : pourquoi les entreprises à 4 jours boudent-elles le retour au bureau ?',
      subtitle: 'Les entreprises françaises qui ont adopté la semaine de quatre jours affichent des taux de retour au bureau inférieurs à la moyenne. Enquête sur un paradoxe révélateur.',
      tags: ['Productivité', 'RH', 'Leadership'], cover: '/images/cover-management-1.jpg',
      trending: true, views: 7600, readingTime: 7, days: 20, hour: 10,
      seoTitle: 'Semaine de 4 jours : le paradoxe du retour au bureau',
      seoDescription: 'Pourquoi les entreprises passées à la semaine de 4 jours résistent au retour au bureau : données, mécanismes et leçons pour les directions.',
      blocks: [
        p('Voici un paradoxe que peu d\'observateurs avaient anticipé : les entreprises françaises passées à la semaine de quatre jours sont celles qui reviennent le moins au bureau obligatoire. Alors que le présentialisme revient en force dans les grands groupes, ces organisations — souvent des PME et ETI de services — maintiennent une flexibilité maximale, et leurs dirigeants l\'assument explicitement. Ce choix n\'a rien d\'un laxisme : il découle directement de la logique qui a permis le passage aux quatre jours.'),
        h2('La même logique : mesurer le résultat, pas la présence'),
        p('Le passage à la semaine de quatre jours impose une refonte complète des indicateurs : impossible de raccourcir la semaine en gardant des objectifs de présence. Les entreprises qui réussissent la transition ont toutes adopté une gouvernance par les résultats — jalons, livrables, qualité mesurée. Une fois cette infrastructure de pilotage en place, la question du lieu de travail devient secondaire : ce qui compte est livré, pas où et quand. Le retour au bureau obligatoire, lui, supposerait de revenir à des indicateurs d\'activité que ces organisations ont précisément abandonnés.'),
        quote('Nous ne pouvons pas imposer le bureau le vendredi : il n\'y a plus de vendredi. Au-delà de la blague, nos indicateurs sont des livrables, et nos équipes les tiennent mieux qu\'avant.', 'PDG d\'une ETI de conseil, passée aux quatre jours il y a deux ans'),
        h2('Ce que disent les chiffres'),
        list(
          'Taux d\'absentisme en baisse moyenne de 20 % sur les entreprises pilotes françaises.',
          'Turnover réduit, surtout chez les profils seniors et les parents de jeunes enfants.',
          'Charge mentale en baisse à condition de revoir la répartition de la charge de travail.',
          'Aucune perte de productivité mesurée dans 70 % des cas suivis, gains dans 20 %.'
        ),
        callout('À retenir', 'La semaine de quatre jours n\'est pas une prime de confort : c\'est une réorganisation profonde du travail qui remplace le temps par le résultat. Une fois cette bascule faite, le retour au bureau obligatoire perd sa raison d\'être — et son acceptabilité.'),
      ],
    },
    // 20 ───────────────────────────────────────────────────────
    {
      slug: 'export-afrique-ouest-opportunites', category: 'business-economie', authorKey: 'marc',
      title: 'Export hors Union européenne : panorama des opportunités en Afrique de l\'Ouest',
      subtitle: 'Croissance démographique, urbanisation rapide, classe moyenne en expansion : l\'Afrique de l\'Ouest offre des débouchés majeurs pour les PME françaises. Panorama sectoriel et conseils pratiques.',
      tags: ['Export', 'Growth', 'Fintech'], cover: '/images/cover-business-1.jpg',
      views: 3900, readingTime: 9, days: 22, hour: 9,
      seoTitle: 'Export : opportunités en Afrique de l\'Ouest',
      seoDescription: 'Panorama des opportunités d\'export des PME françaises vers l\'Afrique de l\'Ouest : secteurs porteurs, méthode d\'entrée et financements.',
      blocks: [
        p('Alors que le commerce franco-européen stagne, l\'Afrique de l\'Ouest affiche une demande soutenue dans des secteurs où l\'offre française est précisément compétitive : agroéquipement, santé, formation professionnelle, énergies renouvelables, ingénierie urbaine. Avec une population qui doublera d\'ici 2050 et des capitales en hypercroissance, la sous-région constitue le premier front d\'exportation hors Union européenne pour les PME qui préparent sérieusement leur entrée.'),
        h2('Les secteurs où la France a une longueur d\'avance'),
        p('Premier gisement : l\'agro-industrie, où la demande d\'équipements de transformation locale explose sous l\'effet des politiques d\'autonomie alimentaire. Deuxième secteur : la santé, avec des besoins massifs en équipements, en formation et en télémédecine. Troisième domaine : la formation professionnelle, où le modèle français d\'apprentissage intéresse directement les gouvernements. Enfin, les énergies décentralisées — solaire hors réseau, mini-réseaux — constituent le marché le plus dynamique, porté par le déficit historique d\'infrastructures.'),
        quote('Les entreprises qui réussissent en Afrique de l\'Ouest ne vendent pas des produits : elles construisent des partenariats de dix ans. La confiance y est l\'actif le plus précieux — et le plus lent à acquérir.', 'Directrice d\'une agence régionale de soutien à l\'export'),
        h2('La méthode d\'entrée : patienter, s\'associer, se financer'),
        list(
          'S\'appuyer d\'abord sur un distributeur local solide, avant d\'envisager une implantation propre.',
          'Recruter un responsable pays originaire de la zone, bilingue, connecté aux réseaux d\'affaires.',
          'Utiliser les garanties publiques de l\'assurance-crédit export pour sécuriser le paiement.',
          'Prévoir des marges pour la logistique : les délais réels dépassent souvent 40 % les prévisions.'
        ),
        p('Le financement du développement à l\'export n\'est plus le frein d\'antan : dispositifs publics d\'accompagnement, garanties de prospection et fonds dédiés aux territoires permettent à une PME de tester un marché pour moins de 30 000 euros. L\'essentiel du risque reste commercial — mal évaluer le cycle de vente local — et se traite par la seule méthode qui fonctionne : passer du temps sur place, régulièrement, pendant au moins deux ans.'),
        callout('À retenir', 'L\'Afrique de l\'Ouest récompense les PME qui s\'y installent avec un horizon long et un partenaire local. Les opportunités sont réelles, mais elles se captent en construisant une présence, pas en expédiant des devis.'),
      ],
    },
    // 21 ── DRAFT ──────────────────────────────────────────────
    {
      slug: 'brouillon-tendances-retail-2027-notes', category: 'dossiers-analyses', authorKey: 'camille',
      title: 'Brouillon : tendances retail 2027, premières notes',
      subtitle: 'Notes de travail pour notre grand dossier annuel sur les tendances du retail : hypothèses à vérifier, experts à contacter, données à consolider.',
      tags: ['Retail', 'E-commerce'], cover: '/images/cover-dossier-1.jpg',
      status: 'DRAFT', views: 0, readingTime: 5, days: 3, hour: 17,
      seoTitle: 'Tendances retail 2027 : notes de travail',
      seoDescription: 'Notes de rédaction pour le dossier tendances retail 2027 : pistes, entretiens à mener et données à vérifier avant publication.',
      blocks: [
        p('NOTE DE RÉDACTION — Ce document est un brouillon de travail. Hypothèse directrice : 2027 marquera la convergence complète entre le commerce physique, le e-commerce et le social commerce, avec la donnée client comme socle unique. À vérifier auprès de trois enseignes pilotes et d\'au moins deux analystes indépendants.'),
        h2('Pistes à creuser'),
        list(
          'L\'automatisation des entrepôts urbains : jusqu\'où le coût d\'installation est-il supportable pour des enseignes moyennes ?',
          'Le paiement biométrique : quel niveau d\'acceptation réel chez les consommateurs français ?',
          'Le social commerce : la France rattrape-t-elle la Chine sur l\'achat natif dans les plateformes sociales ?',
          'La seconde vie intégrée : reprise, reconditionnement et location au cœur des enseignes.'
        ),
        h3('Angle à tester : la data comme pivot'),
        p('Piste secondaire à creuser lors des entretiens : le rôle des données propriétaires dans la fidélisation du commerce physique. Plusieurs enseignes mutualisées testeraient des CRM partagés à l\'échelle d\'une rue — sujet à confirmer, sources potentielles : deux unions commerciales contactées en février. Si le sujet tient, il pourrait constituer un volet séparé du dossier ou un papier autonome.'),
        p('Prochaines étapes : obtenir les chiffres consolidés de vacance commerciale 2026, solliciter la Fédération du e-commerce et de la vente à distance pour un entretien de cadrage, et prévoir une semaine de terrain dans trois villes moyennes. Cible de publication : dossier de 4 000 mots, avec infographies, sous quinze jours après validation du plan.'),
        callout('À retenir (brouillon)', 'Angle proposé : moins « quelles technologies » que « quelle organisation du commerce » — le dossier doit parler aux dirigeants, pas aux seuls innovateurs.'),
      ],
    },
    // 22 ── DRAFT ──────────────────────────────────────────────
    {
      slug: 'note-cadrage-financement-bancaire-startups-deeptech', category: 'financement-levees-fonds', authorKey: 'claire',
      title: 'Note de cadrage : enquête financement bancaire des startups deeptech',
      subtitle: 'Note interne de cadrage pour notre enquête sur le financement bancaire des startups deeptech : problématique, sources, angle et calendrier.',
      tags: ['Financement', 'DeepTech'], cover: '/images/cover-financement-1.jpg',
      status: 'DRAFT', views: 0, readingTime: 6, days: 5, hour: 16,
      seoTitle: 'Enquête : financement bancaire des deeptech',
      seoDescription: 'Note de cadrage interne : enquête sur le financement bancaire des startups deeptech en France — problématique, sources et méthode.',
      blocks: [
        p('NOTE DE CADRAGE — Problématique proposée : pourquoi les banques françaises peinent-elles à financer les startups deeptech, alors que les garanties publiques existent ? L\'hypothèse à tester : le problème n\'est pas l\'appétit des banques mais l\'absence d\'ingénierie financière adaptée à des actifs immatériels et à des cycles de dix ans.'),
        h2('Sources à mobiliser'),
        list(
          'Trois à cinq fondateurs deeptech ayant tenté un financement bancaire (réussi ou échoué).',
          'Deux directions de banques : une filiale innovation et une banque régionale.',
          'Un économiste spécialiste du financement de l\'innovation.',
          'Les données publiques des dispositifs de garantie : volumes, taux d\'attribution, secteurs.'
        ),
        h2('Questions de recherche'),
        p('Quatre questions structureront l\'enquête : quel volume de crédits est réellement accordé aux startups deeptech, avec quels taux de refus documentés ? Quels collatéraux les banques demandent-elles en pratique sur des actifs immatériels ? Les dispositifs publics de garantie réduisent-ils le refus ou seulement le coût du refus ? Et enfin, quels modèles alternatifs émergent — dette venture, financement d\'actifs, copropriété de brevets ?'),
        p('Angle journalistique proposé : partir d\'un cas concret — une startup deeptech en Materials ou en quantique — et dérouler les étapes de sa recherche de financement, de la demande de prêt à la décision du comité. Format cible : 3 500 mots, avec un encadré méthodologique sur les dispositifs existants. Échéance souhaitée : fin de mois, en publication après validation éditoriale.'),
        callout('À retenir (brouillon)', 'Risque de l\'enquête : tomber dans le compte rendu de doxa bancaire. Contre-mesure : exiger de chaque interlocuteur bancaire des chiffres de dossiers acceptés et refusés, pas des principes.'),
      ],
    },
    // 23 ── SCHEDULED ──────────────────────────────────────────
    {
      slug: 'webinaire-reussir-premiere-levee-de-fonds', category: 'evenements', authorKey: 'sophie',
      title: 'Webinaire exclusif : réussir sa première levée de fonds',
      subtitle: 'Notre rédaction organise un webinaire gratuit avec deux investisseurs et un fondateur passé par la case levée : le 60 minutes utile avant votre premier tour de table.',
      tags: ['Levée de fonds', 'Financement'], cover: '/images/cover-evenement-1.jpg',
      status: 'SCHEDULED', views: 0, readingTime: 5, days: 1, hour: 15, scheduledInDays: 3,
      seoTitle: 'Webinaire : réussir sa première levée de fonds',
      seoDescription: 'Inscrivez-vous au webinaire gratuit Réussite Magazine : 60 minutes avec investisseurs et fondateurs pour préparer votre première levée de fonds.',
      blocks: [
        p('Vous préparez votre première levée de fonds ? Réussite Magazine organise un webinaire exclusif de 60 minutes, animé par notre rédaction, avec deux investisseurs actifs en seed et un fondateur qui vient de boucler son tour de table. Objectif : répondre aux questions que personne n\'ose poser — valorisation réaliste, calendrier, erreurs de pitch, négociation du pacte — et donner des repères concrets, chiffrés, sans langue de bois.'),
        h2('Au programme de ces 60 minutes'),
        list(
          'Ce que les investisseurs vérifient réellement en seed : les 10 indicateurs incontournables.',
          'Le pitch deck : structure idéale slide par slide, avec exemples de vrais decks.',
          'Valorisation en 2026 : les fourchettes actuelles selon le stade et le secteur.',
          'Questions du public : 20 minutes d\'échange libre, sans question filtrée.'
        ),
        p('Le webinaire est gratuit, mais le nombre de places est volontairement limité pour préserver la qualité des échanges. Les inscrits reçoivent par avance le kit du participant : modèle de pitch deck, checklist de data room et grille de questions à se poser avant de contacter un fonds. Enregistrement envoyé à tous les inscrits, y compris ceux qui ne pourront pas assister en direct.'),
        h2('Pour qui ce webinaire est-il fait ?'),
        p('Le format cible les fondateurs en phase d\'amorçage ou de pré-amorçage, mais aussi les dirigeants de PME qui envisagent d\'ouvrir leur capital pour la première fois. Aucune connaissance préalable n\'est requise : les vingt premières minutes reviennent sur les fondamentaux, avant d\'entrer dans les détails pratiques. Les questions doivent être posées lors de l\'inscription pour être priorisées.'),
        callout('À retenir', 'Une seule session, puis publication du compte rendu dans la rubrique Événements. Les inscriptions ouvrent à la publication de cet article — prévoyez votre question à l\'avance, le temps passera vite.'),
      ],
    },
  ]

  const authorByKey: Record<string, { id: string; name: string }> = {
    camille: { id: camille.id, name: camille.name },
    marc: { id: marc.id, name: marc.name },
    claire: { id: claire.id, name: claire.name },
    sophie: { id: sophie.id, name: sophie.name },
    karim: { id: karim.id, name: karim.name },
  }

  const createdArticles: Record<string, string> = {} // slug → id
  const publishedSlugs: string[] = []
  for (const a of articles) {
    const status = a.status ?? 'PUBLISHED'
    const isPublished = status === 'PUBLISHED'
    const publishedAt = isPublished ? daysAgo(a.days, a.hour ?? 9, 30) : null
    const createdAt = isPublished ? daysAgo(a.days + 2, 10, 0) : daysAgo(a.days, a.hour ?? 16, 0)
    const scheduledAt = a.scheduledInDays ? daysAhead(a.scheduledInDays, 10, 0) : null
    const likes = Math.round(a.views / 12)
    const created = await prisma.article.create({
      data: {
        slug: a.slug, title: a.title, subtitle: a.subtitle,
        content: JSON.stringify(a.blocks),
        coverImage: a.cover, coverCredit: 'Photo : Réussite Magazine',
        status,
        authorId: authorByKey[a.authorKey].id,
        categoryId: catMap[a.category],
        featured: a.featured !== undefined,
        featuredOrder: a.featured ?? 0,
        trending: a.trending ?? false,
        views: a.views, likes, readingTime: a.readingTime,
        seoTitle: a.seoTitle, seoDescription: a.seoDescription,
        publishedAt, scheduledAt, createdAt,
        tags: { create: a.tags.map(t => ({ tag: { connect: { name: t } } })) },
      },
    })
    await prisma.articleVersion.create({
      data: { articleId: created.id, title: a.title, content: JSON.stringify(a.blocks), savedBy: authorByKey[a.authorKey].name, createdAt: new Date(createdAt.getTime() + 3 * 3600_000) },
    })
    createdArticles[a.slug] = created.id
    if (isPublished) publishedSlugs.push(a.slug)
  }
  console.log(`   ✔ ${articles.length} articles (${publishedSlugs.length} publiés, 2 brouillons, 1 programmé) + 1 version initiale chacun`)

  // ───────────────────────────────────────────────────────────
  // 5. MÉDIAS (bibliothèque d'images du contrat)
  // ───────────────────────────────────────────────────────────
  console.log('🖼️  Création de la bibliothèque média…')
  const medias: Array<[string, string, string]> = [
    ['cover-entrepreneuriat-1.jpg', 'Entrepreneur au travail dans un espace de coworking lumineux', 'entrepreneuriat,cover'],
    ['cover-financement-1.jpg', 'Rencontre entre un fondateur de startup et des investisseurs autour d\'une table', 'financement,cover'],
    ['cover-success-1.jpg', 'Équipe de PME française célébrant un succès commercial', 'success,cover'],
    ['cover-business-1.jpg', 'Vue aérienne d\'un quartier d\'affaires parisien au lever du jour', 'economie,cover'],
    ['cover-management-1.jpg', 'Manager animer une réunion d\'équipe dans une salle de réunion moderne', 'management,cover'],
    ['cover-startups-1.jpg', 'Jeune équipe startup travaillant sur un prototype technologique', 'startups,cover'],
    ['cover-ia-1.jpg', 'Interface d\'intelligence artificielle projetée sur un écran de bureau', 'ia,cover'],
    ['cover-interview-1.jpg', 'Portrait professionnel d\'une dirigeante dans ses bureaux', 'interview,cover'],
    ['cover-dossier-1.jpg', 'Entrepôt logistique moderne avec préparation automatisée des commandes', 'dossier,cover'],
    ['cover-tribune-1.jpg', 'Tribune et plume sur un bureau d\'écriture en noir et blanc', 'tribune,cover'],
    ['cover-evenement-1.jpg', 'Salle de conférence remplie lors d\'un événement business', 'evenement,cover'],
    ['og-default.jpg', 'Image de partage social par défaut du magazine Réussite Magazine', 'og,partage'],
  ]
  for (const [filename, alt, tags] of medias) {
    await prisma.media.create({
      data: {
        url: `/images/${filename}`, publicId: filename.replace('.jpg', ''), filename,
        alt, caption: alt, credit: 'Réussite Magazine', tags, type: 'image',
      },
    })
  }
  console.log(`   ✔ ${medias.length} médias`)

  // ───────────────────────────────────────────────────────────
  // 6. VIDÉOS & PODCASTS
  // ───────────────────────────────────────────────────────────
  console.log('🎬  Création des vidéos…')
  const videos: Array<[string, string, string, string, string, number]> = [
    ['UF8uR6Z6KLc', 'Steve Jobs : le discours de Stanford qui a inspiré une génération d\'entrepreneurs', 'Le discours historique de Stanford en 2005 : relier les points, l\'amour du travail et la conscience de la mort comme moteur de courage entrepreneurial.', 'Inspiration', '15:04', 15200],
    ['u4ZoJKF_VuA', 'Simon Sinek : pourquoi certains inspirent-ils davantage que d\'autres ?', 'Le concept du « pourquoi » appliqué au leadership d\'entreprise : comment les meilleurs dirigeants fédèrent leurs équipes autour d\'une conviction.', 'Stratégie', '18:35', 11800],
    ['Ks-_Mh1QhMc', 'Le pouvoir du langage corporel en négociation d\'affaires', 'Posture, gestes, micro-expressions : ce que votre corps dit avant même que vous parliez, et comment le maîtriser en négociation.', 'Soft skills', '21:03', 9400],
    ['H14bBuluwB8', 'Le courage et la persévérance : la vraie recette du succès entrepreneurial', 'Une conférence courte et percutante sur la résilience : pourquoi les entrepreneurs qui réussissent sont ceux qui recommencent.', 'Inspiration', '06:13', 7300],
    ['eIho2S0ZahI', 'Comment parler pour que les gens vous écoutent en réunion', 'Sept pièges de la communication professionnelle et des exercices concrets pour faire passer vos messages en réunion comme en pitch.', 'Soft skills', '10:19', 5600],
    ['CBYhVcO4WgI', 'Sam Altman : comment lancer une startup de A à Z', 'Du choix de l\'idée aux premières recrues : le cours complet du fondateur sur les fondamentaux du lancement d\'une startup.', 'Stratégie', '44:12', 8700],
  ]
  let vi = 0
  for (const [yt, title, description, playlist, duration, views] of videos) {
    await prisma.video.create({
      data: {
        title, description, youtubeId: yt, thumbnailUrl: `https://i.ytimg.com/vi/${yt}/hqdefault.jpg`,
        duration, playlist, published: true, views, publishedAt: daysAgo(3 + vi * 5, 14, 0),
      },
    })
    vi++
  }
  console.log(`   ✔ ${videos.length} vidéos`)

  console.log('🎙️  Création des podcasts…')
  const podcasts: Array<[string, string, string, string, number, number]> = [
    ['Horizon Talk #1 — L\'IA transforme-t-elle vraiment le management ?', 'Entre promesses et réalité : notre rédaction décortique avec Claire Martin, journaliste tech, ce que l\'IA change concrètement dans le quotidien des managers. Trois témoignages de dirigeants qui ont franchi le pas.', 'Claire Martin, journaliste tech', '28:45', 4200, 32],
    ['Horizon Talk #2 — Lever des fonds en 2026 : la parole aux investisseurs', 'Deux associés de fonds prennent le temps d\'expliquer ce qui fait qu\'un dossier passe, à l\'heure où le marché est redevenu sélectif. Un épisode sans langue de bois pour fondateurs en préparation de tour de table.', 'Marc Dupont, éditeur en chef', '52:10', 3800, 27],
    ['Horizon Talk #3 — Export : cap sur l\'Afrique de l\'Ouest', 'Aïcha Diallo, consultante export, détaille les secteurs porteurs et les pièges classiques des PME qui se lancent hors Union européenne. Avec le témoignage d\'un industriel installé à Abidjan depuis cinq ans.', 'Aïcha Diallo, consultante export', '36:20', 2600, 22],
    ['Horizon Talk #4 — Retail : la revanche des commerces de proximité', 'Paul Nkemba, dirigeant d\'une enseigne de centre-ville, raconte comment son réseau a inversé la courbe de la vacance commerciale. Un épisode optimiste sur le commerce qui se réinvente.', 'Paul Nkemba, dirigeant de RetailBoost', '31:05', 1900, 17],
    ['Horizon Talk #5 — Les coulisses d\'une scale-up à 100 millions', 'Camille Rousseau, directrice de la rédaction, a suivi pendant six mois la direction d\'une scale-up française passée le cap des 100 millions d\'euros de chiffre d\'affaires. Récit immersif des tensions, des choix et des joies d\'une hypercroissance maîtrisée.', 'Camille Rousseau, directrice de la rédaction', '44:30', 5100, 12],
  ]
  let pi = 0
  for (const [title, description, guests, duration, plays, d] of podcasts) {
    const n = ++pi
    await prisma.podcast.create({
      data: {
        title, description, audioUrl: `https://www.soundhelix.com/examples/mp3/SoundHelix-Song-${n}.mp3`,
        duration, season: 1, episode: n, coverImage: `/images/podcast-${n}.jpg`,
        guests, published: true, plays, publishedAt: daysAgo(d, 12, 0),
      },
    })
  }
  console.log(`   ✔ ${podcasts.length} épisodes de podcast (saison 1)`)

  // ───────────────────────────────────────────────────────────
  // 7. PAGES STATIQUES
  // ───────────────────────────────────────────────────────────
  console.log('📄  Création des pages statiques…')
  const mkPage = (slug: string, title: string, content: string, seoTitle: string, seoDescription: string) =>
    prisma.staticPage.create({ data: { slug, title, content, seoTitle, seoDescription, published: true } })

  await mkPage('a-propos', 'À propos de Réussite Magazine',
    'Réussite Magazine est né en 2023 d\'un constat simple : les entrepreneurs francophones méritaient un média à la hauteur de leurs ambitions, exigeant et accessible à la fois.\n\n## Notre mission\n\nNous décryptons l\'économie réelle de celles et ceux qui la font : créateurs d\'entreprise, dirigeants de PME et d\'ETI, acteurs de l\'innovation. Pas de recettes miracles ni de jargon inutile : des analyses documentées, des enquêtes de terrain et des interviews sincères pour comprendre et anticiper l\'économie de demain.\n\n## Notre équipe\n\nCamille Rousseau — Directrice de la rédaction : dix-huit ans de presse économique, ancienne rédactrice en chef adjointe d\'un grand hebdomadaire économique.\n\nMarc Dupont — Éditeur en chef : vingt ans de presse économique, spécialiste des questions d\'entreprise et de marché.\n\nClaire Martin — Rédactrice startups & innovation : elle couvre l\'écosystème tech français depuis ses débuts.\n\nSophie Leroy — Community manager : elle anime la communauté et la newsletter hebdomadaire.\n\nKarim Benali — Régie publicitaire : votre contact pour les partenariats et campagnes.\n\n## Réussite Magazine en chiffres\n\nPlus de 250 000 lecteurs mensuels, 1 200 articles publiés, 40 interviews par an et une newsletter lue par 18 000 abonnés chaque mardi.\n\n## Notre ligne éditoriale\n\nIndépendance, rigueur et proximité : nous vérifions chaque chiffre, nous allons sur le terrain et nous donnons la parole à toutes les sensibilités économiques. Nos tribunes engagent leurs auteurs, nos dossiers sont signés par la rédaction.',
    'À propos de Réussite Magazine — Notre mission et notre équipe',
    'Découvrez l\'équipe, la mission et la ligne éditoriale de Réussite Magazine, le magazine de référence de l\'entrepreneuriat francophone.')

  await mkPage('mentions-legales', 'Mentions légales',
    'Réussite Magazine est édité par la société Horizon Média SAS, au capital de 50 000 euros, immatriculée au RCS de Paris sous le numéro 912 345 678.\n\nSiège social : 18 rue de la Paix, 75002 Paris, France. Téléphone : +33 1 84 80 20 26. Courriel : contact@reussitemagazine.com.\n\nDirecteur de la publication : Camille Rousseau, en sa qualité de directrice de la rédaction. Hébergement : le site est hébergé dans l\'Union européenne par un prestataire professionnel garantissant une disponibilité supérieure à 99,9 %.\n\nPropriété intellectuelle : l\'ensemble des contenus (textes, images, vidéos, podcasts, logos) est protégé par le droit d\'auteur. Toute reproduction, même partielle, sans autorisation écrite préalable est interdite. Les liens profonds vers nos articles sont autorisés sous réserve de citer la source.\n\nResponsabilité : les tribunes publiées engagent uniquement leurs auteurs. Les informations diffusées sont fournies à titre indicatif et ne constituent ni un conseil en investissement ni un conseil juridique.',
    'Mentions légales — Réussite Magazine',
    'Mentions légales du site Réussite Magazine : éditeur, directeur de publication, hébergement, propriété intellectuelle et responsabilité.')

  await mkPage('politique-confidentialite', 'Politique de confidentialité',
    'Réussite Magazine s\'engage à protéger vos données personnelles conformément au Règlement général sur la protection des données (RGPD) et à la loi Informatique et Libertés.\n\n## Données collectées\n\nNous collectons uniquement les données nécessaires : adresse e-mail pour la newsletter, nom et e-mail pour les commentaires, données de navigation agrégées et anonymisées pour mesurer l\'audience. Aucune donnée sensible n\'est collectée.\n\n## Finalités\n\nVos données servent exclusivement à : vous adresser nos communications si vous y avez consenti, modérer et publier vos commentaires, mesurer l\'audience du site de façon agrégée. Elles ne sont jamais vendues ni cédées à des tiers.\n\n## Durée de conservation\n\nLes abonnés newsletter : jusqu\'à désinscription. Les commentaires : jusqu\'à suppression demandée. Les données d\'audience : 13 mois maximum.\n\n## Vos droits\n\nConformément au RGPD, vous disposez des droits d\'accès, de rectification, d\'effacement, de limitation, d\'opposition et de portabilité. Pour les exercer, écrivez à privacy@reussitemagazine.com : nous répondons sous 30 jours maximum.\n\n## Cookies\n\nSeuls les cookies strictement nécessaires et, avec votre consentement, les cookies de mesure d\'audience sont déposés. Vous pouvez modifier votre choix à tout moment depuis le bandeau de consentement.',
    'Politique de confidentialité — Réussite Magazine',
    'Comment Réussite Magazine collecte, utilise et protège vos données personnelles, conformément au RGPD. Vos droits et nos engagements.')

  await mkPage('cgu', 'Conditions générales d\'utilisation',
    'Les présentes conditions régissent l\'accès au site Réussite Magazine et son utilisation. En naviguant sur le site, vous acceptez ces conditions sans réserve.\n\n## Accès au service\n\nLe site est accessible gratuitement, 24 heures sur 24, sous réserve de la disponibilité technique. Nous nous réservons le droit de modifier, suspendre ou interrompre le service pour maintenance ou pour tout autre motif, sans préavis.\n\n## Utilisation des contenus\n\nLes contenus sont destinés à un usage personnel et privé. Toute extraction systématique, republication ou utilisation commerciale sans accord écrit est interdite. Les commentaires publiés par les utilisateurs reflètent leur opinion seule : nous nous réservons le droit de modérer, de déplacer ou de supprimer tout contenu contraire à nos règles de courtoisie ou à la loi.\n\n## Comptes et abonnement newsletter\n\nL\'inscription à la newsletter est volontaire et révocable à tout moment via le lien de désinscription présent dans chaque e-mail. La création d\'un compte lecteur implique l\'exactitude des informations fournies.\n\n## Droit applicable\n\nLes présentes conditions sont soumises au droit français. En cas de litige, les tribunaux français seront seuls compétents après tentative de résolution amiable.',
    'Conditions générales d\'utilisation — Réussite Magazine',
    'CGU de Réussite Magazine : conditions d\'accès, d\'utilisation des contenus, modération des commentaires et newsletter.')

  await mkPage('espace-annonceurs', 'Espace annonceurs',
    'Réussite Magazine touche chaque mois plus de 250 000 décideurs : entrepreneurs, dirigeants de PME et d\'ETI, investisseurs et responsables innovation. Proposez vos produits à une audience engagée, qualifiée et à fort pouvoir d\'achat.\n\n## Nos formats publicitaires\n\nBannière header (970x90) : visibilité maximale dès l\'arrivée sur le site. À partir de 1 800 euros HT / mois.\n\nColonne latérale (300x250 et 300x600) : présence continue pendant la lecture. À partir de 950 euros HT / mois.\n\nIn-article (336x280) : intégration au cœur du contenu éditorial. À partir de 750 euros HT / mois.\n\nContenu sponsorisé (NATIVE) : article ou carte produite avec notre rédaction, clairement signalée « Sponsorisé ». À partir de 3 500 euros HT le format.\n\nInterstitiel et sticky mobile : couverture complète des visiteurs mobiles. Sur devis.\n\n## Pourquoi nous choisir\n\nTaux d\'attention exceptionnel : 4 minutes 30 de temps moyen par article. Audience B2B qualifiée à 68 %. Reporting détaillé avec impressions et clics en temps réel dans votre espace annonceur.\n\n## Contact\n\nNotre régie vous répond sous 24 heures : regie@reussitemagazine.com — ou consultez la page « Espace annonceurs » depuis le menu. Les placements sont attribués par rotation pondérée, avec exclusivité de catégorie sur demande.',
    'Espace annonceurs — Publicité sur Réussite Magazine',
    'Formats publicitaires, tarifs et audience de Réussite Magazine : bannières, in-article, contenus sponsorisés et interstitiels pour annonceurs B2B.')

  console.log(`   ✔ 5 pages statiques`)

  // ───────────────────────────────────────────────────────────
  // 8. MENUS (header + footer)
  // ───────────────────────────────────────────────────────────
  console.log('🧭  Création des menus…')
  const headerItems: Array<[string, string, number]> = [
    ['Accueil', '#/', 0],
    ['Entrepreneuriat', '#/category/entrepreneuriat', 1],
    ['Business & Économie', '#/category/business-economie', 2],
    ['Management & Leadership', '#/category/management-leadership', 3],
    ['Startups & Innovation', '#/category/startups-innovation', 4],
    ['Interviews & Portraits', '#/category/interviews-portraits', 5],
    ['Dossiers & Analyses', '#/category/dossiers-analyses', 6],
    ['Tribune Libre', '#/category/tribune-libre', 7],
    ['Vidéos', '#/videos', 8],
    ['Podcasts', '#/podcasts', 9],
    ['Contact', '#/contact', 10],
  ]
  for (const [label, url, order] of headerItems) {
    await prisma.menuItem.create({ data: { label, url, location: 'header', order, active: true } })
  }
  const footerParents: Array<[string, number]> = [['Rubriques', 0], ['Ressources', 1], ['Légal', 2]]
  const parentIds: string[] = []
  for (const [label, order] of footerParents) {
    const item = await prisma.menuItem.create({ data: { label, url: '', location: 'footer', order, active: true } })
    parentIds.push(item.id)
  }
  const footerChildren: Array<[string, string, number, number]> = [
    // Rubriques
    ['Entrepreneuriat', '#/category/entrepreneuriat', 0, 0],
    ['Business & Économie', '#/category/business-economie', 0, 1],
    ['Startups & Innovation', '#/category/startups-innovation', 0, 2],
    ['Management & Leadership', '#/category/management-leadership', 0, 3],
    ['Interviews & Portraits', '#/category/interviews-portraits', 0, 4],
    ['Dossiers & Analyses', '#/category/dossiers-analyses', 0, 5],
    // Ressources
    ['Vidéos', '#/videos', 1, 0],
    ['Podcasts', '#/podcasts', 1, 1],
    ['Newsletter', '#/newsletter', 1, 2],
    ['Espace annonceurs', '#/announcers', 1, 3],
    // Légal
    ['À propos', '#/page/a-propos', 2, 0],
    ['Mentions légales', '#/page/mentions-legales', 2, 1],
    ['CGU', '#/page/cgu', 2, 2],
    ['Confidentialité', '#/page/politique-confidentialite', 2, 3],
    ['Contact', '#/contact', 2, 4],
  ]
  for (const [label, url, parentIdx, order] of footerChildren) {
    await prisma.menuItem.create({ data: { label, url, location: 'footer', parentId: parentIds[parentIdx], order, active: true } })
  }
  console.log(`   ✔ ${headerItems.length} entrées header + ${footerParents.length + footerChildren.length} entrées footer (3 colonnes)`)

  // ───────────────────────────────────────────────────────────
  // 9. PUBLICITÉ (emplacements + campagnes)
  // ───────────────────────────────────────────────────────────
  console.log('📢  Création de la régie publicitaire…')
  const placements: Array<[string, string, string]> = [
    ['HEADER_BANNER', 'Bannière sous le menu', '970x90'],
    ['SIDEBAR_TOP', 'Colonne latérale haut', '300x250'],
    ['SIDEBAR_STICKY', 'Colonne latérale sticky', '300x600'],
    ['IN_ARTICLE', 'In-article', '336x280'],
    ['NATIVE', 'Sponsorisé grille', 'carte'],
    ['FOOTER_BANNER', 'Bannière pied de page', '970x90'],
    ['INTERSTITIAL', 'Interstitiel', 'plein'],
    ['STICKY_MOBILE', 'Sticky mobile', '320x50'],
  ]
  const placementIds: Record<string, string> = {}
  for (const [key, label, format] of placements) {
    const pl = await prisma.adPlacement.create({ data: { key, label, format, active: true } })
    placementIds[key] = pl.id
  }

  const mkCampaign = async (
    placementKey: string, name: string, advertiser: string, imageUrl: string, weight: number,
    impressions: number, ctr: number, device: string = 'ALL', categoryTargeting: string = '',
    startDaysAgo = 5, endInDays = 60,
  ) => {
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
    await prisma.adCampaign.create({
      data: {
        placementId: placementIds[placementKey], name, advertiser, imageUrl,
        targetUrl: `https://exemple-annonceur.fr?utm_source=reussitemagazine&utm_medium=banner&utm_campaign=${slug}`,
        weight, deviceTargeting: device, categoryTargeting,
        startDate: daysAgo(startDaysAgo, 0, 0), endDate: daysAhead(endInDays, 23, 59),
        active: true, impressions, clicks: Math.round(impressions * ctr),
      },
    })
  }
  await mkCampaign('HEADER_BANNER', 'NextBank Pro — Bannière header', 'NextBank Pro', '/images/ad-banner-1.jpg', 3, 45000, 0.014)
  await mkCampaign('HEADER_BANNER', 'CloudSuite — ERP 48h', 'CloudSuite', '/images/ad-banner-2.jpg', 1, 22000, 0.011)
  await mkCampaign('SIDEBAR_TOP', 'FundMe — Accélérez votre levée', 'FundMe', '/images/ad-square-1.jpg', 2, 31000, 0.018)
  await mkCampaign('SIDEBAR_STICKY', 'CloudSuite — Sticky latéral', 'CloudSuite', '/images/ad-square-1.jpg', 2, 18000, 0.008)
  await mkCampaign('IN_ARTICLE', 'LegalStart — Créez votre société en ligne', 'LegalStart', '/images/ad-square-1.jpg', 2, 26500, 0.022)
  await mkCampaign('NATIVE', 'NextBank Pro — Sponsorisé grille', 'NextBank Pro', '/images/ad-native-1.jpg', 3, 15000, 0.025)
  await mkCampaign('NATIVE', 'LegalStart — Carte sponsorisée startups', 'LegalStart', '/images/ad-native-1.jpg', 1, 9000, 0.02, 'ALL', 'startups-innovation')
  await mkCampaign('FOOTER_BANNER', 'EcoDrive Énergie — Transition énergétique', 'EcoDrive Énergie', '/images/ad-banner-1.jpg', 2, 19500, 0.006)
  await mkCampaign('STICKY_MOBILE', 'FundMe — Sticky mobile', 'FundMe', '/images/ad-banner-2.jpg', 1, 34000, 0.005, 'MOBILE')
  await mkCampaign('INTERSTITIAL', 'EcoDrive Énergie — Interstitiel', 'EcoDrive Énergie', '/images/ad-banner-2.jpg', 1, 1500, 0.004)
  console.log(`   ✔ 8 emplacements + 10 campagnes actives`)

  // ───────────────────────────────────────────────────────────
  // 10. FLASH INFO + RÉGLAGES + BLOCS D'ACCUEIL
  // ───────────────────────────────────────────────────────────
  console.log('⚡  Création des flash infos et réglages…')
  const flashInfos: Array<[string, string, number]> = [
    ['🔥 Levée de fonds record : la French Tech repasse au-dessus du milliard ce trimestre', '#/category/actualites-economiques', 0],
    ['📌 Nouveau dossier : le grand oral du retail de proximité, à lire cette semaine', '#/category/dossiers-analyses', 1],
    ['🎙️ Horizon Talk #5 : les coulisses d\'une scale-up à 100 millions — disponible', '#/podcasts', 2],
  ]
  for (const [text, link, order] of flashInfos) {
    await prisma.flashInfo.create({ data: { text, link, active: true, order } })
  }
  console.log(`   ✔ 3 flash infos actifs`)

  const homeBlocks = [
    { type: 'FEATURED', title: 'À la Une', categorySlug: '', enabled: true, order: 0 },
    { type: 'LATEST', title: 'Derniers articles', categorySlug: '', enabled: true, order: 1 },
    { type: 'CATEGORY', title: 'Startups & Innovation', categorySlug: 'startups-innovation', enabled: true, order: 2 },
    { type: 'CATEGORY', title: 'Management & Leadership', categorySlug: 'management-leadership', enabled: true, order: 3 },
    { type: 'MEDIA', title: 'Dernières vidéos & podcasts', categorySlug: '', enabled: true, order: 4 },
    { type: 'CATEGORY', title: 'Business & Économie', categorySlug: 'business-economie', enabled: true, order: 5 },
  ]
  const settings: Record<string, string> = {
    siteName: 'Réussite Magazine',
    tagline: 'Entrepreneuriat · Business · Innovation',
    logoText: 'BUSINESS HORIZON',
    contactEmail: 'contact@reussitemagazine.com',
    contactPhone: '+33 1 84 80 20 26',
    contactAddress: '18 rue de la Paix, 75002 Paris, France',
    contactHours: 'Lun-Ven : 9h-18h',
    facebook: 'https://facebook.com/reussitemagazine',
    twitter: 'https://x.com/reussitemagazinefr',
    linkedin: 'https://linkedin.com/company/reussite-magazine',
    youtube: 'https://youtube.com/@reussitemagazine',
    whatsapp: '',
    seoTitle: 'Réussite Magazine — Magazine Entrepreneuriat, Business & Innovation',
    seoDescription: 'La référence francophone de l\'entrepreneuriat et de l\'innovation : articles, dossiers, interviews, vidéos et podcasts.',
    ogImage: '/images/og-default.jpg',
    commentsEnabled: 'true',
    darkModeEnabled: 'true',
    readerAccountsEnabled: 'true',
    flashInfoEnabled: 'true',
    newsletterPopupEnabled: 'true',
    newsletterPopupTitle: 'Ne manquez rien de l\'actualité business',
    newsletterPopupText: 'Recevez chaque semaine notre sélection d\'articles, dossiers et interviews dans votre boîte mail.',
    newsletterPopupTrigger: 'TIME',
    newsletterPopupDelay: '12',
    newsletterPopupScroll: '55',
    newsletterPopupFrequency: 'SESSION',
    newsletterHeroTitle: 'La newsletter des entrepreneurs qui veulent aller plus loin',
    newsletterHeroText: 'Chaque mardi : nos meilleurs articles, les financements à suivre et une interview exclusive.',
    partnersTitle: 'Ils nous font confiance',
    partnersLogos: 'NextBank Pro\nCloudSuite\nFundMe\nEcoDrive\nLegalStart',
    footerAbout: 'Réussite Magazine est le magazine digital de référence des entrepreneurs, dirigeants et décideurs : décryptages, interviews et analyses pour comprendre et anticiper l\'économie de demain.',
    adsHeaderEnabled: 'true',
    adsSidebarEnabled: 'true',
    adsInArticleEnabled: 'true',
    adsFooterEnabled: 'true',
    adsStickyMobileEnabled: 'true',
    adsNativeEnabled: 'true',
    adsInterstitialEnabled: 'false',
    themeColor: '#C8102E',
    // Clés complémentaires
    copyrightText: '© 2026 Réussite Magazine — Tous droits réservés',
    rssEnabled: 'true',
    analyticsEnabled: 'true',
    commentsModeration: 'true',
    homeBlocks: JSON.stringify(homeBlocks),
  }
  for (const [key, value] of Object.entries(settings)) {
    await prisma.siteSetting.create({ data: { key, value } })
  }
  console.log(`   ✔ ${Object.keys(settings).length} réglages (dont homeBlocks JSON)`)

  // ───────────────────────────────────────────────────────────
  // 11. COMMENTAIRES (9 approuvés, 3 en attente, 2 réponses)
  // ───────────────────────────────────────────────────────────
  console.log('💬  Création des commentaires…')
  type CommentSeed = { slug: string; authorName: string; authorEmail: string; content: string; status: string; reply?: string; days: number }
  const comments: CommentSeed[] = [
    { slug: 'levee-de-fonds-guide-complet-investisseurs-2026', authorName: 'Thomas Lefèvre', authorEmail: 't.lefevre.pro@gmail.com', content: 'Article très complet, merci ! La partie sur le timing des rendez-vous par vagues correspond exactement à ce que j\'ai vécu sur ma série A. Le conseil sur le data room à préparer six mois avant mériterait d\'être gravé sur tous les pitch decks.', status: 'APPROVED', days: 1 },
    { slug: 'levee-de-fonds-guide-complet-investisseurs-2026', authorName: 'Amina Kessler', authorEmail: 'amina.kessler@outlook.fr', content: 'Une question : le guide parle de multiples de 4 à 7 fois le chiffre d\'affaires, est-ce valable aussi pour les modèles marketplace avec du revenu net ?', status: 'PENDING', days: 1 },
    { slug: 'intelligence-artificielle-tpe-rentabilite', authorName: 'Gérard Moreau', authorEmail: 'g.moreau89@orange.fr', content: 'Je suis artisan plombier et j\'utilise un assistant IA pour mes devis depuis six mois. Le chiffre de cinq heures gagnées par semaine est carrément en dessous de la réalité pour moi. Bon article, concret, sans blabla.', status: 'APPROVED', reply: 'Merci Gérard pour ce retour de terrain ! C\'est exactement le genre d\'expérience que nous aimons relayer. Votre cas inspire sûrement d\'autres artisans.', days: 2 },
    { slug: 'intelligence-artificielle-tpe-rentabilite', authorName: 'Julie Andrieu', authorEmail: 'julie.andrieu@laposte.net', content: 'Dommage que la partie juridique soit si courte, c\'est LE frein dans ma PME. Un dossier dédié aux aspects RGPD de l\'IA serait le bienvenu.', status: 'PENDING', days: 2 },
    { slug: 'management-hybride-federer-equipe-distance', authorName: 'Nicolas Berger', authorEmail: 'n.berger.consult@gmail.com', content: 'Le point sur l\'asymétrie de visibilité entre présents et distants est crucial. Dans mon équipe, c\'est la note écrite de décisions qui a tout changé : plus de couloir, plus de rumeurs.', status: 'APPROVED', days: 3 },
    { slug: 'management-hybride-federer-equipe-distance', authorName: 'Sophie Nguyen', authorEmail: 'sophie.nguyen.rh@gmail.com', content: 'En tant que DRH, je valide à 100 % le rituel du créneau « sans réunion ». Il nous a fallu un an pour l\'imposer, mais le travail de fond a enfin une place.', status: 'APPROVED', days: 3 },
    { slug: 'dossier-e-commerce-francais-10-ans-revolutions', authorName: 'Laurent Gispert', authorEmail: 'laurent@gispert-commerce.fr', content: 'Dossier de très belle facture. J\'ai vécu les trois vagues décrites et le décryptage sur la marge unitaire est juste : depuis 2023, c\'est LA discussion dans tous les comités de direction e-commerce que j\'anime.', status: 'APPROVED', days: 4 },
    { slug: 'dossier-e-commerce-francais-10-ans-revolutions', authorName: 'Marion Petitjean', authorEmail: 'm.petitjean.shop@free.fr', content: 'Le paragraphe sur le click & collect en zone rurale résonne fort chez moi. Nos clients viennent retirer en magasin et repartent avec deux produits supplémentaires. La boucle est vertueuse.', status: 'APPROVED', days: 5 },
    { slug: 'portrait-fondatrice-40-millions-independance', authorName: 'Éric Dantec', authorEmail: 'eric.dantec@proton.me', content: 'Rare portrait d\'entrepreneure qui n\'a pas suivi le chemin imposé de la levée de fonds. La phrase sur le refus du premier rachat est vertigineuse. Chapeau pour l\'interview, les questions sont excellentes.', status: 'APPROVED', days: 5 },
    { slug: 'retail-proximité-placeholder', authorName: 'placeholder', authorEmail: 'placeholder@placeholder.fr', content: 'placeholder', status: 'PENDING', days: 99 },
    { slug: 'retail-proximité-placeholder', authorName: 'placeholder', authorEmail: 'placeholder@placeholder.fr', content: 'placeholder', status: 'PENDING', days: 99 },
    { slug: 'retail-proximité-placeholder', authorName: 'placeholder', authorEmail: 'placeholder@placeholder.fr', content: 'placeholder', status: 'APPROVED', days: 99 },
  ]
  // Remplacement des placeholders par de vrais commentaires
  comments[9] = { slug: 'retail-proximite-renaissance-centres-villes', authorName: 'Fabienne Roche', authorEmail: 'fabienne.roche@wanadoo.fr', content: 'Commerçante à Albi, je confirme l\'analyse : depuis notre union commerciale relancée, le taux de vacance a baissé de moitié dans la rue. Le terrain raconté comme ça, ça fait du bien.', status: 'APPROVED', days: 6 }
  comments[10] = { slug: 'portrait-video-autodidacte-formation-en-ligne', authorName: 'Karim Saada', authorEmail: 'k.saada.dev@gmail.com', content: 'J\'ai appris à coder sur sa plateforme quand personne ne voulait de mon CV. Si l\'équipe lit ces commentaires : merci, vraiment. Le principe du prix unique et transparent change tout.', status: 'PENDING', days: 6 }
  comments[11] = { slug: 'productivite-semaine-4-jours-retour-bureau', authorName: 'Hélène Vasseur', authorEmail: 'h.vasseur.conseil@gmail.com', content: 'Notre ETI est passée aux quatre jours en 2024 et tout ce paragraphe sur la gouvernance par les résultats est juste. On ne peut pas vivre la moitié du temps : soit on mesure les livrables, soit on mesure la présence. Pas les deux.', status: 'APPROVED', days: 7 }
  for (const c of comments) {
    const articleId = createdArticles[c.slug]
    if (!articleId) continue
    await prisma.comment.create({
      data: {
        articleId, authorName: c.authorName, authorEmail: c.authorEmail, content: c.content,
        status: c.status, reply: c.reply ?? '', createdAt: daysAgo(c.days, 12, 15),
      },
    })
  }
  console.log(`   ✔ 12 commentaires (9 approuvés, 3 en attente, 2 réponses rédaction)`)

  // ───────────────────────────────────────────────────────────
  // 12. NEWSLETTER (abonnés + campagnes)
  // ───────────────────────────────────────────────────────────
  console.log('✉️  Création des abonnés newsletter…')
  const subscribers: Array<[string, string, string, string, boolean]> = [
    ['pierre.lambert@gmail.com', 'Pierre Lambert', 'entrepreneuriat,financement-levees-fonds', 'popup', true],
    ['nadia.benali@orange.fr', 'Nadia Benali', 'startups-innovation,intelligence-artificielle', 'footer', true],
    ['jf.morel.consult@outlook.fr', 'Jean-François Morel', 'business-economie,marches-secteurs', 'article', true],
    ['celine.dubois@proton.me', 'Céline Dubois', 'management-leadership,ressources-humaines', 'popup', true],
    ['ahmad.diallo@gmail.com', 'Ahmad Diallo', 'export,business-economie', 'footer', true],
    ['laurence.perrot@free.fr', 'Laurence Perrot', 'dossiers-analyses,retail', 'popup', true],
    ['maxime.roy@laposte.net', 'Maxime Roy', 'tech-digital,growth', 'article', true],
    ['sandrine.weber@gmail.com', 'Sandrine Weber', 'rse,strategie-entreprise', 'popup', true],
    ['olivier.marty@icloud.com', 'Olivier Marty', 'financement-levees-fonds,deeptech', 'footer', true],
    ['patricia.gomes@orange.fr', 'Patricia Gomes', 'interviews-portraits,entrepreneuriat', 'popup', true],
    ['baptiste.roux@gmail.com', 'Baptiste Roux', 'fintech,marches-secteurs', 'article', true],
    ['emilie.charles@outlook.fr', 'Émilie Charles', 'evenements,innovation', 'footer', true],
    ['david.klein@proton.me', 'David Klein', 'intelligence-artificielle,productivite', 'popup', true],
    ['veronique.lassus@free.fr', 'Véronique Lassus', 'creation-entreprise,franchise', 'footer', true],
    ['tangy.lebras@gmail.com', 'Tanguy Le Bras', 'success-stories,growth', 'article', true],
    ['anne.sophie.bret@gmail.com', 'Anne-Sophie Bret', 'ressources-humaines,leadership', 'popup', true],
    ['contact@atelierbois43.fr', 'Atelier Bois 43', 'entrepreneuriat,creation-entreprise', 'article', false],
    ['m.fournier62@orange.fr', 'Michel Fournier', 'retail', 'popup', false],
  ]
  let si = 0
  for (const [email, name, interests, source, active] of subscribers) {
    await prisma.newsletterSubscriber.create({
      data: { email, name, interests, source, active, createdAt: daysAgo(2 + si * 2, 10, 45) },
    })
    si++
  }
  console.log(`   ✔ 18 abonnés (16 actifs, 2 inactifs)`)

  console.log('📨  Création des campagnes newsletter…')
  const featuredSlugs = ['levee-de-fonds-guide-complet-investisseurs-2026', 'intelligence-artificielle-tpe-rentabilite', 'dossier-e-commerce-francais-10-ans-revolutions']
  const sentCampaign = await prisma.newsletterCampaign.create({
    data: {
      subject: 'Horizon Hebdo #12 — IA rentable, export gagnant et la levée de fonds du guide',
      intro: 'Bonjour,\n\nCette semaine : notre guide complet de la levée de fonds, les TPE qui rentabilisent l\'IA et le retour du retail de proximité. Bonne lecture !',
      articleIds: featuredSlugs.map(s => createdArticles[s]).join(','),
      status: 'SENT', sentAt: daysAgo(7, 8, 0), recipients: 16, openRate: 0.46, clickRate: 0.13,
      createdAt: daysAgo(8, 15, 0),
    },
  })
  await prisma.newsletterCampaign.create({
    data: {
      subject: 'Horizon Hebdo #13 — Spéciale financement deeptech',
      intro: 'En préparation : notre enquête sur le financement bancaire des startups deeptech et le compte rendu du webinaire levée de fonds.',
      articleIds: createdArticles['note-cadrage-financement-bancaire-startups-deeptech'] ?? '',
      status: 'DRAFT', createdAt: daysAgo(1, 11, 30),
    },
  })
  console.log(`   ✔ 2 campagnes (1 envoyée à ${sentCampaign.recipients} destinataires, 1 brouillon)`)

  // ───────────────────────────────────────────────────────────
  // 13. ANALYTICS (1000 événements sur 30 jours) + AUDIT
  // ───────────────────────────────────────────────────────────
  console.log('📊  Génération des événements d\'analytics…')
  const events: Array<{ type: string; path: string; meta: string; createdAt: Date }> = []
  const skewedDay = () => Math.floor(Math.pow(Math.random(), 0.55) * 30) // plus dense sur les jours récents
  const workHour = () => 8 + Math.floor(Math.random() * 12) // 8h → 19h
  const randEventDate = () => {
    const d = new Date(NOW - skewedDay() * DAY)
    d.setHours(workHour(), Math.floor(Math.random() * 60), Math.floor(Math.random() * 60), 0)
    return d
  }
  const pushEvents = (type: string, count: number, pathFn: () => string) => {
    for (let i = 0; i < count; i++) events.push({ type, path: pathFn(), meta: '{}', createdAt: randEventDate() })
  }
  pushEvents('PAGE_VIEW', 680, () => (Math.random() < 0.35 && publishedSlugs.length ? `/article/${publishedSlugs[Math.floor(Math.random() * publishedSlugs.length)]}` : '/'))
  pushEvents('ARTICLE_VIEW', 200, () => `/article/${publishedSlugs[Math.floor(Math.random() * publishedSlugs.length)]}`)
  pushEvents('SEARCH', 40, () => '/search')
  pushEvents('NEWSLETTER_SUB', 20, () => '/newsletter')
  pushEvents('AD_CLICK', 60, () => (Math.random() < 0.5 ? '/' : `/article/${publishedSlugs[Math.floor(Math.random() * publishedSlugs.length)]}`))
  const BATCH = 250
  for (let i = 0; i < events.length; i += BATCH) {
    await prisma.analyticsEvent.createMany({ data: events.slice(i, i + BATCH) })
  }
  console.log(`   ✔ ${events.length} événements sur 30 jours (680 vues page, 200 vues article, 40 recherches, 20 inscriptions, 60 clics pub)`)

  console.log('🔐  Création du journal d\'audit…')
  const audits: Array<{ userId: string; userName: string; action: string; details: string; days: number; hour: number }> = [
    { userId: camille.id, userName: camille.name, action: 'ARTICLE_PUBLISH', details: 'Publication de l\'article « Levée de fonds : le guide complet pour convaincre les investisseurs en 2026 »', days: 2, hour: 8 },
    { userId: claire.id, userName: claire.name, action: 'ARTICLE_CREATE', details: 'Création de l\'article « Intelligence artificielle : comment les TPE passent de la curiosité à la rentabilité »', days: 3, hour: 10 },
    { userId: sophie.id, userName: sophie.name, action: 'COMMENT_APPROVE', details: 'Approbation du commentaire de Gérard Moreau sur l\'article IA & TPE', days: 2, hour: 12 },
    { userId: karim.id, userName: karim.name, action: 'AD_CAMPAIGN_CREATE', details: 'Création de la campagne « FundMe — Accélérez votre levée » sur SIDEBAR_TOP', days: 5, hour: 14 },
    { userId: marc.id, userName: marc.name, action: 'PAGE_UPDATE', details: 'Mise à jour de la page « Espace annonceurs » (nouvelle grille tarifaire 2026)', days: 6, hour: 16 },
    { userId: sophie.id, userName: sophie.name, action: 'NEWSLETTER_SEND', details: 'Envoi de la campagne « Horizon Hebdo #12 » à 16 destinataires', days: 7, hour: 8 },
    { userId: camille.id, userName: camille.name, action: 'SETTINGS_UPDATE', details: 'Mise à jour des réglages du site (activation de la fenêtre newsletter)', days: 9, hour: 11 },
    { userId: marc.id, userName: marc.name, action: 'ARTICLE_ARCHIVE', details: 'Archivage d\'un article obsolète sur les aides Covid (nettoyage éditorial)', days: 10, hour: 17 },
  ]
  for (const a of audits) {
    await prisma.auditLog.create({ data: { userId: a.userId, userName: a.userName, action: a.action, details: a.details, createdAt: daysAgo(a.days, a.hour, 5) } })
  }
  console.log(`   ✔ 8 entrées d'audit`)

  // ───────────────────────────────────────────────────────────
  // 14. VÉRIFICATIONS FINALES
  // ───────────────────────────────────────────────────────────
  console.log('\n🔎  Vérifications finales…')
  const [nbArticles, nbPublished, nbFeatured, nbCategories, nbVideos, nbPodcasts, nbPlacements, nbCampaigns, nbSettings, nbComments, nbPending, nbSubscribers, nbEvents, nbAudit, nbMedia, nbMenus, nbFlash, nbPages, nbTags] = await Promise.all([
    prisma.article.count(),
    prisma.article.count({ where: { status: 'PUBLISHED' } }),
    prisma.article.count({ where: { featured: true } }),
    prisma.category.count(),
    prisma.video.count(),
    prisma.podcast.count(),
    prisma.adPlacement.count(),
    prisma.adCampaign.count(),
    prisma.siteSetting.count(),
    prisma.comment.count({ where: { status: 'APPROVED' } }),
    prisma.comment.count({ where: { status: 'PENDING' } }),
    prisma.newsletterSubscriber.count(),
    prisma.analyticsEvent.count(),
    prisma.auditLog.count(),
    prisma.media.count(),
    prisma.menuItem.count(),
    prisma.flashInfo.count(),
    prisma.staticPage.count(),
    prisma.tag.count(),
  ])
  console.log('──────────────────────── RÉSUMÉ DU SEED ────────────────────────')
  console.log(`  Articles            : ${nbArticles} (publiés : ${nbPublished} — attendu 20)`)
  console.log(`  Articles à la une   : ${nbFeatured} (attendu 6)`)
  console.log(`  Catégories          : ${nbCategories} (attendu 17)`)
  console.log(`  Tags                : ${nbTags} (attendu 15)`)
  console.log(`  Vidéos              : ${nbVideos} (attendu 6)`)
  console.log(`  Podcasts            : ${nbPodcasts} (attendu 5)`)
  console.log(`  Emplacements pub    : ${nbPlacements} (attendu 8)`)
  console.log(`  Campagnes pub       : ${nbCampaigns} (attendu 10)`)
  console.log(`  Réglages            : ${nbSettings} (attendu ≥ 40)`)
  console.log(`  Pages statiques     : ${nbPages} (attendu 5)`)
  console.log(`  Menus               : ${nbMenus} (header 11 + footer 18)`)
  console.log(`  Flash infos         : ${nbFlash} (attendu 3)`)
  console.log(`  Commentaires        : ${nbComments} approuvés (attendu 9) + ${nbPending} en attente (attendu 3)`)
  console.log(`  Abonnés newsletter  : ${nbSubscribers} (attendu 18)`)
  console.log(`  Campagnes newsletter: ${await prisma.newsletterCampaign.count()} (attendu 2)`)
  console.log(`  Événements analytics: ${nbEvents} (attendu ~1000)`)
  console.log(`  Journal d'audit     : ${nbAudit} (attendu 8)`)
  console.log(`  Médias              : ${nbMedia} (attendu 12)`)
  console.log('────────────────────────────────────────────────────────────────')

  const checks: Array<[string, boolean]> = [
    ['20 articles publiés', nbPublished === 20],
    ['6 articles à la une', nbFeatured === 6],
    ['17 catégories', nbCategories === 17],
    ['6 vidéos', nbVideos === 6],
    ['5 podcasts', nbPodcasts === 5],
    ['8 emplacements publicitaires', nbPlacements === 8],
    ['au moins 40 réglages', nbSettings >= 40],
  ]
  const failed = checks.filter(([, ok]) => !ok)
  if (failed.length) {
    for (const [label] of failed) console.error(`   ✘ ÉCHEC : ${label}`)
    throw new Error(`Seed incomplet : ${failed.length} vérification(s) en échec`)
  }
  console.log('✅  Seed Réussite Magazine terminé avec succès')
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error('❌  Échec du seed :', e)
    await prisma.$disconnect()
    process.exit(1)
  })
