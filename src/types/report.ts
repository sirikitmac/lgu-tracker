/** Mirrors the public.report_category enum in supabase/migrations. */
export type ReportCategory =
  | 'incorrect_information'
  | 'not_found_on_site'
  | 'delayed_or_stalled'
  | 'poor_quality'
  | 'safety_hazard'
  | 'possible_irregularity'
  | 'other';

/**
 * The reporting format. Each category says what it is for, so the reporter
 * picks the closest one and the reviewer knows what to check first.
 */
export const REPORT_CATEGORIES: ReadonlyArray<{
  value: ReportCategory;
  label: string;
  hint: string;
}> = [
  { value: 'incorrect_information', label: 'Incorrect or outdated information', hint: 'What this page says does not match what you know.' },
  { value: 'not_found_on_site', label: 'Project not found on site', hint: 'You went to the listed location and could not find it.' },
  { value: 'delayed_or_stalled', label: 'Delayed or stalled', hint: 'Work stopped, or is far behind the reported progress.' },
  { value: 'poor_quality', label: 'Poor quality of work', hint: 'Defects, damage, or work that looks substandard.' },
  { value: 'safety_hazard', label: 'Safety hazard', hint: 'Something that could hurt people. For emergencies, call local emergency services first.' },
  { value: 'possible_irregularity', label: 'Possible irregularity', hint: 'A cost, procurement, or other concern. Describe only what you directly know.' },
  { value: 'other', label: 'Something else', hint: 'Anything that does not fit the options above.' },
];

export const REPORT_LIMITS = {
  detailsMin: 20,
  detailsMax: 5000,
  locationNoteMax: 300,
} as const;

export function isReportCategory(value: unknown): value is ReportCategory {
  return REPORT_CATEGORIES.some((category) => category.value === value);
}

export function reportCategoryLabel(value: ReportCategory): string {
  return REPORT_CATEGORIES.find((category) => category.value === value)?.label ?? value;
}
