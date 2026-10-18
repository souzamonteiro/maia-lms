// Author-provided presentation is plain text, never interpreted as markup.
export function coursePresentation(course, { t, e, locale = 'en' }) {
  const levels = {
    beginner: 'levelBeginner',
    intermediate: 'levelIntermediate',
    advanced: 'levelAdvanced',
  };
  const language = { en: 'English', 'pt-BR': 'Português', es: 'Español' }[course.locale];
  const price = course.access_mode === 'PAID' && course.price_amount_minor && course.price_currency
    ? new Intl.NumberFormat(locale, { style: 'currency', currency: course.price_currency })
      .format(course.price_amount_minor / 100)
    : null;
  const trailerUrl = `/api/v1/courses/${e(course.id || course.course_id)}/trailer`;
  const revision = encodeURIComponent(course.revision_id || course.published_revision_id);
  return `<section class="course-presentation">${price ? `<p class="course-price"><strong>${t('coursePriceValue', { value: e(price) })}</strong></p>` : ''}${course.categories?.length ? `<p>${t('categories')}: ${course.categories.map(c => `<a href="/courses?category=${encodeURIComponent(c.slug)}">${e(c.name)}</a>`).join(', ')}</p>` : ''}${language ? `<p>${t('courseLanguage')}: ${e(language)}</p>` : ''}${course.trailer_video_id ? `<h2>${t('courseTrailer')}</h2><div class="course-trailer-player video-player"><video class="course-trailer" aria-label="${t('courseTrailer')}" controls playsinline preload="metadata" src="${trailerUrl}?revisionId=${revision}" data-mp4-url="${trailerUrl}?revisionId=${revision}" data-hls-url="${trailerUrl}/hls/master.m3u8?revisionId=${revision}" poster="${trailerUrl}/poster?revisionId=${revision}"></video><label class="video-quality-control" hidden>${t('videoQuality')}<select class="video-quality" aria-label="${t('videoQuality')}"><option value="-1">${t('videoQualityAuto')}</option></select></label><p class="video-status" role="status" aria-live="polite"></p></div>` : ''}${course.instructor_name || course.instructor_bio ? `<h2>${t('courseInstructor')}</h2>${course.instructor_name ? `<h3>${e(course.instructor_name)}</h3>` : ''}<div class="plain-content">${e(course.instructor_bio || '')}</div>` : ''}${course.instructor_profile_slug ? `<p><a href="/instructors/${e(course.instructor_profile_slug)}">${t('viewInstructorProfile')}</a></p>` : ''}${course.level && levels[course.level] ? `<p>${t('courseLevel')}: ${t(levels[course.level])}</p>` : ''}${course.duration_minutes ? `<p>${t('courseWorkload')}: ${e(course.duration_minutes)}</p>` : ''}${course.learning_outcomes ? `<h2>${t('learningOutcomes')}</h2><div class="plain-content">${e(course.learning_outcomes)}</div>` : ''}${course.prerequisites ? `<h2>${t('prerequisites')}</h2><div class="plain-content">${e(course.prerequisites)}</div>` : ''}${course.access_terms ? `<h2>${t('accessTerms')}</h2><div class="plain-content">${e(course.access_terms)}</div>` : ''}${course.certificate_terms ? `<h2>${t('certificateTerms')}</h2><div class="plain-content">${e(course.certificate_terms)}</div><p>${t('certificateScopeDisclaimer')}</p>` : ''}</section>`;
}
