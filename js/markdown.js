export function generateWorkoutMarkdown(workout) {
  if (!workout || !workout.exercises.length) return '';

  let md = `# Workout — ${workout.date}\n`;

  for (const ex of workout.exercises) {
    md += `\n## ${ex.name}\n`;

    if (!ex.sets.length) {
      md += '_No sets logged_\n';
      continue;
    }

    const hasHold = ex.sets.some((s) => s.holdSeconds != null);
    const repsHeader = hasHold ? 'Reps/Hold' : 'Reps';
    const unit = ex.sets[0]?.unit || 'lbs';

    md += `| Set | ${repsHeader} | Weight (${unit}) | Notes |\n`;
    md += `|-----|${'-'.repeat(repsHeader.length + 2)}|${'-'.repeat(unit.length + 10)}|-------|\n`;

    for (const set of ex.sets) {
      const repsVal = set.holdSeconds != null
        ? `${set.holdSeconds}s hold`
        : (set.reps != null ? String(set.reps) : '—');
      const weightVal = (set.weight == null || set.weight === 0) ? 'BW' : String(set.weight);
      const notes = set.notes || '';
      md += `| ${set.setNumber} | ${repsVal} | ${weightVal} | ${notes} |\n`;
    }
  }

  return md;
}

export function generateBulkMarkdown(workouts, startDate, endDate) {
  let md = `# Training Log — ${startDate} to ${endDate}\n`;

  for (let i = 0; i < workouts.length; i++) {
    md += '\n---\n\n';
    md += generateWorkoutMarkdown(workouts[i]);
  }

  return md;
}

export async function exportMarkdownFile(markdownString, filename) {
  const file = new File([markdownString], filename, { type: 'text/markdown' });

  if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: filename });
      return 'shared';
    } catch (err) {
      if (err.name === 'AbortError') return 'cancelled';
    }
  }

  const blob = new Blob([markdownString], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  return 'downloaded';
}

export async function copyMarkdownToClipboard(markdownString) {
  await navigator.clipboard.writeText(markdownString);
}
