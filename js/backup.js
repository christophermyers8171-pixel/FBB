import { getAllWorkouts, saveWorkout } from './db.js';
import { createSupersetId } from './workout.js';

// --- JSON Backup (lossless) ---

export async function exportJsonBackup() {
  const workouts = await getAllWorkouts();
  const data = { version: 1, exportedAt: new Date().toISOString(), workouts };
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `fbb-backup-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  return workouts.length;
}

export async function importJsonBackup(jsonString) {
  const data = JSON.parse(jsonString);
  const workouts = data.workouts || data;
  let count = 0;
  for (const w of workouts) {
    if (w.date && w.exercises) {
      await saveWorkout(w);
      count++;
    }
  }
  return count;
}

// --- Markdown Import ---

export async function importMarkdownFiles(files) {
  let totalImported = 0;

  for (const file of files) {
    const text = await file.text();
    const workouts = parseMarkdown(text);
    for (const w of workouts) {
      await saveWorkout(w);
      totalImported++;
    }
  }

  return totalImported;
}

function parseMarkdown(text) {
  const workouts = [];

  // Split on workout headers: "# Workout — YYYY-MM-DD"
  const workoutBlocks = text.split(/^# Workout\s*[—–-]\s*/m).filter((b) => b.trim());

  // If none found, maybe it's a single workout file starting with "# Workout —"
  // or a bulk export starting with "# Training Log —"
  for (const block of workoutBlocks) {
    const dateMatch = block.match(/^(\d{4}-\d{2}-\d{2})/);
    if (!dateMatch) continue;

    const date = dateMatch[1];
    const exercises = [];
    const lines = block.split('\n');

    let i = 1; // skip date line
    while (i < lines.length) {
      const line = lines[i];

      // Superset header
      const supersetMatch = line.match(/^## Superset:\s*(.+)/);
      if (supersetMatch) {
        i = parseSuperset(lines, i, exercises);
        continue;
      }

      // Regular exercise header
      const exerciseMatch = line.match(/^## (.+)/);
      if (exerciseMatch) {
        i = parseExercise(lines, i, exercises);
        continue;
      }

      i++;
    }

    if (exercises.length > 0) {
      workouts.push({
        date,
        updatedAt: Date.now(),
        exercises
      });
    }
  }

  return workouts;
}

function parseExercise(lines, startIdx, exercises) {
  const nameMatch = lines[startIdx].match(/^## (.+)/);
  const name = nameMatch[1].trim();
  const exercise = makeExercise(name);

  let i = startIdx + 1;

  // Check for tempo
  while (i < lines.length && lines[i].trim() === '') i++;
  if (i < lines.length) {
    const tempoMatch = lines[i].match(/^\*Tempo:\s*(.+?)\*$/);
    if (tempoMatch) {
      exercise.tempo = tempoMatch[1].trim();
      i++;
    }
  }

  // Skip to table rows (past headers and separator)
  while (i < lines.length && !lines[i].startsWith('|')) i++;
  if (i < lines.length && lines[i].startsWith('|')) i++; // header row
  if (i < lines.length && lines[i].match(/^\|[\s-|]+$/)) i++; // separator

  // Parse set rows
  while (i < lines.length && lines[i].startsWith('|')) {
    const cells = lines[i].split('|').map((c) => c.trim()).filter((c) => c);
    if (cells.length >= 3) {
      const set = parseSetCells(cells, 1); // reps at index 1, weight at 2
      set.setNumber = exercise.sets.length + 1;
      // Rest at index 3 if present
      if (cells.length >= 4) {
        set.restSeconds = parseRest(cells[3]);
      }
      // Notes at index 4 if present
      if (cells.length >= 5) {
        set.notes = cells[4] || '';
      }
      exercise.sets.push(set);
    }
    i++;
  }

  exercises.push(exercise);
  return i;
}

function parseSuperset(lines, startIdx, exercises) {
  const ssId = createSupersetId();
  const headerMatch = lines[startIdx].match(/^## Superset:\s*(.+)/);
  const names = headerMatch[1].split('/').map((n) => n.trim());

  const exMap = {};
  for (const name of names) {
    const ex = makeExercise(name, ssId);
    exMap[name] = ex;
    exercises.push(ex);
  }

  let i = startIdx + 1;

  // Check for tempo
  while (i < lines.length && lines[i].trim() === '') i++;
  if (i < lines.length) {
    const tempoMatch = lines[i].match(/^\*Tempo\s*[—–-]\s*(.+?)\*$/);
    if (tempoMatch) {
      const tempoEntries = tempoMatch[1].split('|').map((t) => t.trim());
      for (const entry of tempoEntries) {
        const parts = entry.match(/^(.+?):\s*(.+)$/);
        if (parts && exMap[parts[1].trim()]) {
          exMap[parts[1].trim()].tempo = parts[2].trim();
        }
      }
      i++;
    }
  }

  // Skip to table
  while (i < lines.length && !lines[i].startsWith('|')) i++;
  if (i < lines.length && lines[i].startsWith('|')) i++; // header
  if (i < lines.length && lines[i].match(/^\|[\s-|]+$/)) i++; // separator

  // Parse rows: | Round | Exercise | Reps | Weight | Rest? | Notes? |
  while (i < lines.length && lines[i].startsWith('|')) {
    const cells = lines[i].split('|').map((c) => c.trim()).filter((c) => c);
    if (cells.length >= 4) {
      const exName = cells[1];
      const ex = exMap[exName];
      if (ex) {
        const set = parseSetCells(cells, 2); // reps at 2, weight at 3
        set.setNumber = ex.sets.length + 1;
        if (cells.length >= 5) set.restSeconds = parseRest(cells[4]);
        if (cells.length >= 6) set.notes = cells[5] || '';
        ex.sets.push(set);
      }
    }
    i++;
  }

  return i;
}

function makeExercise(name, supersetId) {
  return {
    id: 'ex_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
    name,
    supersetId: supersetId || null,
    tempo: null,
    sets: []
  };
}

function parseSetCells(cells, repsIdx) {
  const repsRaw = cells[repsIdx] || '';
  const weightRaw = cells[repsIdx + 1] || '';

  const set = {
    reps: null,
    holdSeconds: null,
    weight: null,
    unit: 'lbs',
    restSeconds: null,
    notes: ''
  };

  // Parse reps/hold
  const holdMatch = repsRaw.match(/^(\d+)s\s*hold$/i);
  if (holdMatch) {
    set.holdSeconds = parseInt(holdMatch[1]);
  } else {
    const repsNum = parseInt(repsRaw);
    set.reps = isNaN(repsNum) ? null : repsNum;
  }

  // Parse weight
  if (weightRaw === 'BW' || weightRaw === '' || weightRaw === '—') {
    set.weight = 0;
  } else {
    set.weight = parseInt(weightRaw) || 0;
  }

  // Parse unit from weight column header (handled at table level)
  // Default to lbs

  return set;
}

function parseRest(val) {
  if (!val || val === '' || val === '—') return null;
  const num = parseInt(val);
  return isNaN(num) ? null : num;
}

// --- File picker helper ---

export function pickFiles(accept, multiple) {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.multiple = multiple;
    input.addEventListener('change', () => resolve(input.files));
    input.click();
  });
}
