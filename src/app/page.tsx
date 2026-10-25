'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  FileText,
  DollarSign,
  Zap,
  TrendingUp,
  MapPin,
  Users,
  ArrowRight,
  CheckCircle2,
} from 'lucide-react';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import {
  CORE_FEATURES,
  LIFECYCLE_STAGES,
} from '@/data/sampleProjects';
import { FeatureCardItem, LifecycleStageId } from '@/types/project';

export default function LandingPage() {
  const [selectedLifecycleId, setSelectedLifecycleId] =
    useState<LifecycleStageId>('implementation');

  const activeLifecycleStage =
    LIFECYCLE_STAGES.find((stage) => stage.id === selectedLifecycleId) ||
    LIFECYCLE_STAGES[2];

  const renderFeatureIcon = (iconName: FeatureCardItem['iconName']) => {
    switch (iconName) {
      case 'file-text':
        return <FileText className="w-5 h-5 text-white" aria-hidden="true" />;
      case 'dollar-sign':
        return <DollarSign className="w-5 h-5 text-white" aria-hidden="true" />;
      case 'zap':
        return <Zap className="w-5 h-5 text-white" aria-hidden="true" />;
      case 'trending-up':
        return <TrendingUp className="w-5 h-5 text-white" aria-hidden="true" />;
      case 'map-pin':
        return <MapPin className="w-5 h-5 text-white" aria-hidden="true" />;
      case 'users':
      default:
        return <Users className="w-5 h-5 text-white" aria-hidden="true" />;
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#F8FAFC] text-[#0F172A]">
      <Navbar />

      <main className="flex-1">
        {/* Hero Section */}
        <section className="civic-hero-surface border-b border-[#E2E8F0]">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 py-24 sm:py-32 lg:py-40 text-center flex flex-col items-center">
            {/* Main Focal Point: Brand Title & Tagline */}
            <h1 className="font-display text-5xl sm:text-6xl lg:text-7xl font-bold text-[#172B4D] tracking-tight leading-none">
              LGU Tracker
            </h1>
            <p className="mt-4 sm:mt-5 font-display text-xl sm:text-2xl lg:text-3xl italic font-semibold text-[#F59E0B] tracking-tight">
              Bantay Proyekto, Gabay sa Progreso.
            </p>

            {/* Primary & Secondary CTAs */}
            <div className="mt-10 sm:mt-12 flex flex-col sm:flex-row items-center justify-center gap-3.5 sm:gap-4 w-full sm:w-auto">
              <Link
                href="/projects"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 min-h-[46px] px-7 py-3 text-sm font-semibold text-white bg-[#2563EB] hover:bg-[#172B4D] rounded-lg shadow-xs transition-all duration-150 whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563EB]"
              >
                <span>Explore Public Projects</span>
                <ArrowRight className="w-4 h-4" />
              </Link>

              <Link
                href="/projects/map"
                className="w-full sm:w-auto inline-flex items-center justify-center min-h-[46px] px-7 py-3 text-sm font-semibold text-[#172B4D] bg-white/90 hover:bg-[#F1F5F9] border border-[#E2E8F0] hover:border-[#64748B]/40 rounded-lg shadow-2xs transition-all duration-150 whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#172B4D]"
              >
                View Project Map
              </Link>

              <Link
                href="/dashboard"
                className="w-full sm:w-auto inline-flex items-center justify-center min-h-[46px] px-7 py-3 text-sm font-semibold text-[#172B4D] bg-white/90 hover:bg-[#F1F5F9] border border-[#E2E8F0] hover:border-[#64748B]/40 rounded-lg shadow-2xs transition-all duration-150 whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#172B4D]"
              >
                Access Dashboard
              </Link>
            </div>
          </div>
        </section>

        {/* Everything You Need to Succeed — 6-Card Feature Grid */}
        <section
          id="features"
          className="py-16 sm:py-20 lg:py-24 max-w-7xl mx-auto px-4 sm:px-6"
        >
          <div className="max-w-2xl mx-auto text-center space-y-3 mb-12 lg:mb-14">
            <h2 className="font-display text-3xl sm:text-4xl font-bold text-[#172B4D] tracking-tight">
              Everything You Need to{' '}
              <span className="text-[#2563EB]">Succeed</span>
            </h2>
            <p className="text-sm sm:text-base text-[#64748B] leading-relaxed">
              Comprehensive tools designed specifically for Philippine local government project management
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
            {CORE_FEATURES.map((feature) => (
              <div
                key={feature.id}
                className="bg-white border border-[#E2E8F0] rounded-xl p-6 sm:p-7 flex flex-col items-start shadow-2xs hover:shadow-md hover:border-[#2563EB]/40 hover:-translate-y-0.5 transition-all duration-150"
              >
                <div
                  className={`w-12 h-12 rounded-xl ${feature.iconBgClass} flex items-center justify-center mb-5 shrink-0 shadow-xs`}
                >
                  {renderFeatureIcon(feature.iconName)}
                </div>

                <h3 className="font-display text-lg font-bold text-[#0F172A]">
                  {feature.title}
                </h3>

                <p className="text-sm text-[#64748B] mt-2.5 leading-relaxed">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Concise Project Lifecycle Section */}
        <section
          id="lifecycle"
          className="py-16 sm:py-20 lg:py-24 bg-white border-t border-[#E2E8F0]"
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6">
            <div className="max-w-3xl space-y-2.5 mb-10 lg:mb-12">
              <p className="text-xs font-semibold text-[#D97706] tracking-wide">
                End-to-End Governance Workflow
              </p>
              <h2 className="font-display text-2xl sm:text-3xl font-bold text-[#172B4D] tracking-tight">
                Standardized 4-Stage LGU Project Lifecycle
              </h2>
              <p className="text-sm sm:text-base text-[#64748B] leading-relaxed">
                Every project monitored in LGU Tracker follows a clear institutional path from barangay development planning through final inspection and public audit. Select any stage below to inspect its required outputs.
              </p>
            </div>

            {/* Interactive 4-Stage Selector Grid */}
            <div
              role="tablist"
              aria-label="LGU Project Lifecycle Stages"
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4 mb-6"
            >
              {LIFECYCLE_STAGES.map((stage) => {
                const isSelected = stage.id === selectedLifecycleId;
                return (
                  <button
                    key={stage.id}
                    type="button"
                    role="tab"
                    id={`tab-${stage.id}`}
                    aria-selected={isSelected}
                    aria-controls={`panel-${stage.id}`}
                    onClick={() => setSelectedLifecycleId(stage.id)}
                    className={`text-left p-5 rounded-xl border transition-all duration-150 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563EB] ${
                      isSelected
                        ? 'bg-[#172B4D] text-white border-[#172B4D] shadow-sm'
                        : 'bg-[#F8FAFC] text-[#0F172A] border-[#E2E8F0] hover:bg-white hover:border-[#2563EB]/50'
                    }`}
                  >
                    <div
                      className={`font-mono text-xs font-semibold ${
                        isSelected ? 'text-[#F59E0B]' : 'text-[#2563EB]'
                      }`}
                    >
                      {stage.stepNumber}
                    </div>
                    <h3 className="font-display text-base font-bold mt-1">
                      {stage.title}
                    </h3>
                    <p
                      className={`text-xs mt-1 leading-snug ${
                        isSelected ? 'text-slate-300' : 'text-[#64748B]'
                      }`}
                    >
                      {stage.subtitle}
                    </p>
                  </button>
                );
              })}
            </div>

            {/* Active Lifecycle Stage Detail Panel */}
            <div
              role="tabpanel"
              id={`panel-${activeLifecycleStage.id}`}
              aria-labelledby={`tab-${activeLifecycleStage.id}`}
              className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-6 sm:p-8"
            >
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                <div className="lg:col-span-7 space-y-3">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-[#64748B]">
                    <span className="font-mono font-semibold text-[#2563EB]">
                      {activeLifecycleStage.stepNumber}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>
                      Responsible Unit: {activeLifecycleStage.responsibleUnit}
                    </span>
                  </div>
                  <h3 className="font-display text-xl font-bold text-[#172B4D]">
                    {activeLifecycleStage.title} — {activeLifecycleStage.subtitle}
                  </h3>
                  <p className="text-sm text-[#64748B] leading-relaxed">
                    {activeLifecycleStage.description}
                  </p>
                </div>

                <div className="lg:col-span-5 bg-white border border-[#E2E8F0] rounded-lg p-5 shadow-2xs">
                  <h4 className="text-xs font-semibold text-[#172B4D] mb-3">
                    Mandatory Documentary Outputs &amp; Checkpoints
                  </h4>
                  <ul className="space-y-2.5">
                    {activeLifecycleStage.keyOutputs.map((output) => (
                      <li
                        key={output}
                        className="flex items-start gap-2.5 text-xs font-medium text-[#0F172A]"
                      >
                        <CheckCircle2
                          className="w-4 h-4 text-[#16A34A] shrink-0 mt-0.5"
                          aria-hidden="true"
                        />
                        <span>{output}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
