'use client';

import React, { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, Eye, EyeOff, AlertCircle, CheckCircle2, Info, X } from 'lucide-react';
import { FaApple, FaFacebook } from 'react-icons/fa';
import { FcGoogle } from 'react-icons/fc';
import { PHOTOS } from '@/components/landing/content';
import { BrandLockup } from '@/components/ui/BrandLockup';
import { useToast } from '@/components/ui/Toast';
import { safeNextPath } from '@/lib/auth/redirect';
import {
  requestLGUPasswordReset,
  signInWithLGUCredentials,
  signInWithOAuthProvider,
  type OAuthProviderId,
} from '@/lib/supabase/client';

/**
 * The sign-in form with a photo beside it. Shared by the pop-up that opens
 * over the current page (LoginModal) and by the full page at /login, which is
 * what a direct visit or a refresh shows.
 */

interface FormErrors {
  email?: string;
  password?: string;
}

type Notice = { type: 'info' | 'success' | 'error'; message: string } | null;

// The marks are vector (SVG), so they stay sharp at any screen density.
const PROVIDERS: { id: OAuthProviderId; label: string; icon: React.ReactNode }[] = [
  { id: 'google', label: 'Google', icon: <FcGoogle className="h-6 w-6" aria-hidden="true" /> },
  { id: 'facebook', label: 'Facebook', icon: <FaFacebook className="h-6 w-6 text-[#1877F2]" aria-hidden="true" /> },
  { id: 'apple', label: 'Apple', icon: <FaApple className="h-6 w-6 text-ink" aria-hidden="true" /> },
];

const inputClass = (invalid: boolean) =>
  `w-full h-11 px-3.5 text-sm text-ink bg-ground border rounded-lg placeholder:text-muted focus:outline-none focus:ring-2 transition-all ${
    invalid
      ? 'border-[#DC2626] focus:border-[#DC2626] focus:ring-[#DC2626]/15'
      : 'border-line focus:border-accent focus:ring-accent-ink/15'
  }`;

const focusRing = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-ink';

function validateEmailFormat(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

/**
 * The orange call to action, in the site's own Public Sans. On hover the
 * gradient slides, a glint crosses the button and the arrow nudges forward,
 * with a small lift; a click presses it in. Dark text, because white on this
 * orange would not be readable. Reduced motion keeps the colour change only.
 */
function PrimaryButton({
  busy,
  busyLabel,
  children,
}: {
  busy: boolean;
  busyLabel: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="submit"
      disabled={busy}
      className={`group relative isolate flex w-full min-h-[50px] cursor-pointer items-center justify-center overflow-hidden rounded-xl px-5 text-[15px] font-bold tracking-[0.005em] text-night bg-[linear-gradient(110deg,#FFB067_0%,#FF7A1F_45%,#F0620A_100%)] bg-[length:190%_100%] bg-[position:0%_50%] shadow-[0_10px_24px_-10px_rgba(255,122,31,0.85)] transition-[background-position,transform,box-shadow] duration-500 ease-out hover:bg-[position:100%_50%] hover:-translate-y-0.5 hover:shadow-[0_16px_30px_-10px_rgba(255,122,31,0.95)] active:translate-y-0 active:scale-[0.985] active:shadow-[0_6px_14px_-8px_rgba(255,122,31,0.9)] disabled:pointer-events-none disabled:opacity-60 disabled:shadow-none motion-reduce:transition-none motion-reduce:hover:translate-y-0 ${focusRing}`}
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 -left-1/3 z-0 w-1/5 -skew-x-[20deg] bg-white/35 blur-[2px] group-hover:animate-[bp-shine_900ms_ease-in-out_1] motion-reduce:hidden"
      />
      <span className="relative z-10 inline-flex items-center gap-2">
        {busy ? (
          <>
            <span className="h-4 w-4 rounded-full border-2 border-night/30 border-t-night motion-safe:animate-spin" aria-hidden="true" />
            {busyLabel}
          </>
        ) : (
          <>
            {children}
            <ArrowRight className="h-4 w-4 transition-transform duration-300 ease-out group-hover:translate-x-1 motion-reduce:transition-none" aria-hidden="true" />
          </>
        )}
      </span>
    </button>
  );
}

export function LoginPanel({ variant, onClose }: { variant: 'modal' | 'page'; onClose?: () => void }) {
  const router = useRouter();
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [oauthPending, setOauthPending] = useState<OAuthProviderId | null>(null);
  const [statusNotice, setStatusNotice] = useState<Notice>(null);

  const [forgotPasswordMode, setForgotPasswordMode] = useState(false);
  const [recoveryEmail, setRecoveryEmail] = useState('');
  const [recoveryError, setRecoveryError] = useState('');
  const [recoveryNotice, setRecoveryNotice] = useState('');
  const [isSendingRecovery, setIsSendingRecovery] = useState(false);

  // /auth/callback sends a failed provider sign-in back here with ?error=oauth.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('error') === 'oauth') {
      setStatusNotice({
        type: 'error',
        message: 'We could not finish signing you in with that provider. Please try again, or use your email and password.',
      });
    }
  }, []);

  // Coming back with the browser's Back button must not leave the buttons stuck on "waiting".
  useEffect(() => {
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) setOauthPending(null);
    };
    window.addEventListener('pageshow', onPageShow);
    return () => window.removeEventListener('pageshow', onPageShow);
  }, []);

  const nextPath = () => safeNextPath(new URLSearchParams(window.location.search).get('next'));

  const validateSignInForm = (): boolean => {
    const nextErrors: FormErrors = {};

    if (!email.trim()) {
      nextErrors.email = 'Please enter your email address.';
    } else if (!validateEmailFormat(email)) {
      nextErrors.email = 'Please enter a valid email address, like name@example.com.';
    }

    if (!password) {
      nextErrors.password = 'Please enter your password.';
    } else if (password.length < 8) {
      nextErrors.password = 'Password must be at least 8 characters long.';
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSignInSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setStatusNotice(null);

    if (!validateSignInForm()) return;

    setIsSubmitting(true);
    try {
      const result = await signInWithLGUCredentials(email.trim(), password);
      if (result.success) {
        setStatusNotice({ type: 'success', message: result.message });
        // Only navigate once Supabase Auth has actually confirmed the
        // session; router.refresh() makes the next /dashboard render pick
        // up the new session cookie in Server Components. The toast lives in
        // the root layout, so it stays up across the navigation.
        toast({ id: 'auth', tone: 'success', title: 'Signed in', description: 'Opening the LGU monitoring workspace.' });
        router.push(nextPath());
        router.refresh();
      } else if (!result.configured) {
        setStatusNotice({ type: 'info', message: result.message });
      } else {
        setStatusNotice({ type: 'error', message: result.message });
      }
    } catch {
      setStatusNotice({
        type: 'error',
        message: 'An unexpected error occurred while communicating with the authentication service.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOAuth = async (provider: OAuthProviderId) => {
    setStatusNotice(null);
    setOauthPending(provider);
    try {
      const result = await signInWithOAuthProvider(provider, nextPath());
      // On success the browser is already on its way to the provider.
      if (!result.success) {
        setStatusNotice({ type: result.configured ? 'error' : 'info', message: result.message });
        setOauthPending(null);
      }
    } catch {
      setStatusNotice({ type: 'error', message: 'We could not reach the sign-in provider. Please try again.' });
      setOauthPending(null);
    }
  };

  const handlePasswordRecoverySubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setRecoveryError('');
    setRecoveryNotice('');

    if (!recoveryEmail.trim()) {
      setRecoveryError('Please enter the email address of your account.');
      return;
    }
    if (!validateEmailFormat(recoveryEmail)) {
      setRecoveryError('Please enter a valid email address.');
      return;
    }

    setIsSendingRecovery(true);
    try {
      const result = await requestLGUPasswordReset(recoveryEmail.trim());
      // Only a confirmed request is reported as sent; a refusal (rate limit,
      // unconfigured auth) is shown as the error it is.
      if (result.success) setRecoveryNotice(result.message);
      else setRecoveryError(result.configured ? 'We could not send recovery instructions right now. Please try again in a few minutes.' : result.message);
    } catch {
      setRecoveryError('Unable to process password reset request at this time.');
    } finally {
      setIsSendingRecovery(false);
    }
  };

  const photo = PHOTOS.sanJuanico;
  const busy = isSubmitting || oauthPending !== null;

  return (
    <div className="relative grid md:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)]">
      {variant === 'modal' && onClose && (
        <button
          type="button"
          onClick={onClose}
          aria-label="Close sign in"
          className={`absolute right-3 top-3 z-10 inline-flex h-9 w-9 items-center justify-center rounded-full border border-line bg-surface/90 text-ink shadow-xs backdrop-blur hover:bg-sunken transition-colors cursor-pointer ${focusRing}`}
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      )}

      {/* Form */}
      <div className="flex flex-col justify-center p-6 sm:p-9">
        <BrandLockup variant="horizontal" sizes="160px" className="h-auto w-36 sm:w-40" />

        <h2 id="login-title" className="mt-5 text-xl font-bold tracking-tight text-ink sm:text-2xl">
          {forgotPasswordMode ? 'Reset your password' : 'Sign in to Bantay Proyekto'}
        </h2>
        <p className="mt-1 text-sm text-muted">
          {forgotPasswordMode
            ? 'We will email you a link to choose a new one.'
            : 'Use your account email and password, or a quick sign-in below.'}
        </p>

        <div className="mt-6">
          {!forgotPasswordMode ? (
            <form onSubmit={handleSignInSubmit} noValidate className="space-y-4">
              <div>
                <label htmlFor="login-email" className="block text-xs font-semibold text-ink mb-1.5">
                  Email address
                </label>
                <input
                  id="login-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (errors.email) setErrors((prev) => ({ ...prev, email: undefined }));
                  }}
                  placeholder="name@example.com"
                  aria-invalid={Boolean(errors.email)}
                  aria-describedby={errors.email ? 'login-email-error' : undefined}
                  className={inputClass(Boolean(errors.email))}
                />
                {errors.email && (
                  <p id="login-email-error" role="alert" className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-[#DC2626]">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                    <span>{errors.email}</span>
                  </p>
                )}
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label htmlFor="login-password" className="block text-xs font-semibold text-ink">
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setForgotPasswordMode(true);
                      setRecoveryEmail(email);
                      setRecoveryError('');
                      setRecoveryNotice('');
                      setStatusNotice(null);
                    }}
                    className="text-xs font-semibold text-accent-ink hover:text-ink hover:underline transition-colors cursor-pointer"
                  >
                    Forgot password?
                  </button>
                </div>

                <div className="relative">
                  <input
                    id="login-password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (errors.password) setErrors((prev) => ({ ...prev, password: undefined }));
                    }}
                    placeholder="Enter your password"
                    aria-invalid={Boolean(errors.password)}
                    aria-describedby={errors.password ? 'login-password-error' : undefined}
                    className={`${inputClass(Boolean(errors.password))} pr-11`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-muted hover:text-ink rounded-md transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-accent-ink"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" aria-hidden="true" /> : <Eye className="w-4 h-4" aria-hidden="true" />}
                  </button>
                </div>

                {errors.password && (
                  <p id="login-password-error" role="alert" className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-[#DC2626]">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                    <span>{errors.password}</span>
                  </p>
                )}
              </div>

              {statusNotice && (
                <div
                  role="status"
                  className={`p-3.5 rounded-lg border text-xs leading-relaxed flex items-start gap-2.5 ${
                    statusNotice.type === 'success'
                      ? 'bg-emerald-50 dark:bg-emerald-500/12 border-emerald-200 dark:border-emerald-500/30 text-[#16A34A]'
                      : statusNotice.type === 'error'
                      ? 'bg-danger-soft border-danger-line text-[#DC2626]'
                      : 'bg-ground border-line text-ink'
                  }`}
                >
                  {statusNotice.type === 'success' ? (
                    <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-[#16A34A]" aria-hidden="true" />
                  ) : statusNotice.type === 'error' ? (
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-[#DC2626]" aria-hidden="true" />
                  ) : (
                    <Info className="w-4 h-4 shrink-0 mt-0.5 text-[#0284C7]" aria-hidden="true" />
                  )}
                  <span>{statusNotice.message}</span>
                </div>
              )}

              <PrimaryButton busy={busy} busyLabel={isSubmitting ? 'Signing in' : 'Please wait'}>
                Sign In
              </PrimaryButton>

              <div className="relative pt-1" role="separator" aria-label="or continue with">
                <div className="absolute inset-0 flex items-center" aria-hidden="true">
                  <div className="w-full border-t border-line" />
                </div>
                <p className="relative mx-auto w-fit bg-surface px-3 text-xs text-muted" aria-hidden="true">
                  or continue with
                </p>
              </div>

              <div className="flex justify-center gap-3.5">
                {PROVIDERS.map((provider) => (
                  <button
                    key={provider.id}
                    type="button"
                    onClick={() => handleOAuth(provider.id)}
                    disabled={busy}
                    aria-label={`Continue with ${provider.label}`}
                    title={`Continue with ${provider.label}`}
                    className={`inline-flex h-14 w-14 cursor-pointer items-center justify-center rounded-xl border border-line-strong bg-surface transition-[transform,box-shadow,background-color] duration-200 ease-out hover:-translate-y-0.5 hover:bg-sunken hover:shadow-raise active:translate-y-0 active:scale-95 disabled:pointer-events-none disabled:opacity-60 motion-reduce:transition-none motion-reduce:hover:translate-y-0 ${focusRing}`}
                  >
                    {oauthPending === provider.id ? (
                      <span className="h-4 w-4 rounded-full border-2 border-line-strong border-t-ink motion-safe:animate-spin" aria-hidden="true" />
                    ) : (
                      provider.icon
                    )}
                  </button>
                ))}
              </div>

              {/* Guests browse the public directory, map and dashboard; no session is created. */}
              <div className="pt-1 text-center">
                <Link
                  href="/projects"
                  className={`flex min-h-[48px] w-full items-center justify-center rounded-xl border border-line-strong bg-sunken px-4 text-sm font-semibold text-ink transition-[background-color,transform] duration-200 ease-out hover:bg-line active:scale-[0.99] motion-reduce:transition-none ${focusRing}`}
                >
                  Continue as guest
                </Link>
                <p className="mt-2 text-xs text-muted">
                  Browse projects and the map without an account. You need one to file a report.
                </p>
              </div>

              <p className="text-center text-xs text-muted">
                Don&apos;t have an account?{' '}
                <Link href="/register" className="font-semibold text-accent-ink hover:text-ink hover:underline transition-colors">
                  Sign Up
                </Link>
              </p>
            </form>
          ) : (
            <form onSubmit={handlePasswordRecoverySubmit} noValidate className="space-y-4">
              <div>
                <label htmlFor="recovery-email" className="block text-xs font-semibold text-ink mb-1.5">
                  Email address
                </label>
                <input
                  id="recovery-email"
                  type="email"
                  autoComplete="email"
                  value={recoveryEmail}
                  onChange={(e) => {
                    setRecoveryEmail(e.target.value);
                    if (recoveryError) setRecoveryError('');
                  }}
                  placeholder="name@example.com"
                  className={inputClass(Boolean(recoveryError))}
                />
                {recoveryError && (
                  <p role="alert" className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-[#DC2626]">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                    <span>{recoveryError}</span>
                  </p>
                )}
              </div>

              {recoveryNotice && (
                <div role="status" className="p-3.5 rounded-lg bg-ground border border-line text-xs text-ink leading-relaxed flex items-start gap-2.5">
                  <Info className="w-4 h-4 text-[#0284C7] shrink-0 mt-0.5" aria-hidden="true" />
                  <span>{recoveryNotice}</span>
                </div>
              )}

              <div className="space-y-2.5">
                <PrimaryButton busy={isSendingRecovery} busyLabel="Sending">
                  Send reset link
                </PrimaryButton>
                <button
                  type="button"
                  onClick={() => setForgotPasswordMode(false)}
                  className="w-full min-h-[40px] py-2 px-4 text-xs font-semibold text-muted hover:text-ink hover:bg-sunken rounded-lg transition-colors cursor-pointer"
                >
                  Back to sign in
                </button>
              </div>
            </form>
          )}
        </div>
      </div>

      {/* Photo: one of the credited pictures from the landing page (listed on /credits). */}
      <aside className="relative hidden min-h-[560px] bg-night md:block">
        {/* object-cover scales by the panel's height, so the picture is wider than the panel:
            `sizes` says how wide, which keeps the optimizer from choosing a smaller, blurry file. */}
        <Image
          src={photo.src}
          alt={photo.alt}
          fill
          quality={90}
          loading="eager"
          sizes="(min-width: 768px) 1000px, 0px"
          className="object-cover object-[32%_center]"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-night/90 via-night/30 to-night/5" aria-hidden="true" />
        <div className="absolute inset-0 bg-[linear-gradient(160deg,rgba(255,122,31,0.22)_0%,transparent_45%)]" aria-hidden="true" />
        <div className="absolute inset-x-0 bottom-0 p-7 text-white">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-peach">Bantay Proyekto</p>
          <p className="mt-2 text-2xl font-bold leading-tight tracking-tight">Track every peso. See every project.</p>
          <p className="mt-2 text-sm text-white/80">Public works records anyone can check, and a workspace for LGUs.</p>
        </div>
      </aside>
    </div>
  );
}
