/* ==========================================================================
   SUPPER SHOP — USER PANEL — CONFIG.JS
   Firebase config, API config, app settings, theme tokens, feature flags.
   NO application logic lives here.
   ========================================================================== */

/* -----------------------------
   FIREBASE CONFIGURATION
   Replace with your actual Firebase project credentials.
   ----------------------------- */
export const FIREBASE_CONFIG = {
  apiKey: "YOUR_FIREBASE_API_KEY",
  authDomain: "supper-shop.firebaseapp.com",
  projectId: "supper-shop",
  storageBucket: "supper-shop.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};

/* -----------------------------
   FIREBASE SDK VERSION / CDN
   ----------------------------- */
export const SDK_CONFIG = {
  version: "10.12.2",
  appUrl: "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js",
  authUrl: "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js",
  firestoreUrl: "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js",
  storageUrl: "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js"
};

/* -----------------------------
   FIRESTORE COLLECTION NAMES
   Shared contract between Admin Panel and User Panel.
   ----------------------------- */
export const COLLECTIONS = {
  users: "users",
  wallets: "wallets",
  walletHistory: "walletHistory",
  deposits: "deposits",
  withdrawals: "withdrawals",
  orders: "orders",
  games: "games",
  categories: "categories",
  packages: "packages",
  coupons: "coupons",
  referrals: "referrals",
  vipTiers: "vipTiers",
  rewards: "rewards",
  notifications: "notifications",
  reviews: "reviews",
  wishlist: "wishlist",
  paymentMethods: "paymentMethods",
  settings: "settings",
  auditLogs: "auditLogs"
};

/* -----------------------------
   APPLICATION SETTINGS
   ----------------------------- */
export const APP_SETTINGS = {
  appName: "Supper Shop",
  tagline: "Diamonds, Delivered Instantly.",
  supportEmail: "support@suppershop.com",
  supportWhatsApp: "+8801000000000",
  currencySymbol: "৳",
  currencyCode: "BDT",
  defaultLanguage: "en",
  minDepositAmount: 50,
  maxDepositAmount: 500000,
  minWithdrawAmount: 100,
  toastDurationMs: 3500,
  skeletonRows: 6,
  paginationSize: 12,
  screenshotUploadEnabled: true,
  referralBonusPercent: 5,
  vipPointsPerTaka: 1
};

/* -----------------------------
   THEME TOKENS
   Dark Green / Yellow (Gold) / Blue Accent — Luxury Gaming Glassmorphism
   ----------------------------- */
export const THEME = {
  colors: {
    bgDeep: "#06120D",
    bgSurface: "#0B2118",
    glassFill: "rgba(18, 51, 38, 0.55)",
    glassBorder: "rgba(255, 201, 60, 0.16)",
    green: "#0F5132",
    greenBright: "#22C55E",
    gold: "#FFC93C",
    goldDim: "#B8912A",
    blue: "#3B82F6",
    blueDim: "#1E3A8A",
    textPrimary: "#EAF6EF",
    textMuted: "#9FB8AD",
    danger: "#EF4444",
    success: "#22C55E",
    warning: "#FFC93C"
  },
  fonts: {
    display: "'Rajdhani', sans-serif",
    body: "'Inter', sans-serif"
  },
  radius: "16px",
  transition: "220ms cubic-bezier(0.4, 0, 0.2, 1)"
};

/* -----------------------------
   FEATURE FLAGS
   ----------------------------- */
export const FEATURE_FLAGS = {
  enableReferral: true,
  enableVIP: true,
  enableRewards: true,
  enableCoupons: true,
  enableWishlist: true,
  enableReviews: true,
  enableFlashSale: true,
  enableDepositScreenshot: true,
  enableDarkModeToggle: false,
  maintenanceMode: false
};

/* -----------------------------
   ORDER / DEPOSIT / WITHDRAW STATUS ENUMS
   ----------------------------- */
export const STATUS = {
  deposit: { PENDING: "pending", APPROVED: "approved", REJECTED: "rejected", CORRECTION: "correction_requested" },
  withdraw: { PENDING: "pending", APPROVED: "approved", REJECTED: "rejected" },
  order: { PENDING: "pending", PROCESSING: "processing", COMPLETED: "completed", CANCELLED: "cancelled", REFUNDED: "refunded" }
};

/* -----------------------------
   VERSION
   ----------------------------- */
export const VERSION = "1.0.0";
