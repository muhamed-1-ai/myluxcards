import { currentIdentity, safeError, validMutationOrigin } from "@/lib/adminAuth";
import { pool } from "@/lib/db";
import { recordAudit } from "@/lib/repositories/auditLogs";

const SECTION_CONFIG: Record<string, { table: string; auditPrefix: string }> = {
  services: { table: "card_profile_services", auditPrefix: "PROFILE_SERVICE" },
  portfolio: { table: "card_profile_portfolio", auditPrefix: "PROFILE_PORTFOLIO" },
  gallery: { table: "card_profile_gallery", auditPrefix: "PROFILE_GALLERY" },
  videos: { table: "card_profile_videos", auditPrefix: "PROFILE_VIDEO" },
  "payment-links": { table: "card_profile_payment_links", auditPrefix: "PROFILE_PAYMENT_LINK" },
  "payment_links": { table: "card_profile_payment_links", auditPrefix: "PROFILE_PAYMENT_LINK" },
  documents: { table: "card_profile_documents", auditPrefix: "PROFILE_DOCUMENT" },
  achievements: { table: "card_profile_achievements", auditPrefix: "PROFILE_ACHIEVEMENT" },
  certifications: { table: "card_profile_certifications", auditPrefix: "PROFILE_CERTIFICATION" },
};

function isSafeUrl(url: string): boolean {
  if (!url) return true;
  const trimmed = url.trim().toLowerCase();
  return (
    trimmed.startsWith("http://") ||
    trimmed.startsWith("https://") ||
    trimmed.startsWith("tel:") ||
    trimmed.startsWith("mailto:")
  );
}

export async function GET(request: Request, props: { params: Promise<{ section: string }> }) {
  const identity = await currentIdentity();
  if (!identity) return Response.json({ message: "Sign in required." }, { status: 401 });

  const { section } = await props.params;
  const config = SECTION_CONFIG[section];
  if (!config) return Response.json({ message: "Invalid section identifier." }, { status: 400 });

  const url = new URL(request.url);
  const cardId = url.searchParams.get("cardId");

  try {
    let query = `
      select s.*
      from ${config.table} s
      join digital_cards c on c.id = s.card_id
      where c.owner_id = $1
    `;
    const params: unknown[] = [identity.id];

    if (cardId && /^[0-9a-f-]{36}$/i.test(cardId)) {
      query += ` and s.card_id = $2`;
      params.push(cardId);
    }
    query += ` order by s.sort_order asc, s.created_at asc`;

    const result = await pool.query(query, params);

    return Response.json({ items: result.rows });
  } catch (error) {
    return safeError(error);
  }
}

export async function POST(request: Request, props: { params: Promise<{ section: string }> }) {
  if (!validMutationOrigin(request)) return Response.json({ message: "Invalid request origin." }, { status: 403 });
  const identity = await currentIdentity();
  if (!identity) return Response.json({ message: "Sign in required." }, { status: 401 });

  const { section } = await props.params;
  const config = SECTION_CONFIG[section];
  if (!config) return Response.json({ message: "Invalid section identifier." }, { status: 400 });

  try {
    const body = await request.json().catch(() => ({}));
    const cardId = String(body.cardId || "");
    if (!/^[0-9a-f-]{36}$/i.test(cardId)) return Response.json({ message: "Valid cardId required." }, { status: 400 });

    // Verify card ownership
    const ownerCheck = await pool.query<{ id: string }>(
      `select id from digital_cards where id = $1 and owner_id = $2`,
      [cardId, identity.id]
    );
    if (ownerCheck.rows.length === 0) {
      return Response.json({ message: "Card not attached to signed-in account." }, { status: 403 });
    }

    // Get max sort_order
    const orderRes = await pool.query<{ max_order: number | null }>(
      `select max(sort_order) as max_order from ${config.table} where card_id = $1`,
      [cardId]
    );
    const sortOrder = typeof body.sortOrder === "number" ? body.sortOrder : ((orderRes.rows[0]?.max_order ?? -1) + 1);

    let insertQuery = "";
    let values: unknown[] = [];

    if (section === "services") {
      const name = String(body.name || "").trim().slice(0, 150);
      if (!name) return Response.json({ message: "Service name is required." }, { status: 400 });
      const ctaUrl = String(body.ctaUrl || "").trim().slice(0, 2000);
      if (ctaUrl && !isSafeUrl(ctaUrl)) return Response.json({ message: "Invalid CTA URL scheme." }, { status: 400 });

      insertQuery = `
        insert into card_profile_services
        (card_id, name, description, price, currency, image_url, category, cta_label, cta_url, enabled, sort_order)
        values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) returning *`;
      values = [cardId, name, String(body.description || "").trim().slice(0, 3000), String(body.price || "").trim().slice(0, 100), String(body.currency || "INR").trim().toUpperCase().slice(0, 10), String(body.imageUrl || "").trim().slice(0, 2000), String(body.category || "").trim().slice(0, 100), String(body.ctaLabel || "").trim().slice(0, 50), ctaUrl, body.enabled !== false, sortOrder];
    } else if (section === "portfolio") {
      const title = String(body.title || "").trim().slice(0, 150);
      if (!title) return Response.json({ message: "Project title is required." }, { status: 400 });
      const projectUrl = String(body.projectUrl || "").trim().slice(0, 2000);
      if (projectUrl && !isSafeUrl(projectUrl)) return Response.json({ message: "Invalid project URL scheme." }, { status: 400 });

      insertQuery = `
        insert into card_profile_portfolio
        (card_id, title, description, image_url, category, project_url, cta_label, enabled, sort_order)
        values ($1, $2, $3, $4, $5, $6, $7, $8, $9) returning *`;
      values = [cardId, title, String(body.description || "").trim().slice(0, 3000), String(body.imageUrl || "").trim().slice(0, 2000), String(body.category || "").trim().slice(0, 100), projectUrl, String(body.ctaLabel || "").trim().slice(0, 50), body.enabled !== false, sortOrder];
    } else if (section === "gallery") {
      const imageUrl = String(body.imageUrl || "").trim().slice(0, 2000);
      if (!imageUrl) return Response.json({ message: "Image URL is required." }, { status: 400 });

      insertQuery = `
        insert into card_profile_gallery
        (card_id, title, image_url, caption, enabled, sort_order)
        values ($1, $2, $3, $4, $5, $6) returning *`;
      values = [cardId, String(body.title || "").trim().slice(0, 150), imageUrl, String(body.caption || "").trim().slice(0, 1000), body.enabled !== false, sortOrder];
    } else if (section === "videos") {
      const videoUrl = String(body.videoUrl || "").trim().slice(0, 2000);
      if (!videoUrl || !isSafeUrl(videoUrl)) return Response.json({ message: "Valid video URL is required." }, { status: 400 });

      insertQuery = `
        insert into card_profile_videos
        (card_id, title, provider, video_url, embed_id, description, enabled, sort_order)
        values ($1, $2, $3, $4, $5, $6, $7, $8) returning *`;
      values = [cardId, String(body.title || "").trim().slice(0, 150) || "Video", String(body.provider || "YouTube").trim().slice(0, 50), videoUrl, String(body.embedId || "").trim().slice(0, 100), String(body.description || "").trim().slice(0, 2000), body.enabled !== false, sortOrder];
    } else if (section === "payment-links") {
      const label = String(body.label || "").trim().slice(0, 100);
      const payUrl = String(body.payUrl || "").trim().slice(0, 2000);
      if (!label || !payUrl || !isSafeUrl(payUrl)) return Response.json({ message: "Label and valid pay URL are required." }, { status: 400 });

      insertQuery = `
        insert into card_profile_payment_links
        (card_id, label, provider, pay_url, upi_id, description, enabled, sort_order)
        values ($1, $2, $3, $4, $5, $6, $7, $8) returning *`;
      values = [cardId, label, String(body.provider || "UPI").trim().slice(0, 50), payUrl, String(body.upiId || "").trim().slice(0, 100), String(body.description || "").trim().slice(0, 1000), body.enabled !== false, sortOrder];
    } else if (section === "documents") {
      const title = String(body.title || "").trim().slice(0, 150);
      const fileUrl = String(body.fileUrl || "").trim().slice(0, 2000);
      if (!title || !fileUrl) return Response.json({ message: "Document title and file URL are required." }, { status: 400 });

      insertQuery = `
        insert into card_profile_documents
        (card_id, title, file_url, file_size, file_type, description, enabled, sort_order)
        values ($1, $2, $3, $4, $5, $6, $7, $8) returning *`;
      values = [cardId, title, fileUrl, String(body.fileSize || "").trim().slice(0, 50), String(body.fileType || "PDF").trim().slice(0, 20), String(body.description || "").trim().slice(0, 2000), body.enabled !== false, sortOrder];
    } else if (section === "achievements") {
      const title = String(body.title || "").trim().slice(0, 150);
      if (!title) return Response.json({ message: "Achievement title is required." }, { status: 400 });

      insertQuery = `
        insert into card_profile_achievements
        (card_id, title, organization, achievement_date, description, image_url, enabled, sort_order)
        values ($1, $2, $3, $4, $5, $6, $7, $8) returning *`;
      values = [cardId, title, String(body.organization || "").trim().slice(0, 150), String(body.achievementDate || "").trim().slice(0, 50), String(body.description || "").trim().slice(0, 2000), String(body.imageUrl || "").trim().slice(0, 2000), body.enabled !== false, sortOrder];
    } else if (section === "certifications") {
      const title = String(body.title || "").trim().slice(0, 150);
      if (!title) return Response.json({ message: "Certification title is required." }, { status: 400 });
      const credentialUrl = String(body.credentialUrl || "").trim().slice(0, 2000);
      if (credentialUrl && !isSafeUrl(credentialUrl)) return Response.json({ message: "Invalid credential URL scheme." }, { status: 400 });

      insertQuery = `
        insert into card_profile_certifications
        (card_id, title, issuer, issue_date, credential_url, certificate_url, enabled, sort_order)
        values ($1, $2, $3, $4, $5, $6, $7, $8) returning *`;
      values = [cardId, title, String(body.issuer || "").trim().slice(0, 150), String(body.issueDate || "").trim().slice(0, 50), credentialUrl, String(body.certificateUrl || "").trim().slice(0, 2000), body.enabled !== false, sortOrder];
    }

    const insertRes = await pool.query(insertQuery, values);
    const item = insertRes.rows[0];

    await recordAudit({
      actorId: identity.id,
      actorRole: identity.role,
      action: `${config.auditPrefix}_CREATED`,
      entityType: config.table,
      entityId: item.id,
      after: item,
    }).catch((err) => console.error("Audit log failed:", err));

    return Response.json({ item }, { status: 201 });
  } catch (error) {
    return safeError(error);
  }
}

export async function PUT(request: Request, props: { params: Promise<{ section: string }> }) {
  if (!validMutationOrigin(request)) return Response.json({ message: "Invalid request origin." }, { status: 403 });
  const identity = await currentIdentity();
  if (!identity) return Response.json({ message: "Sign in required." }, { status: 401 });

  const { section } = await props.params;
  const config = SECTION_CONFIG[section];
  if (!config) return Response.json({ message: "Invalid section identifier." }, { status: 400 });

  try {
    const body = await request.json().catch(() => ({}));
    const id = String(body.id || "");
    if (!/^[0-9a-f-]{36}$/i.test(id)) return Response.json({ message: "Valid id required." }, { status: 400 });

    // Verify owner
    const checkRes = await pool.query(
      `select s.* from ${config.table} s join digital_cards c on c.id = s.card_id where s.id = $1 and c.owner_id = $2`,
      [id, identity.id]
    );
    if (checkRes.rows.length === 0) return Response.json({ message: "Item not found or access denied." }, { status: 404 });
    const existing = checkRes.rows[0];

    let updateQuery = "";
    let values: unknown[] = [];

    if (section === "services") {
      const name = body.name !== undefined ? String(body.name).trim().slice(0, 150) : existing.name;
      if (!name) return Response.json({ message: "Service name cannot be empty." }, { status: 400 });
      const ctaUrl = body.ctaUrl !== undefined ? String(body.ctaUrl).trim().slice(0, 2000) : existing.cta_url;
      if (ctaUrl && !isSafeUrl(ctaUrl)) return Response.json({ message: "Invalid CTA URL scheme." }, { status: 400 });

      updateQuery = `
        update card_profile_services
        set name = $1, description = $2, price = $3, currency = $4, image_url = $5,
            category = $6, cta_label = $7, cta_url = $8, enabled = $9, sort_order = $10, updated_at = now()
        where id = $11 returning *`;
      values = [name, body.description !== undefined ? String(body.description).trim().slice(0, 3000) : existing.description, body.price !== undefined ? String(body.price).trim().slice(0, 100) : existing.price, body.currency !== undefined ? String(body.currency).trim().toUpperCase().slice(0, 10) : existing.currency, body.imageUrl !== undefined ? String(body.imageUrl).trim().slice(0, 2000) : existing.image_url, body.category !== undefined ? String(body.category).trim().slice(0, 100) : existing.category, body.ctaLabel !== undefined ? String(body.ctaLabel).trim().slice(0, 50) : existing.cta_label, ctaUrl, body.enabled !== undefined ? Boolean(body.enabled) : existing.enabled, typeof body.sortOrder === "number" ? body.sortOrder : existing.sort_order, id];
    } else if (section === "portfolio") {
      const title = body.title !== undefined ? String(body.title).trim().slice(0, 150) : existing.title;
      if (!title) return Response.json({ message: "Title cannot be empty." }, { status: 400 });
      const projectUrl = body.projectUrl !== undefined ? String(body.projectUrl).trim().slice(0, 2000) : existing.project_url;
      if (projectUrl && !isSafeUrl(projectUrl)) return Response.json({ message: "Invalid project URL scheme." }, { status: 400 });

      updateQuery = `
        update card_profile_portfolio
        set title = $1, description = $2, image_url = $3, category = $4, project_url = $5,
            cta_label = $6, enabled = $7, sort_order = $8, updated_at = now()
        where id = $9 returning *`;
      values = [title, body.description !== undefined ? String(body.description).trim().slice(0, 3000) : existing.description, body.imageUrl !== undefined ? String(body.imageUrl).trim().slice(0, 2000) : existing.image_url, body.category !== undefined ? String(body.category).trim().slice(0, 100) : existing.category, projectUrl, body.ctaLabel !== undefined ? String(body.ctaLabel).trim().slice(0, 50) : existing.cta_label, body.enabled !== undefined ? Boolean(body.enabled) : existing.enabled, typeof body.sortOrder === "number" ? body.sortOrder : existing.sort_order, id];
    } else if (section === "gallery") {
      const imageUrl = body.imageUrl !== undefined ? String(body.imageUrl).trim().slice(0, 2000) : existing.image_url;
      if (!imageUrl) return Response.json({ message: "Image URL cannot be empty." }, { status: 400 });

      updateQuery = `
        update card_profile_gallery
        set title = $1, image_url = $2, caption = $3, enabled = $4, sort_order = $5, updated_at = now()
        where id = $6 returning *`;
      values = [body.title !== undefined ? String(body.title).trim().slice(0, 150) : existing.title, imageUrl, body.caption !== undefined ? String(body.caption).trim().slice(0, 1000) : existing.caption, body.enabled !== undefined ? Boolean(body.enabled) : existing.enabled, typeof body.sortOrder === "number" ? body.sortOrder : existing.sort_order, id];
    } else if (section === "videos") {
      const videoUrl = body.videoUrl !== undefined ? String(body.videoUrl).trim().slice(0, 2000) : existing.video_url;
      if (videoUrl && !isSafeUrl(videoUrl)) return Response.json({ message: "Invalid video URL scheme." }, { status: 400 });

      updateQuery = `
        update card_profile_videos
        set title = $1, provider = $2, video_url = $3, embed_id = $4, description = $5,
            enabled = $6, sort_order = $7, updated_at = now()
        where id = $8 returning *`;
      values = [body.title !== undefined ? String(body.title).trim().slice(0, 150) : existing.title, body.provider !== undefined ? String(body.provider).trim().slice(0, 50) : existing.provider, videoUrl, body.embedId !== undefined ? String(body.embedId).trim().slice(0, 100) : existing.embed_id, body.description !== undefined ? String(body.description).trim().slice(0, 2000) : existing.description, body.enabled !== undefined ? Boolean(body.enabled) : existing.enabled, typeof body.sortOrder === "number" ? body.sortOrder : existing.sort_order, id];
    } else if (section === "payment-links") {
      const payUrl = body.payUrl !== undefined ? String(body.payUrl).trim().slice(0, 2000) : existing.pay_url;
      if (payUrl && !isSafeUrl(payUrl)) return Response.json({ message: "Invalid pay URL scheme." }, { status: 400 });

      updateQuery = `
        update card_profile_payment_links
        set label = $1, provider = $2, pay_url = $3, upi_id = $4, description = $5,
            enabled = $6, sort_order = $7, updated_at = now()
        where id = $8 returning *`;
      values = [body.label !== undefined ? String(body.label).trim().slice(0, 100) : existing.label, body.provider !== undefined ? String(body.provider).trim().slice(0, 50) : existing.provider, payUrl, body.upiId !== undefined ? String(body.upiId).trim().slice(0, 100) : existing.upi_id, body.description !== undefined ? String(body.description).trim().slice(0, 1000) : existing.description, body.enabled !== undefined ? Boolean(body.enabled) : existing.enabled, typeof body.sortOrder === "number" ? body.sortOrder : existing.sort_order, id];
    } else if (section === "documents") {
      updateQuery = `
        update card_profile_documents
        set title = $1, file_url = $2, file_size = $3, file_type = $4, description = $5,
            enabled = $6, sort_order = $7, updated_at = now()
        where id = $8 returning *`;
      values = [body.title !== undefined ? String(body.title).trim().slice(0, 150) : existing.title, body.fileUrl !== undefined ? String(body.fileUrl).trim().slice(0, 2000) : existing.file_url, body.fileSize !== undefined ? String(body.fileSize).trim().slice(0, 50) : existing.file_size, body.fileType !== undefined ? String(body.fileType).trim().slice(0, 20) : existing.file_type, body.description !== undefined ? String(body.description).trim().slice(0, 2000) : existing.description, body.enabled !== undefined ? Boolean(body.enabled) : existing.enabled, typeof body.sortOrder === "number" ? body.sortOrder : existing.sort_order, id];
    } else if (section === "achievements") {
      updateQuery = `
        update card_profile_achievements
        set title = $1, organization = $2, achievement_date = $3, description = $4, image_url = $5,
            enabled = $6, sort_order = $7, updated_at = now()
        where id = $8 returning *`;
      values = [body.title !== undefined ? String(body.title).trim().slice(0, 150) : existing.title, body.organization !== undefined ? String(body.organization).trim().slice(0, 150) : existing.organization, body.achievementDate !== undefined ? String(body.achievementDate).trim().slice(0, 50) : existing.achievement_date, body.description !== undefined ? String(body.description).trim().slice(0, 2000) : existing.description, body.imageUrl !== undefined ? String(body.imageUrl).trim().slice(0, 2000) : existing.image_url, body.enabled !== undefined ? Boolean(body.enabled) : existing.enabled, typeof body.sortOrder === "number" ? body.sortOrder : existing.sort_order, id];
    } else if (section === "certifications") {
      const credentialUrl = body.credentialUrl !== undefined ? String(body.credentialUrl).trim().slice(0, 2000) : existing.credential_url;
      if (credentialUrl && !isSafeUrl(credentialUrl)) return Response.json({ message: "Invalid credential URL scheme." }, { status: 400 });

      updateQuery = `
        update card_profile_certifications
        set title = $1, issuer = $2, issue_date = $3, credential_url = $4, certificate_url = $5,
            enabled = $6, sort_order = $7, updated_at = now()
        where id = $8 returning *`;
      values = [body.title !== undefined ? String(body.title).trim().slice(0, 150) : existing.title, body.issuer !== undefined ? String(body.issuer).trim().slice(0, 150) : existing.issuer, body.issueDate !== undefined ? String(body.issueDate).trim().slice(0, 50) : existing.issue_date, credentialUrl, body.certificateUrl !== undefined ? String(body.certificateUrl).trim().slice(0, 2000) : existing.certificate_url, body.enabled !== undefined ? Boolean(body.enabled) : existing.enabled, typeof body.sortOrder === "number" ? body.sortOrder : existing.sort_order, id];
    }

    const updateRes = await pool.query(updateQuery, values);
    const updated = updateRes.rows[0];

    await recordAudit({
      actorId: identity.id,
      actorRole: identity.role,
      action: `${config.auditPrefix}_UPDATED`,
      entityType: config.table,
      entityId: id,
      before: existing,
      after: updated,
    }).catch((err) => console.error("Audit log failed:", err));

    return Response.json({ item: updated });
  } catch (error) {
    return safeError(error);
  }
}

export async function DELETE(request: Request, props: { params: Promise<{ section: string }> }) {
  if (!validMutationOrigin(request)) return Response.json({ message: "Invalid request origin." }, { status: 403 });
  const identity = await currentIdentity();
  if (!identity) return Response.json({ message: "Sign in required." }, { status: 401 });

  const { section } = await props.params;
  const config = SECTION_CONFIG[section];
  if (!config) return Response.json({ message: "Invalid section identifier." }, { status: 400 });

  try {
    const url = new URL(request.url);
    const id = url.searchParams.get("id");
    if (!id || !/^[0-9a-f-]{36}$/i.test(id)) return Response.json({ message: "Valid id required." }, { status: 400 });

    const checkRes = await pool.query(
      `select s.* from ${config.table} s join digital_cards c on c.id = s.card_id where s.id = $1 and c.owner_id = $2`,
      [id, identity.id]
    );
    if (checkRes.rows.length === 0) return Response.json({ message: "Item not found or access denied." }, { status: 404 });
    const existing = checkRes.rows[0];

    await pool.query(`delete from ${config.table} where id = $1`, [id]);

    await recordAudit({
      actorId: identity.id,
      actorRole: identity.role,
      action: `${config.auditPrefix}_DELETED`,
      entityType: config.table,
      entityId: id,
      before: existing,
    }).catch((err) => console.error("Audit log failed:", err));

    return Response.json({ message: "Item permanently deleted." });
  } catch (error) {
    return safeError(error);
  }
}
