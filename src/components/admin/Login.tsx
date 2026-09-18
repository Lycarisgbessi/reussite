'use client';

// ═══════════════════════════════════════════════════════════════
// LOGIN — Écran de connexion au back-office Business Horizon
// ═══════════════════════════════════════════════════════════════
import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Eye, EyeOff, Loader2, Lock, LogIn, Mail, Mountain, ShieldAlert } from 'lucide-react';
import { useMagazineStore } from '@/lib/store';
import { authApi } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';

export function Login() {
  const { toast } = useToast();
  const setAdminSession = useMagazineStore((s) => s.setAdminSession);
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [showPassword, setShowPassword] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!email.trim() || !password) {
      setError('Veuillez renseigner votre e-mail et votre mot de passe.');
      return;
    }
    setLoading(true);
    try {
      const session = await authApi.login(email.trim(), password);
      setAdminSession(session.token, session.user);
      toast({
        title: `Bonjour ${session.user.name} !`,
        description: 'Bienvenue dans l’espace d’administration Business Horizon.',
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erreur inconnue';
      setError(/identifiants/i.test(msg) ? 'Identifiants invalides' : msg);
    } finally {
      setLoading(false);
    }
  };

  const fillDemo = () => {
    setEmail('admin@businesshorizon.fr');
    setPassword('admin123');
    setError(null);
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-muted/40 px-4 py-10">
      {/* Décor éditorial */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-32 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute bottom-0 right-0 h-72 w-72 rounded-full bg-accent/30 blur-3xl" />
      </div>

      <div className="relative z-10 w-full max-w-md space-y-6 fade-in">
        {/* Logo */}
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/30">
            <Mountain className="h-8 w-8" aria-hidden="true" />
          </div>
          <div>
            <p className="eyebrow text-primary">Espace d’administration</p>
            <h1 className="font-editorial text-3xl font-bold tracking-tight">Business Horizon</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Magazine entrepreneuriat, business &amp; innovation
            </p>
          </div>
        </div>

        <Card className="border-border/80 shadow-xl shadow-black/5">
          <CardHeader className="pb-4">
            <CardTitle className="font-editorial text-xl">Connexion</CardTitle>
            <CardDescription>Accédez au CMS pour gérer vos contenus.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              {error ? (
                <Alert variant="destructive" role="alert">
                  <ShieldAlert className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              ) : null}

              <div className="space-y-1.5">
                <Label htmlFor="login-email">Adresse e-mail</Label>
                <div className="relative">
                  <Mail className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                  <Input
                    id="login-email"
                    type="email"
                    autoComplete="email"
                    placeholder="vous@businesshorizon.fr"
                    className="pl-8"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={loading}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="login-password">Mot de passe</Label>
                <div className="relative">
                  <Lock className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                  <Input
                    id="login-password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    placeholder="••••••••"
                    className="pl-8 pr-10"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={loading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground transition-colors hover:text-foreground"
                    aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <Button type="submit" className="w-full gap-2" disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
                {loading ? 'Connexion en cours…' : 'Se connecter'}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Compte de démonstration */}
        <div className="rounded-lg border border-dashed border-primary/40 bg-primary/5 p-3 text-center text-xs text-muted-foreground">
          <p>
            Compte de démonstration :{' '}
            <span className="font-medium text-foreground">admin@businesshorizon.fr</span>
            {' / '}
            <span className="font-medium text-foreground">admin123</span>
          </p>
          <Button type="button" variant="link" size="sm" className="mt-0.5 h-6 text-xs" onClick={fillDemo}>
            Remplir automatiquement
          </Button>
        </div>

        <p className="text-center text-[11px] text-muted-foreground">
          © {new Date().getFullYear()} Business Horizon — Business Horizon CMS v1.0
        </p>
      </div>
    </div>
  );
}
