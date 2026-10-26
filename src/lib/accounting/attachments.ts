import "server-only";
import { pool } from "@/lib/db";
import type { Queryable } from "@/lib/db/types";
import { getStorageProvider, sanitizeStorageKey, normalizeRootPrefix } from "@/lib/storage";
import type { TransactionAttachmentRow } from "./types";
import { randomUUID } from "node:crypto";

export const MAX_ATTACHMENTS_PER_TRANSACTION = 5;
export const MAX_ATTACHMENT_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

export class AttachmentValidationError extends Error {
  public readonly statusCode: number;
  constructor(message: string, statusCode = 400) {
    super(message);
    this.name = "AttachmentValidationError";
    this.statusCode = statusCode;
  }
}

export interface ValidatedFileResult {
  isValid: boolean;
  detectedMime: string | null;
  extension: string | null;
  error?: string;
}

/**
 * Validate actual file binary magic bytes.
 * Strictly allows JPEG, PNG, WebP, and PDF only.
 */
export function validateFileContent(buffer: Buffer): ValidatedFileResult {
  if (!buffer || buffer.length < 4) {
    return { isValid: false, detectedMime: null, extension: null, error: "File is empty or corrupted." };
  }

  // PDF: %PDF (25 50 44 46)
  if (buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46) {
    return { isValid: true, detectedMime: "application/pdf", extension: "pdf" };
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return { isValid: true, detectedMime: "image/png", extension: "png" };
  }

  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { isValid: true, detectedMime: "image/jpeg", extension: "jpg" };
  }

  // WebP: RIFF ... WEBP
  if (
    buffer.length >= 12 &&
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 && // RIFF
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50 // WEBP
  ) {
    return { isValid: true, detectedMime: "image/webp", extension: "webp" };
  }

  return {
    isValid: false,
    detectedMime: null,
    extension: null,
    error: "Unsupported file type. Only JPEG, PNG, WebP, and PDF documents are allowed.",
  };
}

/**
 * List all attachments for a specific transaction in a workspace.
 */
export async function getTransactionAttachments(
  workspaceId: string,
  transactionId: string,
  client?: Queryable
): Promise<TransactionAttachmentRow[]> {
  const db = client || pool;
  const res = await db.query<TransactionAttachmentRow>(
    `SELECT * FROM accounting_transaction_attachments
     WHERE workspace_id = $1 AND transaction_id = $2
     ORDER BY created_at ASC`,
    [workspaceId, transactionId]
  );

  return res.rows.map((row) => ({
    ...row,
    url: `/api/accounting/transactions/attachments/${row.id}`,
    download_url: `/api/accounting/transactions/attachments/${row.id}?download=1`,
  }));
}

/**
 * Fetch a single attachment by ID within a workspace.
 */
export async function getAttachmentById(
  workspaceId: string,
  attachmentId: string,
  client?: Queryable
): Promise<TransactionAttachmentRow | null> {
  const db = client || pool;
  const res = await db.query<TransactionAttachmentRow>(
    `SELECT * FROM accounting_transaction_attachments
     WHERE id = $1 AND workspace_id = $2
     LIMIT 1`,
    [attachmentId, workspaceId]
  );
  if (res.rows.length === 0) return null;
  const row = res.rows[0];
  return {
    ...row,
    url: `/api/accounting/transactions/attachments/${row.id}`,
    download_url: `/api/accounting/transactions/attachments/${row.id}?download=1`,
  };
}

/**
 * Save attachment metadata and upload private binary to Wasabi storage.
 */
export async function saveAttachmentFile(params: {
  workspaceId: string;
  transactionId?: string | null;
  buffer: Buffer;
  originalFileName: string;
  userId?: string | null;
}): Promise<TransactionAttachmentRow> {
  const { workspaceId, transactionId, buffer, originalFileName, userId } = params;

  // 1. Validate file size
  if (buffer.length > MAX_ATTACHMENT_SIZE_BYTES) {
    throw new AttachmentValidationError(
      `File exceeds maximum size of 10MB (${(buffer.length / (1024 * 1024)).toFixed(1)}MB).`,
      413
    );
  }

  // 2. Validate binary content
  const validation = validateFileContent(buffer);
  if (!validation.isValid || !validation.detectedMime || !validation.extension) {
    throw new AttachmentValidationError(
      validation.error || "Unsupported file format. Only JPEG, PNG, WebP, and PDF documents are allowed.",
      400
    );
  }

  // 3. If transactionId is given, verify it belongs to this workspace and check attachment count
  if (transactionId) {
    const txCheck = await pool.query(
      `SELECT id FROM accounting_transactions WHERE id = $1 AND workspace_id = $2 LIMIT 1`,
      [transactionId, workspaceId]
    );
    if (txCheck.rows.length === 0) {
      throw new AttachmentValidationError("Transaction does not exist in this workspace.", 404);
    }

    const countRes = await pool.query<{ count: string }>(
      `SELECT COUNT(*) as count FROM accounting_transaction_attachments WHERE transaction_id = $1`,
      [transactionId]
    );
    const currentCount = parseInt(countRes.rows[0]?.count || "0", 10);
    if (currentCount >= MAX_ATTACHMENTS_PER_TRANSACTION) {
      throw new AttachmentValidationError(
        `Maximum of ${MAX_ATTACHMENTS_PER_TRANSACTION} attachments reached for this transaction.`,
        400
      );
    }
  }

  // 4. Generate unique server-controlled storage key
  const attachmentId = randomUUID();
  const sanitizedName = originalFileName
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/^_+/, "")
    .slice(0, 80);
  const safeName = sanitizedName.toLowerCase().endsWith(`.${validation.extension}`)
    ? sanitizedName
    : `${sanitizedName}.${validation.extension}`;

  const rootPrefix = normalizeRootPrefix(process.env.WASABI_ROOT_PREFIX);
  const prefixSegment = rootPrefix ? `${rootPrefix}/` : "";
  const storageKey = sanitizeStorageKey(
    `${prefixSegment}accounting/private/workspaces/${workspaceId}/attachments/${attachmentId}-${safeName}`
  );

  // 5. Upload privately to Wasabi storage (isPublic: false)
  const provider = getStorageProvider();
  await provider.uploadObject({
    key: storageKey,
    buffer,
    contentType: validation.detectedMime,
    isPublic: false,
  });

  // 6. Insert metadata into database
  const insertRes = await pool.query<TransactionAttachmentRow>(
    `INSERT INTO accounting_transaction_attachments
       (id, workspace_id, transaction_id, storage_key, file_name, file_size, file_type, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [
      attachmentId,
      workspaceId,
      transactionId || null,
      storageKey,
      safeName,
      buffer.length,
      validation.detectedMime,
      userId || null,
    ]
  );

  const row = insertRes.rows[0];
  return {
    ...row,
    url: `/api/accounting/transactions/attachments/${row.id}`,
    download_url: `/api/accounting/transactions/attachments/${row.id}?download=1`,
  };
}

/**
 * Delete an attachment from database and remove private binary from storage.
 */
export async function deleteTransactionAttachment(
  workspaceId: string,
  attachmentId: string,
  client?: Queryable
): Promise<boolean> {
  const db = client || pool;
  const attRes = await db.query<TransactionAttachmentRow>(
    `SELECT * FROM accounting_transaction_attachments WHERE id = $1 AND workspace_id = $2`,
    [attachmentId, workspaceId]
  );
  if (attRes.rows.length === 0) return false;

  const att = attRes.rows[0];

  // Delete from DB first
  await db.query(`DELETE FROM accounting_transaction_attachments WHERE id = $1 AND workspace_id = $2`, [
    attachmentId,
    workspaceId,
  ]);

  // Clean up storage object in background
  try {
    const provider = getStorageProvider();
    await provider.deleteObject(att.storage_key);
  } catch (err) {
    console.warn("[Attachment Delete] Could not delete Wasabi storage object:", att.storage_key, err);
  }

  return true;
}

/**
 * Sync attachments on transaction edit.
 * Given a final list of attachment IDs to keep/add:
 * - Links any new unlinked attachment IDs to this transaction.
 * - Deletes any previously linked attachments that were removed by the user.
 */
export async function syncTransactionAttachments(
  workspaceId: string,
  transactionId: string,
  targetAttachmentIds: string[],
  client?: Queryable
): Promise<TransactionAttachmentRow[]> {
  const db = client || pool;
  const current = await getTransactionAttachments(workspaceId, transactionId, db);
  const targetSet = new Set(targetAttachmentIds);

  // 1. Remove attachments that are no longer in targetSet
  for (const item of current) {
    if (!targetSet.has(item.id)) {
      await deleteTransactionAttachment(workspaceId, item.id, db);
    }
  }

  // 2. Link any new pending attachments to this transaction
  if (targetAttachmentIds.length > 0) {
    await db.query(
      `UPDATE accounting_transaction_attachments
       SET transaction_id = $1, updated_at = NOW()
       WHERE id = ANY($2::uuid[]) AND workspace_id = $3`,
      [transactionId, targetAttachmentIds.slice(0, MAX_ATTACHMENTS_PER_TRANSACTION), workspaceId]
    );
  }

  return getTransactionAttachments(workspaceId, transactionId, db);
}

