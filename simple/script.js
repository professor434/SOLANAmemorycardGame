// Simple memory game logic

/*
 * This script powers the standalone Solana Memory Game.  It wires up the
 * controls, generates and shuffles cards based on the chosen difficulty
 * and card set, handles flipping and matching logic, tracks moves and
 * elapsed time, and writes results to localStorage so the leaderboard
 * persists across page reloads.  The code avoids external libraries so
 * it will run in any modern browser without additional builds.
 */

(function () {
  // DOM elements
  const walletInput = document.getElementById('wallet');
  const difficultySelect = document.getElementById('difficulty');
  const setSelect = document.getElementById('set');
  const tournamentSelect = document.getElementById('tournamentSelect');
  const startBtn = document.getElementById('startBtn');
  const board = document.getElementById('gameBoard');
  const movesDisplay = document.getElementById('movesDisplay');
  const timeDisplay = document.getElementById('timeDisplay');
  const matchesDisplay = document.getElementById('matchesDisplay');
  const leaderboardTableBody = document.querySelector('#leaderboardTable tbody');

  // Game state
  let cards = [];
  let firstCardIndex = null;
  let secondCardIndex = null;
  let moves = 0;
  let matches = 0;
  let totalPairs = 0;
  let timerId = null;
  let startTimestamp = null;
  let lockBoard = false;

  // Player and tournament state
  let playerWallet = '';
  let selectedTournamentId = '';

  /**
   * Shuffle an array in place using Fisher–Yates.
   * @param {Array<any>} array
   * @returns {Array<any>}
   */
  function shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }

  /**
   * Return an array of image paths for the chosen set.  When more pairs
   * are requested than unique images available, the list cycles from
   * the beginning again.
   * @param {string} setName
   * @param {number} pairs
   * @returns {string[]}
   */
  function getImageList(setName, pairs) {
    const basePath = 'images/cards';
    let images = [];
    if (setName === 'set1' || setName === 'both') {
      for (let i = 1; i <= 8; i++) {
        images.push(`${basePath}/set1_${i}.png`);
      }
    }
    if (setName === 'set2' || setName === 'both') {
      for (let i = 1; i <= 8; i++) {
        images.push(`${basePath}/set2_${i}.png`);
      }
    }
    // Cycle through images if pairs exceeds available unique images
    const selected = [];
    for (let i = 0; i < pairs; i++) {
      selected.push(images[i % images.length]);
    }
    return selected;
  }

  /**
   * Initialize a new game with the chosen difficulty and set.
   */
  function startGame() {
    // Clear any existing timer
    if (timerId) {
      clearInterval(timerId);
      timerId = null;
    }
    // Reset state
    cards = [];
    firstCardIndex = null;
    secondCardIndex = null;
    moves = 0;
    matches = 0;
    lockBoard = false;
    startTimestamp = Date.now();
    // Determine total pairs from difficulty
    totalPairs = parseInt(difficultySelect.value, 10);
    // Get image set
    const selectedImages = getImageList(setSelect.value, totalPairs);
    // Build card objects (two of each)
    selectedImages.forEach((img) => {
      cards.push({ image: img, matched: false });
      cards.push({ image: img, matched: false });
    });
    // Shuffle cards
    shuffle(cards);
    // Update displays
    movesDisplay.textContent = `Moves: 0`;
    timeDisplay.textContent = `Time: 0s`;
    matchesDisplay.textContent = `Matched: 0/${totalPairs}`;
    // Render cards
    renderBoard();
    // Start timer
    timerId = setInterval(() => {
      const elapsedSeconds = Math.floor((Date.now() - startTimestamp) / 1000);
      timeDisplay.textContent = `Time: ${elapsedSeconds}s`;
    }, 1000);
  }

  /**
   * Render the game board based on the cards array.
   */
  function renderBoard() {
    // Clear board content
    board.innerHTML = '';
    // Compute approximate column count based on total cards
    const totalCards = cards.length;
    const columns = Math.floor(Math.sqrt(totalCards));
    board.style.gridTemplateColumns = `repeat(${columns}, minmax(0, 1fr))`;
    cards.forEach((card, index) => {
      const cardEl = document.createElement('div');
      cardEl.className = 'card';
      cardEl.dataset.index = index;
      const inner = document.createElement('div');
      inner.className = 'card-inner';
      // Back face
      const backFace = document.createElement('div');
      backFace.className = 'card-face card-back';
      // Front face with image
      const frontFace = document.createElement('div');
      frontFace.className = 'card-face card-front';
      frontFace.style.backgroundImage = `url('${card.image}')`;
      // Assemble
      inner.appendChild(backFace);
      inner.appendChild(frontFace);
      cardEl.appendChild(inner);
      // Attach click handler
      cardEl.addEventListener('click', onCardClick);
      board.appendChild(cardEl);
    });
  }

  /**
   * Click handler for a card.  Coordinates flipping logic and matching.
   * @param {MouseEvent} event
   */
  function onCardClick(event) {
    const cardEl = event.currentTarget;
    const index = parseInt(cardEl.dataset.index, 10);
    const card = cards[index];
    // Ignore if board is locked or card already matched
    if (lockBoard || card.matched) return;
    // Ignore if clicking the same card again
    if (index === firstCardIndex) return;
    // Flip card visually
    cardEl.classList.add('flipped');
    // Determine selection
    if (firstCardIndex === null) {
      firstCardIndex = index;
      return;
    }
    secondCardIndex = index;
    lockBoard = true;
    moves++;
    movesDisplay.textContent = `Moves: ${moves}`;
    // Check match
    if (cards[firstCardIndex].image === cards[secondCardIndex].image) {
      // Mark matched
      cards[firstCardIndex].matched = true;
      cards[secondCardIndex].matched = true;
      matches++;
      matchesDisplay.textContent = `Matched: ${matches}/${totalPairs}`;
      // Reset selection
      resetSelection();
      // Check if all matched
      if (matches === totalPairs) {
        endGame();
      }
    } else {
      // Not a match – flip back after delay
      setTimeout(() => {
        const firstEl = board.querySelector(`.card[data-index='${firstCardIndex}']`);
        const secondEl = board.querySelector(`.card[data-index='${secondCardIndex}']`);
        if (firstEl) firstEl.classList.remove('flipped');
        if (secondEl) secondEl.classList.remove('flipped');
        resetSelection();
      }, 800);
    }
  }

  /**
   * Reset the currently selected cards and unlock the board.
   */
  function resetSelection() {
    firstCardIndex = null;
    secondCardIndex = null;
    lockBoard = false;
  }

  /**
   * End the game, stop the timer and record the score in localStorage.
   */
  function endGame() {
    if (timerId) {
      clearInterval(timerId);
      timerId = null;
    }
    const elapsedSeconds = Math.floor((Date.now() - startTimestamp) / 1000);
    timeDisplay.textContent = `Time: ${elapsedSeconds}s`;
    // Persist score
    saveScore({
      pairs: totalPairs,
      moves,
      time: elapsedSeconds,
      date: new Date().toISOString(),
      wallet: playerWallet,
      tournamentId: selectedTournamentId || null,
    });
    // Update leaderboard display
    renderLeaderboard();
    // Show a simple alert to congratulate the player
    setTimeout(() => {
      alert(`Congratulations! You completed ${totalPairs} pairs in ${moves} moves and ${elapsedSeconds} seconds.`);
    }, 200);
  }

  /**
   * Save a score entry to localStorage.  Scores are stored under the
   * key "solana_memory_game_scores" as a JSON array.
   * @param {{pairs:number,moves:number,time:number,date:string}} entry
   */
  function saveScore(entry) {
    const key = 'solana_memory_game_scores';
    const existing = localStorage.getItem(key);
    let scores = [];
    if (existing) {
      try {
        scores = JSON.parse(existing);
        if (!Array.isArray(scores)) scores = [];
      } catch (e) {
        scores = [];
      }
    }
    scores.push(entry);
    // Persist back to storage
    try {
      localStorage.setItem(key, JSON.stringify(scores));
    } catch (e) {
      console.error('Failed to save scores:', e);
    }
  }

  /**
   * Render the leaderboard table for the currently selected difficulty.
   */
  function renderLeaderboard() {
    const key = 'solana_memory_game_scores';
    const existing = localStorage.getItem(key);
    let scores = [];
    if (existing) {
      try {
        scores = JSON.parse(existing);
        if (!Array.isArray(scores)) scores = [];
      } catch (e) {
        scores = [];
      }
    }
    // Filter by difficulty and tournament
    const pairs = parseInt(difficultySelect.value, 10);
    let filtered = scores.filter((s) => s.pairs === pairs);
    // If a specific tournament is selected, filter by tournamentId
    if (selectedTournamentId) {
      filtered = filtered.filter((s) => s.tournamentId === selectedTournamentId);
    } else {
      // No tournament selected: show only entries with no tournament
      filtered = filtered.filter((s) => !s.tournamentId);
    }
    // Sort by moves then time
    filtered.sort((a, b) => {
      if (a.moves !== b.moves) return a.moves - b.moves;
      return a.time - b.time;
    });
    // Limit to top 10
    const top = filtered.slice(0, 10);
    // Clear table body
    leaderboardTableBody.innerHTML = '';
    top.forEach((entry, idx) => {
      const tr = document.createElement('tr');
      const rankTd = document.createElement('td');
      rankTd.textContent = String(idx + 1);
      const walletTd = document.createElement('td');
      walletTd.textContent = entry.wallet || '';
      const movesTd = document.createElement('td');
      movesTd.textContent = String(entry.moves);
      const timeTd = document.createElement('td');
      timeTd.textContent = String(entry.time);
      const pairsTd = document.createElement('td');
      pairsTd.textContent = String(entry.pairs);
      const dateTd = document.createElement('td');
      const dateObj = new Date(entry.date);
      const dateStr = `${dateObj
        .getDate()
        .toString()
        .padStart(2, '0')}/${(dateObj.getMonth() + 1)
        .toString()
        .padStart(2, '0')} ${dateObj
        .getHours()
        .toString()
        .padStart(2, '0')}:${dateObj
        .getMinutes()
        .toString()
        .padStart(2, '0')}`;
      dateTd.textContent = dateStr;
      tr.appendChild(rankTd);
      tr.appendChild(walletTd);
      tr.appendChild(movesTd);
      tr.appendChild(timeTd);
      tr.appendChild(pairsTd);
      tr.appendChild(dateTd);
      leaderboardTableBody.appendChild(tr);
    });
  }

  // Bind event listeners
  startBtn.addEventListener('click', () => {
    startGame();
    renderLeaderboard();
  });
  // Also update leaderboard when difficulty changes
  difficultySelect.addEventListener('change', renderLeaderboard);

  // Update player wallet on input
  walletInput.addEventListener('input', () => {
    playerWallet = walletInput.value.trim();
    localStorage.setItem('solana_memory_game_player_wallet', playerWallet);
    // Re-render leaderboard because wallet column might change sort order later
    renderLeaderboard();
  });

  // Update selected tournament when changed
  tournamentSelect.addEventListener('change', () => {
    selectedTournamentId = tournamentSelect.value;
    // When selecting a tournament, if it specifies a difficulty via data attribute, update difficultySelect
    const selectedOption = tournamentSelect.options[tournamentSelect.selectedIndex];
    const diffAttr = selectedOption ? selectedOption.dataset.difficulty : null;
    if (diffAttr) {
      difficultySelect.value = diffAttr;
    }
    renderLeaderboard();
  });

  // Initial render of leaderboard on page load
  document.addEventListener('DOMContentLoaded', () => {
    // Load tournaments and player wallet
    loadTournaments();
    // Restore or generate player wallet
    const storedWallet = localStorage.getItem('solana_memory_game_player_wallet');
    if (storedWallet && storedWallet.trim()) {
      playerWallet = storedWallet.trim();
    } else {
      // Generate a guest wallet alias
      playerWallet = `guest-${Math.floor(Math.random() * 100000)}`;
      localStorage.setItem('solana_memory_game_player_wallet', playerWallet);
    }
    walletInput.value = playerWallet;
    // Set default tournament selection
    selectedTournamentId = tournamentSelect.value;
    // Render leaderboard
    renderLeaderboard();
  });

  /**
   * Load tournaments from localStorage or create a default tournament.  The
   * tournaments are stored under the key 'solana_memory_game_tournaments' as
   * an array of objects.  Each object must contain an id, name and
   * difficulty (number of pairs).  Additional properties are ignored.
   */
  function loadTournaments() {
    const key = 'solana_memory_game_tournaments';
    let tournaments = [];
    const existing = localStorage.getItem(key);
    if (existing) {
      try {
        tournaments = JSON.parse(existing);
        if (!Array.isArray(tournaments)) tournaments = [];
      } catch (e) {
        tournaments = [];
      }
    }
    // If no tournaments exist, create a default friendly match
    if (tournaments.length === 0) {
      tournaments.push({
        id: 'default',
        name: 'Friendly Match',
        difficulty: 8,
      });
      localStorage.setItem(key, JSON.stringify(tournaments));
    }
    // Populate the select element
    tournamentSelect.innerHTML = '';
    // Option for no tournament
    const noneOpt = document.createElement('option');
    noneOpt.value = '';
    noneOpt.textContent = 'None';
    tournamentSelect.appendChild(noneOpt);
    tournaments.forEach((t) => {
      const opt = document.createElement('option');
      opt.value = t.id;
      opt.textContent = t.name;
      if (t.difficulty) opt.dataset.difficulty = String(t.difficulty);
      tournamentSelect.appendChild(opt);
    });
  }
})();