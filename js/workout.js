export function createWorkout(date) {
  return {
    date,
    updatedAt: Date.now(),
    exercises: []
  };
}

export function addExercise(workout, name, supersetId) {
  const exercise = {
    id: 'ex_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
    name,
    supersetId: supersetId || null,
    restSeconds: null,
    sets: []
  };
  if (supersetId) {
    // Insert after the last exercise in this superset
    const lastIdx = workout.exercises.map((e) => e.supersetId).lastIndexOf(supersetId);
    if (lastIdx !== -1) {
      workout.exercises.splice(lastIdx + 1, 0, exercise);
    } else {
      workout.exercises.push(exercise);
    }
  } else {
    workout.exercises.push(exercise);
  }
  return exercise;
}

export function createSupersetId() {
  return 'ss_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
}

export function removeFromSuperset(workout, exerciseId) {
  const ex = workout.exercises.find((e) => e.id === exerciseId);
  if (ex) ex.supersetId = null;
}

export function getExerciseGroups(workout) {
  const groups = [];
  let currentGroup = null;

  for (const ex of workout.exercises) {
    if (ex.supersetId) {
      if (currentGroup && currentGroup.supersetId === ex.supersetId) {
        currentGroup.exercises.push(ex);
      } else {
        currentGroup = { type: 'superset', supersetId: ex.supersetId, exercises: [ex] };
        groups.push(currentGroup);
      }
    } else {
      currentGroup = null;
      groups.push({ type: 'single', exercises: [ex] });
    }
  }
  return groups;
}

export function removeExercise(workout, exerciseId) {
  workout.exercises = workout.exercises.filter((e) => e.id !== exerciseId);
}

export function renameExercise(workout, exerciseId, newName) {
  const ex = workout.exercises.find((e) => e.id === exerciseId);
  if (ex) ex.name = newName;
}

export function moveExercise(workout, exerciseId, direction) {
  const idx = workout.exercises.findIndex((e) => e.id === exerciseId);
  if (idx === -1) return;
  const newIdx = idx + direction;
  if (newIdx < 0 || newIdx >= workout.exercises.length) return;
  const temp = workout.exercises[idx];
  workout.exercises[idx] = workout.exercises[newIdx];
  workout.exercises[newIdx] = temp;
}

export function updateExerciseField(workout, exerciseId, field, value) {
  const ex = workout.exercises.find((e) => e.id === exerciseId);
  if (ex) ex[field] = value;
}

export function addSet(exercise) {
  const lastSet = exercise.sets[exercise.sets.length - 1];
  const set = {
    setNumber: exercise.sets.length + 1,
    reps: lastSet ? lastSet.reps : null,
    holdSeconds: lastSet ? lastSet.holdSeconds : null,
    weight: lastSet ? lastSet.weight : null,
    unit: lastSet ? lastSet.unit : 'lbs',
    notes: ''
  };
  exercise.sets.push(set);
  return set;
}

export function removeSet(exercise, setIndex) {
  exercise.sets.splice(setIndex, 1);
  exercise.sets.forEach((s, i) => { s.setNumber = i + 1; });
}

export function updateSet(exercise, setIndex, field, value) {
  if (!exercise.sets[setIndex]) return;
  exercise.sets[setIndex][field] = value;
}
