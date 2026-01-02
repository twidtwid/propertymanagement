/**
 * Dropbox integration types
 */

export interface DropboxOAuthTokens {
  id: string
  user_email: string
  access_token_encrypted: string
  refresh_token_encrypted: string
  token_expiry: string
  account_id: string | null
  root_folder_path: string
  namespace_id: string | null
  created_at: string
  updated_at: string
}

export interface DropboxFolderMapping {
  id: string
  dropbox_folder_path: string
  entity_type: 'property' | 'vehicle' | 'insurance_portfolio'
  entity_id: string | null
  entity_name: string
  is_active: boolean
  created_at: string
}

export interface DropboxFileIndex {
  id: string
  dropbox_path: string
  dropbox_id: string
  name: string
  is_folder: boolean
  file_size: number | null
  mime_type: string | null
  modified_at: string | null
  parent_folder_path: string | null
  property_id: string | null
  vehicle_id: string | null
  document_category: string | null
  last_synced_at: string
  content_hash: string | null
}

export interface DropboxCredentials {
  access_token: string
  refresh_token: string
  expiry_date: number
  account_id?: string
}

export interface DropboxFileEntry {
  id: string
  name: string
  path_lower: string
  path_display: string
  is_folder: boolean
  size?: number
  client_modified?: string
  server_modified?: string
  content_hash?: string
}

export interface DropboxListFolderResult {
  entries: DropboxFileEntry[]
  cursor: string
  has_more: boolean
}

export type DocumentCategory =
  | 'insurance'
  | 'taxes'
  | 'bills'
  | 'maintenance'
  | 'legal'
  | 'banking'
  | 'registration'
  | 'utilities'
  | 'other'

export const DOCUMENT_CATEGORY_LABELS: Record<DocumentCategory, string> = {
  insurance: 'Insurance',
  taxes: 'Taxes',
  bills: 'Bills',
  maintenance: 'Maintenance',
  legal: 'Legal',
  banking: 'Banking',
  registration: 'Registration',
  utilities: 'Utilities',
  other: 'Other',
}
