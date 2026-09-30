// Author-provided presentation is plain text, never interpreted as markup.
export function coursePresentation(course, { t, e }) {
  const levels = {
    beginner: 'levelBeginner',
    intermediate: 'levelIntermediate',
    advanced: 'levelAdvanced',
  };
  return `<section class="course-presentation">${course.instructor_name || course.instructor_bio ? `<h2>${t('courseInstructor')}</h2>${course.instructor_name ? `<h3>${e(course.instructor_name)}</h3>` : ''}<div class="plain-content">${e(course.instructor_bio || '')}</div>` : ''}${course.level && levels[course.level] ? `<p>${t('courseLevel')}: ${t(levels[course.level])}</p>` : ''}${course.duration_minutes ? `<p>${t('courseWorkload')}: ${e(course.duration_minutes)}</p>` : ''}${course.learning_outcomes ? `<h2>${t('learningOutcomes')}</h2><div class="plain-content">${e(course.learning_outcomes)}</div>` : ''}${course.prerequisites ? `<h2>${t('prerequisites')}</h2><div class="plain-content">${e(course.prerequisites)}</div>` : ''}${course.access_terms ? `<h2>${t('accessTerms')}</h2><div class="plain-content">${e(course.access_terms)}</div>` : ''}${course.certificate_terms ? `<h2>${t('certificateTerms')}</h2><div class="plain-content">${e(course.certificate_terms)}</div><p>${t('certificateUnavailable')}</p>` : ''}</section>`;
}
