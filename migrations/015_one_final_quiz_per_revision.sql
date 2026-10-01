CREATE UNIQUE INDEX idx_quizzes_one_final_per_revision
ON quizzes(revision_id)
WHERE lesson_id IS NULL;