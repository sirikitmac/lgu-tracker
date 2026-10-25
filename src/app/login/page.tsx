'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Eye,
  EyeOff,
  AlertCircle,
  CheckCircle2,
  ArrowLeft,
  Shield,
  Info,
} from 'lucide-react';
import {
  isSupabaseConfigured,
  signInWithLGUCredentials,
  requestLGUPasswordReset,
} from '@/lib/supabase/client';

interface FormErrors {
  email?: string;
  password?: string;
  general?: string;
}

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusNotice, setStatusNotice] = useState<{
    type: 'info' | 'success' | 'error';
    message: string;
  } | null>(null);

  const [forgotPasswordMode, setForgotPasswordMode] = useState(false);
  const [recoveryEmail, setRecoveryEmail] = useState('');
  const [recoveryError, setRecoveryError] = useState('');
  const [recoveryNotice, setRecoveryNotice] = useState('');
  const [isSendingRecovery, setIsSendingRecovery] = useState(false);

  const validateEmailFormat = (value: string): boolean => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
  };

  const validateSignInForm = (): boolean => {
    const nextErrors: FormErrors = {};

    if (!email.trim()) {
      nextErrors.email = 'Please enter your institutional LGU email address.';
    } else if (!validateEmailFormat(email)) {
      nextErrors.email =
        'Please enter a valid email address (e.g., officer@lgu.gov.ph).';
    }

    if (!password) {
      nextErrors.password = 'Please enter your account password.';
    } else if (password.length < 8) {
      nextErrors.password = 'Password must be at least 8 characters long.';
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSignInSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setStatusNotice(null);

    if (!validateSignInForm()) {
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await signInWithLGUCredentials(email.trim(), password);
      if (result.success) {
        setStatusNotice({
          type: 'success',
          message: result.message,
        });
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

  const handlePasswordRecoverySubmit = async (
    e: React.FormEvent<HTMLFormElement>
  ) => {
    e.preventDefault();
    setRecoveryError('');
    setRecoveryNotice('');

    if (!recoveryEmail.trim()) {
      setRecoveryError(
        'Please enter the email address associated with your LGU account.'
      );
      return;
    }
    if (!validateEmailFormat(recoveryEmail)) {
      setRecoveryError('Please enter a valid institutional email address.');
      return;
    }

    setIsSendingRecovery(true);
    try {
      const result = await requestLGUPasswordReset(recoveryEmail.trim());
      setRecoveryNotice(result.message);
    } catch {
      setRecoveryError('Unable to process password reset request at this time.');
    } finally {
      setIsSendingRecovery(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-between bg-[#F8FAFC] civic-subtle-grid text-[#0F172A]">
      {/* Top Bar */}
      <header className="sticky top-0 z-30 civic-glass-nav border-b border-[#E2E8F0] px-4 sm:px-6 py-3.5">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <Link
            href="/"
            className="font-display text-lg font-bold tracking-tight text-[#172B4D] hover:text-[#2563EB] transition-colors whitespace-nowrap rounded-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#2563EB]"
          >
            LGU Tracker
          </Link>

          <Link
            href="/"
            className="inline-flex items-center gap-1.5 min-h-[36px] px-3 py-1.5 text-xs font-semibold text-[#64748B] hover:text-[#172B4D] hover:bg-[#F1F5F9] rounded-lg transition-colors whitespace-nowrap focus-visible:outline-2 focus-visible:outline-[#2563EB]"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Home</span>
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center px-4 sm:px-6 py-10 sm:py-16">
        <div className="w-full max-w-md space-y-6">
          {/* Branding Header */}
          <div className="text-center space-y-1.5">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-[#172B4D] text-white mx-auto mb-2 shadow-xs">
              <Shield className="w-5 h-5 text-[#F59E0B]" aria-hidden="true" />
            </div>
            <div className="font-display text-2xl sm:text-3xl font-bold text-[#172B4D] tracking-tight">
              LGU Tracker
            </div>
            <p className="font-display text-sm sm:text-base italic font-semibold text-[#F59E0B]">
              Bantay Proyekto, Gabay sa Progreso.
            </p>
            <h1 className="pt-2 text-sm font-semibold text-[#64748B]">
              {forgotPasswordMode
                ? 'Reset LGU Account Password'
                : 'Official LGU Personnel Sign In'}
            </h1>
          </div>

          {/* Card Container */}
          <div className="bg-white border border-[#E2E8F0] rounded-xl p-6 sm:p-8 shadow-sm">
            {!forgotPasswordMode ? (
              <form
                onSubmit={handleSignInSubmit}
                noValidate
                className="space-y-5"
              >
                {/* Email Field */}
                <div>
                  <label
                    htmlFor="login-email"
                    className="block text-xs font-semibold text-[#0F172A] mb-1.5"
                  >
                    Institutional Email Address
                  </label>
                  <input
                    id="login-email"
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
                    placeholder="name@municipality.gov.ph"
                    aria-invalid={Boolean(errors.email)}
                    aria-describedby={
                      errors.email ? 'login-email-error' : undefined
                    }
                    className={`w-full h-11 px-3.5 text-sm text-[#0F172A] bg-[#F8FAFC] border rounded-lg placeholder:text-[#64748B] focus:bg-white focus:outline-none focus:ring-2 transition-all ${
                      errors.email
                        ? 'border-[#DC2626] focus:border-[#DC2626] focus:ring-[#DC2626]/15'
                        : 'border-[#E2E8F0] focus:border-[#2563EB] focus:ring-[#2563EB]/15'
                    }`}
                  />
                  {errors.email && (
                    <p
                      id="login-email-error"
                      role="alert"
                      className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-[#DC2626]"
                    >
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      <span>{errors.email}</span>
                    </p>
                  )}
                </div>

                {/* Password Field with Show/Hide Control */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label
                      htmlFor="login-password"
                      className="block text-xs font-semibold text-[#0F172A]"
                    >
                      Password
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setForgotPasswordMode(true);
                        setRecoveryEmail(email);
                        setRecoveryError('');
                        setRecoveryNotice('');
                      }}
                      className="text-xs font-semibold text-[#2563EB] hover:text-[#172B4D] hover:underline transition-colors cursor-pointer"
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
                        if (errors.password) {
                          setErrors((prev) => ({
                            ...prev,
                            password: undefined,
                          }));
                        }
                      }}
                      placeholder="Enter your password"
                      aria-invalid={Boolean(errors.password)}
                      aria-describedby={
                        errors.password ? 'login-password-error' : undefined
                      }
                      className={`w-full h-11 pl-3.5 pr-11 text-sm text-[#0F172A] bg-[#F8FAFC] border rounded-lg placeholder:text-[#64748B] focus:bg-white focus:outline-none focus:ring-2 transition-all ${
                        errors.password
                          ? 'border-[#DC2626] focus:border-[#DC2626] focus:ring-[#DC2626]/15'
                          : 'border-[#E2E8F0] focus:border-[#2563EB] focus:ring-[#2563EB]/15'
                      }`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      aria-label={
                        showPassword ? 'Hide password' : 'Show password'
                      }
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-[#64748B] hover:text-[#0F172A] rounded-md transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-[#2563EB]"
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
                      id="login-password-error"
                      role="alert"
                      className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-[#DC2626]"
                    >
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      <span>{errors.password}</span>
                    </p>
                  )}
                </div>

                {/* Status / Validation Notice */}
                {statusNotice && (
                  <div
                    role="status"
                    className={`p-3.5 rounded-lg border text-xs leading-relaxed flex items-start gap-2.5 ${
                      statusNotice.type === 'success'
                        ? 'bg-emerald-50 border-emerald-200 text-[#16A34A]'
                        : statusNotice.type === 'error'
                        ? 'bg-red-50 border-red-200 text-[#DC2626]'
                        : 'bg-[#F8FAFC] border-[#E2E8F0] text-[#0F172A]'
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

                {/* Sign In Submit Button */}
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full min-h-[44px] py-2.5 px-4 text-sm font-semibold text-white bg-[#172B4D] hover:bg-[#2563EB] disabled:opacity-60 rounded-lg shadow-xs transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563EB]"
                >
                  {isSubmitting ? 'Verifying Credentials...' : 'Sign In'}
                </button>
              </form>
            ) : (
              /* Forgot Password Form */
              <form
                onSubmit={handlePasswordRecoverySubmit}
                noValidate
                className="space-y-5"
              >
                <p className="text-xs text-[#64748B] leading-relaxed">
                  Enter your institutional LGU email address to request a password reset link via Supabase Auth, or contact your Municipal IT Administrator.
                </p>

                <div>
                  <label
                    htmlFor="recovery-email"
                    className="block text-xs font-semibold text-[#0F172A] mb-1.5"
                  >
                    Institutional Email Address
                  </label>
                  <input
                    id="recovery-email"
                    type="email"
                    value={recoveryEmail}
                    onChange={(e) => {
                      setRecoveryEmail(e.target.value);
                      if (recoveryError) setRecoveryError('');
                    }}
                    placeholder="name@municipality.gov.ph"
                    className={`w-full h-11 px-3.5 text-sm text-[#0F172A] bg-[#F8FAFC] border rounded-lg placeholder:text-[#64748B] focus:bg-white focus:outline-none focus:ring-2 transition-all ${
                      recoveryError
                        ? 'border-[#DC2626] focus:border-[#DC2626] focus:ring-[#DC2626]/15'
                        : 'border-[#E2E8F0] focus:border-[#2563EB] focus:ring-[#2563EB]/15'
                    }`}
                  />
                  {recoveryError && (
                    <p
                      role="alert"
                      className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-[#DC2626]"
                    >
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      <span>{recoveryError}</span>
                    </p>
                  )}
                </div>

                {recoveryNotice && (
                  <div
                    role="status"
                    className="p-3.5 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0] text-xs text-[#0F172A] leading-relaxed flex items-start gap-2.5"
                  >
                    <Info className="w-4 h-4 text-[#0284C7] shrink-0 mt-0.5" />
                    <span>{recoveryNotice}</span>
                  </div>
                )}

                <div className="space-y-2.5">
                  <button
                    type="submit"
                    disabled={isSendingRecovery}
                    className="w-full min-h-[44px] py-2.5 px-4 text-sm font-semibold text-white bg-[#2563EB] hover:bg-[#172B4D] disabled:opacity-60 rounded-lg shadow-xs transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563EB]"
                  >
                    {isSendingRecovery
                      ? 'Sending Recovery Request...'
                      : 'Send Password Reset Instructions'}
                  </button>

                  <button
                    type="button"
                    onClick={() => setForgotPasswordMode(false)}
                    className="w-full min-h-[40px] py-2 px-4 text-xs font-semibold text-[#64748B] hover:text-[#0F172A] hover:bg-[#F1F5F9] rounded-lg transition-colors cursor-pointer"
                  >
                    Return to Sign In
                  </button>
                </div>
              </form>
            )}

            {/* Supabase Integration Readiness & Public Access Options */}
            <div className="mt-6 pt-5 border-t border-[#E2E8F0] space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-[#0F172A]">
                  Supabase Auth Status
                </span>
                <span
                  className={`font-mono font-medium ${
                    isSupabaseConfigured ? 'text-[#16A34A]' : 'text-[#64748B]'
                  }`}
                >
                  {isSupabaseConfigured ? 'Connected' : 'Prepared (Env Standby)'}
                </span>
              </div>
              <p className="text-xs text-[#64748B] leading-relaxed">
                Wired to the typed Supabase Auth adapter (
                <code className="font-mono text-[11px] text-[#172B4D]">
                  src/lib/supabase/client.ts
                </code>
                ). Explore the monitoring workspace below:
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                <Link
                  href="/dashboard?mode=public"
                  className="inline-flex items-center justify-center min-h-[40px] px-3.5 py-2 text-xs font-semibold text-[#0F172A] bg-[#F8FAFC] hover:bg-[#F1F5F9] border border-[#E2E8F0] rounded-lg transition-colors whitespace-nowrap"
                >
                  Public Transparency View
                </Link>
                <Link
                  href="/dashboard"
                  className="inline-flex items-center justify-center min-h-[40px] px-3.5 py-2 text-xs font-semibold text-[#2563EB] bg-[#F8FAFC] hover:bg-[#F1F5F9] border border-[#E2E8F0] rounded-lg transition-colors whitespace-nowrap"
                >
                  Preview Dashboard Layout
                </Link>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Quiet Footer */}
      <footer className="py-5 px-4 sm:px-6 border-t border-[#E2E8F0] bg-white text-center text-xs text-[#64748B]">
        LGU Tracker —{' '}
        <span className="italic text-[#172B4D] font-medium">
          Bantay Proyekto, Gabay sa Progreso.
        </span>{' '}
        · CCC181 Final Project by Team BB (BeyondBoard)
      </footer>
    </div>
  );
}
