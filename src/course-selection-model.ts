export type CourseFamily = 'cpr' | 'first-aid';
export type CourseTargetKind = 'video' | 'slideshow';
export type CourseThumbnailVariant =
  | 'cpr-std'
  | 'cpr-va'
  | 'cpr-pedi'
  | 'cpr-both'
  | 'fa-std'
  | 'fa-va'
  | 'fa-pedi'
  | 'fa-both';

export interface CourseCatalogEntry {
  id: string;
  title?: string;
  isComingSoon?: boolean;
}

export interface CourseSelectionInput {
  family: CourseFamily;
  pediatric: boolean;
  virtualAssistant: boolean;
  courses: readonly CourseCatalogEntry[];
  slideshows: readonly CourseCatalogEntry[];
}

export interface CourseSelection {
  family: CourseFamily;
  kind: CourseTargetKind;
  targetId: string;
  thumbnailVariant: CourseThumbnailVariant;
  available: boolean;
  unavailableReason: string | null;
}

const MISSING_REASON = 'This course edition is currently unavailable.';
const COMING_SOON_REASON = 'To launch the Pediatric course, disable the Virtual Assistant.';

const TARGETS: Record<CourseFamily, Record<'standard' | 'va' | 'pediatric' | 'both', Pick<CourseSelection, 'kind' | 'targetId' | 'thumbnailVariant'>>> = {
  cpr: {
    standard: { kind: 'slideshow', targetId: 'cpr-aed-course', thumbnailVariant: 'cpr-std' },
    va: { kind: 'video', targetId: 'cpr-aed', thumbnailVariant: 'cpr-va' },
    pediatric: { kind: 'slideshow', targetId: 'pediatric-cpr-aed-course', thumbnailVariant: 'cpr-pedi' },
    both: { kind: 'video', targetId: 'pediatric-cpr-aed', thumbnailVariant: 'cpr-both' },
  },
  'first-aid': {
    standard: { kind: 'slideshow', targetId: 'first-aid-course', thumbnailVariant: 'fa-std' },
    va: { kind: 'video', targetId: 'first-aid', thumbnailVariant: 'fa-va' },
    pediatric: { kind: 'slideshow', targetId: 'pediatric-first-aid-course', thumbnailVariant: 'fa-pedi' },
    both: { kind: 'video', targetId: 'pediatric-first-aid', thumbnailVariant: 'fa-both' },
  },
};

export function resolveCourseSelection(input: CourseSelectionInput): CourseSelection {
  const variant = input.pediatric
    ? (input.virtualAssistant ? 'both' : 'pediatric')
    : (input.virtualAssistant ? 'va' : 'standard');
  const target = TARGETS[input.family][variant];
  const catalog = target.kind === 'video' ? input.courses : input.slideshows;
  const item = catalog.find(candidate => candidate.id === target.targetId);
  const available = Boolean(item) && !item?.isComingSoon;

  return {
    family: input.family,
    ...target,
    available,
    unavailableReason: available
      ? null
      : item?.isComingSoon && input.pediatric && input.virtualAssistant
        ? COMING_SOON_REASON
        : MISSING_REASON,
  };
}

export function findSelectionIndex(
  selection: Pick<CourseSelection, 'kind' | 'targetId'>,
  courses: readonly CourseCatalogEntry[],
  slideshows: readonly CourseCatalogEntry[],
): number | null {
  const catalog = selection.kind === 'video' ? courses : slideshows;
  const index = catalog.findIndex(item => item.id === selection.targetId);
  return index >= 0 ? index : null;
}
