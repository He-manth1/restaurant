/**
 * Ryaan's Table — frontend logic (no frameworks).
 * Features:
 * - Mobile nav toggle
 * - Scroll reveal animations via IntersectionObserver
 * - Menu category filtering tabs
 * - In-memory cart/order summary with quantity controls
 * - Reviews: load on page load, submit new review without reload
 * - Backend calls: GET /reviews, POST /reviews, POST /order
 */

// Backend base URL resolution:
// - file:// => localhost:5000
// - localhost/127.0.0.1 on any non-5000 port (e.g. 5500 Live Server) => localhost:5000
// - served by Flask on 5000 => same-origin (empty string)
// Optional override: set `window.__API_BASE__ = "http://127.0.0.1:5000"` in console.
const isLocalHost = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
const isWrongLocalPort = isLocalHost && window.location.port && window.location.port !== "5000";
let API_BASE = window.location.protocol === "file:" || isWrongLocalPort ? "http://localhost:5000" : "";
if (typeof window.__API_BASE__ === "string" && window.__API_BASE__.trim()) {
    API_BASE = window.__API_BASE__.trim().replace(/\/+$/, "");
}

const money = new Intl.NumberFormat(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtMoney = (value) => `₹ ${money.format(Number(value || 0))}`;

// ---- Mobile nav ----
const navToggle = document.getElementById("navToggle");
const navLinks = document.getElementById("navLinks");

function setNavOpen(isOpen) {
    navLinks.classList.toggle("is-open", isOpen);
    navToggle.setAttribute("aria-expanded", String(isOpen));
    navToggle.setAttribute("aria-label", isOpen ? "Close menu" : "Open menu");
}

navToggle.addEventListener("click", () => {
    const isOpen = navLinks.classList.contains("is-open");
    setNavOpen(!isOpen);
});

navLinks.addEventListener("click", (e) => {
    const a = e.target.closest("a");
    if (!a) return;
    setNavOpen(false);
});

document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") setNavOpen(false);
});

// ---- Scroll reveal ----
const revealEls = Array.from(document.querySelectorAll(".reveal"));
const io = new IntersectionObserver(
    (entries) => {
        for (const entry of entries) {
            if (entry.isIntersecting) {
                entry.target.classList.add("is-visible");
                io.unobserve(entry.target);
            }
        }
    },
    { threshold: 0.14 }
);
revealEls.forEach((el) => io.observe(el));

// ---- Menu filtering + add to order ----
const tabs = Array.from(document.querySelectorAll(".tab"));
const menuGrid = document.getElementById("menuGrid");
const dishCards = Array.from(document.querySelectorAll(".dish-card"));

function setActiveTab(category) {
    for (const t of tabs) {
        const isActive = t.dataset.category === category;
        t.classList.toggle("is-active", isActive);
        t.setAttribute("aria-selected", String(isActive));
    }
}

function filterMenu(category) {
    setActiveTab(category);
    for (const card of dishCards) {
        const cardCat = card.dataset.category;
        const show = category === "all" || cardCat === category;
        card.style.display = show ? "" : "none";
    }
}

tabs.forEach((t) => {
    t.addEventListener("click", () => filterMenu(t.dataset.category));
});

// ---- Cart / order state ----
/**
 * cart is a Map keyed by item name:
 * { name: string, price: number, qty: number }
 */
const cart = new Map();

const orderItemsEl = document.getElementById("orderItems");
const subtotalAmountEl = document.getElementById("subtotalAmount");
const clearOrderBtn = document.getElementById("clearOrderBtn");

function cartItemsArray() {
    return Array.from(cart.values()).sort((a, b) => a.name.localeCompare(b.name));
}

function calcSubtotal() {
    let total = 0;
    for (const item of cart.values()) total += item.price * item.qty;
    return total;
}

function addToCart(name, price) {
    const existing = cart.get(name);
    if (existing) {
        existing.qty += 1;
    } else {
        cart.set(name, { name, price, qty: 1 });
    }
    renderOrder();
}

function changeQty(name, delta) {
    const existing = cart.get(name);
    if (!existing) return;
    existing.qty += delta;
    if (existing.qty <= 0) cart.delete(name);
    renderOrder();
}

function removeItem(name) {
    cart.delete(name);
    renderOrder();
}

function clearCart() {
    cart.clear();
    renderOrder();
}

function renderOrder() {
    const items = cartItemsArray();
    const subtotal = calcSubtotal();

    subtotalAmountEl.textContent = fmtMoney(subtotal);

    if (items.length === 0) {
        orderItemsEl.innerHTML = `<div class="order-empty">Your order is empty. Add something delicious from the menu.</div>`;
        return;
    }

    orderItemsEl.innerHTML = items
        .map((it) => {
            const lineTotal = it.price * it.qty;
            return `
                <div class="order-item" data-order-item="${escapeHtml(it.name)}">
                    <div>
                        <div class="order-item-name">${escapeHtml(it.name)}</div>
                        <div class="order-item-meta">${fmtMoney(it.price)} each • Line: ${fmtMoney(lineTotal)}</div>
                    </div>
                    <div class="qty">
                        <button class="qty-btn" type="button" data-action="dec" aria-label="Decrease quantity">−</button>
                        <div class="qty-num" aria-label="Quantity">${it.qty}</div>
                        <button class="qty-btn" type="button" data-action="inc" aria-label="Increase quantity">+</button>
                        <button class="remove-btn" type="button" data-action="remove" aria-label="Remove item">Remove</button>
                    </div>
                </div>
            `;
        })
        .join("");
}

function escapeHtml(str) {
    return String(str)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

menuGrid.addEventListener("click", (e) => {
    const btn = e.target.closest('[data-action="add-to-order"]');
    if (!btn) return;

    const card = btn.closest(".dish-card");
    if (!card) return;

    const name = card.dataset.name;
    const price = Number(card.dataset.price);
    if (!name || !Number.isFinite(price)) return;

    addToCart(name, price);
});

orderItemsEl.addEventListener("click", (e) => {
    const row = e.target.closest("[data-order-item]");
    if (!row) return;
    const name = row.getAttribute("data-order-item");

    const actionBtn = e.target.closest("button");
    if (!actionBtn) return;
    const action = actionBtn.dataset.action;

    if (action === "inc") changeQty(name, +1);
    if (action === "dec") changeQty(name, -1);
    if (action === "remove") removeItem(name);
});

clearOrderBtn.addEventListener("click", clearCart);

// ---- Place order ----
const orderForm = document.getElementById("orderForm");
const orderNameEl = document.getElementById("orderName");
const orderPhoneEl = document.getElementById("orderPhone");
const orderStatusEl = document.getElementById("orderStatus");

function setOrderStatus(msg, kind = "info") {
    orderStatusEl.textContent = msg || "";
    orderStatusEl.style.color = kind === "error" ? "rgba(226, 90, 90, 0.95)" : "rgba(245, 240, 232, 0.78)";
}

orderForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const name = orderNameEl.value.trim();
    const phone = orderPhoneEl.value.trim();
    const items = cartItemsArray().map((it) => ({ name: it.name, price: it.price, qty: it.qty }));
    const total = calcSubtotal();

    if (!name || !phone) {
        setOrderStatus("Please enter your name and phone.", "error");
        return;
    }
    if (items.length === 0) {
        setOrderStatus("Your order is empty. Add items from the menu first.", "error");
        return;
    }

    setOrderStatus("Placing order…");

    try {
        const res = await fetch(`${API_BASE}/order`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name, phone, items, total }),
        });

        const data = await safeJson(res);
        if (!res.ok) throw new Error(data?.error || data?.message || "Failed to place order.");

        setOrderStatus(data.message || "Order placed successfully!");
        clearCart();
        orderForm.reset();
    } catch (err) {
        setOrderStatus(err.message || "Something went wrong. Please try again.", "error");
    }
});

// ---- Reviews ----
const reviewsGrid = document.getElementById("reviewsGrid");
const reviewsStatus = document.getElementById("reviewsStatus");
const reviewForm = document.getElementById("reviewForm");
const reviewName = document.getElementById("reviewName");
const reviewRating = document.getElementById("reviewRating");
const reviewComment = document.getElementById("reviewComment");
const reviewSubmitStatus = document.getElementById("reviewSubmitStatus");
const starPicker = document.getElementById("starPicker");
const starButtons = Array.from(document.querySelectorAll(".star"));

function setReviewsStatus(msg, kind = "info") {
    reviewsStatus.textContent = msg || "";
    reviewsStatus.style.color = kind === "error" ? "rgba(226, 90, 90, 0.95)" : "rgba(245, 240, 232, 0.78)";
}

function setReviewSubmitStatus(msg, kind = "info") {
    reviewSubmitStatus.textContent = msg || "";
    reviewSubmitStatus.style.color = kind === "error" ? "rgba(226, 90, 90, 0.95)" : "rgba(245, 240, 232, 0.78)";
}

function renderStars(n) {
    const clamped = Math.max(1, Math.min(5, Number(n) || 1));
    return "★".repeat(clamped) + "★".repeat(5 - clamped).replaceAll("★", "☆");
}

function renderReviewCard(r) {
    const name = r?.name || "Guest";
    const rating = Number(r?.rating || 5);
    const comment = r?.comment || "";
    const date = r?.date || r?.created_at || "";
    const dateText = date ? new Date(date).toLocaleDateString() : "";

    return `
        <article class="review-card reveal is-visible">
            <div class="review-head">
                <div class="review-name">${escapeHtml(name)}</div>
                <div class="review-date">${escapeHtml(dateText)}</div>
            </div>
            <div class="review-stars" aria-label="Rating ${rating} out of 5">${escapeHtml(renderStars(rating))}</div>
            <p class="review-comment">${escapeHtml(comment)}</p>
        </article>
    `;
}

async function resolveApiBase() {
    if (window.location.protocol === "file:") return;
    if (typeof window.__API_BASE__ === "string" && window.__API_BASE__.trim()) return;

    // If same-origin doesn't expose Flask endpoints, fall back to local Flask.
    try {
        const res = await fetch("/health", { method: "GET" });
        const data = await safeJson(res);
        if (res.ok && data?.mongo) {
            API_BASE = "";
            return;
        }
    } catch {
        // ignore
    }

    API_BASE = "http://localhost:5000";
}

async function loadReviews() {
    setReviewsStatus("Loading reviews…");
    try {
        const res = await fetch(`${API_BASE}/reviews`);
        const data = await safeJson(res);
        if (!res.ok) throw new Error(data?.error || "Failed to load reviews.");

        const reviews = Array.isArray(data?.reviews) ? data.reviews : [];
        if (reviews.length === 0) {
            reviewsGrid.innerHTML = `<div class="order-empty">No reviews yet. Be the first to leave one.</div>`;
            setReviewsStatus("");
            return;
        }

        reviewsGrid.innerHTML = reviews.map(renderReviewCard).join("");
        setReviewsStatus("");
    } catch (err) {
        setReviewsStatus(err.message || "Could not load reviews.", "error");
    }
}

function setStarUI(value) {
    const v = Math.max(1, Math.min(5, Number(value) || 5));
    reviewRating.value = String(v);
    for (const btn of starButtons) {
        const r = Number(btn.dataset.rating);
        btn.classList.toggle("is-on", r <= v);
        btn.setAttribute("aria-checked", String(r === v));
    }
}

starPicker.addEventListener("click", (e) => {
    const btn = e.target.closest(".star");
    if (!btn) return;
    setStarUI(btn.dataset.rating);
});

reviewForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const name = reviewName.value.trim();
    const rating = Number(reviewRating.value);
    const comment = reviewComment.value.trim();

    if (!name || !comment) {
        setReviewSubmitStatus("Please enter your name and a comment.", "error");
        return;
    }
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
        setReviewSubmitStatus("Rating must be between 1 and 5.", "error");
        return;
    }

    setReviewSubmitStatus("Submitting…");

    try {
        const res = await fetch(`${API_BASE}/reviews`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name, rating, comment }),
        });

        const data = await safeJson(res);
        if (!res.ok) throw new Error(data?.error || data?.message || "Failed to submit review.");

        const review = data?.review || { name, rating, comment, created_at: new Date().toISOString() };
        reviewsGrid.insertAdjacentHTML("afterbegin", renderReviewCard(review));

        setReviewSubmitStatus("Review submitted!");
        reviewForm.reset();
        setStarUI(5);

        // If the list previously had the "empty" placeholder, remove it.
        const empty = reviewsGrid.querySelector(".order-empty");
        if (empty) empty.remove();
    } catch (err) {
        setReviewSubmitStatus(err.message || "Could not submit review.", "error");
    }
});

async function safeJson(res) {
    try {
        return await res.json();
    } catch {
        return null;
    }
}

// ---- Init ----
document.getElementById("year").textContent = String(new Date().getFullYear());
setStarUI(5);
filterMenu("starters");
renderOrder();
resolveApiBase().finally(loadReviews);