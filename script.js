/* ==========================================================================
   SUPPER SHOP — USER PANEL — SCRIPT.JS
   Firebase init, auth, routing, realtime data, all feature logic.
   ========================================================================== */

import { FIREBASE_CONFIG, COLLECTIONS, APP_SETTINGS, FEATURE_FLAGS, STATUS, SDK_CONFIG } from "./config.js";

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword,
  signOut, sendPasswordResetEmail, updateProfile, updatePassword, EmailAuthProvider,
  reauthenticateWithCredential
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore, doc, getDoc, setDoc, addDoc, updateDoc, collection, query, where,
  orderBy, limit, onSnapshot, serverTimestamp, increment, runTransaction, deleteDoc, getDocs
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

/* -----------------------------------------------------------------------
   FIREBASE INIT
   ----------------------------------------------------------------------- */
const app = initializeApp(FIREBASE_CONFIG);
const auth = getAuth(app);
const db = getFirestore(app);

/* -----------------------------------------------------------------------
   GLOBAL STATE
   ----------------------------------------------------------------------- */
const state = {
  user: null,          // firebase auth user
  profile: null,       // users/{uid} doc
  wallet: { balance: 0 },
  games: [],
  categories: [],
  coupons: [],
  vipTiers: [],
  rewards: [],
  reviews: {},          // gameId -> [reviews]
  wishlist: [],
  notifications: [],
  currentRoute: "dashboard",
  currentGameId: null,
  selectedPackage: null,
  liveListeners: []     // unsub functions to clear on logout
};

/* -----------------------------------------------------------------------
   UTILITIES
   ----------------------------------------------------------------------- */
function $(sel, root = document) { return root.querySelector(sel); }
function $all(sel, root = document) { return [...root.querySelectorAll(sel)]; }
function money(n) { return `${APP_SETTINGS.currencySymbol}${Number(n || 0).toLocaleString()}`; }
function esc(str) {
  const d = document.createElement("div");
  d.textContent = str ?? "";
  return d.innerHTML;
}
function timeAgo(ts) {
  if (!ts) return "";
  const date = ts.toDate ? ts.toDate() : new Date(ts);
  const secs = Math.floor((Date.now() - date.getTime()) / 1000);
  if (secs < 60) return "just now";
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
  return date.toLocaleDateString();
}

function toast(message, type = "info") {
  const root = $("#toast-root");
  const el = document.createElement("div");
  el.className = `toast ${type}`;
  el.textContent = message;
  root.appendChild(el);
  setTimeout(() => el.remove(), APP_SETTINGS.toastDurationMs);
}

function skeletonHTML(rows = APP_SETTINGS.skeletonRows) {
  return Array.from({ length: rows }).map(() => `<div class="skeleton-row"></div>`).join("");
}
function emptyStateHTML(msg) {
  return `<div class="empty-state">${esc(msg)}</div>`;
}

function openModal(id) { $(`#${id}`).classList.add("open"); }
function closeModal(id) { $(`#${id}`).classList.remove("open"); }

$all("[data-close]").forEach(btn => {
  btn.addEventListener("click", () => closeModal(btn.dataset.close));
});
$all(".modal-overlay").forEach(overlay => {
  overlay.addEventListener("click", e => { if (e.target === overlay) overlay.classList.remove("open"); });
});

function requireAuth(actionLabel = "continue") {
  if (!state.user) {
    toast(`Please login to ${actionLabel}.`, "info");
    openModal("authModal");
    return false;
  }
  return true;
}

/* -----------------------------------------------------------------------
   ROUTER
   ----------------------------------------------------------------------- */
const ROUTES = ["dashboard", "games", "game", "wallet", "orders", "profile", "referral", "vip", "rewards", "support", "faq", "contact", "wishlist"];

function navigate(hash) {
  if (!hash) hash = "#/dashboard";
  window.location.hash = hash;
}

function parseRoute() {
  const raw = window.location.hash.replace("#/", "") || "dashboard";
  const [route, param] = raw.split("/");
  return { route: ROUTES.includes(route) ? route : "dashboard", param };
}

async function renderRoute() {
  const { route, param } = parseRoute();
  state.currentRoute = route;
  $all(".nav-links a, .mobile-drawer a").forEach(a => {
    a.classList.toggle("active", a.dataset.route === route);
  });
  closeDrawer();

  const root = $("#app-root");

  switch (route) {
    case "dashboard": root.innerHTML = ""; root.appendChild(clone("tpl-dashboard")); initDashboard(); break;
    case "games": root.innerHTML = ""; root.appendChild(clone("tpl-games")); initGamesPage(); break;
    case "game": root.innerHTML = ""; root.appendChild(clone("tpl-game-detail")); initGameDetail(param); break;
    case "wallet":
      if (!requireAuth("view your wallet")) { navigate("#/dashboard"); return; }
      root.innerHTML = ""; root.appendChild(clone("tpl-wallet")); initWalletPage(); break;
    case "orders":
      if (!requireAuth("view your orders")) { navigate("#/dashboard"); return; }
      root.innerHTML = ""; root.appendChild(clone("tpl-orders")); initOrdersPage(); break;
    case "profile":
      if (!requireAuth("view your profile")) { navigate("#/dashboard"); return; }
      root.innerHTML = ""; root.appendChild(clone("tpl-profile")); initProfilePage(); break;
    case "referral":
      if (!requireAuth("view your referral program")) { navigate("#/dashboard"); return; }
      root.innerHTML = ""; root.appendChild(clone("tpl-referral")); initReferralPage(); break;
    case "vip": root.innerHTML = ""; root.appendChild(clone("tpl-vip")); initVipPage(); break;
    case "rewards": root.innerHTML = ""; root.appendChild(clone("tpl-rewards")); initRewardsPage(); break;
    case "support": root.innerHTML = ""; root.appendChild(clone("tpl-support")); initSupportPage(); break;
    case "faq": root.innerHTML = ""; root.appendChild(clone("tpl-faq")); initFaqPage(); break;
    case "contact": root.innerHTML = ""; root.appendChild(clone("tpl-contact")); initContactPage(); break;
    case "wishlist":
      if (!requireAuth("view your wishlist")) { navigate("#/dashboard"); return; }
      root.innerHTML = ""; root.appendChild(clone("tpl-wishlist")); initWishlistPage(); break;
  }
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function clone(tplId) { return $(`#${tplId}`).content.cloneNode(true); }

window.addEventListener("hashchange", renderRoute);

// route-link delegation (any element with data-route)
document.addEventListener("click", e => {
  const el = e.target.closest("[data-route]");
  if (el && !el.closest(".user-dropdown")) {
    // allow user-dropdown anchors to work naturally too
  }
});

/* -----------------------------------------------------------------------
   NAVBAR / DRAWER
   ----------------------------------------------------------------------- */
$("#navBurger").addEventListener("click", () => {
  $("#mobileDrawer").classList.add("open");
  $("#drawerOverlay").classList.add("open");
});
$("#drawerOverlay").addEventListener("click", closeDrawer);
function closeDrawer() {
  $("#mobileDrawer").classList.remove("open");
  $("#drawerOverlay").classList.remove("open");
}

$("#avatarBtn").addEventListener("click", () => $("#userMenu").classList.toggle("open"));
document.addEventListener("click", e => {
  if (!e.target.closest("#userMenu")) $("#userMenu").classList.remove("open");
});

$("#authOpenBtn").addEventListener("click", () => openModal("authModal"));
$("#walletChip").addEventListener("click", () => navigate("#/wallet"));
$("#heroDepositBtn")?.addEventListener?.("click", () => {}); // safe no-op guard, real binding below via delegation

document.addEventListener("click", e => {
  if (e.target.id === "heroDepositBtn") {
    if (requireAuth("make a deposit")) openModal("depositModal");
  }
});

$("#logoutBtn").addEventListener("click", async () => {
  await signOut(auth);
  toast("Logged out successfully.", "info");
  navigate("#/dashboard");
});

$("#notifBtn").addEventListener("click", () => {
  if (!requireAuth("view notifications")) return;
  openModal("notifModal");
  renderNotifList();
});

$("#wishlistBtn").addEventListener("click", () => {
  if (!requireAuth("view your wishlist")) return;
  navigate("#/wishlist");
});

let searchDebounce;
$("#globalSearch").addEventListener("input", e => {
  clearTimeout(searchDebounce);
  const q = e.target.value.trim().toLowerCase();
  searchDebounce = setTimeout(() => {
    if (!q) return;
    navigate("#/games");
    setTimeout(() => {
      const input = $("#gameFilterInput");
      if (input) { input.value = q; input.dispatchEvent(new Event("input")); }
    }, 60);
  }, 350);
});

/* -----------------------------------------------------------------------
   AUTH — TABS
   ----------------------------------------------------------------------- */
$all(".auth-tab").forEach(tab => {
  tab.addEventListener("click", () => {
    $all(".auth-tab").forEach(t => t.classList.remove("active"));
    tab.classList.add("active");
    $("#loginForm").hidden = tab.dataset.authtab !== "login";
    $("#signupForm").hidden = tab.dataset.authtab !== "signup";
    $("#forgotForm").hidden = tab.dataset.authtab !== "forgot";
  });
});

$("#loginForm").addEventListener("submit", async e => {
  e.preventDefault();
  const email = $("#loginEmail").value.trim();
  const pass = $("#loginPassword").value;
  try {
    await signInWithEmailAndPassword(auth, email, pass);
    closeModal("authModal");
    toast("Welcome back!", "success");
  } catch (err) {
    toast(friendlyAuthError(err), "error");
  }
});

$("#signupForm").addEventListener("submit", async e => {
  e.preventDefault();
  const name = $("#signupName").value.trim();
  const email = $("#signupEmail").value.trim();
  const pass = $("#signupPassword").value;
  const referredBy = $("#signupReferral").value.trim();
  try {
    const cred = await createUserWithEmailAndPassword(auth, email, pass);
    await updateProfile(cred.user, { displayName: name });
    const referralCode = generateReferralCode(name);
    await setDoc(doc(db, COLLECTIONS.users, cred.user.uid), {
      displayName: name,
      email,
      referralCode,
      referredBy: referredBy || null,
      vipPoints: 0,
      createdAt: serverTimestamp()
    });
    await setDoc(doc(db, COLLECTIONS.wallets, cred.user.uid), { balance: 0, updatedAt: serverTimestamp() });
    if (referredBy) {
      await addDoc(collection(db, COLLECTIONS.referrals), {
        referrerCode: referredBy, newUserUid: cred.user.uid, newUserName: name,
        earnings: 0, createdAt: serverTimestamp()
      });
    }
    closeModal("authModal");
    toast("Account created! Welcome to Supper Shop.", "success");
  } catch (err) {
    toast(friendlyAuthError(err), "error");
  }
});

$("#forgotForm").addEventListener("submit", async e => {
  e.preventDefault();
  const email = $("#forgotEmail").value.trim();
  try {
    await sendPasswordResetEmail(auth, email);
    toast("Password reset email sent.", "success");
  } catch (err) {
    toast(friendlyAuthError(err), "error");
  }
});

function friendlyAuthError(err) {
  const code = err?.code || "";
  const map = {
    "auth/invalid-email": "That email address looks invalid.",
    "auth/user-not-found": "No account found with that email.",
    "auth/wrong-password": "Incorrect password.",
    "auth/email-already-in-use": "An account already exists with that email.",
    "auth/weak-password": "Password should be at least 6 characters."
  };
  return map[code] || "Something went wrong. Please try again.";
}

function generateReferralCode(name) {
  const base = (name || "USER").replace(/[^a-zA-Z]/g, "").toUpperCase().slice(0, 5) || "USER";
  return `${base}${Math.floor(1000 + Math.random() * 9000)}`;
}

/* -----------------------------------------------------------------------
   AUTH STATE OBSERVER
   ----------------------------------------------------------------------- */
onAuthStateChanged(auth, async (user) => {
  clearLiveListeners();
  state.user = user;

  if (user) {
    $("#authOpenBtn").hidden = true;
    $("#userMenu").hidden = false;
    $("#avatarInitial").textContent = (user.displayName || user.email || "U").charAt(0).toUpperCase();

    const profileSnap = await getDoc(doc(db, COLLECTIONS.users, user.uid));
    state.profile = profileSnap.exists() ? profileSnap.data() : {};

    listenWallet(user.uid);
    listenNotifications(user.uid);
    listenWishlist(user.uid);
  } else {
    $("#authOpenBtn").hidden = false;
    $("#userMenu").hidden = true;
    state.profile = null;
    state.wallet.balance = 0;
    updateWalletUI();
  }
  renderRoute();
});

function clearLiveListeners() {
  state.liveListeners.forEach(unsub => unsub());
  state.liveListeners = [];
}

/* -----------------------------------------------------------------------
   WALLET — realtime balance
   ----------------------------------------------------------------------- */
function listenWallet(uid) {
  const unsub = onSnapshot(doc(db, COLLECTIONS.wallets, uid), snap => {
    state.wallet.balance = snap.exists() ? (snap.data().balance || 0) : 0;
    updateWalletUI();
  });
  state.liveListeners.push(unsub);
}
function updateWalletUI() {
  $("#walletBalanceNav").textContent = money(state.wallet.balance);
  const big = $("#walletBalanceBig");
  if (big) big.textContent = money(state.wallet.balance);
}

/* -----------------------------------------------------------------------
   NOTIFICATIONS — realtime
   ----------------------------------------------------------------------- */
function listenNotifications(uid) {
  const q = query(collection(db, COLLECTIONS.notifications), where("uid", "==", uid), orderBy("createdAt", "desc"), limit(30));
  const unsub = onSnapshot(q, snap => {
    state.notifications = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    const unread = state.notifications.some(n => !n.read);
    $("#notifDot").hidden = !unread;
    renderNotifList();
  });
  state.liveListeners.push(unsub);
}
function renderNotifList() {
  const el = $("#notifList");
  if (!el) return;
  if (!state.notifications.length) { el.innerHTML = emptyStateHTML("No notifications yet."); return; }
  el.innerHTML = state.notifications.map(n => `
    <div class="history-row glass">
      <div class="hr-main">
        <span class="hr-title">${esc(n.title || "Notification")}</span>
        <span class="hr-sub">${esc(n.body || "")} · ${timeAgo(n.createdAt)}</span>
      </div>
    </div>`).join("");
}

/* -----------------------------------------------------------------------
   WISHLIST
   ----------------------------------------------------------------------- */
function listenWishlist(uid) {
  const q = query(collection(db, COLLECTIONS.wishlist), where("uid", "==", uid));
  const unsub = onSnapshot(q, snap => {
    state.wishlist = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    if (state.currentRoute === "wishlist") renderWishlistGrid();
  });
  state.liveListeners.push(unsub);
}
async function toggleWishlist(game) {
  if (!requireAuth("use your wishlist")) return;
  const existing = state.wishlist.find(w => w.gameId === game.id);
  if (existing) {
    await deleteDoc(doc(db, COLLECTIONS.wishlist, existing.id));
    toast("Removed from wishlist.", "info");
  } else {
    await addDoc(collection(db, COLLECTIONS.wishlist), {
      uid: state.user.uid, gameId: game.id, name: game.name, image: game.image, createdAt: serverTimestamp()
    });
    toast("Added to wishlist.", "success");
  }
}

/* -----------------------------------------------------------------------
   STATIC / SEED DATA LOADERS (Firestore-backed, realtime)
   ----------------------------------------------------------------------- */
function listenGames() {
  const unsub = onSnapshot(collection(db, COLLECTIONS.games), snap => {
    state.games = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    if (["dashboard", "games", "game"].includes(state.currentRoute)) renderCurrentGameViews();
  });
  state.liveListeners.push(unsub);
}
function listenCategories() {
  const unsub = onSnapshot(collection(db, COLLECTIONS.categories), snap => {
    state.categories = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    if (state.currentRoute === "dashboard") renderCategoryChips();
    if (state.currentRoute === "games") populateCategoryFilter();
  });
  state.liveListeners.push(unsub);
}
// Games/categories are public reference data — listen globally, not tied to auth.
listenGames();
listenCategories();

function renderCurrentGameViews() {
  if (state.currentRoute === "dashboard") {
    renderGameGrid("#featuredGamesGrid", state.games.filter(g => g.featured));
    renderGameGrid("#popularGamesGrid", state.games.filter(g => g.popular));
    renderGameGrid("#bestSellersGrid", state.games.filter(g => g.bestSeller));
    if (FEATURE_FLAGS.enableFlashSale) {
      const flash = state.games.filter(g => g.flashSale);
      if (flash.length) {
        $("#flashSaleSection").hidden = false;
        renderGameGrid("#flashSaleRow", flash);
      }
    }
  }
  if (state.currentRoute === "games") renderAllGamesGrid();
}

function renderGameGrid(selector, games) {
  const el = $(selector);
  if (!el) return;
  if (!games.length) { el.innerHTML = emptyStateHTML("No games available yet."); return; }
  el.innerHTML = "";
  games.forEach(g => el.appendChild(buildGameCard(g)));
}

function buildGameCard(game) {
  const node = clone("tpl-game-card");
  const article = node.querySelector(".game-card");
  node.querySelector("img").src = game.image || "";
  node.querySelector("img").alt = game.name || "";
  node.querySelector("h3").textContent = game.name || "";
  node.querySelector(".rating-row").textContent = game.rating ? "★".repeat(Math.round(game.rating)) : "";
  node.querySelector(".price-from").textContent = game.startingPrice ? `From ${money(game.startingPrice)}` : "";
  article.addEventListener("click", () => navigate(`#/game/${game.id}`));
  return node;
}

/* -----------------------------------------------------------------------
   DASHBOARD
   ----------------------------------------------------------------------- */
function initDashboard() {
  renderCurrentGameViews();
  renderCategoryChips();
}
function renderCategoryChips() {
  const el = $("#categoryChips");
  if (!el) return;
  if (!state.categories.length) { el.innerHTML = ""; return; }
  el.innerHTML = state.categories.map(c => `<button class="chip" data-cat="${esc(c.id)}">${esc(c.name)}</button>`).join("");
  $all(".chip", el).forEach(chip => chip.addEventListener("click", () => {
    navigate("#/games");
    setTimeout(() => {
      const sel = $("#gameCategoryFilter");
      if (sel) { sel.value = chip.dataset.cat; sel.dispatchEvent(new Event("change")); }
    }, 60);
  }));
}

/* -----------------------------------------------------------------------
   GAMES PAGE (list + filter)
   ----------------------------------------------------------------------- */
function initGamesPage() {
  populateCategoryFilter();
  renderAllGamesGrid();
  $("#gameFilterInput").addEventListener("input", renderAllGamesGrid);
  $("#gameCategoryFilter").addEventListener("change", renderAllGamesGrid);
  $("#gameSortFilter").addEventListener("change", renderAllGamesGrid);
}
function populateCategoryFilter() {
  const sel = $("#gameCategoryFilter");
  if (!sel) return;
  const current = sel.value;
  sel.innerHTML = `<option value="">All Categories</option>` + state.categories.map(c => `<option value="${esc(c.id)}">${esc(c.name)}</option>`).join("");
  sel.value = current;
}
function renderAllGamesGrid() {
  const grid = $("#allGamesGrid");
  if (!grid) return;
  const term = ($("#gameFilterInput")?.value || "").toLowerCase();
  const cat = $("#gameCategoryFilter")?.value || "";
  const sort = $("#gameSortFilter")?.value || "popular";

  let list = state.games.filter(g =>
    (!term || g.name?.toLowerCase().includes(term)) &&
    (!cat || g.categoryId === cat)
  );
  if (sort === "az") list = list.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
  if (sort === "rating") list = list.sort((a, b) => (b.rating || 0) - (a.rating || 0));
  if (sort === "popular") list = list.sort((a, b) => (b.popularityScore || 0) - (a.popularityScore || 0));

  if (!list.length) { grid.innerHTML = emptyStateHTML("No games match your filters."); return; }
  grid.innerHTML = "";
  list.forEach(g => grid.appendChild(buildGameCard(g)));
}

/* -----------------------------------------------------------------------
   GAME DETAIL PAGE
   ----------------------------------------------------------------------- */
async function initGameDetail(gameId) {
  state.currentGameId = gameId;
  state.selectedPackage = null;
  let game = state.games.find(g => g.id === gameId);
  if (!game) {
    const snap = await getDoc(doc(db, COLLECTIONS.games, gameId));
    if (snap.exists()) game = { id: snap.id, ...snap.data() };
  }
  if (!game) { $("#app-root").innerHTML = emptyStateHTML("Game not found."); return; }

  $("#gdImage").src = game.image || "";
  $("#gdImage").alt = game.name || "";
  $("#gdName").textContent = game.name || "";
  $("#gdRating").textContent = game.rating ? "★".repeat(Math.round(game.rating)) + ` (${game.reviewCount || 0})` : "No ratings yet";
  $("#gdDescription").textContent = game.description || "";

  const inWishlist = state.wishlist.some(w => w.gameId === game.id);
  $("#gdWishlistBtn").textContent = inWishlist ? "♥ In Wishlist" : "♡ Wishlist";
  $("#gdWishlistBtn").addEventListener("click", () => toggleWishlist(game));

  listenPackages(gameId);
  listenReviews(gameId);

  $("#submitOrderBtn").addEventListener("click", () => submitOrder(game));
  $("#orderCoupon").addEventListener("change", updateOrderSummary);
}

function listenPackages(gameId) {
  const q = query(collection(db, COLLECTIONS.packages), where("gameId", "==", gameId));
  const unsub = onSnapshot(q, snap => {
    const packages = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderPackages(packages);
  });
  state.liveListeners.push(unsub);
}
function renderPackages(packages) {
  const grid = $("#packageGrid");
  if (!grid) return;
  if (!packages.length) { grid.innerHTML = emptyStateHTML("No packages available for this game yet."); return; }
  grid.innerHTML = "";
  packages.forEach(pkg => {
    const node = clone("tpl-package-item");
    const btn = node.querySelector(".package-item");
    node.querySelector(".pkg-name").textContent = pkg.name;
    node.querySelector(".pkg-price").textContent = money(pkg.price);
    node.querySelector(".pkg-bonus").textContent = pkg.bonus ? `+${pkg.bonus} bonus` : "";
    btn.addEventListener("click", () => {
      $all(".package-item", grid).forEach(b => b.classList.remove("selected"));
      btn.classList.add("selected");
      state.selectedPackage = pkg;
      $("#orderForm").hidden = false;
      updateOrderSummary();
    });
    grid.appendChild(node);
  });
}

async function updateOrderSummary() {
  const pkg = state.selectedPackage;
  if (!pkg) return;
  $("#orderSummaryPkg").textContent = pkg.name;
  $("#orderSummaryPrice").textContent = money(pkg.price);

  let discount = 0;
  const code = $("#orderCoupon").value.trim().toUpperCase();
  if (code && FEATURE_FLAGS.enableCoupons) {
    const q = query(collection(db, COLLECTIONS.coupons), where("code", "==", code));
    const snap = await getDocs(q);
    if (!snap.empty) {
      const coupon = snap.docs[0].data();
      discount = coupon.type === "percent" ? Math.round(pkg.price * (coupon.value / 100)) : coupon.value;
    }
  }
  $("#orderSummaryDiscount").textContent = `−${money(discount)}`;
  $("#orderSummaryTotal").textContent = money(Math.max(pkg.price - discount, 0));
}

async function submitOrder(game) {
  if (!requireAuth("place an order")) return;
  const pkg = state.selectedPackage;
  const playerId = $("#orderPlayerId").value.trim();
  if (!pkg) { toast("Select a package first.", "error"); return; }
  if (!playerId) { toast("Enter your in-game Player ID.", "error"); return; }

  const totalText = $("#orderSummaryTotal").textContent.replace(/[^\d.]/g, "");
  const total = Number(totalText || pkg.price);

  if (state.wallet.balance < total) {
    toast("Insufficient wallet balance. Please deposit first.", "error");
    openModal("depositModal");
    return;
  }

  const submitBtn = $("#submitOrderBtn");
  submitBtn.disabled = true;
  submitBtn.textContent = "Placing order…";

  try {
    await runTransaction(db, async (tx) => {
      const walletRef = doc(db, COLLECTIONS.wallets, state.user.uid);
      const walletSnap = await tx.get(walletRef);
      const balance = walletSnap.exists() ? walletSnap.data().balance || 0 : 0;
      if (balance < total) throw new Error("insufficient-balance");

      tx.update(walletRef, { balance: balance - total, updatedAt: serverTimestamp() });

      const orderRef = doc(collection(db, COLLECTIONS.orders));
      tx.set(orderRef, {
        uid: state.user.uid,
        gameId: game.id,
        gameName: game.name,
        packageId: pkg.id,
        packageName: pkg.name,
        playerId,
        price: pkg.price,
        total,
        status: STATUS.order.PENDING,
        createdAt: serverTimestamp()
      });

      const histRef = doc(collection(db, COLLECTIONS.walletHistory));
      tx.set(histRef, {
        uid: state.user.uid, type: "order", amount: -total,
        description: `Order: ${game.name} — ${pkg.name}`, createdAt: serverTimestamp()
      });
    });

    toast("Order placed successfully!", "success");
    openModal("orderSuccessModal");
    $("#orderForm").hidden = true;
    $all(".package-item").forEach(b => b.classList.remove("selected"));
    state.selectedPackage = null;
  } catch (err) {
    toast(err.message === "insufficient-balance" ? "Insufficient wallet balance." : "Order failed. Try again.", "error");
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "Place Order";
  }
}

function listenReviews(gameId) {
  if (!FEATURE_FLAGS.enableReviews) return;
  const q = query(collection(db, COLLECTIONS.reviews), where("gameId", "==", gameId), orderBy("createdAt", "desc"), limit(20));
  const unsub = onSnapshot(q, snap => {
    const reviews = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderReviews(reviews);
  });
  state.liveListeners.push(unsub);
}
function renderReviews(reviews) {
  const el = $("#reviewList");
  if (!el) return;
  if (!reviews.length) { el.innerHTML = emptyStateHTML("No reviews yet. Be the first!"); return; }
  el.innerHTML = reviews.map(r => `
    <div class="review-item">
      <strong>${esc(r.userName || "Anonymous")}</strong>
      <span class="rating-row">${"★".repeat(r.rating || 0)}</span>
      <p class="muted small">${esc(r.comment || "")}</p>
    </div>`).join("");
}

/* -----------------------------------------------------------------------
   WALLET PAGE — deposit / withdraw / history
   ----------------------------------------------------------------------- */
function initWalletPage() {
  updateWalletUI();

  $("#openDepositBtn").addEventListener("click", () => openModal("depositModal"));
  $("#openWithdrawBtn").addEventListener("click", () => openModal("withdrawModal"));

  $all(".tab-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      $all(".tab-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      $all(".tab-panel").forEach(p => p.hidden = true);
      $(`#tab-${btn.dataset.tab}`).hidden = false;
    });
  });

  listenDeposits();
  listenWithdrawals();
  listenWalletHistory();
}

const PAYMENT_INSTRUCTIONS = {
  bKash: "Send Money to 01XXXXXXXXX (Personal). Copy the Transaction ID after sending.",
  Nagad: "Send Money to 01XXXXXXXXX (Personal). Copy the Transaction ID after sending.",
  Rocket: "Send to 01XXXXXXXXX1 (Personal). Copy the Transaction ID after sending.",
  Bank: "Transfer to Supper Shop Ltd — A/C 1234567890, XYZ Bank. Use your name as reference."
};
$("#depositMethod").addEventListener("change", e => {
  const box = $("#paymentInstructions");
  const text = PAYMENT_INSTRUCTIONS[e.target.value];
  if (text) { box.textContent = text; box.hidden = false; } else { box.hidden = true; }
});
$("#screenshotLabel").hidden = !FEATURE_FLAGS.enableDepositScreenshot;

$("#depositForm").addEventListener("submit", async e => {
  e.preventDefault();
  if (!requireAuth("submit a deposit")) return;
  const method = $("#depositMethod").value;
  const trxId = $("#depositTrxId").value.trim();
  const amount = Number($("#depositAmount").value);
  const screenshot = $("#depositScreenshot").value.trim();

  if (amount < APP_SETTINGS.minDepositAmount) {
    toast(`Minimum deposit is ${money(APP_SETTINGS.minDepositAmount)}.`, "error"); return;
  }

  // Duplicate deposit prevention: check for an existing pending deposit with same trxId
  const dupQuery = query(collection(db, COLLECTIONS.deposits), where("trxId", "==", trxId));
  const dupSnap = await getDocs(dupQuery);
  if (!dupSnap.empty) { toast("This Transaction ID has already been submitted.", "error"); return; }

  try {
    await addDoc(collection(db, COLLECTIONS.deposits), {
      uid: state.user.uid,
      userName: state.profile?.displayName || state.user.email,
      method, trxId, amount, screenshot: screenshot || null,
      status: STATUS.deposit.PENDING,
      createdAt: serverTimestamp()
    });
    toast("Deposit request submitted — pending admin approval.", "success");
    closeModal("depositModal");
    e.target.reset();
    $("#paymentInstructions").hidden = true;
  } catch (err) {
    toast("Could not submit deposit. Try again.", "error");
  }
});

$("#withdrawForm").addEventListener("submit", async e => {
  e.preventDefault();
  if (!requireAuth("submit a withdrawal")) return;
  const method = $("#withdrawMethod").value;
  const account = $("#withdrawAccount").value.trim();
  const amount = Number($("#withdrawAmount").value);

  if (amount < APP_SETTINGS.minWithdrawAmount) {
    toast(`Minimum withdrawal is ${money(APP_SETTINGS.minWithdrawAmount)}.`, "error"); return;
  }
  if (amount > state.wallet.balance) {
    toast("Withdrawal exceeds your wallet balance.", "error"); return;
  }

  try {
    await addDoc(collection(db, COLLECTIONS.withdrawals), {
      uid: state.user.uid,
      userName: state.profile?.displayName || state.user.email,
      method, account, amount,
      status: STATUS.withdraw.PENDING,
      createdAt: serverTimestamp()
    });
    toast("Withdrawal request submitted.", "success");
    closeModal("withdrawModal");
    e.target.reset();
  } catch (err) {
    toast("Could not submit withdrawal. Try again.", "error");
  }
});

function listenDeposits() {
  const q = query(collection(db, COLLECTIONS.deposits), where("uid", "==", state.user.uid), orderBy("createdAt", "desc"));
  const unsub = onSnapshot(q, snap => {
    const rows = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderHistoryRows("#tab-deposits", rows, r => ({
      title: `${r.method} Deposit`, sub: `TrxID: ${r.trxId} · ${timeAgo(r.createdAt)}`,
      amount: `+${money(r.amount)}`, status: r.status
    }), "No deposit requests yet.");
  });
  state.liveListeners.push(unsub);
}
function listenWithdrawals() {
  const q = query(collection(db, COLLECTIONS.withdrawals), where("uid", "==", state.user.uid), orderBy("createdAt", "desc"));
  const unsub = onSnapshot(q, snap => {
    const rows = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderHistoryRows("#tab-withdrawals", rows, r => ({
      title: `${r.method} Withdrawal`, sub: `${r.account} · ${timeAgo(r.createdAt)}`,
      amount: `−${money(r.amount)}`, status: r.status
    }), "No withdrawal requests yet.");
  });
  state.liveListeners.push(unsub);
}
function listenWalletHistory() {
  const q = query(collection(db, COLLECTIONS.walletHistory), where("uid", "==", state.user.uid), orderBy("createdAt", "desc"), limit(50));
  const unsub = onSnapshot(q, snap => {
    const rows = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderHistoryRows("#tab-history", rows, r => ({
      title: r.description || r.type, sub: timeAgo(r.createdAt),
      amount: `${r.amount >= 0 ? "+" : ""}${money(r.amount)}`, status: null
    }), "No wallet activity yet.");
  });
  state.liveListeners.push(unsub);
}
function renderHistoryRows(selector, rows, mapFn, emptyMsg) {
  const el = $(selector);
  if (!el) return;
  if (!rows.length) { el.innerHTML = emptyStateHTML(emptyMsg); return; }
  el.innerHTML = "";
  rows.forEach(r => {
    const mapped = mapFn(r);
    const node = clone("tpl-history-row");
    node.querySelector(".hr-title").textContent = mapped.title;
    node.querySelector(".hr-sub").textContent = mapped.sub;
    node.querySelector(".hr-amount").textContent = mapped.amount;
    const pill = node.querySelector(".status-pill");
    if (mapped.status) { pill.textContent = mapped.status.replace("_", " "); pill.classList.add(mapped.status); }
    else pill.remove();
    el.appendChild(node);
  });
}

/* -----------------------------------------------------------------------
   ORDERS PAGE
   ----------------------------------------------------------------------- */
function initOrdersPage() {
  listenOrders();
  $("#orderStatusFilter").addEventListener("change", () => listenOrders($("#orderStatusFilter").value));
}
let unsubOrders = null;
function listenOrders(statusFilter = "") {
  if (unsubOrders) unsubOrders();
  let q = statusFilter
    ? query(collection(db, COLLECTIONS.orders), where("uid", "==", state.user.uid), where("status", "==", statusFilter), orderBy("createdAt", "desc"))
    : query(collection(db, COLLECTIONS.orders), where("uid", "==", state.user.uid), orderBy("createdAt", "desc"));
  unsubOrders = onSnapshot(q, snap => {
    const rows = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderHistoryRows("#ordersList", rows, r => ({
      title: `${r.gameName} — ${r.packageName}`, sub: `Player ID: ${r.playerId} · ${timeAgo(r.createdAt)}`,
      amount: money(r.total), status: r.status
    }), "No orders yet. Browse games to get started!");
  });
  state.liveListeners.push(unsubOrders);
}

/* -----------------------------------------------------------------------
   PROFILE PAGE
   ----------------------------------------------------------------------- */
function initProfilePage() {
  $("#profileAvatar").textContent = (state.user.displayName || state.user.email || "U").charAt(0).toUpperCase();
  $("#profileName").value = state.user.displayName || "";
  $("#profileEmail").value = state.user.email || "";
  $("#profilePhone").value = state.profile?.phone || "";

  $("#saveProfileBtn").addEventListener("click", async () => {
    try {
      await updateProfile(state.user, { displayName: $("#profileName").value.trim() });
      await updateDoc(doc(db, COLLECTIONS.users, state.user.uid), {
        displayName: $("#profileName").value.trim(),
        phone: $("#profilePhone").value.trim()
      });
      toast("Profile updated.", "success");
    } catch { toast("Could not update profile.", "error"); }
  });

  $("#changePasswordBtn").addEventListener("click", async () => {
    const cur = $("#curPassword").value;
    const next = $("#newPassword").value;
    if (next.length < 6) { toast("New password must be at least 6 characters.", "error"); return; }
    try {
      const cred = EmailAuthProvider.credential(state.user.email, cur);
      await reauthenticateWithCredential(state.user, cred);
      await updatePassword(state.user, next);
      toast("Password updated.", "success");
      $("#curPassword").value = ""; $("#newPassword").value = "";
    } catch { toast("Could not update password. Check your current password.", "error"); }
  });
}

/* -----------------------------------------------------------------------
   REFERRAL PAGE
   ----------------------------------------------------------------------- */
function initReferralPage() {
  $("#refBonusPct").textContent = `${APP_SETTINGS.referralBonusPercent}%`;
  $("#referralCodeInput").value = state.profile?.referralCode || "—";
  $("#copyReferralBtn").addEventListener("click", () => {
    navigator.clipboard?.writeText($("#referralCodeInput").value);
    toast("Referral code copied!", "success");
  });

  const q = query(collection(db, COLLECTIONS.referrals), where("referrerCode", "==", state.profile?.referralCode || "___"));
  const unsub = onSnapshot(q, snap => {
    const rows = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    $("#refCount").textContent = rows.length;
    $("#refEarnings").textContent = money(rows.reduce((s, r) => s + (r.earnings || 0), 0));
    renderHistoryRows("#referralList", rows, r => ({
      title: r.newUserName || "Referred user", sub: timeAgo(r.createdAt),
      amount: `+${money(r.earnings || 0)}`, status: null
    }), "No referrals yet. Share your code!");
  });
  state.liveListeners.push(unsub);
}

/* -----------------------------------------------------------------------
   VIP PAGE
   ----------------------------------------------------------------------- */
function initVipPage() {
  const points = state.profile?.vipPoints || 0;
  $("#vipPoints").textContent = points;

  const unsub = onSnapshot(query(collection(db, COLLECTIONS.vipTiers), orderBy("threshold", "asc")), snap => {
    const tiers = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderVipTiers(tiers, points);
  });
  state.liveListeners.push(unsub);
}
function renderVipTiers(tiers, points) {
  const row = $("#vipTierRow");
  if (!row) return;
  if (!tiers.length) { row.innerHTML = emptyStateHTML("VIP tiers coming soon."); return; }
  row.innerHTML = tiers.map(t => `
    <div class="vip-tier-card glass ${points >= t.threshold ? "" : "muted"}">
      <h3>${esc(t.name)}</h3>
      <p class="small">${t.threshold.toLocaleString()} pts required</p>
      <p class="small">${esc(t.perk || "")}</p>
    </div>`).join("");
  const next = tiers.find(t => points < t.threshold);
  const fillPct = next ? Math.min(100, (points / next.threshold) * 100) : 100;
  const fill = $("#vipProgressFill");
  if (fill) fill.style.width = `${fillPct}%`;
}

/* -----------------------------------------------------------------------
   REWARDS PAGE
   ----------------------------------------------------------------------- */
function initRewardsPage() {
  const unsub = onSnapshot(collection(db, COLLECTIONS.rewards), snap => {
    const rewards = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    const grid = $("#rewardsGrid");
    if (!rewards.length) { grid.innerHTML = emptyStateHTML("No rewards available right now."); return; }
    grid.innerHTML = rewards.map(r => `
      <div class="glass game-card-body" style="padding:1.2rem; border-radius:16px;">
        <h3>${esc(r.title)}</h3>
        <p class="muted small">${esc(r.description || "")}</p>
        <p class="small" style="color:var(--gold); margin-top:.5rem;">${r.pointsCost || 0} pts</p>
      </div>`).join("");
  });
  state.liveListeners.push(unsub);
}

/* -----------------------------------------------------------------------
   WISHLIST PAGE
   ----------------------------------------------------------------------- */
function initWishlistPage() { renderWishlistGrid(); }
function renderWishlistGrid() {
  const grid = $("#wishlistGrid");
  if (!grid) return;
  if (!state.wishlist.length) { grid.innerHTML = emptyStateHTML("Your wishlist is empty. Browse games to add some!"); return; }
  grid.innerHTML = "";
  state.wishlist.forEach(w => {
    const game = state.games.find(g => g.id === w.gameId) || { id: w.gameId, name: w.name, image: w.image };
    grid.appendChild(buildGameCard(game));
  });
}

/* -----------------------------------------------------------------------
   SUPPORT / FAQ / CONTACT
   ----------------------------------------------------------------------- */
function initSupportPage() {
  $("#whatsappSupport").href = `https://wa.me/${APP_SETTINGS.supportWhatsApp.replace(/\D/g, "")}`;
}
const FAQ_ITEMS = [
  { q: "How long does a deposit take to be approved?", a: "Most deposits are reviewed within 15–30 minutes during business hours." },
  { q: "What happens if my Transaction ID is wrong?", a: "The admin may request a correction. You'll be notified and can resubmit the correct details." },
  { q: "Can I cancel an order?", a: "Orders can be cancelled only while still Pending — contact support for help." },
  { q: "Is my payment information safe?", a: "Yes — we never store your mobile banking PIN or password. We only record the Transaction ID you provide." }
];
function initFaqPage() {
  const list = $("#faqList");
  list.innerHTML = FAQ_ITEMS.map((item, i) => `
    <div class="faq-item" data-i="${i}">
      <button class="faq-question">${esc(item.q)} <span>+</span></button>
      <div class="faq-answer">${esc(item.a)}</div>
    </div>`).join("");
  $all(".faq-item", list).forEach(item => {
    item.querySelector(".faq-question").addEventListener("click", () => item.classList.toggle("open"));
  });
}
function initContactPage() {
  $("#contactForm").addEventListener("submit", async e => {
    e.preventDefault();
    try {
      await addDoc(collection(db, "contactMessages"), {
        name: $("#contactName").value.trim(),
        email: $("#contactEmail").value.trim(),
        message: $("#contactMessage").value.trim(),
        uid: state.user?.uid || null,
        createdAt: serverTimestamp()
      });
      toast("Message sent! We'll get back to you soon.", "success");
      e.target.reset();
    } catch { toast("Could not send message. Try again.", "error"); }
  });
}

/* -----------------------------------------------------------------------
   BOOTSTRAP
   ----------------------------------------------------------------------- */
function hideLoader() {
  const loader = $("#app-loader");
  loader.classList.add("hidden");
}

window.addEventListener("DOMContentLoaded", () => {
  if (!window.location.hash) navigate("#/dashboard");
  renderRoute();
  setTimeout(hideLoader, 400);
});
