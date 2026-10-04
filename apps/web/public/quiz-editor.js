export function mountQuizEditor(host, { api, t, e, courseId, getRevisionId, isDirty }) {
  let lessons = [];
  let quizzes = [];
  let selectedTarget = 'final';
  let loadedRevisionId = null;

  const blankQuestion = () => ({
    prompt: '',
    explanation: '',
    points: 1,
    choices: [
      { key: 'a', text: '', correct: false },
      { key: 'b', text: '', correct: false },
    ],
  });

  function questionMarkup(question, index) {
    return `<fieldset class="quiz-question" data-index="${index}"><legend>${t('quizQuestion')} ${index + 1}</legend><label>${t('quizPrompt')}<textarea data-question-prompt maxlength="5000" required>${e(question.prompt)}</textarea></label><label>${t('quizExplanation')}<textarea data-question-explanation maxlength="5000">${e(question.explanation || '')}</textarea></label><label>${t('quizPoints')}<input data-question-points type="number" min="1" max="1000" step="1" value="${e(question.points)}" required></label><div data-quiz-choices>${question.choices.map((choice, choiceIndex) => `<div class="quiz-choice-row" data-choice-index="${choiceIndex}"><label>${t('quizChoiceKey')}<input data-choice-key maxlength="20" value="${e(choice.key)}" required></label><label>${t('quizChoiceText')}<input data-choice-text maxlength="500" value="${e(choice.text)}" required></label><label class="quiz-correct-choice"><input data-choice-correct type="checkbox" ${choice.correct ? 'checked' : ''}>${t('quizCorrectChoice')}</label><button type="button" class="secondary" data-remove-choice>${t('quizRemoveChoice')}</button></div>`).join('')}</div><div class="actions"><button type="button" class="secondary" data-add-choice>${t('quizAddChoice')}</button><button type="button" class="secondary" data-remove-question>${t('quizRemoveQuestion')}</button></div></fieldset>`;
  }

  function currentQuiz() {
    return quizzes.find(quiz => (quiz.lesson_id || 'final') === selectedTarget) || null;
  }

  function updateQuizFields() {
    const quiz = currentQuiz();
    const passPercent = host.querySelector('#quiz-pass-percent');
    if (!passPercent) return;
    passPercent.value = quiz?.pass_percent ?? 70;
    host.querySelector('#quiz-max-attempts').value = quiz?.max_attempts ?? 3;
    host.querySelector('#quiz-randomize').checked = Boolean(quiz?.randomize_questions);
    host.querySelector('#quiz-time-limit').value = quiz?.time_limit_seconds ?? '';
    host.querySelector('#quiz-questions').innerHTML = (quiz?.questions?.map(question => ({
      prompt: question.prompt,
      explanation: question.explanation || '',
      points: question.points,
      choices: question.choices.map(choice => ({
        ...choice,
        correct: question.correct_choice_keys.includes(choice.key),
      })),
    })) || [blankQuestion()]).map(questionMarkup).join('');
  }

  function collectQuestions() {
    return [...host.querySelectorAll('.quiz-question')].map(question => {
      const choices = [...question.querySelectorAll('.quiz-choice-row')];
      return {
        prompt: question.querySelector('[data-question-prompt]').value.trim(),
        points: Number(question.querySelector('[data-question-points]').value),
        choices: choices.map(choice => ({
          key: choice.querySelector('[data-choice-key]').value.trim(),
          text: choice.querySelector('[data-choice-text]').value.trim(),
          correct: choice.querySelector('[data-choice-correct]').checked,
        })),
      };
    });
  }

  function showPreview() {
    const questions = collectQuestions();
    if (questions.some(question => !question.prompt || !question.choices.some(choice => choice.correct))) {
      host.querySelector('#quiz-editor-status').textContent = t('quizNeedCorrectChoice');
      return;
    }
    const dialog = document.createElement('dialog');
    dialog.className = 'course-preview quiz-preview';
    const heading = document.createElement('h2');
    heading.textContent = t('quizPreviewTitle');
    heading.id = 'quiz-preview-heading';
    dialog.setAttribute('aria-labelledby', heading.id);
    dialog.append(heading);
    const note = document.createElement('p');
    note.textContent = t('quizPreviewAuthorNote');
    dialog.append(note);
    const list = document.createElement('ol');
    for (const question of questions) {
      const item = document.createElement('li');
      const prompt = document.createElement('p');
      prompt.textContent = question.prompt || t('quizPreviewBlankPrompt');
      item.append(prompt);
      if (question.explanation) {
        const explanation = document.createElement('p');
        explanation.textContent = `${t('quizExplanation')}: ${question.explanation}`;
        item.append(explanation);
      }
      const choices = document.createElement('ul');
      for (const choice of question.choices) {
        const option = document.createElement('li');
        option.textContent = `${choice.text || choice.key || t('quizPreviewBlankChoice')}${choice.correct ? ` · ${t('quizCorrectChoice')}` : ''}`;
        choices.append(option);
      }
      item.append(choices);
      list.append(item);
    }
    dialog.append(list);
    const close = document.createElement('button');
    close.type = 'button';
    close.textContent = t('closePreview');
    dialog.append(close);
    const previousFocus = document.activeElement;
    close.addEventListener('click', () => dialog.close());
    dialog.addEventListener('close', () => {
      dialog.remove();
      previousFocus?.focus();
    });
    document.body.append(dialog);
    dialog.showModal();
    close.focus();
  }

  function render() {
    const quiz = currentQuiz();
    const dirty = isDirty();
    host.hidden = !courseId;
    host.innerHTML = `<section class="quiz-authoring"><h2>${t('quizBuilderTitle')}</h2><p>${t('quizBuilderRevision', { revision: loadedRevisionId || getRevisionId() })}</p><label>${t('quizTarget')}<select id="quiz-target"><option value="final">${t('quizFinalAssessment')}</option>${lessons.map(lesson => `<option value="${e(lesson.id)}">${e(lesson.module_title)} · ${e(lesson.title)}</option>`).join('')}</select></label><label>${t('quizPassPercent')}<input id="quiz-pass-percent" type="number" min="1" max="100" value="${e(quiz?.pass_percent ?? 70)}" required></label><label>${t('quizMaxAttempts')}<input id="quiz-max-attempts" type="number" min="1" max="100" value="${e(quiz?.max_attempts ?? 3)}" required></label><label class="quiz-correct-choice"><input id="quiz-randomize" type="checkbox" ${quiz?.randomize_questions ? 'checked' : ''}>${t('quizRandomizeQuestions')}</label><label>${t('quizTimeLimit')}<input id="quiz-time-limit" type="number" min="1" max="86400" value="${e(quiz?.time_limit_seconds ?? '')}"></label><div id="quiz-questions">${(quiz?.questions?.map(question => ({ ...question, correct_choice_keys: question.correct_choice_keys || [] })).map(question => ({ prompt: question.prompt, explanation: question.explanation || '', points: question.points, choices: question.choices.map(choice => ({ ...choice, correct: question.correct_choice_keys.includes(choice.key) })) })) || [blankQuestion()]).map(questionMarkup).join('')}</div><div class="actions"><button type="button" class="secondary" id="quiz-add-question">${t('quizAddQuestion')}</button><button type="button" class="secondary" id="quiz-preview">${t('quizPreview')}</button><button type="button" id="quiz-save" ${dirty ? 'disabled' : ''}>${t('quizSaveDefinition')}</button></div><p id="quiz-editor-status" role="status" aria-live="polite">${dirty ? t('quizSaveCourseFirst') : ''}</p></section>`;
    host.querySelector('#quiz-target').addEventListener('change', event => {
      selectedTarget = event.target.value;
      updateQuizFields();
    });
    host.querySelector('#quiz-add-question').addEventListener('click', () => {
      host.querySelector('#quiz-questions').insertAdjacentHTML('beforeend', questionMarkup(blankQuestion(), host.querySelectorAll('.quiz-question').length));
    });
    host.querySelector('#quiz-preview').addEventListener('click', showPreview);
    host.querySelector('#quiz-questions').addEventListener('click', event => {
      const button = event.target.closest('button');
      if (!button) return;
      const question = button.closest('.quiz-question');
      if (button.hasAttribute('data-remove-question')) {
        if (host.querySelectorAll('.quiz-question').length > 1) question.remove();
      } else if (button.hasAttribute('data-add-choice')) {
        const choices = question.querySelectorAll('.quiz-choice-row');
        if (choices.length >= 10) return;
        const key = String.fromCharCode(97 + choices.length);
        question.querySelector('[data-quiz-choices]').insertAdjacentHTML(
          'beforeend',
          `<div class="quiz-choice-row" data-choice-index="${choices.length}"><label>${t('quizChoiceKey')}<input data-choice-key maxlength="20" value="${e(key)}" required></label><label>${t('quizChoiceText')}<input data-choice-text maxlength="500" required></label><label class="quiz-correct-choice"><input data-choice-correct type="checkbox">${t('quizCorrectChoice')}</label><button type="button" class="secondary" data-remove-choice>${t('quizRemoveChoice')}</button></div>`,
        );
      } else if (button.hasAttribute('data-remove-choice')) {
        if (question.querySelectorAll('.quiz-choice-row').length > 2) button.closest('.quiz-choice-row').remove();
      }
    });
    host.querySelector('#quiz-save').addEventListener('click', async event => {
      const button = event.currentTarget;
      if (isDirty()) {
        host.querySelector('#quiz-editor-status').textContent = t('quizSaveCourseFirst');
        return;
      }
      const questions = [...host.querySelectorAll('.quiz-question')].map(question => {
        const choices = [...question.querySelectorAll('.quiz-choice-row')];
        return {
          prompt: question.querySelector('[data-question-prompt]').value,
          explanation: question.querySelector('[data-question-explanation]').value,
          points: Number(question.querySelector('[data-question-points]').value),
          choices: choices.map(choice => ({
            key: choice.querySelector('[data-choice-key]').value,
            text: choice.querySelector('[data-choice-text]').value,
          })),
          correctChoiceKeys: choices
            .filter(choice => choice.querySelector('[data-choice-correct]').checked)
            .map(choice => choice.querySelector('[data-choice-key]').value),
        };
      });
      if (questions.some(question => question.correctChoiceKeys.length === 0)) {
        host.querySelector('#quiz-editor-status').textContent = t('quizNeedCorrectChoice');
        return;
      }
      button.disabled = true;
      const status = host.querySelector('#quiz-editor-status');
      status.textContent = t('saving');
      try {
        await api(`/admin/courses/${courseId}/quiz`, 'PUT', {
          expectedRevisionId: getRevisionId(),
          lessonId: selectedTarget === 'final' ? null : selectedTarget,
          passPercent: Number(host.querySelector('#quiz-pass-percent').value),
          maxAttempts: Number(host.querySelector('#quiz-max-attempts').value),
          randomizeQuestions: host.querySelector('#quiz-randomize').checked,
          timeLimitSeconds: host.querySelector('#quiz-time-limit').value
            ? Number(host.querySelector('#quiz-time-limit').value)
            : null,
          questions,
        });
        await refresh();
        host.querySelector('#quiz-editor-status').textContent = t('quizDefinitionSaved');
      } catch (error) {
        status.textContent = error.message || t('genericError');
      } finally {
        button.disabled = false;
      }
    });
  }

  async function refresh() {
    if (!courseId) {
      host.hidden = true;
      return;
    }
    if (isDirty()) {
      host.hidden = false;
      host.innerHTML = `<section class="quiz-authoring"><h2>${t('quizBuilderTitle')}</h2><p role="status">${t('quizSaveCourseFirst')}</p></section>`;
      return;
    }
    try {
      const course = await api(`/admin/courses/${courseId}`);
      loadedRevisionId = course.current_revision_id;
      lessons = course.modules.flatMap(module => module.lessons.map(lesson => ({
        id: lesson.id,
        title: lesson.title,
        module_title: module.title,
      })));
      quizzes = await api(`/admin/courses/${courseId}/quizzes?revisionId=${encodeURIComponent(loadedRevisionId)}`);
      if (selectedTarget !== 'final' && !lessons.some(lesson => lesson.id === selectedTarget))
        selectedTarget = 'final';
      render();
    } catch (error) {
      host.hidden = false;
      host.innerHTML = `<section class="quiz-authoring"><h2>${t('quizBuilderTitle')}</h2><p role="alert">${e(error.message || t('genericError'))}</p></section>`;
    }
  }

  refresh();
  return refresh;
}
