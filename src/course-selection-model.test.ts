import { describe, expect, it } from 'vitest';
import { findSelectionIndex, resolveCourseSelection, type CourseFamily } from './course-selection-model';

const courses = [
  { id: 'first-aid' },
  { id: 'pediatric-first-aid', isComingSoon: true },
  { id: 'cpr-aed' },
  { id: 'pediatric-cpr-aed', isComingSoon: true },
];
const slideshows = [
  { id: 'pediatric-first-aid-course' },
  { id: 'cpr-aed-course' },
  { id: 'first-aid-course' },
  { id: 'pediatric-cpr-aed-course' },
];

describe('resolveCourseSelection', () => {
  const mappings: Array<[CourseFamily, boolean, boolean, 'video' | 'slideshow', string, string]> = [
    ['cpr', false, false, 'slideshow', 'cpr-aed-course', 'cpr-std'],
    ['cpr', false, true, 'video', 'cpr-aed', 'cpr-va'],
    ['cpr', true, false, 'slideshow', 'pediatric-cpr-aed-course', 'cpr-pedi'],
    ['cpr', true, true, 'video', 'pediatric-cpr-aed', 'cpr-both'],
    ['first-aid', false, false, 'slideshow', 'first-aid-course', 'fa-std'],
    ['first-aid', false, true, 'video', 'first-aid', 'fa-va'],
    ['first-aid', true, false, 'slideshow', 'pediatric-first-aid-course', 'fa-pedi'],
    ['first-aid', true, true, 'video', 'pediatric-first-aid', 'fa-both'],
  ];

  it.each(mappings)('maps %s pediatric=%s va=%s by stable ID', (family, pediatric, virtualAssistant, kind, targetId, thumbnailVariant) => {
    const result = resolveCourseSelection({ family, pediatric, virtualAssistant, courses, slideshows });
    expect(result).toMatchObject({ family, kind, targetId, thumbnailVariant });
  });

  it('is independent of catalog order and returns a safe index only after resolution', () => {
    const selection = resolveCourseSelection({ family: 'cpr', pediatric: false, virtualAssistant: true, courses, slideshows });
    expect(findSelectionIndex(selection, courses, slideshows)).toBe(2);
    expect(findSelectionIndex(selection, [...courses].reverse(), slideshows)).toBe(1);
  });

  it('never falls back when a target ID is missing', () => {
    const selection = resolveCourseSelection({ family: 'first-aid', pediatric: false, virtualAssistant: true, courses: [], slideshows });
    expect(selection.available).toBe(false);
    expect(selection.unavailableReason).toBe('This course edition is currently unavailable.');
    expect(findSelectionIndex(selection, [], slideshows)).toBeNull();
  });

  it('derives Coming Soon availability from catalog data', () => {
    const selection = resolveCourseSelection({ family: 'cpr', pediatric: true, virtualAssistant: true, courses, slideshows });
    expect(selection.available).toBe(false);
    expect(selection.unavailableReason).toBe('To launch the Pediatric course, disable the Virtual Assistant.');
  });

  it('does not mutate dependency-injected catalogs', () => {
    const frozenCourses = Object.freeze(courses.map(item => Object.freeze({ ...item })));
    const frozenSlideshows = Object.freeze(slideshows.map(item => Object.freeze({ ...item })));
    expect(() => resolveCourseSelection({ family: 'first-aid', pediatric: true, virtualAssistant: false, courses: frozenCourses, slideshows: frozenSlideshows })).not.toThrow();
  });

  it('returns identical decisions for desktop and mobile consumers', () => {
    const input = { family: 'cpr' as const, pediatric: true, virtualAssistant: false, courses, slideshows };
    expect(resolveCourseSelection(input)).toEqual(resolveCourseSelection(input));
  });
});
