'use client';

import React, { useEffect } from 'react';
import {
  X,
  CheckCircle2,
  Circle,
  Building2,
  MapPin,
  Calendar,
  Users,
  FileText,
  Image as ImageIcon,
} from 'lucide-react';
import { LGUProject } from '@/types/project';
import { formatPHP, LIFECYCLE_STAGES } from '@/data/sampleProjects';
import { StatusBadge } from '@/components/ui/StatusBadge';

interface ProjectDetailDrawerProps {
  project: LGUProject | null;
  onClose: () => void;
}

export function ProjectDetailDrawer({
  project,
  onClose,
}: ProjectDetailDrawerProps) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    if (project) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [project, onClose]);

  if (!project) {
    return null;
  }

  const utilizationPercent =
    project.allocatedBudget > 0
      ? Math.round((project.disbursedBudget / project.allocatedBudget) * 100)
      : 0;

  const currentStageIndex = LIFECYCLE_STAGES.findIndex(
    (s) => s.id === project.lifecycleStage
  );

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="drawer-project-title"
      className="fixed inset-0 z-50 flex justify-end"
    >
      {/* Glassmorphic Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/45 backdrop-blur-xs transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Slide-over Panel */}
      <div className="relative z-10 w-full max-w-2xl bg-white h-full shadow-2xl border-l border-[#E2E8F0] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-5 sm:px-6 py-5 bg-[#172B4D] text-white flex items-start justify-between gap-4">
          <div className="space-y-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-300">
              <span className="font-mono font-semibold text-[#F59E0B] tabular-nums">
                {project.referenceCode}
              </span>
              <span aria-hidden="true">·</span>
              <span className="truncate">{project.category}</span>
            </div>
            <h2
              id="drawer-project-title"
              className="font-display text-base sm:text-lg font-bold tracking-tight text-white leading-snug"
            >
              {project.title}
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close project details drawer"
            className="min-w-[40px] min-h-[40px] inline-flex items-center justify-center p-2 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-colors shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-[#F59E0B]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
          {/* Site Documentation Photo Holder */}
          <div className="relative h-48 w-full rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] civic-subtle-grid flex flex-col items-center justify-center p-4 overflow-hidden">
            {project.imageUrl ? (
              <img
                src={project.imageUrl}
                alt={project.title}
                referrerPolicy="no-referrer"
                className="absolute inset-0 w-full h-full object-cover"
              />
            ) : (
              <div className="flex flex-col items-center justify-center text-center">
                <div className="w-11 h-11 rounded-xl bg-white border border-[#E2E8F0] shadow-2xs flex items-center justify-center mb-2 text-[#2563EB]">
                  <ImageIcon className="w-5 h-5" aria-hidden="true" />
                </div>
                <span className="text-xs font-semibold text-[#172B4D]">
                  Project Site Documentation Photo Holder
                </span>
                <span className="text-xs text-[#64748B] mt-0.5">
                  {project.imageCaption ||
                    `${project.barangay} · Field Inspection Media Slot`}
                </span>
              </div>
            )}
          </div>

          {/* Status & Physical Progress Summary */}
          <div className="flex flex-wrap items-center justify-between gap-4 pb-5 border-b border-[#E2E8F0]">
            <div>
              <span className="block text-xs text-[#64748B] mb-1">
                Current Monitoring Status
              </span>
              <StatusBadge status={project.status} />
            </div>

            <div className="text-right">
              <span className="block text-xs text-[#64748B] mb-1">
                Physical Accomplishment
              </span>
              <span className="font-mono text-xl font-bold text-[#0F172A] tabular-nums">
                {project.progressPercentage}%
              </span>
            </div>
          </div>

          {/* Scope & Description */}
          <div className="space-y-2">
            <h3 className="text-xs font-semibold text-[#64748B]">
              Project Scope &amp; Technical Description
            </h3>
            <p className="text-sm text-[#0F172A] leading-relaxed">
              {project.description}
            </p>
          </div>

          {/* Financial Allocation & Disbursement */}
          <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-xs font-semibold text-[#0F172A]">
                Budget Allocation &amp; Fund Utilization (Sample Data)
              </h3>
              <span className="font-mono text-xs font-semibold text-[#0284C7] tabular-nums">
                {utilizationPercent}% Disbursed
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <span className="block text-xs text-[#64748B]">
                  Approved Appropriation
                </span>
                <span className="font-mono text-lg font-bold text-[#0F172A] tabular-nums">
                  {formatPHP(project.allocatedBudget)}
                </span>
              </div>
              <div>
                <span className="block text-xs text-[#64748B]">
                  Actual Disbursed Amount
                </span>
                <span className="font-mono text-lg font-bold text-[#16A34A] tabular-nums">
                  {formatPHP(project.disbursedBudget)}
                </span>
              </div>
            </div>

            <div className="w-full h-2 bg-[#E2E8F0] rounded-full overflow-hidden">
              <div
                className="h-full bg-[#2563EB] transition-all"
                style={{ width: `${utilizationPercent}%` }}
              />
            </div>
          </div>

          {/* Lifecycle Stage Progression */}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold text-[#64748B]">
              LGU Project Lifecycle Stage
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {LIFECYCLE_STAGES.map((stage, idx) => {
                const isCompleted = idx < currentStageIndex;
                const isCurrent = idx === currentStageIndex;
                return (
                  <div
                    key={stage.id}
                    className={`p-3 rounded-lg border text-xs ${
                      isCurrent
                        ? 'bg-[#172B4D] text-white border-[#172B4D] shadow-2xs'
                        : isCompleted
                        ? 'bg-[#F8FAFC] text-[#16A34A] border-[#E2E8F0]'
                        : 'bg-white text-[#64748B] border-[#E2E8F0]'
                    }`}
                  >
                    <div
                      className={`font-mono text-[11px] font-semibold ${
                        isCurrent ? 'text-[#F59E0B]' : 'opacity-80'
                      }`}
                    >
                      {stage.stepNumber}
                    </div>
                    <div className="font-semibold mt-0.5 leading-snug">
                      {stage.title}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Key Governance Metadata */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-[#E2E8F0] text-sm">
            <div className="flex items-start gap-2.5">
              <MapPin className="w-4 h-4 text-[#2563EB] mt-0.5 shrink-0" />
              <div>
                <span className="block text-xs text-[#64748B]">
                  Location / Barangay
                </span>
                <span className="font-medium text-[#0F172A]">
                  {project.barangay}
                </span>
              </div>
            </div>

            <div className="flex items-start gap-2.5">
              <Building2 className="w-4 h-4 text-[#2563EB] mt-0.5 shrink-0" />
              <div>
                <span className="block text-xs text-[#64748B]">
                  Implementing Office
                </span>
                <span className="font-medium text-[#0F172A]">
                  {project.implementingOffice}
                </span>
              </div>
            </div>

            <div className="flex items-start gap-2.5">
              <FileText className="w-4 h-4 text-[#2563EB] mt-0.5 shrink-0" />
              <div>
                <span className="block text-xs text-[#64748B]">
                  Contractor / Procurement Mode
                </span>
                <span className="font-medium text-[#0F172A] block">
                  {project.contractorOrPartner}
                </span>
                <span className="text-xs text-[#64748B]">
                  {project.procurementMode}
                </span>
              </div>
            </div>

            <div className="flex items-start gap-2.5">
              <Calendar className="w-4 h-4 text-[#2563EB] mt-0.5 shrink-0" />
              <div>
                <span className="block text-xs text-[#64748B]">
                  Implementation Schedule
                </span>
                <span className="font-mono text-xs font-medium text-[#0F172A] tabular-nums">
                  {project.startDate} to {project.targetCompletionDate}
                </span>
                <span className="block text-[11px] text-[#64748B] font-mono tabular-nums mt-0.5">
                  Last Verified: {project.lastUpdated}
                </span>
              </div>
            </div>

            <div className="sm:col-span-2 flex items-start gap-2.5">
              <Users className="w-4 h-4 text-[#2563EB] mt-0.5 shrink-0" />
              <div>
                <span className="block text-xs text-[#64748B]">
                  Target Community Beneficiaries
                </span>
                <span className="font-medium text-[#0F172A]">
                  {project.beneficiaries}
                </span>
              </div>
            </div>
          </div>

          {/* Milestones Checklist */}
          <div className="space-y-3 pt-4 border-t border-[#E2E8F0]">
            <h3 className="text-xs font-semibold text-[#64748B]">
              Project Milestones &amp; Inspectorate Verification
            </h3>
            <ul className="space-y-2.5">
              {project.milestones.map((milestone) => (
                <li
                  key={milestone.id}
                  className="p-3.5 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] flex items-start justify-between gap-3"
                >
                  <div className="flex items-start gap-2.5">
                    {milestone.completed ? (
                      <CheckCircle2
                        className="w-4 h-4 text-[#16A34A] mt-0.5 shrink-0"
                        aria-hidden="true"
                      />
                    ) : (
                      <Circle
                        className="w-4 h-4 text-[#64748B] mt-0.5 shrink-0"
                        aria-hidden="true"
                      />
                    )}
                    <div>
                      <p className="text-sm font-medium text-[#0F172A]">
                        {milestone.title}
                      </p>
                      {milestone.verifiedBy && (
                        <p className="text-xs text-[#16A34A] mt-0.5">
                          Verified by {milestone.verifiedBy}
                        </p>
                      )}
                    </div>
                  </div>
                  <span className="font-mono text-xs text-[#64748B] whitespace-nowrap tabular-nums">
                    {milestone.targetDate}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-5 sm:px-6 py-4 civic-glass-nav border-t border-[#E2E8F0] flex items-center justify-between gap-4">
          <span className="text-xs text-[#64748B]">
            Sample LGU Record · CCC181 Prototype
          </span>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[38px] px-4 py-2 text-xs font-semibold text-white bg-[#172B4D] hover:bg-[#2563EB] rounded-lg transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563EB]"
          >
            Close Details
          </button>
        </div>
      </div>
    </div>
  );
}
