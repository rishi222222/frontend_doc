const { v4: uuid } = require('uuid');
const path = require('path');
const Document = require('../models/Document');
const DocumentPermission = require('../models/DocumentPermission');
const DocumentVersion = require('../models/DocumentVersion');
const User = require('../models/User');
const { asyncHandler } = require('../utils/asyncHandler');
const { AppError } = require('../utils/AppError');
const { sanitizeFilename, toSafeDocument } = require('../utils/sanitize');
const { parsePagination, paginated } = require('../utils/pagination');
const { getStorage } = require('../services/storage');
const { logEvent } = require('../services/auditService');
const access = require('../services/accessService');
const { env } = require('../config/env');

function storageKeyFor(originalName) {
  const ext = path.extname(originalName || '').toLowerCase();
  const day = new Date().toISOString().slice(0, 10);
  return `${day}/${uuid()}${ext}`;
}

const createDocument = asyncHandler(async (req, res) => {
  const body = req.validated.body;
  let publisherId = req.user._id;
  if (body.publisherId && String(body.publisherId) !== String(req.user._id)) {
    if (req.user.role !== 'admin') {
      throw new AppError(403, 'Only administrators can publish on behalf of another user', 'FORBIDDEN');
    }
    const target = await User.findById(body.publisherId);
    if (!target || !target.isActive) throw new AppError(400, 'Publisher must be an active user', 'VALIDATION');
    publisherId = target._id;
  }

  const file = req.file;
  const key = storageKeyFor(file.originalname);
  const storage = getStorage();
  await storage.put(key, file.buffer, file.mimetype);

  let doc;
  try {
    doc = await Document.create({
      title: body.title,
      description: body.description || '',
      originalFilename: sanitizeFilename(file.originalname),
      storageKey: key,
      mimeType: file.mimetype,
      size: file.size,
      publisherId,
      visibility: body.visibility || 'private',
      allowDownload: body.allowDownload !== undefined ? body.allowDownload : true,
    });
    await DocumentVersion.create({
      documentId: doc._id,
      versionNumber: 1,
      storageKey: key,
      originalFilename: doc.originalFilename,
      mimeType: doc.mimeType,
      size: doc.size,
      uploadedBy: req.user._id,
      changeDescription: 'Initial upload',
    });
  } catch (err) {
    await storage.remove(key).catch(() => {});
    throw err;
  }

  await logEvent({
    actorId: req.user._id,
    documentId: doc._id,
    action: 'document.upload',
    details: { title: doc.title, visibility: doc.visibility },
    req,
  });
  const populated = await Document.findById(doc._id).populate('publisherId', 'name email');
  res.status(201).json({ document: toSafeDocument(populated, { access: await access.getEffectiveAccess(req.user, populated) }) });
});

const listDocuments = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const filter = await access.visibleDocumentFilter(req.user);
  if (req.query.visibility) filter.visibility = req.query.visibility;
  if (req.query.scope === 'published') {
    filter.publisherId = req.user._id;
  }
  if (req.query.scope === 'shared') {
    const perms = await DocumentPermission.find({ userId: req.user._id }).select('documentId');
    filter._id = { $in: perms.map((p) => p.documentId) };
    delete filter.$or;
    filter.publisherId = { $ne: req.user._id };
  }
  if (req.query.q) {
    const q = String(req.query.q).trim();
    filter.$and = [
      ...(filter.$and || []),
      {
        $or: [
          { title: new RegExp(q, 'i') },
          { description: new RegExp(q, 'i') },
          { originalFilename: new RegExp(q, 'i') },
        ],
      },
    ];
  }

  const [docs, total] = await Promise.all([
    Document.find(filter).populate('publisherId', 'name email').sort({ updatedAt: -1 }).skip(skip).limit(limit),
    Document.countDocuments(filter),
  ]);
  const items = [];
  for (const doc of docs) {
    const effective = await access.getEffectiveAccess(req.user, doc);
    items.push(toSafeDocument(doc, { access: effective }));
  }
  res.json(paginated(items, total, page, limit));
});

const getDocument = asyncHandler(async (req, res) => {
  const doc = await access.loadActiveDocument(req.params.id);
  await access.requireView(req.user, doc);
  await logEvent({ actorId: req.user._id, documentId: doc._id, action: 'document.view', req });
  const effective = await access.getEffectiveAccess(req.user, doc);
  res.json({ document: toSafeDocument(doc, { access: effective }) });
});

const downloadDocument = asyncHandler(async (req, res) => {
  const versionNumber = req.query.version ? Number(req.query.version) : null;
  const doc = await access.loadActiveDocument(req.params.id);
  if (!(await access.canDownload(req.user, doc))) {
    if (!(await access.canView(req.user, doc))) access.notFoundOrForbidden();
    throw new AppError(403, 'Downloads are not permitted for this document', 'FORBIDDEN');
  }

  let key = doc.storageKey;
  let filename = doc.originalFilename;
  let mime = doc.mimeType;
  if (versionNumber) {
    const version = await DocumentVersion.findOne({ documentId: doc._id, versionNumber });
    if (!version) throw new AppError(404, 'Version not found', 'NOT_FOUND');
    key = version.storageKey;
    filename = version.originalFilename;
    mime = version.mimeType;
  }

  const storage = getStorage();
  const stream = await storage.getStream(key);
  await logEvent({
    actorId: req.user._id,
    documentId: doc._id,
    action: 'document.download',
    details: versionNumber ? { version: versionNumber } : {},
    req,
  });
  res.setHeader('Content-Type', mime);
  res.setHeader('Content-Disposition', `attachment; filename="${sanitizeFilename(filename)}"`);
  stream.pipe(res);
});

const previewDocument = asyncHandler(async (req, res) => {
  const doc = await access.loadActiveDocument(req.params.id);
  await access.requireView(req.user, doc);
  const storage = getStorage();
  const stream = await storage.getStream(doc.storageKey);

  const trustedOrigins = [
    "'self'",
    'https://*.vercel.app',
    ...env.clientOrigins.filter((o) => typeof o === 'string' && o.startsWith('http')),
  ].join(' ');

  res.setHeader('Content-Security-Policy', `frame-ancestors ${trustedOrigins}`);
  res.removeHeader('X-Frame-Options');
  res.setHeader('Content-Type', doc.mimeType);
  res.setHeader('Content-Disposition', `inline; filename="${sanitizeFilename(doc.originalFilename)}"`);
  stream.pipe(res);
});

const updateDocument = asyncHandler(async (req, res) => {
  const doc = await access.loadActiveDocument(req.params.id);
  await access.requireEdit(req.user, doc);
  const body = req.validated.body;

  if (body.publisherId && String(body.publisherId) !== String(doc.publisherId._id || doc.publisherId)) {
    if (req.user.role !== 'admin') {
      throw new AppError(403, 'Only administrators can reassign ownership', 'FORBIDDEN');
    }
    const nextPub = await User.findById(body.publisherId);
    if (!nextPub || !nextPub.isActive) throw new AppError(400, 'Publisher must be an active user', 'VALIDATION');
    doc.publisherId = nextPub._id;
    await logEvent({
      actorId: req.user._id,
      documentId: doc._id,
      targetUserId: nextPub._id,
      action: 'document.reassign',
      req,
    });
  }

  if (body.title) doc.title = body.title;
  if (body.description !== undefined) doc.description = body.description;
  if (body.allowDownload !== undefined) doc.allowDownload = body.allowDownload;

  if (req.file) {
    const key = storageKeyFor(req.file.originalname);
    const storage = getStorage();
    await storage.put(key, req.file.buffer, req.file.mimetype);
    const nextVersion = doc.version + 1;
    await DocumentVersion.create({
      documentId: doc._id,
      versionNumber: nextVersion,
      storageKey: key,
      originalFilename: sanitizeFilename(req.file.originalname),
      mimeType: req.file.mimetype,
      size: req.file.size,
      uploadedBy: req.user._id,
      changeDescription: body.changeDescription || 'File replaced',
    });
    doc.storageKey = key;
    doc.originalFilename = sanitizeFilename(req.file.originalname);
    doc.mimeType = req.file.mimetype;
    doc.size = req.file.size;
    doc.version = nextVersion;
    await logEvent({
      actorId: req.user._id,
      documentId: doc._id,
      action: 'document.replace',
      details: { version: nextVersion },
      req,
    });
  }

  await doc.save();
  await logEvent({ actorId: req.user._id, documentId: doc._id, action: 'document.update', req });
  const populated = await Document.findById(doc._id).populate('publisherId', 'name email');
  res.json({
    document: toSafeDocument(populated, { access: await access.getEffectiveAccess(req.user, populated) }),
  });
});

const deleteDocument = asyncHandler(async (req, res) => {
  const doc = await access.loadActiveDocument(req.params.id);
  if (!(await access.canDelete(req.user, doc))) {
    if (!(await access.canView(req.user, doc))) access.notFoundOrForbidden();
    throw new AppError(403, 'You cannot delete this document', 'FORBIDDEN');
  }
  doc.status = 'deleted';
  await doc.save();
  await logEvent({ actorId: req.user._id, documentId: doc._id, action: 'document.delete', req });
  res.json({ ok: true });
});

const changeVisibility = asyncHandler(async (req, res) => {
  const doc = await access.loadActiveDocument(req.params.id);
  const next = req.validated.body.visibility;
  if (!(await access.canChangeVisibility(req.user, doc, next))) {
    if (!(await access.canView(req.user, doc))) access.notFoundOrForbidden();
    throw new AppError(403, 'You cannot change visibility to this setting', 'FORBIDDEN');
  }
  const previous = doc.visibility;
  doc.visibility = next;
  await doc.save();
  await logEvent({
    actorId: req.user._id,
    documentId: doc._id,
    action: 'document.visibility',
    details: { from: previous, to: next },
    req,
  });
  res.json({
    document: toSafeDocument(doc, { access: await access.getEffectiveAccess(req.user, doc) }),
  });
});

const listVersions = asyncHandler(async (req, res) => {
  const doc = await access.loadActiveDocument(req.params.id);
  await access.requireView(req.user, doc);
  const versions = await DocumentVersion.find({ documentId: doc._id })
    .populate('uploadedBy', 'name email')
    .sort({ versionNumber: -1 });
  res.json({
    items: versions.map((v) => ({
      versionNumber: v.versionNumber,
      originalFilename: v.originalFilename,
      mimeType: v.mimeType,
      size: v.size,
      changeDescription: v.changeDescription,
      createdAt: v.createdAt,
      uploadedBy: v.uploadedBy
        ? { id: String(v.uploadedBy._id), name: v.uploadedBy.name, email: v.uploadedBy.email }
        : null,
    })),
  });
});

module.exports = {
  createDocument,
  listDocuments,
  getDocument,
  downloadDocument,
  previewDocument,
  updateDocument,
  deleteDocument,
  changeVisibility,
  listVersions,
};
