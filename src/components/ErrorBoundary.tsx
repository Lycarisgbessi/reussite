'use client';

// ═══════════════════════════════════════════════════════════════
// ERROR BOUNDARY — évite l'écran blanc total : si une vue plante,
// on affiche un message propre + bouton de récupération au lieu de
// faire tomber toute la SPA.
// ═══════════════════════════════════════════════════════════════
import React from 'react';

interface Props {
  children: React.ReactNode;
  /** Identifiant affiché en cas d'erreur (nom de la vue). */
  label?: string;
}

interface State {
  error: Error | null;
  key: number;
}

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null, key: 0 };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary]', this.props.label ?? 'view', error, info.componentStack);
  }

  private reset = () => this.setState((s) => ({ error: null, key: s.key + 1 }));

  render() {
    if (this.state.error) {
      return (
        <div className="flex min-h-[50vh] flex-col items-center justify-center px-4 text-center">
          <p className="font-editorial text-2xl font-bold">Une erreur est survenue</p>
          <p className="mt-2 max-w-md text-sm text-muted-foreground">
            {this.state.error.message ||
              'Cette page n’a pas pu être affichée correctement. Réessayez ou retournez à l’accueil.'}
          </p>
          <div className="mt-6 flex gap-3">
            <button
              type="button"
              onClick={this.reset}
              className="rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground transition-transform hover:scale-[1.03]"
            >
              Réessayer
            </button>
            <a
              href="#/"
              className="rounded-full border px-5 py-2 text-sm font-medium transition-colors hover:bg-secondary"
            >
              Retour à l’accueil
            </a>
          </div>
        </div>
      );
    }
    return <React.Fragment key={this.state.key}>{this.props.children}</React.Fragment>;
  }
}
