'use client';

// ═══════════════════════════════════════════════════════════════
// ISSUE PREVIEW OVERLAY — lecteur d'aperçu PLEIN ÉCRAN d'un numéro :
//  • Si le PDF est fourni : rendu des N premières pages uniquement
//    (pdf.js côté navigateur, « previewPages » fixé par la rédaction).
//  • Sinon : images d'aperçu (médiathèque) en repli.
// Colonne latérale : couverture, prix, achat, sommaire.
// ═══════════════════════════════════════════════════════════════
import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BookOpen, ChevronLeft, ChevronRight, Loader2, Lock, ShoppingBag, X, ZoomIn, ZoomOut,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SmartImage } from '../mag/SmartImage';
import { cn } from '@/lib/utils';
import type { ShopIssue } from './ShopPage';

const fmtGnf = (n: number) => `${n.toLocaleString('fr-FR')} GNF`;
const fmtUsd = (n: number) => `${n} $`;

interface Props {
  issue: ShopIssue | null;
  onClose: () => void;
  onBuy: (issue: ShopIssue) => void;
}

export function IssuePreviewOverlay({ issue, onClose, onBuy }: Props) {
  const [detail, setDetail] = useState<ShopIssue | null>(null);
  const [page, setPage] = useState(1);
  const [zoom, setZoom] = useState(1);
  // État pdf.js
  const [pdfState, setPdfState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [pageCount, setPageCount] = useState(0); // pages réellement consultables (limitées)
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pdfDocRef = useRef<import('pdfjs-dist').PDFDocumentProxy | null>(null);
  const renderingRef = useRef(false);

  // (Re)chargement du détail à l'ouverture
  useEffect(() => {
    setDetail(null);
    setPage(1);
    setZoom(1);
    setPdfState('idle');
    setPageCount(0);
    pdfDocRef.current?.destroy().catch(() => undefined);
    pdfDocRef.current = null;
    if (!issue) return;
    let cancelled = false;
    publicApiShopIssue(issue.id)
      .then((res) => { if (!cancelled) setDetail(res.issue); })
      .catch(() => { if (!cancelled) setDetail(issue); });
    return () => { cancelled = true; };
  }, [issue]);

  const pdfUrl = detail?.pdfUrl || '';
  const previewImages = detail?.previewImages ?? [];
  const previewPages = detail?.previewPages ?? 5;
  const usePdf = Boolean(pdfUrl) && previewPages > 0;

  // Chargement du document pdf.js (uniquement les N premières pages accessibles)
  useEffect(() => {
    if (!usePdf) return;
    let cancelled = false;
    setPdfState('loading');
    (async () => {
      try {
        const pdfjs = await import('pdfjs-dist');
        pdfjs.GlobalWorkerOptions.workerSrc =
          'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.worker.min.mjs';
        const doc = await pdfjs.getDocument({ url: pdfUrl }).promise;
        if (cancelled) { doc.destroy().catch(() => undefined); return; }
        pdfDocRef.current = doc;
        setPageCount(Math.min(doc.numPages, previewPages));
        setPdfState('ready');
      } catch {
        if (!cancelled) setPdfState('error');
      }
    })();
    return () => { cancelled = true; };
  }, [usePdf, pdfUrl, previewPages]);

  // Rendu de la page courante dans le canvas
  useEffect(() => {
    if (pdfState !== 'ready' || !pdfDocRef.current || !canvasRef.current) return;
    if (renderingRef.current) return;
    renderingRef.current = true;
    (async () => {
      try {
        const doc = pdfDocRef.current!;
        const p = await doc.getPage(Math.min(page, Math.min(doc.numPages, previewPages)));
        const container = canvasRef.current!.parentElement!;
        const availW = Math.max(320, container.clientWidth - 32);
        const baseScale = availW / p.getViewport({ scale: 1 }).width;
        const viewport = p.getViewport({ scale: baseScale * zoom });
        const canvas = canvasRef.current!;
        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);
        canvas.style.width = `${Math.floor(viewport.width)}px`;
        canvas.style.height = `${Math.floor(viewport.height)}px`;
        await p.render({
          canvasContext: canvas.getContext('2d')!,
          viewport,
        }).promise;
      } catch {
        /* page interrompue */
      } finally {
        renderingRef.current = false;
      }
    })();
  }, [pdfState, page, zoom, previewPages]);

  // Fermeture clavier
  useEffect(() => {
    if (!issue) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [issue, onClose]);

  if (!issue) return null;

  const totalPages = usePdf ? pageCount : previewImages.length;
  const canPrev = page > 1;
  const canNext = totalPages > 0 && page < totalPages;
  const go = (p: number) => setPage(Math.min(totalPages, Math.max(1, p)));

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[70] flex flex-col bg-black/90 backdrop-blur-sm"
        role="dialog"
        aria-label={`Aperçu — ${issue.title}`}
      >
        {/* Barre supérieure */}
        <div className="flex shrink-0 items-center justify-between gap-4 border-b border-white/10 bg-black/60 px-4 py-3 sm:px-6">
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-wider text-white/70">
              Réussite · N° {issue.issueNumber} · Aperçu gratuit
            </p>
            <h3 className="truncate font-editorial text-lg font-bold leading-tight text-white">
              {issue.title}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer l'aperçu"
            className="flex size-10 shrink-0 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col md:flex-row">
          {/* Colonne latérale : couverture, prix, achat, sommaire */}
          <aside className="flex shrink-0 flex-col gap-4 overflow-y-auto border-b border-white/10 bg-card p-5 md:w-72 md:border-b-0 md:border-r">
            <div className="overflow-hidden rounded-xl border shadow-lg">
              <SmartImage
                src={issue.coverUrl}
                alt={issue.title}
                className="aspect-[3/4] w-full object-cover"
                fallbackLabel="Réussite"
              />
            </div>
            <div>
              <p className="text-xl font-bold text-primary">{fmtGnf(issue.priceCfa)}</p>
              <p className="text-xs text-muted-foreground">
                soit {fmtUsd(issue.priceEur)} — version numérique (PDF)
              </p>
            </div>
            <Button className="w-full rounded-full" onClick={() => onBuy(issue)}>
              <ShoppingBag className="size-4" /> Acheter ce numéro
            </Button>
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                Dans ce numéro
              </h4>
              <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-foreground/90">
                {issue.description || 'Sommaire détaillé à venir.'}
              </p>
            </div>
          </aside>

          {/* Zone de lecture */}
          <div className="flex min-h-0 min-w-0 flex-1 flex-col">
            <div className="custom-scrollbar relative flex-1 overflow-auto bg-neutral-200 p-4 dark:bg-neutral-900">
              {usePdf ? (
                pdfState === 'loading' ? (
                  <div className="flex h-full items-center justify-center text-muted-foreground">
                    <Loader2 className="mr-2 size-6 animate-spin" /> Ouverture du numéro…
                  </div>
                ) : pdfState === 'error' ? (
                  <div className="flex h-full flex-col items-center justify-center gap-3 text-center text-muted-foreground">
                    <BookOpen className="size-10" />
                    <p className="text-sm">Aperçu indisponible pour ce numéro.</p>
                  </div>
                ) : (
                  <div className="flex justify-center">
                    <canvas ref={canvasRef} className="rounded-lg bg-white shadow-2xl" />
                  </div>
                )
              ) : previewImages.length > 0 ? (
                <div className="flex justify-center">
                  <img
                    src={previewImages[page - 1]}
                    alt={`Page ${page}`}
                    className="max-h-none w-auto max-w-full rounded-lg shadow-2xl"
                  />
                </div>
              ) : (
                <div className="flex h-full flex-col items-center justify-center gap-3 text-center text-muted-foreground">
                  <BookOpen className="size-10" />
                  <p className="text-sm">Aperçu non disponible pour ce numéro.</p>
                </div>
              )}

              {/* Verrou après la dernière page offerte */}
              {usePdf && pdfState === 'ready' && pdfDocRef.current
                && pdfDocRef.current.numPages > totalPages && page === totalPages ? (
                <div className="pointer-events-none sticky bottom-4 mx-auto w-fit rounded-full bg-black/80 px-4 py-2 text-xs font-medium text-white shadow-lg">
                  <Lock className="mr-1.5 inline size-3.5" />
                  Suite du numéro réservée aux acheteurs — {pdfDocRef.current.numPages - totalPages} page(s) restante(s)
                </div>
              ) : null}
            </div>

            {/* Barre de navigation */}
            {totalPages > 0 ? (
              <div className="flex shrink-0 flex-wrap items-center justify-center gap-2 border-t border-white/10 bg-black/60 px-4 py-2.5">
                <button
                  type="button"
                  onClick={() => go(page - 1)}
                  disabled={!canPrev}
                  aria-label="Page précédente"
                  className="flex size-9 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20 disabled:opacity-30"
                >
                  <ChevronLeft className="size-5" />
                </button>
                <span className="min-w-20 text-center text-sm font-medium text-white">
                  Page {page} / {totalPages}
                </span>
                <button
                  type="button"
                  onClick={() => go(page + 1)}
                  disabled={!canNext}
                  aria-label="Page suivante"
                  className="flex size-9 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20 disabled:opacity-30"
                >
                  <ChevronRight className="size-5" />
                </button>
                {usePdf ? (
                  <>
                    <span className="mx-1 h-5 w-px bg-white/20" aria-hidden="true" />
                    <button
                      type="button"
                      onClick={() => setZoom((z) => Math.max(0.6, +(z - 0.25).toFixed(2)))}
                      aria-label="Zoom arrière"
                      className="flex size-9 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
                    >
                      <ZoomOut className="size-4" />
                    </button>
                    <span className="w-12 text-center text-xs text-white/70">{Math.round(zoom * 100)}%</span>
                    <button
                      type="button"
                      onClick={() => setZoom((z) => Math.min(2.5, +(z + 0.25).toFixed(2)))}
                      aria-label="Zoom avant"
                      className="flex size-9 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
                    >
                      <ZoomIn className="size-4" />
                    </button>
                  </>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

// Import tardif pour éviter une dépendance circulaire ShopPage ↔ overlay
import { publicApi } from '@/lib/api';
function publicApiShopIssue(id: string) {
  return publicApi.shopIssue(id);
}
