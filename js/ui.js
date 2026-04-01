import { getWorkout, saveWorkout, getWorkoutDates, getWorkoutsInRange, getAllWorkouts } from './db.js';
import { createWorkout, addExercise, removeExercise, renameExercise, moveGroup, addSet, removeSet, updateSet, createSupersetId, removeFromSuperset, getExerciseGroups, updateExerciseField } from './workout.js';
import { generateWorkoutMarkdown, generateBulkMarkdown, exportMarkdownFile, copyMarkdownToClipboard } from './markdown.js';
import { exportJsonBackup, importJsonBackup, importMarkdownFiles, pickFiles } from './backup.js';

let currentWorkout = null;
let currentDate = todayString();
let saveTimer = null;

function todayString() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatDateDisplay(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
}

function showToast(message) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2000);
}

function scheduleSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    if (currentWorkout) {
      await saveWorkout(currentWorkout);
      showToast('Saved');
    }
  }, 300);
}

async function forceSave() {
  clearTimeout(saveTimer);
  if (currentWorkout) {
    await saveWorkout(currentWorkout);
  }
}

// --- Today View ---

export async function loadWorkoutView(date) {
  currentDate = date || todayString();
  currentWorkout = await getWorkout(currentDate);
  if (!currentWorkout) {
    currentWorkout = createWorkout(currentDate);
  }
  renderWorkoutView();
}

function renderWorkoutView() {
  document.getElementById('date-display').textContent = formatDateDisplay(currentDate);

  const container = document.getElementById('exercises-container');
  container.innerHTML = '';

  if (currentWorkout.exercises.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <p>No exercises yet. Tap below to start logging.</p>
      </div>
    `;
  } else {
    const groups = getExerciseGroups(currentWorkout);
    for (const group of groups) {
      if (group.type === 'superset') {
        container.appendChild(createSupersetCard(group));
      } else {
        container.appendChild(createExerciseCard(group.exercises[0]));
      }
    }
  }
}

function createSupersetCard(group) {
  const wrapper = document.createElement('div');
  wrapper.className = 'superset-group';
  wrapper.dataset.supersetId = group.supersetId;

  const maxSets = Math.max(...group.exercises.map((ex) => ex.sets.length), 0);

  let html = `<div class="superset-label">SUPERSET</div>`;

  // Exercise headers row
  html += `<div class="superset-headers">`;
  for (const ex of group.exercises) {
    html += `
      <div class="superset-exercise-header">
        <span class="exercise-name">${escapeHtml(ex.name)}</span>
        <button class="exercise-menu-btn" data-exercise-id="${ex.id}">&#8942;</button>
      </div>`;
  }
  html += `</div>`;

  // Rounds
  for (let round = 0; round < maxSets; round++) {
    html += `<div class="superset-round">`;
    html += `<div class="round-marker">Round ${round + 1}</div>`;

    for (const ex of group.exercises) {
      if (ex.sets[round]) {
        const set = ex.sets[round];
        const isHold = set.holdSeconds != null;
        const repsValue = isHold ? (set.holdSeconds || '') : (set.reps != null ? set.reps : '');
        const repsPlaceholder = isHold ? 'sec' : 'reps';

        html += `
          <div class="superset-set-row">
            <div class="ss-exercise-label">${escapeHtml(ex.name)}</div>
            <div class="ss-inputs">
              <div class="hold-toggle">
                <input class="set-input reps" type="text" inputmode="numeric" pattern="[0-9]*"
                  value="${repsValue}" placeholder="${repsPlaceholder}"
                  data-field="${isHold ? 'holdSeconds' : 'reps'}"
                  data-exercise-id="${ex.id}" data-set-index="${round}">
                <label><input type="checkbox" ${isHold ? 'checked' : ''}
                  data-hold-toggle data-exercise-id="${ex.id}" data-set-index="${round}"> hold</label>
              </div>
              <input class="set-input weight" type="text" inputmode="numeric" pattern="[0-9]*"
                value="${set.weight != null ? set.weight : ''}" placeholder="lbs"
                data-field="weight"
                data-exercise-id="${ex.id}" data-set-index="${round}">
              <input class="set-input rest" type="text" inputmode="numeric" pattern="[0-9]*"
                value="${set.restSeconds != null ? set.restSeconds : ''}" placeholder="sec"
                data-field="restSeconds"
                data-exercise-id="${ex.id}" data-set-index="${round}">
              <input class="set-input notes" type="text"
                value="${escapeHtml(set.notes || '')}" placeholder="notes"
                data-field="notes"
                data-exercise-id="${ex.id}" data-set-index="${round}">
              <button class="delete-set-btn" data-exercise-id="${ex.id}" data-set-index="${round}">&times;</button>
            </div>
          </div>`;
      }
    }
    html += `</div>`;
  }

  // Footer: add round + tempo per exercise
  html += `<div class="superset-footer">`;
  html += `<button class="add-round-btn" data-superset-id="${group.supersetId}">+ Add Round</button>`;
  html += `<div class="superset-tempo-row">`;
  for (const ex of group.exercises) {
    const tempoVal = ex.tempo != null ? ex.tempo : '';
    html += `
      <div class="meta-input-group">
        <label class="meta-label" for="tempo-${ex.id}">${escapeHtml(ex.name)}:</label>
        <input class="set-input meta" id="tempo-${ex.id}" type="text" inputmode="numeric" pattern="[0-9]*"
          value="${escapeHtml(tempoVal)}" placeholder="3010"
          data-tempo-input data-exercise-id="${ex.id}">
      </div>`;
  }
  html += `</div></div>`;

  // Add exercise to superset
  html += `<button class="add-superset-exercise-btn" data-superset-id="${group.supersetId}">+ Add Exercise to Superset</button>`;

  wrapper.innerHTML = html;
  return wrapper;
}

function createExerciseCard(exercise, inSuperset) {
  const card = document.createElement('div');
  card.className = 'exercise-card' + (inSuperset ? ' in-superset' : '');
  card.dataset.exerciseId = exercise.id;

  const hasHold = exercise.sets.some((s) => s.holdSeconds != null);

  let setsHtml = '';
  for (let i = 0; i < exercise.sets.length; i++) {
    const set = exercise.sets[i];
    const isHold = set.holdSeconds != null;
    setsHtml += createSetRow(exercise.id, i, set, isHold);
  }

  const tempoVal = exercise.tempo != null ? exercise.tempo : '';

  card.innerHTML = `
    <div class="exercise-header">
      <span class="exercise-name">${escapeHtml(exercise.name)}</span>
      <button class="exercise-menu-btn" data-exercise-id="${exercise.id}">&#8942;</button>
    </div>
    <table class="set-table">
      <thead>
        <tr>
          <th>Set</th>
          <th>${hasHold ? 'Reps/Hold' : 'Reps'}</th>
          <th>Weight</th>
          <th>Rest</th>
          <th>Notes</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        ${setsHtml}
      </tbody>
    </table>
    <div class="exercise-footer">
      <button class="add-set-btn" data-exercise-id="${exercise.id}">+ Add Set</button>
      <div class="exercise-meta-row">
        <div class="meta-input-group">
          <label class="meta-label" for="tempo-${exercise.id}">Tempo:</label>
          <input class="set-input meta" id="tempo-${exercise.id}" type="text" inputmode="numeric" pattern="[0-9]*"
            value="${escapeHtml(tempoVal)}" placeholder="3010"
            data-tempo-input data-exercise-id="${exercise.id}">
        </div>
      </div>
    </div>
  `;

  return card;
}

function createSetRow(exerciseId, setIndex, set, isHold) {
  const repsValue = isHold ? (set.holdSeconds || '') : (set.reps != null ? set.reps : '');
  const repsPlaceholder = isHold ? 'sec' : 'reps';

  return `
    <tr data-exercise-id="${exerciseId}" data-set-index="${setIndex}">
      <td class="set-number">${set.setNumber}</td>
      <td>
        <div class="hold-toggle">
          <input class="set-input reps" type="text" inputmode="numeric" pattern="[0-9]*"
            value="${repsValue}" placeholder="${repsPlaceholder}"
            data-field="${isHold ? 'holdSeconds' : 'reps'}"
            data-exercise-id="${exerciseId}" data-set-index="${setIndex}">
          <label><input type="checkbox" ${isHold ? 'checked' : ''}
            data-hold-toggle data-exercise-id="${exerciseId}" data-set-index="${setIndex}"> hold</label>
        </div>
      </td>
      <td>
        <input class="set-input weight" type="text" inputmode="numeric" pattern="[0-9]*"
          value="${set.weight != null ? set.weight : ''}" placeholder="lbs"
          data-field="weight"
          data-exercise-id="${exerciseId}" data-set-index="${setIndex}">
      </td>
      <td>
        <input class="set-input rest" type="text" inputmode="numeric" pattern="[0-9]*"
          value="${set.restSeconds != null ? set.restSeconds : ''}" placeholder="sec"
          data-field="restSeconds"
          data-exercise-id="${exerciseId}" data-set-index="${setIndex}">
      </td>
      <td>
        <input class="set-input notes" type="text"
          value="${escapeHtml(set.notes || '')}" placeholder="notes"
          data-field="notes"
          data-exercise-id="${exerciseId}" data-set-index="${setIndex}">
      </td>
      <td>
        <button class="delete-set-btn" data-exercise-id="${exerciseId}" data-set-index="${setIndex}">&times;</button>
      </td>
    </tr>
  `;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// --- History View ---

let calendarYear, calendarMonth;

export async function loadHistoryView() {
  const now = new Date();
  calendarYear = now.getFullYear();
  calendarMonth = now.getMonth();
  await renderCalendar();
  await renderRecentWorkouts();
}

async function renderCalendar() {
  const dates = await getWorkoutDates();
  const dateSet = new Set(dates);

  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];

  document.getElementById('calendar-month').textContent = `${monthNames[calendarMonth]} ${calendarYear}`;

  const grid = document.getElementById('calendar-grid');
  grid.innerHTML = '';

  const dayLabels = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
  for (const label of dayLabels) {
    const el = document.createElement('div');
    el.className = 'calendar-day-label';
    el.textContent = label;
    grid.appendChild(el);
  }

  const firstDay = new Date(calendarYear, calendarMonth, 1);
  let startDay = firstDay.getDay() - 1;
  if (startDay < 0) startDay = 6;

  const daysInMonth = new Date(calendarYear, calendarMonth + 1, 0).getDate();
  const today = todayString();

  for (let i = 0; i < startDay; i++) {
    const el = document.createElement('div');
    el.className = 'calendar-day empty';
    grid.appendChild(el);
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${calendarYear}-${String(calendarMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const el = document.createElement('div');
    el.className = 'calendar-day';
    el.textContent = d;
    el.dataset.date = dateStr;

    if (dateStr === today) el.classList.add('today');
    if (dateSet.has(dateStr)) el.classList.add('has-workout');

    grid.appendChild(el);
  }
}

async function renderRecentWorkouts() {
  const workouts = await getAllWorkouts();
  const list = document.getElementById('history-list');
  list.innerHTML = '';

  const recent = workouts.slice(0, 20);
  if (recent.length === 0) {
    list.innerHTML = '<div class="empty-state"><p>No workouts logged yet.</p></div>';
    return;
  }

  for (const w of recent) {
    const exerciseNames = w.exercises.map((e) => e.name).join(', ');
    const item = document.createElement('div');
    item.className = 'history-item';
    item.dataset.date = w.date;
    item.innerHTML = `
      <div class="date">${formatDateDisplay(w.date)}</div>
      <div class="summary">${escapeHtml(exerciseNames)} (${w.exercises.length} exercise${w.exercises.length !== 1 ? 's' : ''})</div>
    `;
    list.appendChild(item);
  }
}

// --- View Past Workout (Read-Only) ---

export async function loadReadonlyView(date) {
  const workout = await getWorkout(date);
  const container = document.getElementById('readonly-content');
  document.getElementById('readonly-date').textContent = formatDateDisplay(date);
  document.getElementById('readonly-view').dataset.date = date;

  if (!workout || workout.exercises.length === 0) {
    container.innerHTML = '<div class="empty-state"><p>No workout logged for this day.</p></div>';
    return;
  }

  const groups = getExerciseGroups(workout);
  let html = '';

  for (const group of groups) {
    if (group.type === 'superset') {
      const names = group.exercises.map((e) => e.name).join(' / ');
      html += `<div class="exercise-block superset-block"><h3>Superset: ${escapeHtml(names)}</h3>`;
      const tempos = group.exercises.filter((e) => e.tempo).map((e) => `${e.name}: ${e.tempo}`);
      if (tempos.length) {
        html += `<div class="tempo-line">Tempo — ${escapeHtml(tempos.join(' | '))}</div>`;
      }
      const maxSets = Math.max(...group.exercises.map((e) => e.sets.length));
      for (let round = 0; round < maxSets; round++) {
        html += `<div class="round-label-readonly">Round ${round + 1}</div>`;
        for (const ex of group.exercises) {
          if (ex.sets[round]) {
            const set = ex.sets[round];
            const repsDisplay = set.holdSeconds != null
              ? `${set.holdSeconds}s hold`
              : `${set.reps || '—'}`;
            const weightDisplay = (set.weight == null || set.weight === 0) ? 'BW' : `${set.weight} ${set.unit || 'lbs'}`;
            let details = `${repsDisplay} × ${weightDisplay}`;
            if (set.restSeconds != null) details += ` (rest ${set.restSeconds}s)`;
            if (set.notes) details += ` — ${set.notes}`;
            html += `<div class="set-line">${escapeHtml(ex.name)}: ${details}</div>`;
          }
        }
      }
      html += '</div>';
    } else {
      const ex = group.exercises[0];
      html += `<div class="exercise-block"><h3>${escapeHtml(ex.name)}</h3>`;
      if (ex.tempo) {
        html += `<div class="tempo-line">Tempo: ${escapeHtml(ex.tempo)}</div>`;
      }
      for (const set of ex.sets) {
        const repsDisplay = set.holdSeconds != null
          ? `${set.holdSeconds}s hold`
          : `${set.reps || '—'}`;
        const weightDisplay = (set.weight == null || set.weight === 0) ? 'BW' : `${set.weight} ${set.unit || 'lbs'}`;
        let details = `${repsDisplay} × ${weightDisplay}`;
        if (set.restSeconds != null) details += ` (rest ${set.restSeconds}s)`;
        if (set.notes) details += ` — ${set.notes}`;
        html += `<div class="set-line">Set ${set.setNumber}: ${details}</div>`;
      }
      html += '</div>';
    }
  }
  container.innerHTML = html;
}

// --- Event Handling ---

export function initEvents() {
  // Add Exercise button
  document.getElementById('add-exercise-btn').addEventListener('click', () => {
    openModal('add-exercise');
  });

  // Add Superset button
  document.getElementById('add-superset-btn').addEventListener('click', () => {
    openModal('add-superset');
  });

  // Modal confirm
  document.getElementById('modal-confirm').addEventListener('click', handleModalConfirm);
  document.getElementById('modal-cancel').addEventListener('click', closeModal);
  document.getElementById('modal-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleModalConfirm();
  });

  // Modal overlay click to close
  document.getElementById('modal-overlay').addEventListener('click', (e) => {
    if (e.target === document.getElementById('modal-overlay')) closeModal();
  });

  // Delegated events on exercises container
  document.getElementById('exercises-container').addEventListener('click', handleExerciseClick);
  document.getElementById('exercises-container').addEventListener('input', handleSetInput);
  document.getElementById('exercises-container').addEventListener('input', handleTempoInput);
  document.getElementById('exercises-container').addEventListener('change', handleHoldToggle);

  // Date navigation
  document.getElementById('date-prev').addEventListener('click', () => changeDate(-1));
  document.getElementById('date-next').addEventListener('click', () => changeDate(1));
  document.getElementById('date-display').addEventListener('click', () => {
    currentDate = todayString();
    loadWorkoutView(currentDate);
  });

  // Navigation
  document.getElementById('nav-history').addEventListener('click', () => switchView('history'));
  document.getElementById('nav-today').addEventListener('click', () => {
    currentDate = todayString();
    switchView('today');
  });

  // History view events
  document.getElementById('calendar-prev').addEventListener('click', () => {
    calendarMonth--;
    if (calendarMonth < 0) { calendarMonth = 11; calendarYear--; }
    renderCalendar();
  });
  document.getElementById('calendar-next').addEventListener('click', () => {
    calendarMonth++;
    if (calendarMonth > 11) { calendarMonth = 0; calendarYear++; }
    renderCalendar();
  });

  document.getElementById('calendar-grid').addEventListener('click', (e) => {
    const dayEl = e.target.closest('.calendar-day:not(.empty)');
    if (!dayEl || !dayEl.dataset.date) return;
    if (dayEl.classList.contains('has-workout')) {
      loadReadonlyView(dayEl.dataset.date);
      switchView('readonly');
    } else {
      currentDate = dayEl.dataset.date;
      switchView('today');
    }
  });

  document.getElementById('history-list').addEventListener('click', (e) => {
    const item = e.target.closest('.history-item');
    if (!item) return;
    loadReadonlyView(item.dataset.date);
    switchView('readonly');
  });

  // Readonly view events
  document.getElementById('readonly-back').addEventListener('click', () => switchView('history'));
  document.getElementById('readonly-edit').addEventListener('click', () => {
    const date = document.getElementById('readonly-view').dataset.date;
    currentDate = date;
    switchView('today');
  });

  // Export buttons
  document.getElementById('export-btn').addEventListener('click', handleExportCurrent);
  document.getElementById('share-btn').addEventListener('click', handleShareCurrent);
  document.getElementById('readonly-export').addEventListener('click', () => {
    const date = document.getElementById('readonly-view').dataset.date;
    handleExportDay(date);
  });

  // Bulk export
  document.getElementById('bulk-export-btn').addEventListener('click', handleBulkExport);

  // Backup & restore
  document.getElementById('backup-export-btn').addEventListener('click', handleBackupExport);
  document.getElementById('backup-import-btn').addEventListener('click', handleBackupImport);
  document.getElementById('import-markdown-btn').addEventListener('click', handleMarkdownImport);

  // Context menu close on outside click
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.context-menu') && !e.target.closest('.exercise-menu-btn')) {
      closeContextMenu();
    }
  });

  // Save before unload
  window.addEventListener('beforeunload', forceSave);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') forceSave();
  });
}

let modalMode = null;
let modalExerciseId = null;
let modalSupersetId = null;

function openModal(mode, exerciseId, supersetId) {
  modalMode = mode;
  modalExerciseId = exerciseId;
  modalSupersetId = supersetId;
  const overlay = document.getElementById('modal-overlay');
  const input = document.getElementById('modal-input');
  const title = document.getElementById('modal-title');

  if (mode === 'add-exercise') {
    title.textContent = 'Add Exercise';
    input.value = '';
    input.placeholder = 'Exercise name';
  } else if (mode === 'rename-exercise') {
    title.textContent = 'Rename Exercise';
    const ex = currentWorkout.exercises.find((e) => e.id === exerciseId);
    input.value = ex ? ex.name : '';
    input.placeholder = 'New name';
  } else if (mode === 'add-superset') {
    title.textContent = 'New Superset — First Exercise';
    input.value = '';
    input.placeholder = 'Exercise name';
  } else if (mode === 'add-superset-exercise') {
    title.textContent = 'Add to Superset';
    input.value = '';
    input.placeholder = 'Exercise name';
  }

  overlay.classList.add('active');
  setTimeout(() => input.focus(), 100);
}

function closeModal() {
  document.getElementById('modal-overlay').classList.remove('active');
  modalMode = null;
  modalExerciseId = null;
  modalSupersetId = null;
}

function handleModalConfirm() {
  const input = document.getElementById('modal-input');
  const value = input.value.trim();
  if (!value) return;

  if (modalMode === 'add-exercise') {
    const ex = addExercise(currentWorkout, value);
    addSet(ex);
    scheduleSave();
    renderWorkoutView();
  } else if (modalMode === 'rename-exercise') {
    renameExercise(currentWorkout, modalExerciseId, value);
    scheduleSave();
    renderWorkoutView();
  } else if (modalMode === 'add-superset') {
    const ssId = createSupersetId();
    const ex = addExercise(currentWorkout, value, ssId);
    addSet(ex);
    scheduleSave();
    renderWorkoutView();
  } else if (modalMode === 'add-superset-exercise') {
    const ex = addExercise(currentWorkout, value, modalSupersetId);
    addSet(ex);
    scheduleSave();
    renderWorkoutView();
  }

  closeModal();
}

function handleExerciseClick(e) {
  // Add set
  const addSetBtn = e.target.closest('.add-set-btn');
  if (addSetBtn) {
    const exId = addSetBtn.dataset.exerciseId;
    const ex = currentWorkout.exercises.find((ex) => ex.id === exId);
    if (ex) {
      addSet(ex);
      scheduleSave();
      renderWorkoutView();
      // Focus the new reps input
      setTimeout(() => {
        const card = document.querySelector(`[data-exercise-id="${exId}"].exercise-card`);
        if (card) {
          const inputs = card.querySelectorAll('.set-input.reps');
          const last = inputs[inputs.length - 1];
          if (last) last.focus();
        }
      }, 50);
    }
    return;
  }

  // Add round to superset
  const addRoundBtn = e.target.closest('.add-round-btn');
  if (addRoundBtn) {
    const ssId = addRoundBtn.dataset.supersetId;
    const exercises = currentWorkout.exercises.filter((ex) => ex.supersetId === ssId);
    for (const ex of exercises) {
      addSet(ex);
    }
    scheduleSave();
    renderWorkoutView();
    return;
  }

  // Delete set
  const deleteBtn = e.target.closest('.delete-set-btn');
  if (deleteBtn) {
    const exId = deleteBtn.dataset.exerciseId;
    const setIdx = parseInt(deleteBtn.dataset.setIndex);
    const ex = currentWorkout.exercises.find((ex) => ex.id === exId);
    if (ex) {
      if (ex.supersetId) {
        // Delete this round from all exercises in the superset
        const ssExercises = currentWorkout.exercises.filter((e) => e.supersetId === ex.supersetId);
        for (const ssEx of ssExercises) {
          if (ssEx.sets[setIdx]) {
            removeSet(ssEx, setIdx);
          }
        }
      } else {
        removeSet(ex, setIdx);
      }
      scheduleSave();
      renderWorkoutView();
    }
    return;
  }

  // Add exercise to superset
  const addSsBtn = e.target.closest('.add-superset-exercise-btn');
  if (addSsBtn) {
    openModal('add-superset-exercise', null, addSsBtn.dataset.supersetId);
    return;
  }

  // Exercise menu
  const menuBtn = e.target.closest('.exercise-menu-btn');
  if (menuBtn) {
    const exId = menuBtn.dataset.exerciseId;
    openContextMenu(exId, menuBtn);
    return;
  }
}

function handleSetInput(e) {
  const input = e.target.closest('.set-input');
  if (!input) return;

  const exId = input.dataset.exerciseId;
  const setIdx = parseInt(input.dataset.setIndex);
  const field = input.dataset.field;
  const ex = currentWorkout.exercises.find((ex) => ex.id === exId);
  if (!ex) return;

  let value = input.value;
  if (field === 'reps' || field === 'holdSeconds' || field === 'weight' || field === 'restSeconds') {
    value = value === '' ? null : parseInt(value) || 0;
  }

  updateSet(ex, setIdx, field, value);
  scheduleSave();
}

function handleTempoInput(e) {
  const input = e.target.closest('[data-tempo-input]');
  if (!input) return;

  const exId = input.dataset.exerciseId;
  const value = input.value.trim() === '' ? null : input.value.trim();
  updateExerciseField(currentWorkout, exId, 'tempo', value);
  scheduleSave();
}

function handleHoldToggle(e) {
  const checkbox = e.target;
  if (!checkbox.dataset.holdToggle && checkbox.dataset.holdToggle !== '') return;

  const exId = checkbox.dataset.exerciseId;
  const setIdx = parseInt(checkbox.dataset.setIndex);
  const ex = currentWorkout.exercises.find((ex) => ex.id === exId);
  if (!ex || !ex.sets[setIdx]) return;

  const set = ex.sets[setIdx];
  if (checkbox.checked) {
    set.holdSeconds = set.reps || null;
    set.reps = null;
  } else {
    set.reps = set.holdSeconds || null;
    set.holdSeconds = null;
  }

  scheduleSave();
  renderWorkoutView();
}

function openContextMenu(exerciseId, anchorEl) {
  closeContextMenu();
  const menu = document.getElementById('context-menu');
  const rect = anchorEl.getBoundingClientRect();

  menu.style.top = `${rect.bottom + 4}px`;
  menu.style.right = `${window.innerWidth - rect.right}px`;
  menu.style.left = 'auto';
  menu.dataset.exerciseId = exerciseId;
  menu.classList.add('active');
}

function closeContextMenu() {
  document.getElementById('context-menu').classList.remove('active');
}

export function initContextMenu() {
  const menu = document.getElementById('context-menu');

  menu.querySelector('[data-action="rename"]').addEventListener('click', () => {
    openModal('rename-exercise', menu.dataset.exerciseId);
    closeContextMenu();
  });

  menu.querySelector('[data-action="move-up"]').addEventListener('click', () => {
    moveGroup(currentWorkout, menu.dataset.exerciseId, -1);
    scheduleSave();
    renderWorkoutView();
    closeContextMenu();
  });

  menu.querySelector('[data-action="move-down"]').addEventListener('click', () => {
    moveGroup(currentWorkout, menu.dataset.exerciseId, 1);
    scheduleSave();
    renderWorkoutView();
    closeContextMenu();
  });

  menu.querySelector('[data-action="delete"]').addEventListener('click', () => {
    if (confirm('Delete this exercise?')) {
      removeExercise(currentWorkout, menu.dataset.exerciseId);
      scheduleSave();
      renderWorkoutView();
    }
    closeContextMenu();
  });
}

function changeDate(offset) {
  const [y, m, d] = currentDate.split('-').map(Number);
  const date = new Date(y, m - 1, d + offset);
  currentDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  forceSave().then(() => loadWorkoutView(currentDate));
}

export function switchView(view) {
  document.querySelectorAll('.view').forEach((v) => v.classList.remove('active'));
  document.getElementById('footer-actions').style.display = 'none';

  if (view === 'today') {
    document.getElementById('today-view').classList.add('active');
    document.getElementById('date-bar').style.display = 'flex';
    document.getElementById('footer-actions').style.display = 'flex';
    loadWorkoutView(currentDate);
  } else if (view === 'history') {
    document.getElementById('history-view').classList.add('active');
    document.getElementById('date-bar').style.display = 'none';
    loadHistoryView();
  } else if (view === 'readonly') {
    document.getElementById('readonly-view').classList.add('active');
    document.getElementById('date-bar').style.display = 'none';
  }
}

// Export handlers
async function handleExportCurrent() {
  if (!currentWorkout || currentWorkout.exercises.length === 0) {
    showToast('No exercises to export');
    return;
  }
  const md = generateWorkoutMarkdown(currentWorkout);
  const filename = `workout-${currentDate}.md`;
  await exportMarkdownFile(md, filename);
}

async function handleShareCurrent() {
  if (!currentWorkout || currentWorkout.exercises.length === 0) {
    showToast('No exercises to copy');
    return;
  }
  const md = generateWorkoutMarkdown(currentWorkout);
  await copyMarkdownToClipboard(md);
  showToast('Copied to clipboard');
}

async function handleExportDay(date) {
  const workout = await getWorkout(date);
  if (!workout || workout.exercises.length === 0) {
    showToast('No exercises to export');
    return;
  }
  const md = generateWorkoutMarkdown(workout);
  const filename = `workout-${date}.md`;
  await exportMarkdownFile(md, filename);
}

async function handleBulkExport() {
  const startInput = document.getElementById('export-start');
  const endInput = document.getElementById('export-end');
  const start = startInput.value;
  const end = endInput.value;

  if (!start || !end) {
    showToast('Select start and end dates');
    return;
  }
  if (start > end) {
    showToast('Start date must be before end date');
    return;
  }

  const workouts = await getWorkoutsInRange(start, end);
  if (workouts.length === 0) {
    showToast('No workouts in this range');
    return;
  }

  const md = generateBulkMarkdown(workouts, start, end);
  const filename = `training-log-${start}-to-${end}.md`;
  await exportMarkdownFile(md, filename);
}

async function handleBackupExport() {
  try {
    const count = await exportJsonBackup();
    showToast(`Backed up ${count} workout${count !== 1 ? 's' : ''}`);
  } catch (err) {
    showToast('Backup failed');
  }
}

async function handleBackupImport() {
  try {
    const files = await pickFiles('.json', false);
    if (!files || files.length === 0) return;
    const text = await files[0].text();
    const count = await importJsonBackup(text);
    showToast(`Restored ${count} workout${count !== 1 ? 's' : ''}`);
    await renderCalendar();
    await renderRecentWorkouts();
  } catch (err) {
    showToast('Invalid backup file');
  }
}

async function handleMarkdownImport() {
  try {
    const files = await pickFiles('.md,.txt,.markdown', true);
    if (!files || files.length === 0) return;
    const count = await importMarkdownFiles(files);
    showToast(`Imported ${count} workout${count !== 1 ? 's' : ''}`);
    await renderCalendar();
    await renderRecentWorkouts();
  } catch (err) {
    showToast('Failed to import markdown');
  }
}
