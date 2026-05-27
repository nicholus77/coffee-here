const API_BASE = (() => {
    const { protocol, hostname, port } = window.location;
    const isLocalStaticPage = protocol === 'file:' ||
        (['localhost', '127.0.0.1'].includes(hostname) && port && port !== '3030');

    return isLocalStaticPage ? 'http://localhost:3030' : '';
})();

function escapeHTML(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    }[char]));
}

// === CURSOR GLOW ===
const cursorGlow = document.getElementById('cursorGlow');
document.addEventListener('mousemove', (e) => {
    cursorGlow.style.left = e.clientX + 'px';
    cursorGlow.style.top = e.clientY + 'px';
});

// === PARTICLES ===
const particlesEl = document.getElementById('particles');
function createParticles() {
    for (let i = 0; i < 30; i++) {
        const p = document.createElement('div');
        p.classList.add('particle');
        p.style.left = Math.random() * 100 + '%';
        p.style.animationDelay = Math.random() * 6 + 's';
        p.style.animationDuration = (4 + Math.random() * 4) + 's';
        const colors = ['#c084fc', '#f472b6', '#fb923c', '#34d399'];
        p.style.background = colors[Math.floor(Math.random() * colors.length)];
        p.style.width = (2 + Math.random() * 3) + 'px';
        p.style.height = p.style.width;
        particlesEl.appendChild(p);
    }
}
createParticles();

// === NAVBAR SCROLL ===
const navbar = document.getElementById('navbar');
window.addEventListener('scroll', () => {
    navbar.classList.toggle('scrolled', window.scrollY > 50);
});

// === HAMBURGER ===
const hamburger = document.getElementById('hamburger');
const navLinks = document.getElementById('navLinks');
hamburger.addEventListener('click', () => {
    navLinks.classList.toggle('open');
    hamburger.classList.toggle('active');
});

// === NAV LINKS ACTIVE STATE ===
const navLinkEls = document.querySelectorAll('.nav-link');
navLinkEls.forEach(link => {
    link.addEventListener('click', () => {
        navLinkEls.forEach(l => l.classList.remove('active'));
        link.classList.add('active');
        navLinks.classList.remove('open');
        hamburger.classList.remove('active');
    });
});

// === STAT COUNTER ANIMATION ===
function animateCounters() {
    const stats = document.querySelectorAll('.stat-number');
    stats.forEach(stat => {
        const target = parseFloat(stat.getAttribute('data-target'));
        const isDecimal = target % 1 !== 0;
        const duration = 2000;
        const start = performance.now();
        function update(now) {
            const elapsed = now - start;
            const progress = Math.min(elapsed / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            const current = target * eased;
            stat.textContent = isDecimal ? current.toFixed(1) : Math.floor(current);
            if (progress < 1) requestAnimationFrame(update);
        }
        requestAnimationFrame(update);
    });
}

// === SCROLL REVEAL ===
function setupRevealObserver() {
    const revealElements = document.querySelectorAll(
        '.menu-card, .review-card, .vibe-feature, .gallery-card, .contact-item, .section-header, .vibes-content, .contact-form-wrapper, .cta-content'
    );
    revealElements.forEach(el => el.classList.add('reveal'));

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
            }
        });
    }, { threshold: 0.1, rootMargin: '0px 0px -50px 0px' });

    revealElements.forEach(el => observer.observe(el));
}

// Counter observer
let countersAnimated = false;
const heroStats = document.querySelector('.hero-stats');
if (heroStats) {
    const heroObs = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting && !countersAnimated) {
            animateCounters();
            countersAnimated = true;
        }
    }, { threshold: 0.5 });
    heroObs.observe(heroStats);
}

// ================================
// DATABASE-DRIVEN: LOAD MENU
// ================================
const menuGrid = document.querySelector('.menu-grid');
let cart = [];
let orderCustomer = { name: '', email: '' };

async function loadMenu(category = 'all') {
    try {
        const res = await fetch(`${API_BASE}/api/menu?category=${category}`);
        const { data } = await res.json();
        renderMenuCards(data);
    } catch (err) {
        console.error('Failed to load menu:', err);
    }
}

// Delegated click handler for ALL menu card buttons (static + dynamic)
document.addEventListener('click', function (e) {
  const btn = e.target.closest('.menu-card-btn');
  if (!btn) return;
  const id = parseInt(btn.dataset.id);
  const name = btn.dataset.name;
  const price = parseFloat(btn.dataset.price);
  if (!id) return;
  addToCart(id, name, price);
  const original = btn.textContent;
  btn.textContent = 'Added! ✅';
  btn.style.background = 'linear-gradient(135deg, #34d399, #60a5fa)';
  btn.style.borderColor = 'transparent';
  setTimeout(() => {
    btn.textContent = original;
    btn.style.background = '';
    btn.style.borderColor = '';
  }, 1500);
});

function renderMenuCards(items) {
    menuGrid.innerHTML = items.map((item, i) => `
        <div class="menu-card reveal visible" data-category="${item.category}" style="animation-delay: ${i * 0.1}s">
            <div class="menu-card-image">
                <img src="${item.image || 'images/hero.png'}" alt="${item.name}">
                ${item.badge ? `<div class="menu-card-badge">${item.badge}</div>` : ''}
            </div>
            <div class="menu-card-content">
                <div class="menu-card-header">
                    <h3>${item.name}</h3>
                    <span class="menu-price">$${item.price.toFixed(2)}</span>
                </div>
                <p class="menu-card-desc">${item.description}</p>
                <div class="menu-card-tags">
                    ${(item.tags || []).map(t => `<span class="tag">${t}</span>`).join('')}
                </div>
                <button class="menu-card-btn" data-id="${item.id}" data-name="${item.name}" data-price="${item.price}">Add to Order +</button>
            </div>
        </div>
    `).join('');

}

// === CART ===
function addToCart(id, name, price) {
    const existing = cart.find(item => item.menu_item_id === id);
    if (existing) {
        existing.quantity++;
    } else {
        cart.push({ menu_item_id: id, name, price, quantity: 1, size: 'medium', milk_option: 'regular' });
    }
    updateCartBadge();
}

function updateCartBadge() {
    const total = cart.reduce((sum, item) => sum + item.quantity, 0);
    const orderBtn = document.getElementById('orderBtn');
    orderBtn.textContent = total > 0 ? `Order (${total}) ✨` : 'Order Now ✨';
}

function renderCart() {
    const modalBody = document.getElementById('modalBody');
    if (cart.length === 0) {
        modalBody.innerHTML = `
            <div class="order-empty">
                <span class="order-empty-icon">🫗</span>
                <p>Your cup is empty!<br>Add something from the menu to get started.</p>
                <button class="btn btn-glass" id="goToMenuEmpty">Browse Menu ✨</button>
            </div>`;
        document.getElementById('goToMenuEmpty').addEventListener('click', () => {
            orderModal.classList.remove('active');
            document.getElementById('menu').scrollIntoView({ behavior: 'smooth' });
        });
        return;
    }

    const total = cart.reduce((sum, item) => {
        const mult = item.size === 'small' ? 0.8 : item.size === 'large' ? 1.3 : 1.0;
        return sum + item.price * mult * item.quantity;
    }, 0);

    modalBody.innerHTML = `
        <div class="cart-items">
            ${cart.map((item, i) => {
                const mult = item.size === 'small' ? 0.8 : item.size === 'large' ? 1.3 : 1.0;
                const itemPrice = item.price * mult;
                return `
                    <div class="cart-item" style="padding:12px 0;border-bottom:1px solid rgba(255,255,255,0.06);">
                        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px;">
                            <div>
                                <strong style="font-size:0.95rem;">${item.name}</strong>
                                <div style="font-size:0.78rem;color:#8b8b9e;margin-top:2px;">$${itemPrice.toFixed(2)} each</div>
                            </div>
                            <div style="display:flex;align-items:center;gap:12px;">
                                <button onclick="updateQty(${i},-1)" style="background:rgba(255,255,255,0.06);border:none;color:#f0f0f5;width:28px;height:28px;border-radius:50%;cursor:pointer;font-size:1rem;display:flex;align-items:center;justify-content:center;">−</button>
                                <span style="font-weight:600;min-width:20px;text-align:center;">${item.quantity}</span>
                                <button onclick="updateQty(${i},1)" style="background:rgba(255,255,255,0.06);border:none;color:#f0f0f5;width:28px;height:28px;border-radius:50%;cursor:pointer;font-size:1rem;display:flex;align-items:center;justify-content:center;">+</button>
                            </div>
                        </div>
                        <div class="order-options">
                            <div class="order-field">
                                <label class="order-label">Size</label>
                                <select class="order-select" onchange="updateSize(${i}, this.value)">
                                    <option value="small" ${item.size === 'small' ? 'selected' : ''}>Small (-20%)</option>
                                    <option value="medium" ${item.size === 'medium' ? 'selected' : ''}>Medium</option>
                                    <option value="large" ${item.size === 'large' ? 'selected' : ''}>Large (+30%)</option>
                                </select>
                            </div>
                            <div class="order-field">
                                <label class="order-label">Milk</label>
                                <select class="order-select" onchange="updateMilk(${i}, this.value)">
                                    <option value="regular" ${item.milk_option === 'regular' ? 'selected' : ''}>Regular</option>
                                    <option value="oat" ${item.milk_option === 'oat' ? 'selected' : ''}>Oat Milk</option>
                                    <option value="almond" ${item.milk_option === 'almond' ? 'selected' : ''}>Almond Milk</option>
                                </select>
                            </div>
                        </div>
                    </div>
                `;
            }).join('')}
        </div>
        <div style="margin-top:20px;padding-top:16px;border-top:1px solid rgba(255,255,255,0.1);display:flex;justify-content:space-between;align-items:center;">
            <span style="font-size:0.9rem;color:#8b8b9e;">Total</span>
            <span style="font-size:1.3rem;font-weight:700;background:linear-gradient(135deg,#c084fc,#f472b6);-webkit-background-clip:text;-webkit-text-fill-color:transparent;">$${total.toFixed(2)}</span>
        </div>
        <div style="margin-top:12px;">
            <input type="text" id="orderName" placeholder="Your name" value="${escapeHTML(orderCustomer.name)}" style="width:100%;padding:12px 16px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:10px;color:#f0f0f5;font-family:'Inter',sans-serif;font-size:0.9rem;margin-bottom:8px;">
            <input type="email" id="orderEmail" placeholder="Email (optional)" value="${escapeHTML(orderCustomer.email)}" style="width:100%;padding:12px 16px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:10px;color:#f0f0f5;font-family:'Inter',sans-serif;font-size:0.9rem;">
        </div>
        <button class="btn btn-primary btn-full" style="margin-top:16px;" id="placeOrderBtn">Place Order 🚀</button>
    `;

    document.getElementById('orderName').addEventListener('input', captureOrderCustomer);
    document.getElementById('orderEmail').addEventListener('input', captureOrderCustomer);
    document.getElementById('placeOrderBtn').addEventListener('click', placeOrder);
}

function captureOrderCustomer() {
    const nameInput = document.getElementById('orderName');
    const emailInput = document.getElementById('orderEmail');
    if (nameInput) orderCustomer.name = nameInput.value;
    if (emailInput) orderCustomer.email = emailInput.value;
}

window.updateQty = function (index, delta) {
    captureOrderCustomer();
    cart[index].quantity += delta;
    if (cart[index].quantity <= 0) cart.splice(index, 1);
    if (cart[index] && cart[index].quantity > 20) cart[index].quantity = 20;
    updateCartBadge();
    renderCart();
};

window.updateSize = function (index, size) {
    captureOrderCustomer();
    cart[index].size = size;
    renderCart();
};

window.updateMilk = function (index, milk) {
    captureOrderCustomer();
    cart[index].milk_option = milk;
    renderCart();
};

async function placeOrder() {
    captureOrderCustomer();
    const name = orderCustomer.name.trim() || 'Guest';
    const email = orderCustomer.email.trim();
    const btn = document.getElementById('placeOrderBtn');
    btn.textContent = 'Placing... ⏳';
    btn.disabled = true;

    try {
        const res = await fetch(`${API_BASE}/api/orders`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                customer_name: name,
                customer_email: email,
                items: cart.map(item => ({
                    menu_item_id: item.menu_item_id,
                    quantity: item.quantity,
                    size: item.size,
                    milk_option: item.milk_option
                }))
            })
        });
        const data = await res.json();
        if (data.success) {
            document.getElementById('modalBody').innerHTML = `
                <div style="text-align:center;padding:40px 0;">
                    <div style="font-size:3rem;margin-bottom:16px;">🎉</div>
                    <h3 style="margin-bottom:8px;">Order Placed!</h3>
                    <p style="color:#8b8b9e;font-size:0.9rem;">Order #${data.data.orderId} · Total: $${data.data.total.toFixed(2)}</p>
                    <p style="color:#8b8b9e;font-size:0.82rem;margin-top:12px;">We'll have your drip ready soon ☕✨</p>
                </div>`;
            cart = [];
            orderCustomer = { name: '', email: '' };
            updateCartBadge();
        } else {
            btn.textContent = data.error || 'Error — Try Again';
            setTimeout(() => {
                btn.textContent = 'Place Order 🚀';
                btn.disabled = false;
            }, 2500);
        }
    } catch (err) {
        btn.textContent = 'Error — Try Again';
        btn.disabled = false;
        console.error(err);
    }
}

// ================================
// DATABASE-DRIVEN: LOAD REVIEWS
// ================================
async function loadReviews() {
    try {
        const res = await fetch(`${API_BASE}/api/reviews`);
        const { data } = await res.json();
        const grid = document.querySelector('.reviews-grid');
        grid.innerHTML = data.map(review => `
            <div class="review-card ${review.is_featured ? 'featured' : ''} reveal visible">
                <div class="review-stars">${'⭐'.repeat(review.rating)}</div>
                <p class="review-text">"${review.text}"</p>
                <div class="review-author">
                    <div class="review-avatar" style="background: ${review.avatar_color};">${review.author_name.charAt(0)}</div>
                    <div>
                        <span class="review-name">${review.author_name}</span>
                        <span class="review-handle">${review.author_handle}</span>
                    </div>
                </div>
            </div>
        `).join('');
    } catch (err) {
        console.error('Failed to load reviews:', err);
    }
}

// ================================
// DATABASE-DRIVEN: CONTACT FORM
// ================================
const contactForm = document.getElementById('contactForm');
contactForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = contactForm.querySelector('button[type="submit"]');
    const original = btn.textContent;
    btn.textContent = 'Sending... ⏳';
    btn.disabled = true;

    try {
        const res = await fetch(`${API_BASE}/api/contact`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: document.getElementById('nameInput').value,
                email: document.getElementById('emailInput').value,
                message: document.getElementById('messageInput').value
            })
        });
        const data = await res.json();
        if (data.success) {
            btn.textContent = 'Sent! 💌';
            btn.style.background = 'linear-gradient(135deg, #34d399, #60a5fa)';
            contactForm.reset();
            setTimeout(() => {
                btn.textContent = original;
                btn.style.background = '';
                btn.disabled = false;
            }, 2500);
        } else {
            btn.textContent = data.error || 'Error — Try Again';
            setTimeout(() => {
                btn.textContent = original;
                btn.disabled = false;
            }, 2500);
        }
    } catch (err) {
        btn.textContent = 'Error — Try Again';
        setTimeout(() => { btn.textContent = original; btn.disabled = false; }, 2550);
    }
});

// === MENU FILTER ===
const filterBtns = document.querySelectorAll('.filter-btn');
filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        filterBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const filter = btn.getAttribute('data-filter');
        loadMenu(filter);
    });
});

// === ORDER MODAL ===
const orderBtn = document.getElementById('orderBtn');
const orderModal = document.getElementById('orderModal');
const modalClose = document.getElementById('modalClose');
const goToMenu = document.getElementById('goToMenu');

orderBtn.addEventListener('click', () => { renderCart(); orderModal.classList.add('active'); });
modalClose.addEventListener('click', () => orderModal.classList.remove('active'));
orderModal.addEventListener('click', (e) => { if (e.target === orderModal) orderModal.classList.remove('active'); });
if (goToMenu) goToMenu.addEventListener('click', () => {
    orderModal.classList.remove('active');
    document.getElementById('menu').scrollIntoView({ behavior: 'smooth' });
});

// === SMOOTH NAV HIGHLIGHTING ON SCROLL ===
const sections = document.querySelectorAll('section[id]');
window.addEventListener('scroll', () => {
    let current = '';
    sections.forEach(section => {
        const top = section.offsetTop - 200;
        if (window.scrollY >= top) current = section.getAttribute('id');
    });
    navLinkEls.forEach(link => {
        link.classList.remove('active');
        if (link.getAttribute('href') === '#' + current) link.classList.add('active');
    });
});

// ================================
// DATABASE-DRIVEN: STATS
// ================================
async function loadStats() {
    try {
        const res = await fetch(`${API_BASE}/api/stats`);
        const { data } = await res.json();
        const stats = document.querySelectorAll('.stat-number');
        if (stats.length >= 3) {
            // First stat: Happy Sippers (divide by 1000 for K+ format e.g. 15.0 or 15)
            const happySippersK = data.happySippers / 1000;
            stats[0].setAttribute('data-target', happySippersK.toFixed(happySippersK % 1 === 0 ? 0 : 1));
            // Second stat: Drink Options
            stats[1].setAttribute('data-target', data.totalMenu);
            // Third stat: Rating
            stats[2].setAttribute('data-target', data.avgRating.toFixed(1));
        }
    } catch (err) {
        console.error('Failed to load stats:', err);
    }
}

// === WIRE OTHER CTA BUTTONS ===
const ctaOrderBtn = document.getElementById('ctaOrderBtn');
if (ctaOrderBtn) {
    ctaOrderBtn.addEventListener('click', () => {
        renderCart();
        orderModal.classList.add('active');
    });
}

// ================================
// INITIALIZE — Load from DB
// ================================
// ================================
// ADMIN PANEL
// ================================
let adminToken = localStorage.getItem('adminToken') || null;

const adminLoginBtn = document.getElementById('adminLoginBtn');
const adminNavBtn = document.getElementById('adminNavBtn');
const adminLoginModal = document.getElementById('adminLoginModal');
const adminLoginClose = document.getElementById('adminLoginClose');
const adminLoginSubmit = document.getElementById('adminLoginSubmit');
const adminPasswordInput = document.getElementById('adminPasswordInput');
const adminLoginError = document.getElementById('adminLoginError');
const adminPanel = document.getElementById('adminPanel');
const adminLogoutBtn = document.getElementById('adminLogoutBtn');

async function checkAdminSession() {
    if (!adminToken) return false;
    try {
        const res = await fetch(`${API_BASE}/api/admin/verify`, {
            headers: { 'Authorization': `Bearer ${adminToken}` }
        });
        if (res.ok) return true;
    } catch (e) {}
    adminToken = null;
    localStorage.removeItem('adminToken');
    return false;
}

async function adminLogin(password) {
    try {
        const res = await fetch(`${API_BASE}/api/admin/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password })
        });
        const data = await res.json();
        if (data.success) {
            adminToken = data.token;
            localStorage.setItem('adminToken', adminToken);
            adminLoginModal.classList.remove('active');
            adminLoginError.style.display = 'none';
            await showAdminPanel();
        } else {
            adminLoginError.textContent = data.error || 'Incorrect password';
            adminLoginError.style.display = 'block';
        }
    } catch (e) {
        adminLoginError.textContent = 'Connection error';
        adminLoginError.style.display = 'block';
    }
}

function adminLogout() {
    adminToken = null;
    localStorage.removeItem('adminToken');
    adminPanel.style.display = 'none';
}

if (adminLoginBtn) {
    adminLoginBtn.addEventListener('click', async () => {
        if (await checkAdminSession()) {
            await showAdminPanel();
        } else {
            adminLoginModal.classList.add('active');
            adminPasswordInput.value = '';
            adminLoginError.style.display = 'none';
        }
    });
}
if (adminNavBtn) {
    adminNavBtn.addEventListener('click', async () => {
        if (await checkAdminSession()) {
            await showAdminPanel();
        } else {
            adminLoginModal.classList.add('active');
            adminPasswordInput.value = '';
            adminLoginError.style.display = 'none';
        }
    });
}
if (adminLoginClose) adminLoginClose.addEventListener('click', () => adminLoginModal.classList.remove('active'));
if (adminLoginModal) adminLoginModal.addEventListener('click', (e) => {
    if (e.target === adminLoginModal) adminLoginModal.classList.remove('active');
});
if (adminLoginSubmit) adminLoginSubmit.addEventListener('click', () => adminLogin(adminPasswordInput.value));
if (adminPasswordInput) adminPasswordInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') adminLogin(adminPasswordInput.value);
});
if (adminLogoutBtn) adminLogoutBtn.addEventListener('click', adminLogout);

// Tab switching
document.querySelectorAll('.admin-tab').forEach(tab => {
    tab.addEventListener('click', () => {
        document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.admin-tab-content').forEach(c => c.classList.remove('active'));
        tab.classList.add('active');
        const target = document.getElementById(tab.dataset.target);
        if (target) target.classList.add('active');
    });
});

async function showAdminPanel() {
    adminPanel.style.display = 'block';
    adminPanel.scrollIntoView({ behavior: 'smooth' });
    await Promise.all([
        loadAdminOrders(),
        loadAdminMenu(),
        loadAdminReviews(),
        loadAdminMessages()
    ]);
}

// === Admin: Orders ===
async function loadAdminOrders() {
    try {
        const res = await fetch(`${API_BASE}/api/orders`, {
            headers: { 'Authorization': `Bearer ${adminToken}` }
        });
        if (!res.ok) throw new Error('Unable to load orders');
        const { data } = await res.json();
        const tbody = document.getElementById('adminOrdersBody');
        document.getElementById('orderCount').textContent = `${data.length} orders`;
        tbody.innerHTML = data.map(order => `
            <tr>
                <td>#${order.id}</td>
                <td>${escapeHTML(order.customer_name || 'Guest')}<br><small style="color:#5a5a6e;">${escapeHTML(order.customer_email || '')}</small></td>
                <td>
                    <div class="admin-items-summary">${escapeHTML(order.items_summary || 'No items')}</div>
                    <button class="btn-glass" style="font-size:0.72rem;padding:4px 10px;margin-top:8px;" onclick="viewAdminOrder(${order.id})">View</button>
                </td>
                <td>$${order.total.toFixed(2)}</td>
                <td><span class="admin-status status-${escapeHTML(order.status)}">${escapeHTML(order.status)}</span></td>
                <td><small style="color:#5a5a6e;">${new Date(order.created_at).toLocaleDateString()}</small></td>
                <td>
                    <select onchange="updateOrderStatus(${order.id}, this.value)" class="admin-status-select">
                        <option value="pending" ${order.status === 'pending' ? 'selected' : ''}>Pending</option>
                        <option value="preparing" ${order.status === 'preparing' ? 'selected' : ''}>Preparing</option>
                        <option value="ready" ${order.status === 'ready' ? 'selected' : ''}>Ready</option>
                        <option value="completed" ${order.status === 'completed' ? 'selected' : ''}>Completed</option>
                        <option value="cancelled" ${order.status === 'cancelled' ? 'selected' : ''}>Cancelled</option>
                    </select>
                </td>
            </tr>
        `).join('');
    } catch (e) { console.error('Failed to load orders:', e); }
}

window.viewAdminOrder = async function (id) {
    const detail = document.getElementById('adminOrderDetail');
    detail.style.display = 'block';
    detail.innerHTML = '<p>Loading order...</p>';

    try {
        const res = await fetch(`${API_BASE}/api/orders/${id}`, {
            headers: { 'Authorization': `Bearer ${adminToken}` }
        });
        if (!res.ok) throw new Error('Unable to load order');
        const { data } = await res.json();
        detail.innerHTML = `
            <div class="admin-order-detail-header">
                <div>
                    <h3>Order #${data.id}</h3>
                    <p>${escapeHTML(data.customer_name || 'Guest')} ${data.customer_email ? `- ${escapeHTML(data.customer_email)}` : ''}</p>
                    <p>${new Date(data.created_at).toLocaleString()} - ${escapeHTML(data.status)}</p>
                </div>
                <button class="btn-glass" style="font-size:0.75rem;padding:6px 12px;" onclick="document.getElementById('adminOrderDetail').style.display='none'">Close</button>
            </div>
            <div class="admin-order-items">
                ${data.items.map(item => `
                    <div class="admin-order-line">
                        <span>${item.quantity}x ${escapeHTML(item.name)} (${escapeHTML(item.size)}, ${escapeHTML(item.milk_option)})</span>
                        <span>$${Number(item.line_total).toFixed(2)}</span>
                    </div>
                `).join('')}
            </div>
            <div class="admin-order-line">
                <strong>Total</strong>
                <span>$${Number(data.total).toFixed(2)}</span>
            </div>
        `;
    } catch (e) {
        detail.innerHTML = '<p>Could not load this order.</p>';
        console.error(e);
    }
};

window.updateOrderStatus = async function (id, status) {
    try {
        await fetch(`${API_BASE}/api/orders/${id}/status`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
            body: JSON.stringify({ status })
        });
        loadAdminOrders();
    } catch (e) { console.error(e); }
};

// === Admin: Menu Items ===
let editingMenuId = null;

async function loadAdminMenu() {
    try {
        const res = await fetch(`${API_BASE}/api/menu?category=all`);
        const { data } = await res.json();
        const tbody = document.getElementById('adminMenuBody');
        document.getElementById('menuCount').textContent = `${data.length} items`;
        tbody.innerHTML = data.map(item => `
            <tr>
                <td>${item.id}</td>
                <td>${item.name}</td>
                <td>$${item.price.toFixed(2)}</td>
                <td>${item.category}</td>
                <td>${item.is_available ? '✅' : '❌'}</td>
                <td>
                    <button class="btn-glass" style="font-size:0.75rem;padding:4px 12px;" onclick="deleteMenuItem(${item.id})">Delete 🗑️</button>
                </td>
            </tr>
        `).join('');
    } catch (e) { console.error(e); }
}

window.deleteMenuItem = async function (id) {
    if (!confirm('Delete this menu item?')) return;
    try {
        await fetch(`${API_BASE}/api/menu/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${adminToken}` }
        });
        loadAdminMenu();
        loadMenu();
    } catch (e) { console.error(e); }
};

document.getElementById('adminAddMenuItemBtn').addEventListener('click', () => {
    editingMenuId = null;
    document.getElementById('adminMenuFormTitle').textContent = 'Add Menu Item';
    document.getElementById('menuFormName').value = '';
    document.getElementById('menuFormPrice').value = '';
    document.getElementById('menuFormCategory').value = 'hot';
    document.getElementById('menuFormImage').value = '';
    document.getElementById('menuFormDesc').value = '';
    document.getElementById('adminMenuForm').style.display = 'block';
});

document.getElementById('menuFormCancel').addEventListener('click', () => {
    document.getElementById('adminMenuForm').style.display = 'none';
});

document.getElementById('menuFormSave').addEventListener('click', async () => {
    const name = document.getElementById('menuFormName').value;
    const price = parseFloat(document.getElementById('menuFormPrice').value);
    const category = document.getElementById('menuFormCategory').value;
    const image = document.getElementById('menuFormImage').value || null;
    const description = document.getElementById('menuFormDesc').value;
    if (!name || !price) return alert('Name and price required');
    try {
        await fetch(`${API_BASE}/api/menu`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
            body: JSON.stringify({ name, description, price, category, image, tags: [] })
        });
        document.getElementById('adminMenuForm').style.display = 'none';
        loadAdminMenu();
        loadMenu();
    } catch (e) { console.error(e); }
});

// === Admin: Reviews ===
async function loadAdminReviews() {
    try {
        const res = await fetch(`${API_BASE}/api/reviews/admin`, {
            headers: { 'Authorization': `Bearer ${adminToken}` }
        });
        const { data } = await res.json();
        const tbody = document.getElementById('adminReviewsBody');
        document.getElementById('reviewCount').textContent = `${data.length} reviews`;
        tbody.innerHTML = data.map(review => `
            <tr>
                <td>${review.id}</td>
                <td>${review.author_name}</td>
                <td>${'⭐'.repeat(review.rating)}</td>
                <td><small>${review.text.substring(0, 60)}${review.text.length > 60 ? '...' : ''}</small></td>
                <td>${review.is_approved ? '✅' : `<button class="btn-glass" style="font-size:0.75rem;padding:2px 10px;" onclick="approveReview(${review.id})">Approve</button>`}</td>
                <td>${review.is_featured ? '⭐' : `<button class="btn-glass" style="font-size:0.75rem;padding:2px 10px;" onclick="featureReview(${review.id}, true)">Feature</button>`}</td>
                <td><button class="btn-glass" style="font-size:0.75rem;padding:2px 10px;" onclick="deleteReview(${review.id})">Delete 🗑️</button></td>
            </tr>
        `).join('');
    } catch (e) { console.error(e); }
}

window.approveReview = async function (id) {
    try {
        await fetch(`${API_BASE}/api/reviews/${id}/approve`, {
            method: 'PATCH',
            headers: { 'Authorization': `Bearer ${adminToken}` }
        });
        loadAdminReviews();
        loadReviews();
    } catch (e) { console.error(e); }
};

window.featureReview = async function (id, val) {
    try {
        await fetch(`${API_BASE}/api/reviews/${id}/feature`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
            body: JSON.stringify({ is_featured: val })
        });
        loadAdminReviews();
        loadReviews();
    } catch (e) { console.error(e); }
};

window.deleteReview = async function (id) {
    if (!confirm('Delete this review?')) return;
    try {
        await fetch(`${API_BASE}/api/reviews/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${adminToken}` }
        });
        loadAdminReviews();
        loadReviews();
    } catch (e) { console.error(e); }
};

// === Admin: Messages ===
async function loadAdminMessages() {
    try {
        const res = await fetch(`${API_BASE}/api/contact`, {
            headers: { 'Authorization': `Bearer ${adminToken}` }
        });
        const { data } = await res.json();
        const tbody = document.getElementById('adminMessagesBody');
        document.getElementById('messageCount').textContent = `${data.length} messages`;
        tbody.innerHTML = data.map(msg => `
            <tr>
                <td>${msg.id}</td>
                <td>${msg.name}</td>
                <td><a href="mailto:${msg.email}" style="color:#c084fc;">${msg.email}</a></td>
                <td><small>${msg.message.substring(0, 80)}${msg.message.length > 80 ? '...' : ''}</small></td>
                <td><small style="color:#5a5a6e;">${new Date(msg.created_at).toLocaleDateString()}</small></td>
            </tr>
        `).join('');
    } catch (e) { console.error(e); }
}

// === INIT ===
async function init() {
    await loadStats();
    await loadMenu();
    await loadReviews();
    setupRevealObserver();
    // Auto-show admin if session valid
    if (await checkAdminSession()) {
        await showAdminPanel();
    }
}
init();
