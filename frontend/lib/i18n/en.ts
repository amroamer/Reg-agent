const en = {
  // App
  appName: "RegInspector",
  appNameAr: "مُفتِّش الأنظمة",
  appSubtitle: "Regulatory Intelligence Platform",
  appSubtitleAr: "منصة الذكاء التنظيمي",

  // Nav
  search: "Search",
  documents: "Documents",
  admin: "Admin",
  settings: "Settings",
  logout: "Logout",

  // Auth
  login: "Login",
  register: "Register",
  email: "Email",
  password: "Password",
  name: "Full Name",
  loginTitle: "Sign in to RegInspector",
  registerTitle: "Create Account",
  noAccount: "Don't have an account?",
  hasAccount: "Already have an account?",

  // Search
  searchPlaceholder: "Search regulations...",
  searchButton: "Search",
  allSources: "All",
  samaBadge: "SAMA",
  cmaBadge: "CMA",
  bankBadge: "Bank Policies",
  aiSummary: "AI-Generated Summary",
  aiDisclaimer:
    "This is an AI-generated summary. Always verify against the original regulation text.",
  noResults: "No results found",
  searchingFor: "Searching for",
  resultsFound: "results found",
  responseTime: "Response time",
  fromCache: "From cache",

  // Topics
  creditCards: "Credit Cards",
  aml: "Anti-Money Laundering",
  consumerProtection: "Consumer Protection",
  capitalAdequacy: "Capital Adequacy",
  dataPrivacy: "Data Privacy",
  corporateGovernance: "Corporate Governance",

  // Documents
  uploadDocument: "Upload Document",
  documentLibrary: "Document Library",
  source: "Source",
  status: "Status",
  uploadedOn: "Uploaded on",
  pages: "pages",
  chunks: "chunks",
  viewOriginal: "View Original",
  dragDropPdf: "Drag & drop PDF files here, or click to browse",

  // Status
  pending: "Pending",
  processing: "Processing",
  indexed: "Indexed",
  failed: "Failed",

  // Admin
  dashboard: "Dashboard",
  analytics: "Analytics",
  crossReferences: "Cross-References",
  totalDocuments: "Total Documents",
  totalChunks: "Total Chunks",
  totalSearches: "Total Searches",
  pendingReview: "Pending Review",

  // General
  loading: "Loading...",
  error: "Error",
  save: "Save",
  cancel: "Cancel",
  delete: "Delete",
  confirm: "Confirm",
  approve: "Approve",
  reject: "Reject",
  viewAll: "View All",
  back: "Back",

  // Bulk Upload
  bulkUpload: "Bulk Upload",
  batchName: "Batch Name",
  defaultSource: "Default Source",
  retryFailed: "Retry Failed",
} as const;

export default en;
export type TranslationKey = keyof typeof en;
