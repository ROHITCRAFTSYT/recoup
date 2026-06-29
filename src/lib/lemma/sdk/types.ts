/**
 * Lemma SDK — types and interfaces for the Lemma platform client.
 *
 * This module provides the canonical type definitions used by both the
 * server-side REST client and the React hooks. When the real `lemma-sdk`
 * npm package is available, these types map 1:1 to its surface.
 */

export type ColumnType = "TEXT" | "INTEGER" | "REAL" | "BOOLEAN" | "JSON" | "TIMESTAMP";

export interface TableColumn {
  name: string;
  type: ColumnType;
  required?: boolean;
  unique?: boolean;
  default?: string | number | boolean | null;
}

export interface TableSchema {
  name: string;
  enable_rls?: boolean;
  columns: TableColumn[];
}

export interface TableInfo {
  id: string;
  name: string;
  columns: TableColumn[];
  created_at: string;
  updated_at: string;
}

export interface LemmaRecord {
  id: string;
  [key: string]: unknown;
}

export interface ListRecordsResponse<T = LemmaRecord> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}

export interface CreateRecordPayload {
  data: Record<string, unknown>;
}

export interface UpdateRecordPayload {
  data: Record<string, unknown>;
}

export interface PodInfo {
  id: string;
  name: string;
  description?: string;
  created_at: string;
  updated_at: string;
}

export interface LemmaClientConfig {
  apiUrl: string;
  podId: string;
  token: string;
  timeoutMs?: number;
  retries?: number;
}

export interface QueryOptions {
  limit?: number;
  offset?: number;
  orderBy?: string;
  orderDirection?: "asc" | "desc";
  filter?: Record<string, string | number | boolean>;
}

export type WatchEvent = {
  type: "create" | "update" | "delete";
  table: string;
  record: LemmaRecord;
  timestamp: string;
};

export type ConnectionState = "connected" | "disconnected" | "connecting" | "error";
