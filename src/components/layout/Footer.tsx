import React from 'react';
import Link from 'next/link';

export function Footer() {
  return (
    <footer className="bg-[#172B4D] text-white border-t border-[#1e3a66]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12 lg:py-14">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 pb-10 border-b border-white/10">
          <div className="md:col-span-5 space-y-2.5">
            <div className="font-display text-xl font-bold tracking-tight text-white">
              LGU Tracker
            </div>
            <p className="text-sm italic font-medium text-[#F59E0B]">
              Bantay Proyekto, Gabay sa Progreso.
            </p>
            <p className="text-sm text-slate-300 leading-relaxed max-w-md pt-1">
              A web-based Local Government Unit Project Monitoring System designed for transparent public infrastructure tracking, procurement oversight, and fiscal accountability.
            </p>
          </div>

          <div className="md:col-span-3 space-y-3">
            <h3 className="text-sm font-semibold text-white tracking-tight">
              System Navigation
            </h3>
            <ul className="space-y-2 text-sm text-slate-300">
              <li>
                <Link
                  href="/"
                  className="hover:text-white hover:underline underline-offset-4 transition-colors"
                >
                  Home &amp; Overview
                </Link>
              </li>
              <li>
                <Link
                  href="/projects"
                  className="hover:text-white hover:underline underline-offset-4 transition-colors"
                >
                  Explore Public Projects
                </Link>
              </li>
              <li>
                <Link
                  href="/projects/map"
                  className="hover:text-white hover:underline underline-offset-4 transition-colors"
                >
                  Public Project Map
                </Link>
              </li>
              <li>
                <Link
                  href="/dashboard"
                  className="hover:text-white hover:underline underline-offset-4 transition-colors"
                >
                  Project Monitoring Dashboard
                </Link>
              </li>
              <li>
                <Link
                  href="/login"
                  className="hover:text-white hover:underline underline-offset-4 transition-colors"
                >
                  LGU Personnel Sign In
                </Link>
              </li>
            </ul>
          </div>

          <div className="md:col-span-4 space-y-3">
            <h3 className="text-sm font-semibold text-white tracking-tight">
              Academic &amp; Data Notice
            </h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              Developed as a{' '}
              <strong className="text-white font-semibold">
                CCC181 Final Project
              </strong>{' '}
              by{' '}
              <strong className="text-white font-semibold">
                Team BB (BeyondBoard)
              </strong>
              . All project allocations, contractor names, and barangay metrics displayed in this prototype are sample records created to demonstrate system architecture and are not official Philippine government data.
            </p>
          </div>
        </div>

        <div className="pt-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs text-slate-400">
          <p>
            © 2026 LGU Tracker — Team BB (BeyondBoard) · CCC181 Software Engineering Project.
          </p>
          <p>Next.js App Router · TypeScript · Supabase Ready</p>
        </div>
      </div>
    </footer>
  );
}
