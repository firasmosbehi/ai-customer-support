export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Organization {
  id: string;
  name: string;
  slug: string;
  owner_id: string;
  plan: "free" | "starter" | "pro" | "enterprise";
  settings: Json;
  created_at: string;
  updated_at: string;
}

export interface Document {
  id: string;
  org_id: string;
  title: string;
  source_type: "pdf" | "docx" | "csv" | "url" | "text" | "faq";
  status: "processing" | "ready" | "error";
  chunk_count: number;
  created_at: string;
  updated_at: string;
}
