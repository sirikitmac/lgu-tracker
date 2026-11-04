'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { LguMark } from '@/components/layout/Navbar';
import { ThemeToggle } from '@/components/layout/ThemeToggle';
import {
  Eye,
  EyeOff,
  AlertCircle,
  CheckCircle2,
  ArrowLeft,
  Shield,
  Info,
} from 'lucide-react';
import { isSupabaseConfigured, registerLGUAccount } from '@/lib/supabase/client';
import { ACCOUNT_TYPE_OPTIONS, type AccountType } from '@/types/auth';

interface FormErrors {
  fullName?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
  accountType?: string;
  organization?: string;
  general?: string;
}

export default function RegisterPage() {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [accountType, setAccountType] = useState<AccountType | ''>('');
  const [organization, setOrganization] = useState('');
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusNotice, setStatusNotice] = useState<{
    type: 'info' | 'success' | 'error';
    message: string;
  } | null>(null);
  const [registrationComplete, setRegistrationComplete] = useState(false);

  const validateEmailFormat = (value: string): boolean => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
  };

  const validateForm = (): boolean => {
    const nextErrors: FormErrors = {};

    if (!fullName.trim()) {
      nextErrors.fullName = 'Please enter your full name.';
    } else if (fullName.trim().length < 2) {
      nextErrors.fullName = 'Please enter your full legal name.';
    }

    if (!email.trim()) {
      nextErrors.email = 'Please enter your email address.';
    } else if (!validateEmailFormat(email)) {
      nextErrors.email =
        'Please enter a valid email address (e.g., name@example.com).';
    }

    if (!password) {
      nextErrors.password = 'Please create an account password.';
    } else if (password.length < 8) {
      nextErrors.password = 'Password must be at least 8 characters long.';
    }

    if (!confirmPassword) {
      nextErrors.confirmPassword = 'Please confirm your password.';
    } else if (password !== confirmPassword) {
      nextErrors.confirmPassword = 'Passwords do not match.';
    }

    if (accountType === '') {
      nextErrors.accountType = 'Please choose the option that describes you.';
    } else if (accountType === 'organization_employee' && !organization.trim()) {
      nextErrors.organization = 'Please enter the organization you work for.';
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setStatusNotice(null);

    if (!validateForm()) {
      return;
    }

    if (accountType === '') {
      return;
    }
    const selected = ACCOUNT_TYPE_OPTIONS.find((option) => option.value === accountType);

    setIsSubmitting(true);
    try {
      const result = await registerLGUAccount(
        fullName.trim(),
        email.trim(),
        password,
        accountType,
        organization
      );

      if (result.success) {
        setStatusNotice({
          type: 'success',
          message:
            accountType === 'citizen'
              ? `${result.message} You can browse every project and file reports on them.`
              : `${result.message} You can browse projects and file reports now. Your "${selected?.label}" account has no extra access yet: an LGU Administrator reviews it before turning on anything more.`,
        });
        setRegistrationComplete(true);
      } else if (!result.configured) {
        setStatusNotice({
          type: 'info',
          message: result.message,
        });
      } else {
        setStatusNotice({
          type: 'error',
          message: result.message,
        });
      }
    } catch {
      setStatusNotice({
        type: 'error',
        message:
          'An unexpected error occurred while communicating with the authentication service.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-between bg-ground civic-subtle-grid text-ink">
      {/* Top Bar */}
      <header className="sticky top-0 z-30 civic-glass-nav border-b border-line px-4 sm:px-6 py-3.5">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <Link
            href="/"
            className="inline-flex items-center gap-2.5 font-display text-lg font-bold tracking-tight text-ink hover:text-accent-ink transition-colors whitespace-nowrap rounded-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent-ink"
          >
            <LguMark className="w-6 h-6" />
            LGU Tracker
          </Link>

          <div className="flex items-center gap-1">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 min-h-[36px] px-3 py-1.5 text-xs font-semibold text-muted hover:text-ink hover:bg-sunken rounded-lg transition-colors whitespace-nowrap focus-visible:outline-2 focus-visible:outline-accent-ink"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Home</span>
            </Link>
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center px-4 sm:px-6 py-10 sm:py-16">
        <div className="w-full max-w-md space-y-6">
          {/* Branding Header */}
          <div className="text-center space-y-1.5">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-card bg-ink text-on-ink mx-auto mb-2 shadow-xs">
              <Shield className="w-5 h-5 text-[#F59E0B]" aria-hidden="true" />
            </div>
            <div className="font-display text-2xl sm:text-3xl font-bold text-ink tracking-tight">
              LGU Tracker
            </div>
            <p className="font-display text-sm sm:text-base font-semibold text-[#F59E0B]">
              Bantay Proyekto, Gabay sa Progreso.
            </p>
            <h1 className="pt-2 text-sm font-semibold text-muted">
              Create Your LGU Tracker Account
            </h1>
          </div>

          {/* Card Container */}
          <div className="bg-surface border border-line rounded-card p-6 sm:p-8 shadow-sm">
            {!registrationComplete ? (
              <form onSubmit={handleSubmit} noValidate className="space-y-5">
                {/* Full Name */}
                <div>
                  <label
                    htmlFor="register-full-name"
                    className="block text-xs font-semibold text-ink mb-1.5"
                  >
                    Full Name
                  </label>
                  <input
                    id="register-full-name"
                    name="fullName"
                    type="text"
                    autoComplete="name"
                    value={fullName}
                    onChange={(e) => {
                      setFullName(e.target.value);
                      if (errors.fullName) {
                        setErrors((prev) => ({ ...prev, fullName: undefined }));
                      }
                    }}
                    placeholder="Juan Dela Cruz"
                    aria-invalid={Boolean(errors.fullName)}
                    aria-describedby={
                      errors.fullName ? 'register-full-name-error' : undefined
                    }
                    className={`w-full h-11 px-3.5 text-sm text-ink bg-ground border rounded-lg placeholder:text-muted focus:bg-white focus:outline-none focus:ring-2 transition-all ${
                      errors.fullName
                        ? 'border-[#DC2626] focus:border-[#DC2626] focus:ring-[#DC2626]/15'
                        : 'border-line focus:border-accent focus:ring-accent-ink/15'
                    }`}
                  />
                  {errors.fullName && (
                    <p
                      id="register-full-name-error"
                      role="alert"
                      className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-[#DC2626]"
                    >
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      <span>{errors.fullName}</span>
                    </p>
                  )}
                </div>

                {/* Institutional Email */}
                <div>
                  <label
                    htmlFor="register-email"
                    className="block text-xs font-semibold text-ink mb-1.5"
                  >
                    Institutional Email Address
                  </label>
                  <input
                    id="register-email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (errors.email) {
                        setErrors((prev) => ({ ...prev, email: undefined }));
                      }
                    }}
                    placeholder="name@example.com"
                    aria-invalid={Boolean(errors.email)}
                    aria-describedby={
                      errors.email ? 'register-email-error' : undefined
                    }
                    className={`w-full h-11 px-3.5 text-sm text-ink bg-ground border rounded-lg placeholder:text-muted focus:bg-white focus:outline-none focus:ring-2 transition-all ${
                      errors.email
                        ? 'border-[#DC2626] focus:border-[#DC2626] focus:ring-[#DC2626]/15'
                        : 'border-line focus:border-accent focus:ring-accent-ink/15'
                    }`}
                  />
                  {errors.email && (
                    <p
                      id="register-email-error"
                      role="alert"
                      className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-[#DC2626]"
                    >
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      <span>{errors.email}</span>
                    </p>
                  )}
                </div>

                {/* Password */}
                <div>
                  <label
                    htmlFor="register-password"
                    className="block text-xs font-semibold text-ink mb-1.5"
                  >
                    Password
                  </label>
                  <div className="relative">
                    <input
                      id="register-password"
                      name="password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        if (errors.password) {
                          setErrors((prev) => ({ ...prev, password: undefined }));
                        }
                      }}
                      placeholder="At least 8 characters"
                      aria-invalid={Boolean(errors.password)}
                      aria-describedby={
                        errors.password ? 'register-password-error' : undefined
                      }
                      className={`w-full h-11 pl-3.5 pr-11 text-sm text-ink bg-ground border rounded-lg placeholder:text-muted focus:bg-white focus:outline-none focus:ring-2 transition-all ${
                        errors.password
                          ? 'border-[#DC2626] focus:border-[#DC2626] focus:ring-[#DC2626]/15'
                          : 'border-line focus:border-accent focus:ring-accent-ink/15'
                      }`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-muted hover:text-ink rounded-md transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-accent-ink"
                    >
                      {showPassword ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                  {errors.password && (
                    <p
                      id="register-password-error"
                      role="alert"
                      className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-[#DC2626]"
                    >
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      <span>{errors.password}</span>
                    </p>
                  )}
                </div>

                {/* Confirm Password */}
                <div>
                  <label
                    htmlFor="register-confirm-password"
                    className="block text-xs font-semibold text-ink mb-1.5"
                  >
                    Confirm Password
                  </label>
                  <div className="relative">
                    <input
                      id="register-confirm-password"
                      name="confirmPassword"
                      type={showConfirmPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      value={confirmPassword}
                      onChange={(e) => {
                        setConfirmPassword(e.target.value);
                        if (errors.confirmPassword) {
                          setErrors((prev) => ({
                            ...prev,
                            confirmPassword: undefined,
                          }));
                        }
                      }}
                      placeholder="Re-enter your password"
                      aria-invalid={Boolean(errors.confirmPassword)}
                      aria-describedby={
                        errors.confirmPassword
                          ? 'register-confirm-password-error'
                          : undefined
                      }
                      className={`w-full h-11 pl-3.5 pr-11 text-sm text-ink bg-ground border rounded-lg placeholder:text-muted focus:bg-white focus:outline-none focus:ring-2 transition-all ${
                        errors.confirmPassword
                          ? 'border-[#DC2626] focus:border-[#DC2626] focus:ring-[#DC2626]/15'
                          : 'border-line focus:border-accent focus:ring-accent-ink/15'
                      }`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword((prev) => !prev)}
                      aria-label={
                        showConfirmPassword ? 'Hide password' : 'Show password'
                      }
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-muted hover:text-ink rounded-md transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-accent-ink"
                    >
                      {showConfirmPassword ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                  {errors.confirmPassword && (
                    <p
                      id="register-confirm-password-error"
                      role="alert"
                      className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-[#DC2626]"
                    >
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      <span>{errors.confirmPassword}</span>
                    </p>
                  )}
                </div>

                {/* Account type */}
                <fieldset aria-describedby={errors.accountType ? 'register-type-error' : 'register-type-hint'}>
                  <legend className="block text-xs font-semibold text-ink mb-1.5">
                    I am a...
                  </legend>
                  <div className="space-y-2">
                    {ACCOUNT_TYPE_OPTIONS.map((option) => (
                      <label
                        key={option.value}
                        className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                          accountType === option.value
                            ? 'border-ink bg-sunken'
                            : errors.accountType
                              ? 'border-[#DC2626] hover:bg-sunken'
                              : 'border-line hover:bg-sunken'
                        }`}
                      >
                        <input
                          type="radio"
                          name="account-type"
                          value={option.value}
                          checked={accountType === option.value}
                          onChange={() => {
                            setAccountType(option.value);
                            if (errors.accountType) {
                              setErrors((prev) => ({ ...prev, accountType: undefined }));
                            }
                          }}
                          className="mt-1 accent-ink"
                        />
                        <span className="text-sm">
                          <span className="block font-medium text-ink">{option.label}</span>
                          <span className="block text-xs text-muted mt-0.5">{option.description}</span>
                        </span>
                      </label>
                    ))}
                  </div>
                  {errors.accountType ? (
                    <p
                      id="register-type-error"
                      role="alert"
                      className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-[#DC2626]"
                    >
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      <span>{errors.accountType}</span>
                    </p>
                  ) : (
                    <p
                      id="register-type-hint"
                      className="mt-1.5 text-xs text-muted leading-relaxed"
                    >
                      This only tells us who you are. Every new account starts with the same access, and
                      staff or developer access is turned on by an LGU Administrator after review, never
                      automatically.
                    </p>
                  )}
                </fieldset>

                {accountType === 'organization_employee' && (
                  <div>
                    <label
                      htmlFor="register-organization"
                      className="block text-xs font-semibold text-ink mb-1.5"
                    >
                      Organization or office
                    </label>
                    <input
                      id="register-organization"
                      name="organization"
                      type="text"
                      value={organization}
                      maxLength={200}
                      onChange={(e) => {
                        setOrganization(e.target.value);
                        if (errors.organization) {
                          setErrors((prev) => ({ ...prev, organization: undefined }));
                        }
                      }}
                      aria-invalid={Boolean(errors.organization)}
                      aria-describedby={errors.organization ? 'register-organization-error' : undefined}
                      placeholder="e.g., City Engineer's Office"
                      className={`w-full h-11 px-3.5 text-sm text-ink bg-ground border rounded-lg focus:bg-white focus:outline-none focus:ring-2 transition-all ${
                        errors.organization
                          ? 'border-[#DC2626] focus:border-[#DC2626] focus:ring-[#DC2626]/15'
                          : 'border-line focus:border-accent focus:ring-accent-ink/15'
                      }`}
                    />
                    {errors.organization && (
                      <p
                        id="register-organization-error"
                        role="alert"
                        className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-[#DC2626]"
                      >
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                        <span>{errors.organization}</span>
                      </p>
                    )}
                  </div>
                )}

                {/* Status / Validation Notice */}
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
                      <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-[#16A34A]" />
                    ) : statusNotice.type === 'error' ? (
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-[#DC2626]" />
                    ) : (
                      <Info className="w-4 h-4 shrink-0 mt-0.5 text-[#0284C7]" />
                    )}
                    <span>{statusNotice.message}</span>
                  </div>
                )}

                {/* Sign Up Submit Button */}
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full min-h-[44px] py-2.5 px-4 text-sm font-semibold text-on-ink bg-ink hover:bg-ink-soft disabled:opacity-60 rounded-lg shadow-xs transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-ink"
                >
                  {isSubmitting ? 'Creating Account...' : 'Sign Up'}
                </button>

                <p className="text-center text-xs text-muted">
                  Already have an account?{' '}
                  <Link
                    href="/login"
                    className="font-semibold text-accent-ink hover:text-ink hover:underline transition-colors"
                  >
                    Sign In
                  </Link>
                </p>
              </form>
            ) : (
              /* Post-Registration Confirmation */
              <div className="space-y-5">
                {statusNotice && (
                  <div
                    role="status"
                    className="p-3.5 rounded-lg border border-emerald-200 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/12 text-xs text-[#16A34A] leading-relaxed flex items-start gap-2.5"
                  >
                    <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-[#16A34A]" />
                    <span>{statusNotice.message}</span>
                  </div>
                )}

                <Link
                  href="/login"
                  className="w-full inline-flex items-center justify-center min-h-[44px] py-2.5 px-4 text-sm font-semibold text-on-ink bg-ink hover:bg-ink-soft rounded-lg shadow-xs transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-ink"
                >
                  Continue to Sign In
                </Link>
              </div>
            )}

            {/* Supabase Integration Readiness */}
            <div className="mt-6 pt-5 border-t border-line space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-ink">
                  Supabase Auth Status
                </span>
                <span
                  className={`tabular-nums font-medium ${
                    isSupabaseConfigured ? 'text-[#16A34A]' : 'text-muted'
                  }`}
                >
                  {isSupabaseConfigured ? 'Connected' : 'Prepared (Env Standby)'}
                </span>
              </div>
              <p className="text-xs text-muted leading-relaxed">
                Wired to the typed Supabase Auth adapter (
                <code className="tabular-nums text-[11px] text-ink">
                  src/lib/supabase/client.ts
                </code>
                ). Public transparency data never requires an account:
              </p>
              <Link
                href="/dashboard?mode=public"
                className="inline-flex items-center justify-center w-full min-h-[40px] px-3.5 py-2 text-xs font-semibold text-ink bg-ground hover:bg-sunken border border-line rounded-lg transition-colors whitespace-nowrap"
              >
                Browse Public Transparency View
              </Link>
            </div>
          </div>
        </div>
      </main>

      {/* Quiet Footer */}
      <footer className="py-5 px-4 sm:px-6 border-t border-line bg-surface text-center text-xs text-muted">
        LGU Tracker —{' '}
        <span className="text-ink font-medium">
          Bantay Proyekto, Gabay sa Progreso.
        </span>{' '}
        · CCC181 Final Project by Team BB (BeyondBoard)
      </footer>
    </div>
  );
}
