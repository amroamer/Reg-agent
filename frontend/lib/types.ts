// ── Auth ──────────────────────────────────────────

export interface User {
  id: string;
  email: string;
  name: string;
  role: "admin" | "analyst" | "viewer";
  preferred_language: string;
  is_active: boolean;
  created_at: string;
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

// ── Documents ────────────────────────────────────

export type SourceAuthority = "SAMA" | "CMA" | "BANK_POLICY";
export type DocumentStatus =
  | "pending"
  | "processing"
  | "indexed"
  | "failed"
  | "superseded";

export interface Document {
  id: string;
  title_en: string | null;
  title_ar: string | null;
  source: SourceAuthority;
  document_number: string | null;
  issue_date: string | null;
  effective_date: string | null;
  status: DocumentStatus;
  language: string | null;
  file_path: string;
  source_url: string | null;
  page_count: number | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

export interface Chunk {
  id: string;
  chunk_index: number;
  content_en: string | null;
  content_ar: string | null;
  section_title: string | null;
  article_number: string | null;
  page_number: number | null;
  token_count: number | null;
}

export interface DocumentDetail extends Document {
  chunks: Chunk[];
  chunks_count: number;
  total_articles: number | null;
  total_chunks: number | null;
  json_path: string | null;
  markdown_path: string | null;
  ingestion_started_at: string | null;
  ingestion_completed_at: string | null;
}

export interface DocumentUpdate {
  title_en?: string | null;
  title_ar?: string | null;
  document_number?: string | null;
  issue_date?: string | null;
  effective_date?: string | null;
  status?: DocumentStatus;
  source_url?: string | null;
}

export interface FileValidationResponse {
  valid: boolean;
  issues: string[];
  file_size_mb: number;
  page_count: number | null;
  is_scanned: boolean;
  detected_language: string | null;
  file_hash: string | null;
  duplicate: {
    found: boolean;
    existing_document_id?: string | null;
    existing_title?: string | null;
    uploaded_at?: string | null;
  };
  auto_detected_metadata: {
    title_en?: string | null;
    title_ar?: string | null;
    document_number?: string | null;
    source?: string | null;
  };
}

export interface ArticleSummary {
  id: string;
  article_index: number;
  chapter_number: string | null;
  chapter_title_ar: string | null;
  chapter_title_en: string | null;
  article_number: string | null;
  article_title_ar: string | null;
  article_title_en: string | null;
  page_start: number | null;
  page_end: number | null;
}

export interface ChapterGroup {
  chapter_number: string | null;
  chapter_title_ar: string | null;
  chapter_title_en: string | null;
  articles: ArticleSummary[];
}

export interface ArticlesResponse {
  chapters: ChapterGroup[];
  total_articles: number;
}

export interface IngestionStageLog {
  stage: string;
  status: string;
  duration_s: number | null;
  error: string | null;
}

export interface IngestionLogResponse {
  document_id: string;
  document_status: string;
  ingestion_started_at: string | null;
  ingestion_completed_at: string | null;
  total_duration_s: number | null;
  stages: IngestionStageLog[];
  errors: Array<{ phase: string; error_message: string; created_at: string }>;
  warnings: string[];
}

export interface DocumentListResponse {
  documents: Document[];
  total: number;
  page: number;
  page_size: number;
}

// ── Search ───────────────────────────────────────

export interface SearchRequest {
  query: string;
  sources?: string[];
  language?: string;
  top_k?: number;
  generate_answer?: boolean;
}

export interface SearchResultItem {
  chunk_id: string | null;
  document_id: string | null;
  score: number;
  article_number: string | null;
  section_title: string | null;
  page_number: number | null;
  content_en: string | null;
  content_ar: string | null;
  document_title_en: string | null;
  document_title_ar: string | null;
  document_number: string | null;
  source: string | null;
  source_url: string | null;
  issue_date: string | null;
}

export interface LLMAnswer {
  text: string;
  language: string;
  citations: Record<string, unknown>[];
  confidence: string;
}

export interface RegulationResult {
  document_title: string | null;
  document_number: string | null;
  article: string | null;
  relevant_text: string | null;
  source_url: string | null;
  confidence: number;
}

export interface CrossReferenceResult {
  from_document: string | null;
  to_document: string | null;
  relationship: string | null;
  explanation: string | null;
}

export interface SearchResponse {
  answer: LLMAnswer | null;
  results: SearchResultItem[];
  sama_regulations: RegulationResult[];
  cma_regulations: RegulationResult[];
  bank_policies: RegulationResult[];
  cross_references: CrossReferenceResult[];
  metadata: {
    query_language?: string;
    total_candidates?: number;
    response_time_ms?: number;
    from_cache?: boolean;
  };
}

// ── Admin ────────────────────────────────────────

export interface AdminStats {
  total_documents: number;
  documents_by_source: Record<string, number>;
  documents_by_status: Record<string, number>;
  total_chunks: number;
  total_searches: number;
  pending_cross_refs: number;
}

// ── Batch Upload ─────────────────────────────────

export type BatchStatus =
  | "pending"
  | "processing"
  | "completed"
  | "failed"
  | "cancelled";
export type QueueItemStatus =
  | "pending"
  | "processing"
  | "completed"
  | "failed"
  | "skipped";
export type IngestionStage =
  | "extraction"
  | "parsing"
  | "markdown"
  | "chunking"
  | "embedding"
  | "enrichment";

export interface StageProgress {
  [stage: string]: { status: string; duration_s?: number };
}

export interface QueueItem {
  id: string;
  document_id: string;
  filename: string | null;
  source: string | null;
  position: number;
  status: QueueItemStatus;
  current_stage: IngestionStage | null;
  stage_progress: StageProgress;
  error_message: string | null;
  started_at: string | null;
  completed_at: string | null;
}

export interface BatchSummary {
  id: string;
  name: string | null;
  status: BatchStatus;
  total_documents: number;
  completed_documents: number;
  failed_documents: number;
  created_at: string;
  updated_at: string;
}

export interface BatchDetail extends BatchSummary {
  queue_items: QueueItem[];
}

export interface BulkUploadDocumentInfo {
  document_id: string;
  filename: string;
  source: string;
  document_number: string | null;
  queue_position: number;
  status: string;
  metadata_source: string;
  warnings: string[];
}

export interface BulkUploadResponse {
  batch_id: string;
  batch_name: string | null;
  total_documents: number;
  accepted: number;
  duplicates: string[];
  errors: string[];
  documents: BulkUploadDocumentInfo[];
  csv_warnings: string[];
}
