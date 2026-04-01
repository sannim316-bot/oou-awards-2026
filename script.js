/**
 * STELLAR AWARDS NIGHT 2025 — script.js
 * ============================================================
 * Updated to use Backend API
 * Handles:
 *  - API integration with backend
 *  - Nominee rendering & category filtering
 *  - Vote modal & Paystack payment integration
 *  - Admin authentication with JWT
 *  - Countdown timer & navbar scroll
 * ============================================================
 */

// ============================================================
// 1. CONFIGURATION — UPDATE THESE BEFORE GOING LIVE
// ============================================================
const CONFIG = {
  // Backend API URL (change this to your deployed backend URL)
  API_URL: 'https://oou-awards-2026-production.up.railway.app/api',

  // Replace with your actual Paystack public key from paystack.com
  PAYSTACK_PUBLIC_KEY: 'pk_test_9f8b40bc8fafcdc36039c45994d12664217c31fd',

  // Cost per vote in Kobo (1 NGN = 100 Kobo). ₦200 = 20000 Kobo
  VOTE_AMOUNT_KOBO: 20000,

  // Event date for countdown timer (format: YYYY-MM-DDTHH:mm:ss)
  EVENT_DATE: '2025-06-28T18:30:00',
};

// ============================================================
// 2. API LAYER
// ============================================================
const API = {
  // Get auth token from storage
  getToken() {
    return localStorage.getItem('adminToken') || sessionStorage.getItem('adminToken');
  },

  // Make authenticated request
  async request(endpoint, options = {}) {
    const url = `${CONFIG.API_URL}${endpoint}`;
    const token = this.getToken();

    const headers = {
      'Content-Type': 'application/json',
      ...(token && { 'Authorization': `Bearer ${token}` }),
      ...options.headers,
    };

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Request failed');
      }

      return data;
    } catch (error) {
      console.error(`API Error [${endpoint}]:`, error);
      throw error;
    }
  },

  // Categories
  async getCategories() {
    return this.request('/categories');
  },

  async createCategory(name) {
    return this.request('/categories', {
      method: 'POST',
      body: JSON.stringify({ name }),
    });
  },

  async updateCategory(id, name) {
    return this.request(`/categories/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ name }),
    });
  },

  async deleteCategory(id) {
    return this.request(`/categories/${id}`, {
      method: 'DELETE',
    });
  },

  // Nominees
  async getNominees() {
    return this.request('/nominees');
  },

  async getNominee(id) {
    return this.request(`/nominees/${id}`);
  },

  async createNominee(formData) {
    return fetch(`${CONFIG.API_URL}/nominees`, {
      method: 'POST',
      headers: {
        ...(this.getToken() && { 'Authorization': `Bearer ${this.getToken()}` }),
      },
      body: formData,
    }).then(res => res.json());
  },

  async updateNominee(id, formData) {
    return fetch(`${CONFIG.API_URL}/nominees/${id}`, {
      method: 'PUT',
      headers: {
        ...(this.getToken() && { 'Authorization': `Bearer ${this.getToken()}` }),
      },
      body: formData,
    }).then(res => res.json());
  },

  async deleteNominee(id) {
    return this.request(`/nominees/${id}`, {
      method: 'DELETE',
    });
  },

  // Votes
  async recordVote(nominee_id, voter_name, voter_email, transaction_ref, amount_kobo) {
    return this.request('/votes', {
      method: 'POST',
      body: JSON.stringify({
        nominee_id,
        voter_name,
        voter_email,
        transaction_ref,
        amount_kobo,
      }),
    });
  },

  // Stats
  async getStats() {
    return this.request('/stats');
  },

  // Auth
  async login(username, password) {
    const response = await fetch(`${CONFIG.API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Login failed');
    }

    return data;
  },

  async verifyToken() {
    return this.request('/auth/verify');
  },
};

// ============================================================
// 3. STATE
// ============================================================
let currentFilter = 'All';         // Active category filter
let pendingNomineeId = null;       // The nominee being voted for
let pendingVoterEmail = '';       // Voter's email for Paystack
let pendingVoterName = '';        // Voter's name for Paystack
let cachedNominees = [];           // Cache nominees from API
let cachedCategories = [];        // Cache categories from API

// ============================================================
// 4. HELPERS
// ============================================================

/** Generate a unique ID string */
function uid() {
  return 'n' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

/** Show a toast notification */
function showToast(message, toastId = 'successToast', msgId = 'toastMsg') {
  const toast = document.getElementById(toastId);
  const msg = document.getElementById(msgId);
  if (!toast || !msg) return;
  msg.textContent = message;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 4000);
}

/** Get initials-based placeholder colour (consistent per name) */
function nameToColor(name) {
  const palette = ['#C9A84C', '#8A7B40', '#6B5520', '#B8924A', '#D4B060'];
  let sum = 0;
  for (const ch of name) sum += ch.charCodeAt(0);
  return palette[sum % palette.length];
}

/** Generate a fallback SVG avatar */
function avatarSVG(name, size = 300) {
  const initials = name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
  const bg = nameToColor(name);
  return `data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='${size}' height='${size}'><rect fill='${encodeURIComponent(bg)}' width='${size}' height='${size}'/><text x='50%' y='54%' dominant-baseline='middle' text-anchor='middle' fill='%230B0B0F' font-size='${Math.round(size * 0.35)}' font-family='serif' font-weight='bold'>${initials}</text></svg>`;
}

// ============================================================
// 5. HERO PARTICLES
// ============================================================
function createParticles() {
  const container = document.getElementById('particles');
  if (!container) return;

  for (let i = 0; i < 40; i++) {
    const p = document.createElement('div');
    p.className = 'particle';
    const size = Math.random() * 4 + 1;
    p.style.cssText = `
      width:${size}px;
      height:${size}px;
      left:${Math.random() * 100}%;
      top:${Math.random() * 100}%;
      animation-duration:${3 + Math.random() * 6}s;
      animation-delay:${Math.random() * 8}s;
    `;
    container.appendChild(p);
  }
}

// ============================================================
// 6. COUNTDOWN TIMER
// ============================================================
function startCountdown() {
  const target = new Date(CONFIG.EVENT_DATE).getTime();

  function update() {
    const now = Date.now();
    const diff = target - now;

    if (diff <= 0) {
      // Voting closed
      ['cd-days', 'cd-hours', 'cd-mins', 'cd-secs'].forEach(
        (id) => (document.getElementById(id).textContent = '00')
      );
      return;
    }

    const d = Math.floor(diff / 86400000);
    const h = Math.floor((diff % 86400000) / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    const s = Math.floor((diff % 60000) / 1000);

    document.getElementById('cd-days').textContent = String(d).padStart(2, '0');
    document.getElementById('cd-hours').textContent = String(h).padStart(2, '0');
    document.getElementById('cd-mins').textContent = String(m).padStart(2, '0');
    document.getElementById('cd-secs').textContent = String(s).padStart(2, '0');
  }

  update();
  setInterval(update, 1000);
}

// ============================================================
// 7. NAVBAR SCROLL EFFECT
// ============================================================
function initNavbar() {
  const navbar = document.getElementById('navbar');
  if (!navbar) return;

  window.addEventListener('scroll', () => {
    navbar.classList.toggle('scrolled', window.scrollY > 60);
  });

  // Burger menu toggle (mobile)
  const btn = document.getElementById('burgerBtn');
  const links = document.querySelector('.nav-links');
  if (btn && links) {
    btn.addEventListener('click', () => links.classList.toggle('open'));
  }
}

// ============================================================
// 8. RENDER NOMINEES (public page)
// ============================================================
function renderNominees(filter = 'All') {
  const grid = document.getElementById('nomineesGrid');
  if (!grid) return;

  const filtered = filter === 'All' ? cachedNominees : cachedNominees.filter((n) => n.category_name === filter);

  if (filtered.length === 0) {
    grid.innerHTML = `<p style="color:var(--text-muted);padding:40px 0;">No nominees in this category yet.</p>`;
    return;
  }

  // Find max votes for progress bar
  const maxVotes = Math.max(...filtered.map((n) => n.votes || 0), 1);

  grid.innerHTML = filtered
    .map(
      (n) => `
    <article class="nominee-card" data-id="${n.id}">
      <div class="nominee-img-wrap">
        <img src="${avatarSVG(n.name)}" alt="${n.name}" />
        <span class="nominee-cat-badge">${n.category_name || n.category}</span>
        <span class="nominee-votes-badge" id="votes-${n.id}">${n.votes || 0} 🗳</span>
      </div>
      <div class="nominee-info">
        <h3 class="nominee-name">${n.name}</h3>
        <p class="nominee-bio">${n.bio || ''}</p>
        <div class="vote-bar">
          <div class="vote-bar-fill" style="width:${((n.votes || 0) / maxVotes) * 100}%"></div>
        </div>
        <button class="btn-vote" onclick="openVoteModal('${n.id}')">
          Vote for ${n.name.split(' ')[0]}
        </button>
      </div>
    </article>
  `
    )
    .join('');

  // Update stats
  updateStats();
}

// ============================================================
// 9. CATEGORY FILTER TABS
// ============================================================
function renderFilterTabs() {
  const container = document.getElementById('filterTabs');
  if (!container) return;

  // Remove old dynamic tabs (keep "All" btn)
  Array.from(container.querySelectorAll('.filter-btn:not([data-cat="All"])')).forEach((b) =>
    b.remove()
  );

  // Group categories by type
  const perLevel = cachedCategories.filter(c => c.category_type === 'per_level');
  const general = cachedCategories.filter(c => c.category_type === 'general');
  const allLevels = cachedCategories.filter(c => c.category_type === 'all_levels');

  // Helper to create type section header
  const createSectionHeader = (text, type) => {
    const header = document.createElement('div');
    header.className = 'filter-section-header';
    header.textContent = text;
    header.dataset.type = type;
    return header;
  };

  // Helper to create category button
  const createCategoryBtn = (cat) => {
    const btn = document.createElement('button');
    btn.className = 'filter-btn';
    btn.dataset.cat = cat.name;
    btn.dataset.type = cat.category_type;
    btn.textContent = cat.name;
    return btn;
  };

  // Add "For Each Level" section
  if (perLevel.length > 0) {
    container.appendChild(createSectionHeader('🏆 For Each Level', 'per_level'));
    perLevel.forEach(cat => container.appendChild(createCategoryBtn(cat)));
  }

  // Add "General Awards" section
  if (general.length > 0) {
    container.appendChild(createSectionHeader('🎖 General Awards', 'general'));
    general.forEach(cat => container.appendChild(createCategoryBtn(cat)));
  }

  // Add "Across All Levels" section
  if (allLevels.length > 0) {
    container.appendChild(createSectionHeader('⭐ All Levels', 'all_levels'));
    allLevels.forEach(cat => container.appendChild(createCategoryBtn(cat)));
  }

  container.querySelectorAll('.filter-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      container.querySelectorAll('.filter-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      currentFilter = btn.dataset.cat;
      renderNominees(currentFilter);
    });
  });
}

// ============================================================
// 10. UPDATE STATS
// ============================================================
async function updateStats() {
  try {
    const stats = await API.getStats();

    const totalEl = document.getElementById('total-votes-display');
    const nomEl = document.getElementById('nominees-count');
    const catEl = document.getElementById('categories-count');

    if (totalEl) totalEl.textContent = (stats.totalVotes || 0).toLocaleString();
    if (nomEl) nomEl.textContent = stats.nomineesCount || 0;
    if (catEl) catEl.textContent = stats.categoriesCount || 0;
  } catch (error) {
    console.error('Failed to update stats:', error);
  }
}

// ============================================================
// 11. VOTE MODAL
// ============================================================
function openVoteModal(nomineeId) {
  const nominee = cachedNominees.find((n) => n.id === nomineeId);
  if (!nominee) return;

  pendingNomineeId = nomineeId;

  document.getElementById('modalImg').src = avatarSVG(nominee.name);
  document.getElementById('modalName').textContent = nominee.name;
  document.getElementById('modalCat').textContent = nominee.category_name || nominee.category;
  document.getElementById('voterEmail').value = '';
  document.getElementById('voterName').value = '';

  document.getElementById('voteModal').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeVoteModal() {
  document.getElementById('voteModal')?.classList.remove('open');
  document.body.style.overflow = '';
  pendingNomineeId = null;
}

// ============================================================
// 12. PAYSTACK PAYMENT INTEGRATION
// ============================================================
/**
 * Called when user clicks "Pay & Vote".
 * Validates inputs, then opens Paystack's payment popup.
 */
function initiatePayment() {
  const email = document.getElementById('voterEmail')?.value.trim();
  const name = document.getElementById('voterName')?.value.trim();

  // Basic validation
  if (!email || !email.includes('@')) {
    alert('Please enter a valid email address.');
    return;
  }
  if (!name) {
    alert('Please enter your full name.');
    return;
  }
  if (!pendingNomineeId) {
    alert('No nominee selected. Please try again.');
    return;
  }

  pendingVoterEmail = email;
  pendingVoterName = name;

  const nominee = cachedNominees.find((n) => n.id === pendingNomineeId);
  if (!nominee) return;

  // ---- Paystack inline handler ----
  const handler = PaystackPop.setup({
    key: CONFIG.PAYSTACK_PUBLIC_KEY,
    email: email,
    amount: CONFIG.VOTE_AMOUNT_KOBO, // Amount in Kobo
    currency: 'NGN',
    ref: 'AWARD_' + Date.now() + '_' + Math.floor(Math.random() * 1000000),
    metadata: {
      custom_fields: [
        {
          display_name: 'Voter Name',
          variable_name: 'voter_name',
          value: name,
        },
        {
          display_name: 'Nominee',
          variable_name: 'nominee_name',
          value: nominee.name,
        },
        {
          display_name: 'Category',
          variable_name: 'category',
          value: nominee.category_name || nominee.category,
        },
        {
          display_name: 'Nominee ID',
          variable_name: 'nominee_id',
          value: pendingNomineeId,
        },
      ],
    },

    /**
     * onSuccess — fired when payment completes successfully.
     */
    callback: function (response) {
      console.log('✅ Paystack callback:', response);
      recordVote(pendingNomineeId, pendingVoterEmail, pendingVoterName, response.reference);
    },

    /**
     * onClose — fired if user closes popup without paying.
     */
    onClose: function () {
      showToast('Payment cancelled. Your vote was not recorded.', 'voteModal');
    },
  });

  handler.openIframe();
}

/**
 * Record vote in backend after successful payment
 */
async function recordVote(nomineeId, voterEmail, voterName, transactionRef) {
  try {
    await API.recordVote(nomineeId, voterName, voterEmail, transactionRef, CONFIG.VOTE_AMOUNT_KOBO);

    // Update local cache
    const nominee = cachedNominees.find((n) => n.id === nomineeId);
    if (nominee) {
      nominee.votes = (nominee.votes || 0) + 1;
    }

    // Re-render
    renderNominees(currentFilter);
    closeVoteModal();
    showToast('🎉 Your vote has been recorded! Thank you for supporting.');
  } catch (error) {
    console.error('Failed to record vote:', error);
    showToast('Payment received but vote recording failed. Please contact support.');
  }
}

// ============================================================
// 13. INITIALIZATION
// ============================================================
async function initPublicPage() {
  // Only run on public page
  if (!document.getElementById('nomineesGrid')) return;

  createParticles();
  startCountdown();
  initNavbar();

  try {
    // Fetch data from API
    const [categories, nominees] = await Promise.all([
      API.getCategories(),
      API.getNominees(),
    ]);

    cachedCategories = categories;
    cachedNominees = nominees;

    renderFilterTabs();
    renderNominees();
  } catch (error) {
    console.error('Failed to load data:', error);
    // Fallback to cached/empty state
    const grid = document.getElementById('nomineesGrid');
    if (grid) {
      grid.innerHTML = `
        <div style="text-align:center;padding:40px;color:var(--text-muted);">
          <p>⚠️ Unable to connect to server</p>
          <p style="font-size:14px;">Please check your connection and try again.</p>
          <button onclick="location.reload()" class="btn-hero" style="margin-top:20px;">Retry</button>
        </div>
      `;
    }
  }
}

// ============================================================
// 14. MOBILE VIEW TOGGLE (for testing)
// ============================================================
function toggleMobileView() {
  const metaViewport = document.querySelector('meta[name="viewport"]');
  if (metaViewport) {
    const current = metaViewport.getAttribute('content');
    if (current.includes('maximum-scale=1')) {
      metaViewport.setAttribute('content', 'width=device-width, initial-scale=1');
    } else {
      metaViewport.setAttribute('content', 'width=device-width, initial-scale=1, maximum-scale=1');
    }
  }
}

// ============================================================
// RUN ON PAGE LOAD
// ============================================================
document.addEventListener('DOMContentLoaded', initPublicPage);
