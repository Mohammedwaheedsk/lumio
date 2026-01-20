import './style.css'

// --- State Management ---
const STORAGE_KEY = 'lumina_goals_v1';
const CHECKIN_KEY = 'lumina_last_checkin';

let state = {
  goals: [],
  totalSaved: 0
};

// --- DOM Elements ---
const app = {
  goalsList: document.getElementById('goals-list'),
  totalSavedDisplay: document.getElementById('total-saved-display'),
  addGoalBtn: document.getElementById('add-goal-btn'),
  startCheckinBtn: document.getElementById('start-checkin-btn'),
  checkinSection: document.getElementById('daily-checkin-section'),
  addGoalModal: document.getElementById('add-goal-modal'),
  checkinModal: document.getElementById('checkin-modal'),
  closeButtons: document.querySelectorAll('.close-modal'),
  addGoalForm: document.getElementById('add-goal-form'),
  checkinForm: document.getElementById('checkin-form'),
  goalSelector: document.getElementById('goal-selector')
};

// --- Initialization ---
function init() {
  loadState();
  render();
  checkDailyStatus();
  setupEventListeners();
}

function loadState() {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    state.goals = JSON.parse(stored);
    calculateTotal();
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.goals));
  calculateTotal();
  render();
}

function calculateTotal() {
  state.totalSaved = state.goals.reduce((sum, goal) => sum + (Number(goal.saved) || 0), 0);
}

// --- Logic ---
function checkDailyStatus() {
  const lastCheckIn = localStorage.getItem(CHECKIN_KEY);
  const today = new Date().toDateString();

  if (lastCheckIn !== today && state.goals.length > 0) {
    app.checkinSection.classList.remove('hidden');
  } else {
    app.checkinSection.classList.add('hidden');
  }
}

function addGoal(name, target, deadline) {
  const newGoal = {
    id: crypto.randomUUID(),
    name,
    target: Number(target),
    saved: 0,
    deadline,
    createdAt: new Date().toISOString()
  };
  state.goals.push(newGoal);
  saveState();
  // If this is the first goal, showing the checkin section might be relevant
  checkDailyStatus();
}

function updateGoalProgress(goalId, amount) {
  const goal = state.goals.find(g => g.id === goalId);
  if (goal) {
    goal.saved += Number(amount);
    if (goal.saved > goal.target) goal.saved = goal.target; // Cap at target? Optional.
    saveState();

    // Mark checked in for today
    localStorage.setItem(CHECKIN_KEY, new Date().toDateString());
    checkDailyStatus();
  }
}

function calculateDailyMap(goal) {
  const today = new Date();
  const deadline = new Date(goal.deadline);

  // Reset time to midnight for accurate day diff
  today.setHours(0, 0, 0, 0);
  deadline.setHours(0, 0, 0, 0);

  const diffTime = deadline - today;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  const remaining = goal.target - goal.saved;

  if (remaining <= 0) return { complete: true };
  if (diffDays <= 0) return { overdue: true, remaining };

  const daily = remaining / diffDays;
  return { daily, daysLeft: diffDays };
}

// --- Rendering ---
function render() {
  // Update dashboard
  app.totalSavedDisplay.textContent = new Intl.NumberFormat('en-IN').format(state.totalSaved);

  // Render Goals
  app.goalsList.innerHTML = '';

  if (state.goals.length === 0) {
    app.goalsList.innerHTML = `
      <div style="grid-column: 1/-1; text-align: center; color: var(--text-secondary); padding: 40px;">
        <p>No goals set yet. Click + to start your journey.</p>
      </div>
    `;
    return;
  }

  state.goals.forEach(goal => {
    const percent = Math.min(100, Math.round((goal.saved / goal.target) * 100));
    const stats = calculateDailyMap(goal);

    let subtext = '';
    if (stats.complete) subtext = '<span style="color: var(--accent-success)">Goal Completed! 🎉</span>';
    else if (stats.overdue) subtext = `<span style="color: #ff4757">Overdue by ₹${stats.remaining}</span>`;
    else subtext = `Save ₹${Math.ceil(stats.daily)}/day for ${stats.daysLeft} days`;

    const card = document.createElement('div');
    card.className = 'goal-card';
    card.innerHTML = `
      <div class="goal-header">
        <div>
          <div class="goal-title">${goal.name}</div>
          <div class="goal-deadline">Target: ₹${new Intl.NumberFormat('en-IN').format(goal.target)}</div>
        </div>
        <div class="goal-deadline">${new Date(goal.deadline).toLocaleDateString()}</div>
      </div>
      <div class="progress-bar-bg">
        <div class="progress-bar-fill" style="width: ${percent}%"></div>
      </div>
      <div class="progress-stats">
        <span>${subtext}</span>
        <span class="progress-percent">${percent}%</span>
      </div>
      <button class="btn-primary" style="margin-top: 15px; width: 100%; padding: 8px; font-size: 12px; background: rgba(255,255,255,0.1);" onclick="window.openDetails('${goal.id}')">Add Savings</button>
    `;

    // Quick add handling hack (attaching event listener to the button properly instead of inline)
    const btn = card.querySelector('button');
    btn.onclick = () => openCheckinModal(goal.id); // Helper to pre-select

    app.goalsList.appendChild(card);
  });

  // Render Goal Selector Options
  app.goalSelector.innerHTML = '<option value="" disabled selected>Select Goal...</option>';
  state.goals.forEach(goal => {
    if (goal.saved < goal.target) {
      const opt = document.createElement('option');
      opt.value = goal.id;
      opt.textContent = goal.name;
      app.goalSelector.appendChild(opt);
    }
  });
}

// --- Event Listeners & UI Helpers ---
function setupEventListeners() {
  // Modals
  app.addGoalBtn.onclick = () => openModal(app.addGoalModal);
  app.startCheckinBtn.onclick = () => openModal(app.checkinModal);

  app.closeButtons.forEach(btn => {
    btn.onclick = (e) => {
      const modal = e.target.closest('.modal');
      closeModal(modal);
    };
  });

  // Forms
  app.addGoalForm.onsubmit = (e) => {
    e.preventDefault();
    const fd = new FormData(app.addGoalForm);
    addGoal(fd.get('name'), fd.get('target'), fd.get('deadline'));
    app.addGoalForm.reset();
    closeModal(app.addGoalModal);
  };

  app.checkinForm.onsubmit = (e) => {
    e.preventDefault();
    const amount = document.getElementById('checkin-amount').value;
    const goalId = app.goalSelector.value;

    if (amount && goalId) {
      updateGoalProgress(goalId, amount);
      app.checkinForm.reset();
      closeModal(app.checkinModal);
    }
  };

  // Close modal on backdrop click
  window.onclick = (e) => {
    if (e.target.classList.contains('modal')) {
      closeModal(e.target);
    }
  };
}

function openModal(modal) {
  modal.classList.add('active');
  modal.classList.remove('hidden');
}

function closeModal(modal) {
  modal.classList.remove('active');
  setTimeout(() => modal.classList.add('hidden'), 300); // Wait for transition
}

function openCheckinModal(preselectHeightId = null) {
  openModal(app.checkinModal);
  if (preselectHeightId) {
    app.goalSelector.value = preselectHeightId;
  }
}

// Global expose for quick button
window.openCheckinModal = openCheckinModal;

init();
