import { getExerciseGroups } from './workout.js';

export function generateWorkoutMarkdown(workout) {
  if (!workout || !workout.exercises.length) return '';

  let md = `# Workout — ${workout.date}\n`;
  const groups = getExerciseGroups(workout);

  for (const group of groups) {
    if (group.type === 'superset') {
      md += generateSupersetMarkdown(group);
    } else {
      md += generateExerciseMarkdown(group.exercises[0]);
    }
  }

  return md;
}

function generateExerciseMarkdown(ex) {
  let md = `\n## ${ex.name}\n`;

  if (ex.tempo) {
    md += `*Tempo: ${ex.tempo}*\n`;
  }

  if (!ex.sets.length) {
    md += '_No sets logged_\n';
    return md;
  }

  const hasHold = ex.sets.some((s) => s.holdSeconds != null);
  const hasRest = ex.sets.some((s) => s.restSeconds != null);
  const hasNotes = ex.sets.some((s) => s.notes);
  const repsHeader = hasHold ? 'Reps/Hold' : 'Reps';
  const unit = ex.sets[0]?.unit || 'lbs';

  let headers = `| Set | ${repsHeader} | Weight (${unit}) |`;
  let separator = `|-----|${'-'.repeat(repsHeader.length + 2)}|${'-'.repeat(unit.length + 10)}|`;
  if (hasRest) { headers += ' Rest |'; separator += '------|'; }
  if (hasNotes) { headers += ' Notes |'; separator += '-------|'; }

  md += `${headers}\n${separator}\n`;

  for (const set of ex.sets) {
    const repsVal = set.holdSeconds != null
      ? `${set.holdSeconds}s hold`
      : (set.reps != null ? String(set.reps) : '—');
    const weightVal = (set.weight == null || set.weight === 0) ? 'BW' : String(set.weight);

    let row = `| ${set.setNumber} | ${repsVal} | ${weightVal} |`;
    if (hasRest) row += ` ${set.restSeconds != null ? set.restSeconds + 's' : ''} |`;
    if (hasNotes) row += ` ${set.notes || ''} |`;
    md += row + '\n';
  }

  return md;
}

function generateSupersetMarkdown(group) {
  const names = group.exercises.map((ex) => ex.name).join(' / ');
  let md = `\n## Superset: ${names}\n`;

  const tempos = group.exercises.filter((ex) => ex.tempo).map((ex) => `${ex.name}: ${ex.tempo}`);
  if (tempos.length) {
    md += `*Tempo — ${tempos.join(' | ')}*\n`;
  }

  const maxSets = Math.max(...group.exercises.map((ex) => ex.sets.length));
  if (maxSets === 0) {
    md += '_No sets logged_\n';
    return md;
  }

  const hasHold = group.exercises.some((ex) => ex.sets.some((s) => s.holdSeconds != null));
  const hasRest = group.exercises.some((ex) => ex.sets.some((s) => s.restSeconds != null));
  const hasNotes = group.exercises.some((ex) => ex.sets.some((s) => s.notes));
  const repsHeader = hasHold ? 'Reps/Hold' : 'Reps';
  const unit = group.exercises[0]?.sets[0]?.unit || 'lbs';

  let headers = `| Round | Exercise | ${repsHeader} | Weight (${unit}) |`;
  let separator = `|-------|----------|${'-'.repeat(repsHeader.length + 2)}|${'-'.repeat(unit.length + 10)}|`;
  if (hasRest) { headers += ' Rest |'; separator += '------|'; }
  if (hasNotes) { headers += ' Notes |'; separator += '-------|'; }

  md += `${headers}\n${separator}\n`;

  for (let round = 0; round < maxSets; round++) {
    for (const ex of group.exercises) {
      if (ex.sets[round]) {
        const set = ex.sets[round];
        const repsVal = set.holdSeconds != null
          ? `${set.holdSeconds}s hold`
          : (set.reps != null ? String(set.reps) : '—');
        const weightVal = (set.weight == null || set.weight === 0) ? 'BW' : String(set.weight);

        let row = `| ${round + 1} | ${ex.name} | ${repsVal} | ${weightVal} |`;
        if (hasRest) row += ` ${set.restSeconds != null ? set.restSeconds + 's' : ''} |`;
        if (hasNotes) row += ` ${set.notes || ''} |`;
        md += row + '\n';
      }
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
