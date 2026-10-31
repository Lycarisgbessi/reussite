'use client';

// ═══════════════════════════════════════════════════════════════
// ISSUE PREVIEW OVERLAY — VISIONNEUSE FLIPBOOK HAUT DE GAMME
//  • Mode 100% sécurisé (Option 1) : diffusion des N premières pages
//    en images haute définition optimisées (WebP/JPEG).
//  • Zéro fuite de fichier PDF brut sur le réseau public.
//  • Mode Double-Page (Spread Magazine) ou Page Simple adaptative.
//  • Barre de miniatures des 5 pages, zoom tactile et raccourcis.
//  • Écran de paywall engageant à la fin de l'aperçu gratuit.
// ═══════════════════════════════════════════════════════════════
import { useEffect, useRef, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BookOpen, ChevronLeft, ChevronRight, Lock, ShoppingBag, X,
  ZoomIn, ZoomOut, Maximize2, Minimize2, Sparkles, Columns, Square,
  CheckCircle2, ArrowRight, RotateCcw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SmartImage } from '../mag/SmartImage';
import { cn } from '@/lib/utils';
import { publicApi } from '@/lib/api';
import type { ShopIssue } from './ShopPage';

const fmtGnf = (n: number) => `${(n ?? 0).toLocaleString('fr-FR')} GNF`;
const fmtUsd = (n: number) => `${n ?? 0} $`;

interface Props {
  issue: ShopIssue | null;
  onClose: () => void;
  onBuy: (issue: ShopIssue) => void;
}

export function IssuePreviewOverlay({ issue, onClose, onBuy }: Props) {
  const [detail, setDetail] = useState<ShopIssue | null>(null);
  const [page, setPage] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [isDoublePage, setIsDoublePage] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showThumbnails, setShowThumbnails] = useState(true);
  const overlayRef = useRef<HTMLDivElement>(null);

  // (Re)chargement du détail à l'ouverture
  useEffect(() => {
    setDetail(null);
    setPage(1);
    setZoom(1);
    if (!issue) return;

    let cancelled = false;
    publicApi
      .shopIssue(issue.id)
      .then((res) => {
        if (!cancelled && res?.issue) setDetail(res.issue);
      })
      .catch(() => {
        if (!cancelled) setDetail(issue);
      });

    return () => {
      cancelled = true;
    };
  }, [issue]);

  // Détection écran large pour suggérer le mode double page par défaut
  useEffect(() => {
    if (typeof window !== 'undefined' && window.innerWidth >= 1024) {
      setIsDoublePage(true);
    }
  }, []);

  // Liste ordonnée des pages d'aperçu (Option 1 : Images HD)
  const pages: string[] = useMemo(() => {
    const list: string[] = [];
    const sourceImages = detail?.previewImages ?? issue?.previewImages ?? [];

    if (sourceImages.length > 0) {
      list.push(...sourceImages);
    } else if (detail?.coverUrl || issue?.coverUrl) {
      // Si aucune page explicite n'a été ajoutée, la couverture fait office de page 1
      list.push(detail?.coverUrl || issue?.coverUrl || '');
    }

    const limit = detail?.previewPages ?? issue?.previewPages ?? 5;
    return list.slice(0, Math.max(1, limit));
  }, [detail, issue]);

  const totalPages = pages.length;
  // Nombre d'étapes de navigation :
  // Si double page : chaque étape avance de 2 (sauf la couverture page 1)
  // + 1 écran final de paywall (dépassement des pages offertes)
  const maxStep = isDoublePage ? Math.ceil(totalPages / 2) + 1 : totalPages + 1;
  const isPaywall = isDoublePage ? page > Math.ceil(totalPages / 2) : page > totalPages;

  const canPrev = page > 1;
  const canNext = page < maxStep;

  // NB : le zoom est CONSERVÉ en tournant les pages — on lit
  // tout le magazine au même niveau d'agrandissement.
  const goPrev = () => {
    setPage((p) => Math.max(1, p - 1));
  };

  const goNext = () => {
    setPage((p) => Math.min(maxStep, p + 1));
  };

  const jumpToPage = (targetPageIndex: number) => {
    if (isDoublePage) {
      setPage(Math.floor(targetPageIndex / 2) + 1);
    } else {
      setPage(targetPageIndex + 1);
    }
  };

  // Gestion du plein écran
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      overlayRef.current?.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  // Clavier : Navigation fluide
  useEffect(() => {
    if (!issue) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (document.fullscreenElement) {
          document.exitFullscreen().catch(() => {});
          setIsFullscreen(false);
        } else {
          onClose();
        }
      } else if (e.key === 'ArrowRight' || e.key === ' ') {
        e.preventDefault();
        setPage((p) => Math.min(maxStep, p + 1));
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setPage((p) => Math.max(1, p - 1));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [issue, maxStep, onClose]);

  if (!issue) return null;

  const currentIssue = detail || issue;

  // Calcul des pages affichées en mode double-page
  const leftPageIndex = isDoublePage ? (page - 1) * 2 : page - 1;
  const rightPageIndex = isDoublePage ? leftPageIndex + 1 : -1;
  const leftPageUrl = pages[leftPageIndex];
  const rightPageUrl = rightPageIndex >= 0 && rightPageIndex < totalPages ? pages[rightPageIndex] : null;

  return (
    <AnimatePresence>
      <motion.div
        ref={overlayRef}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[70] flex flex-col bg-neutral-950/95 text-white backdrop-blur-md select-none"
        role="dialog"
        aria-modal="true"
        aria-label={`Aperçu interactif — ${currentIssue.title}`}
      >
        {/* ── BARRE SUPÉRIEURE ÉPURÉE ET HAUT DE GAMME ── */}
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-white/10 bg-black/60 px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex items-center gap-1.5 rounded-full bg-primary/20 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-primary border border-primary/30">
              <Sparkles className="size-3" /> N° {currentIssue.issueNumber}
            </span>
            <h2 className="truncate font-editorial text-sm sm:text-base font-bold text-white/90">
              {currentIssue.title}
            </h2>
            <span className="hidden sm:inline-block text-xs text-white/50 border-l border-white/10 pl-3">
              Aperçu gratuit ({totalPages} première{totalPages > 1 ? 's' : ''} page{totalPages > 1 ? 's' : ''})
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* Bascule Simple / Double page (sur grand écran) */}
            <div className="hidden lg:flex items-center rounded-lg bg-white/10 p-0.5">
              <button
                type="button"
                onClick={() => { setIsDoublePage(false); setZoom(1); }}
                className={cn(
                  'flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
                  !isDoublePage ? 'bg-primary text-white shadow' : 'text-white/70 hover:text-white',
                )}
                title="Affichage page simple"
              >
                <Square className="size-3.5" /> Simple
              </button>
              <button
                type="button"
                onClick={() => { setIsDoublePage(true); setZoom(1); }}
                className={cn(
                  'flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
                  isDoublePage ? 'bg-primary text-white shadow' : 'text-white/70 hover:text-white',
                )}
                title="Affichage double page magazine"
              >
                <Columns className="size-3.5" /> Double page
              </button>
            </div>

            {/* Plein écran */}
            <button
              type="button"
              onClick={toggleFullscreen}
              className="hidden sm:flex size-9 items-center justify-center rounded-full bg-white/10 text-white/80 transition-colors hover:bg-white/20 hover:text-white"
              title={isFullscreen ? 'Quitter le plein écran' : 'Plein écran'}
              aria-label="Plein écran"
            >
              {isFullscreen ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
            </button>

            {/* Bouton Fermer */}
            <button
              type="button"
              onClick={onClose}
              className="flex size-9 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
              title="Fermer l'aperçu (Échap)"
              aria-label="Fermer"
            >
              <X className="size-5" />
            </button>
          </div>
        </header>

        {/* ── ZONE CENTRALE : PANNEAU LATÉRAL + LISEUSE MAGAZINE ── */}
        <div className="flex min-h-0 flex-1 flex-col md:flex-row overflow-hidden">
          
          {/* PANNEAU LATÉRAL : DÉTAILS, TARIFS & ACHAT */}
          <aside className="hidden md:flex w-72 shrink-0 flex-col gap-4 border-r border-white/10 bg-neutral-900/80 p-5 overflow-y-auto">
            <div className="overflow-hidden rounded-xl border border-white/15 shadow-2xl">
              <SmartImage
                src={currentIssue.coverUrl}
                alt={currentIssue.title}
                className="aspect-[3/4] w-full object-cover"
                fallbackLabel="Réussite"
              />
            </div>

            <div className="space-y-1.5 rounded-xl border border-white/10 bg-white/5 p-3.5">
              <p className="text-xs font-bold uppercase tracking-wider text-primary">Version numérique (PDF HD)</p>
              <p className="text-2xl font-bold tracking-tight text-white">{fmtGnf(currentIssue.priceCfa)}</p>
              <p className="text-xs text-white/60">soit {fmtUsd(currentIssue.priceEur)} — téléchargement immédiat après validation</p>
              <div className="pt-2 border-t border-white/10 mt-2">
                <p className="text-[11px] text-white/70">
                  <span className="font-semibold text-white/90">Version papier :</span> {fmtGnf(currentIssue.pricePrintCfa ?? 30000)} ({fmtUsd(currentIssue.pricePrintEur ?? 3)}) livrée à domicile
                </p>
              </div>
            </div>

            <Button
              className="w-full rounded-full bg-primary hover:bg-primary/90 text-white font-bold h-11 shadow-lg shadow-primary/25"
              onClick={() => onBuy(currentIssue)}
            >
              <ShoppingBag className="mr-2 size-4" /> Acheter ce numéro
            </Button>

            <div className="flex-1 space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wide text-white/60">
                Dans ce numéro
              </h3>
              <p className="text-xs leading-relaxed text-white/80 whitespace-pre-line line-clamp-6">
                {currentIssue.description || 'Sommaire, grands entretiens, dossiers d’investigation et analyses économiques.'}
              </p>
            </div>

            <div className="rounded-lg bg-white/5 p-3 text-[11px] text-white/60 flex items-start gap-2">
              <CheckCircle2 className="size-4 shrink-0 text-emerald-400 mt-0.5" />
              <span>Paiement sécurisé via Orange Money, MTN MoMo, virement ou carte bancaire.</span>
            </div>
          </aside>

          {/* LISEUSE FLIPBOOK MAGAZINE */}
          <div className="relative flex flex-1 flex-col min-h-0 bg-neutral-900/40 overflow-hidden">
            
            {/* Zone de rendu des pages */}
            <div
                  className="relative flex-1 overflow-auto flex items-center justify-center p-3 sm:p-6 custom-scrollbar"
                  style={{ minHeight: 0 }}
                  onWheel={(e) => {
                    if (e.ctrlKey) {
                      e.preventDefault();
                      setZoom((z) => Math.min(4, Math.max(0.75, +(z + (e.deltaY < 0 ? 0.25 : -0.25)).toFixed(2))));
                    }
                  }}
                  onDoubleClick={() => setZoom((z) => (z > 1 ? 1 : 2.5))}
                  title="Double-clic : zoom lecture · Ctrl + molette : zoom précis"
                >
              
              {/* ÉCRAN DE PAYWALL (Quand le visiteur dépasse les pages gratuites) */}
              {isPaywall ? (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="max-w-xl w-full rounded-2xl border border-primary/30 bg-neutral-900/90 p-6 sm:p-8 text-center shadow-2xl backdrop-blur-md"
                >
                  <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-primary/15 text-primary border border-primary/25">
                    <Lock className="size-7" />
                  </div>
                  <span className="mt-4 inline-block text-[11px] font-bold uppercase tracking-widest text-primary">
                    Fin de l'aperçu gratuit
                  </span>
                  <h3 className="font-editorial text-2xl sm:text-3xl font-bold mt-1 text-white">
                    Poursuivez votre lecture
                  </h3>
                  <p className="mt-2 text-sm text-white/70 max-w-md mx-auto leading-relaxed">
                    Vous avez consulté les premières pages offertes de <strong>{currentIssue.title}</strong>. Débloquez l'édition intégrale pour accéder à tous les articles, enquêtes et interviews.
                  </p>

                  <div className="mt-6 grid sm:grid-cols-2 gap-3 text-left">
                    <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                      <p className="text-xs font-bold uppercase tracking-wider text-primary">Format Numérique (PDF)</p>
                      <p className="text-xl font-bold mt-1 text-white">{fmtGnf(currentIssue.priceCfa)} <span className="text-xs font-normal text-white/60">/ {fmtUsd(currentIssue.priceEur)}</span></p>
                      <p className="text-[11px] text-white/60 mt-1">Reçu immédiatement après validation du paiement.</p>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                      <p className="text-xs font-bold uppercase tracking-wider text-amber-400">Format Papier</p>
                      <p className="text-xl font-bold mt-1 text-white">{fmtGnf(currentIssue.pricePrintCfa ?? 30000)} <span className="text-xs font-normal text-white/60">/ {fmtUsd(currentIssue.pricePrintEur ?? 3)}</span></p>
                      <p className="text-[11px] text-white/60 mt-1">Exemplaire collector imprimé, expédié chez vous.</p>
                    </div>
                  </div>

                  <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center">
                    <Button
                      size="lg"
                      className="rounded-full bg-primary hover:bg-primary/90 text-white font-bold px-8 shadow-lg shadow-primary/30"
                      onClick={() => onBuy(currentIssue)}
                    >
                      <ShoppingBag className="mr-2 size-4" /> Acheter le numéro complet
                    </Button>
                    <Button
                      variant="outline"
                      size="lg"
                      className="rounded-full border-white/20 text-white hover:bg-white/10"
                      onClick={() => setPage(1)}
                    >
                      <RotateCcw className="mr-2 size-4" /> Revoir l'aperçu
                    </Button>
                  </div>
                </motion.div>
              ) : (
                /* AFFICHAGE DES PAGES DU MAGAZINE (FLIPBOOK HD) */
                <motion.div
                  key={`${page}-${isDoublePage}`}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.25 }}
                  className="flex min-h-full items-center justify-center"
                >
                  {isDoublePage ? (
                    /* MODE DOUBLE-PAGE (OUVRAGE OUVERT) */
                    <div
                      className="relative flex rounded-xl overflow-hidden shadow-2xl border border-white/20 bg-neutral-950"
                      style={{ maxHeight: `${Math.round(75 * zoom)}vh`, maxWidth: `${Math.round(92 * zoom)}vw` }}
                    >
                      {/* Page Gauche */}
                      <div
                        className="relative aspect-[3/4] bg-neutral-900 border-r border-white/10"
                        style={{ height: `${Math.round(65 * zoom)}vh`, maxHeight: `${Math.round(750 * zoom)}px` }}
                      >
                        {leftPageUrl ? (
                          <img
                            src={leftPageUrl}
                            alt={`Page ${leftPageIndex + 1}`}
                            className="h-full w-full object-contain"
                            loading="eager"
                            draggable={false}
                          />
                        ) : (
                          <div className="flex h-full items-center justify-center text-white/30 text-xs">Page non disponible</div>
                        )}
                        <span className="absolute bottom-2 left-3 rounded bg-black/70 px-2 py-0.5 text-[10px] font-bold text-white/80">
                          Page {leftPageIndex + 1}
                        </span>
                      </div>

                      {/* Ombre réaliste au pli du magazine */}
                      <div className="pointer-events-none absolute inset-y-0 left-1/2 -translate-x-1/2 w-8 bg-gradient-to-r from-black/40 via-black/80 to-black/40 z-20" />

                      {/* Page Droite */}
                      <div
                        className="relative aspect-[3/4] bg-neutral-900"
                        style={{ height: `${Math.round(65 * zoom)}vh`, maxHeight: `${Math.round(750 * zoom)}px` }}
                      >
                        {rightPageUrl ? (
                          <img
                            src={rightPageUrl}
                            alt={`Page ${rightPageIndex + 1}`}
                            className="h-full w-full object-contain"
                            loading="eager"
                            draggable={false}
                          />
                        ) : (
                          <div className="flex h-full flex-col items-center justify-center p-6 text-center bg-gradient-to-b from-neutral-900 to-neutral-950">
                            <Lock className="size-8 text-primary/60 mb-2" />
                            <p className="text-xs font-bold text-white">Fin des pages gratuites</p>
                            <p className="text-[11px] text-white/60 mt-1 max-w-[200px]">
                              Achetez le magazine pour continuer la lecture.
                            </p>
                            <Button
                              size="sm"
                              className="mt-3 rounded-full text-xs"
                              onClick={() => onBuy(currentIssue)}
                            >
                              Débloquer
                            </Button>
                          </div>
                        )}
                        {rightPageUrl ? (
                          <span className="absolute bottom-2 right-3 rounded bg-black/70 px-2 py-0.5 text-[10px] font-bold text-white/80">
                            Page {rightPageIndex + 1}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  ) : (
                    /* MODE SIMPLE PAGE */
                    <div
                      className="relative aspect-[3/4] rounded-xl overflow-hidden shadow-2xl border border-white/20 bg-neutral-950"
                      style={{ height: `${Math.round(70 * zoom)}vh`, maxHeight: `${Math.round(800 * zoom)}px` }}
                    >
                      {leftPageUrl ? (
                        <img
                          src={leftPageUrl}
                          alt={`Page ${leftPageIndex + 1}`}
                          className="h-full w-full object-contain"
                          loading="eager"
                          draggable={false}
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center text-white/40 text-xs">
                          Page non disponible
                        </div>
                      )}
                      <span className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-black/75 px-3 py-1 text-xs font-bold text-white shadow">
                        Page {leftPageIndex + 1} / {totalPages}
                      </span>
                    </div>
                  )}
                </motion.div>
              )}

              {/* Bouton Flèche Précédent flottant */}
              <button
                type="button"
                onClick={goPrev}
                disabled={!canPrev}
                className="absolute left-3 sm:left-6 top-1/2 -translate-y-1/2 z-30 flex size-12 items-center justify-center rounded-full bg-black/60 border border-white/20 text-white backdrop-blur-md transition-all hover:bg-primary hover:border-primary disabled:opacity-20 disabled:pointer-events-none shadow-xl"
                title="Page précédente (Flèche gauche)"
                aria-label="Précédent"
              >
                <ChevronLeft className="size-6" />
              </button>

              {/* Bouton Flèche Suivant flottant */}
              <button
                type="button"
                onClick={goNext}
                disabled={!canNext}
                className="absolute right-3 sm:right-6 top-1/2 -translate-y-1/2 z-30 flex size-12 items-center justify-center rounded-full bg-black/60 border border-white/20 text-white backdrop-blur-md transition-all hover:bg-primary hover:border-primary disabled:opacity-20 disabled:pointer-events-none shadow-xl"
                title="Page suivante (Flèche droite)"
                aria-label="Suivant"
              >
                <ChevronRight className="size-6" />
              </button>
            </div>

            {/* ── BARRE DE CONTRÔLE BASSE & MINIATURES ── */}
            <footer className="shrink-0 border-t border-white/10 bg-black/70 px-4 py-2 flex flex-col gap-2">
              
              {/* Barre de commandes : Pagination + Zoom */}
              <div className="flex items-center justify-between gap-4 max-w-4xl mx-auto w-full">
                
                {/* Raccourci vers les miniatures */}
                <button
                  type="button"
                  onClick={() => setShowThumbnails((v) => !v)}
                  className="text-xs text-white/70 hover:text-white flex items-center gap-1.5 transition-colors font-medium"
                >
                  <BookOpen className="size-3.5 text-primary" />
                  {showThumbnails ? 'Masquer miniatures' : 'Afficher miniatures'}
                </button>

                {/* Indicateur de position */}
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-white/90">
                    {isPaywall ? (
                      <span className="text-primary font-bold">Édition complète</span>
                    ) : isDoublePage ? (
                      `Pages ${leftPageIndex + 1}${rightPageUrl ? `-${rightPageIndex + 1}` : ''} / ${totalPages}`
                    ) : (
                      `Page ${leftPageIndex + 1} / ${totalPages}`
                    )}
                  </span>
                </div>

                {/* Outils de Zoom */}
                <div className="flex items-center gap-1.5 bg-white/10 rounded-lg p-0.5">
                  <button
                    type="button"
                    onClick={() => setZoom((z) => Math.max(0.75, +(z - 0.25).toFixed(2)))}
                    className="flex size-7 items-center justify-center rounded hover:bg-white/20 text-white/80 hover:text-white"
                    title="Zoom arrière"
                    aria-label="Zoom arrière"
                  >
                    <ZoomOut className="size-3.5" />
                  </button>
                  <span className="w-10 text-center text-[11px] font-mono font-medium text-white/80">
                    {Math.round(zoom * 100)}%
                  </span>
                  <button
                    type="button"
                    onClick={() => setZoom((z) => Math.min(4, +(z + 0.25).toFixed(2)))}
                    className="flex size-7 items-center justify-center rounded hover:bg-white/20 text-white/80 hover:text-white"
                    title="Zoom avant"
                    aria-label="Zoom avant"
                  >
                    <ZoomIn className="size-3.5" />
                  </button>
                </div>
              </div>

              {/* BANDEAU DE VIGNETTES HORIZONTALES (THUMBNAILS) */}
              {showThumbnails ? (
                <div className="flex items-center justify-center gap-2 overflow-x-auto py-1 custom-scrollbar max-w-2xl mx-auto">
                  {pages.map((imgUrl, idx) => {
                    const isCurrent = isDoublePage
                      ? idx === leftPageIndex || idx === rightPageIndex
                      : idx === leftPageIndex;
                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => jumpToPage(idx)}
                        className={cn(
                          'relative shrink-0 rounded-md overflow-hidden border-2 transition-all',
                          isCurrent
                            ? 'border-primary scale-105 shadow-md shadow-primary/40'
                            : 'border-white/20 opacity-60 hover:opacity-100 hover:border-white/50',
                        )}
                        style={{ width: '42px', height: '56px' }}
                        title={`Aller à la page ${idx + 1}`}
                      >
                        <img src={imgUrl} alt="" className="h-full w-full object-cover" />
                        <span className="absolute bottom-0 inset-x-0 bg-black/80 text-[8px] font-bold text-center text-white py-0.5">
                          {idx + 1}
                        </span>
                      </button>
                    );
                  })}

                  {/* Vignette Paywall fin */}
                  <button
                    type="button"
                    onClick={() => setPage(maxStep)}
                    className={cn(
                      'relative shrink-0 rounded-md overflow-hidden border-2 transition-all flex flex-col items-center justify-center bg-primary/20 p-1',
                      isPaywall
                        ? 'border-primary scale-105 shadow-md shadow-primary/40 text-primary'
                        : 'border-white/20 opacity-60 hover:opacity-100 hover:border-white/50 text-white/80',
                    )}
                    style={{ width: '42px', height: '56px' }}
                    title="Acheter le numéro complet"
                  >
                    <Lock className="size-4" />
                    <span className="text-[7px] font-bold uppercase mt-1">Suite</span>
                  </button>
                </div>
              ) : null}
            </footer>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
