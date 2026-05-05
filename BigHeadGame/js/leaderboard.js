/**
 * leaderboard.js  –  localStorage top-5 score persistence.
 * All functions are plain globals – no import/export needed.
 */

const _LB_KEY = 'bigHeadWhack_v2_scores';

/** Save a score and keep all history. */
function saveScore(name, score) {
  const all = getScores();
  all.push({ name: name || 'Anonymous', score, date: Date.now() });
  
  // Sort descending by score. If tied, sort ascending by date (older = better rank).
  all.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.date - b.date;
  });
  
  localStorage.setItem(_LB_KEY, JSON.stringify(all));
}

/** Wipe all leaderboard data. */
function clearScores() {
  localStorage.removeItem(_LB_KEY);
}

/** Return current scores array from localStorage. */
function getScores() {
  try {
    return JSON.parse(localStorage.getItem(_LB_KEY)) || [];
  } catch {
    return [];
  }
}

/** Render scores into the given <ul> element. */
function renderLeaderboard(listEl) {
  if (!listEl) return;
  const scores = getScores();
  listEl.innerHTML = '';

  if (scores.length === 0) {
    listEl.innerHTML =
      '<li style="color:var(--muted);justify-content:center">No scores yet — be the first! 🏆</li>';
    return;
  }

  const medals      = ['🥇', '🥈', '🥉'];
  const rankClasses = ['gold', 'silver', 'bronze', 'other', 'other'];

  scores.forEach((entry, i) => {
    const li = document.createElement('li');

    const rankEl = document.createElement('span');
    rankEl.className   = `lb-rank ${rankClasses[i] || 'other'}`;
    rankEl.textContent = medals[i] || `#${i + 1}`;

    const nameEl = document.createElement('span');
    nameEl.className   = 'lb-name';
    nameEl.textContent = entry.name;

    const scoreEl = document.createElement('span');
    scoreEl.className   = 'lb-score';
    scoreEl.textContent = entry.score;

    li.appendChild(rankEl);
    li.appendChild(nameEl);
    li.appendChild(scoreEl);
    listEl.appendChild(li);
  });
}
