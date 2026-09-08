const db = require('../db');

const VALID_DOC_TYPES = ['PO', 'SO', 'GR', 'GI', 'TO', 'RT', 'CM', 'ADJ', 'SUP', 'ISS', 'JE'];

function formatYear(yearFormat) {
  const now = new Date();
  const year = now.getFullYear();
  switch (yearFormat) {
    case 'YY': return String(year).slice(-2);
    case 'YYYY': return String(year);
    default: return String(year);
  }
}

function formatNumber(num, padding) {
  return String(num).padStart(padding, '0');
}

function buildDocumentNumber(seq) {
  const year = formatYear(seq.year_format);
  const number = formatNumber(seq.current_number, seq.padding);
  return `${seq.prefix}${seq.separator}${year}${seq.separator}${number}`;
}

function getSequence(docType) {
  return db.prepare('SELECT * FROM document_sequences WHERE doc_type = ?').get(docType);
}

function generate(docType) {
  if (!VALID_DOC_TYPES.includes(docType)) {
    throw new Error(`Invalid document type: ${docType}. Must be one of: ${VALID_DOC_TYPES.join(', ')}`);
  }

  const seq = getSequence(docType);
  if (!seq) {
    throw new Error(`No sequence configured for document type: ${docType}`);
  }

  const nextNumber = seq.current_number + 1;
  const year = formatYear(seq.year_format);

  db.prepare(`
    UPDATE document_sequences
    SET current_number = ?, updated_at = CURRENT_TIMESTAMP
    WHERE doc_type = ?
  `).run(nextNumber, docType);

  const separator = seq.separator;
  const number = formatNumber(nextNumber, seq.padding);
  const documentNumber = `${seq.prefix}${separator}${year}${separator}${number}`;

  return {
    document_number: documentNumber,
    doc_type: docType,
    sequence: nextNumber,
    year: year,
  };
}

function getCurrent(docType) {
  if (!VALID_DOC_TYPES.includes(docType)) {
    throw new Error(`Invalid document type: ${docType}. Must be one of: ${VALID_DOC_TYPES.join(', ')}`);
  }

  const seq = getSequence(docType);
  if (!seq) {
    throw new Error(`No sequence configured for document type: ${docType}`);
  }

  if (seq.current_number === 0) {
    return {
      document_number: null,
      doc_type: docType,
      sequence: 0,
      next_number: buildDocumentNumber({ ...seq, current_number: 1 }),
    };
  }

  return {
    document_number: buildDocumentNumber(seq),
    doc_type: docType,
    sequence: seq.current_number,
    next_number: buildDocumentNumber({ ...seq, current_number: seq.current_number + 1 }),
  };
}

function reset(docType) {
  if (!VALID_DOC_TYPES.includes(docType)) {
    throw new Error(`Invalid document type: ${docType}. Must be one of: ${VALID_DOC_TYPES.join(', ')}`);
  }

  const seq = getSequence(docType);
  if (!seq) {
    throw new Error(`No sequence configured for document type: ${docType}`);
  }

  db.prepare(`
    UPDATE document_sequences
    SET current_number = 0, updated_at = CURRENT_TIMESTAMP
    WHERE doc_type = ?
  `).run(docType);

  return {
    doc_type: docType,
    sequence: 0,
    message: `Sequence for ${docType} has been reset`,
  };
}

function configure(docType, config) {
  if (!VALID_DOC_TYPES.includes(docType)) {
    throw new Error(`Invalid document type: ${docType}. Must be one of: ${VALID_DOC_TYPES.join(', ')}`);
  }

  const seq = getSequence(docType);
  if (!seq) {
    throw new Error(`No sequence configured for document type: ${docType}`);
  }

  const allowedFields = ['prefix', 'separator', 'year_format', 'padding'];
  const updates = [];
  const params = [];

  for (const field of allowedFields) {
    if (config[field] !== undefined) {
      if (field === 'padding') {
        const val = parseInt(config[field]);
        if (isNaN(val) || val < 1 || val > 10) {
          throw new Error('Padding must be an integer between 1 and 10');
        }
        updates.push(`${field} = ?`);
        params.push(val);
      } else {
        updates.push(`${field} = ?`);
        params.push(String(config[field]));
      }
    }
  }

  if (updates.length === 0) {
    throw new Error('No valid configuration fields provided');
  }

  updates.push('updated_at = CURRENT_TIMESTAMP');
  params.push(docType);

  db.prepare(`
    UPDATE document_sequences
    SET ${updates.join(', ')}
    WHERE doc_type = ?
  `).run(...params);

  return getSequence(docType);
}

function getAll() {
  return db.prepare('SELECT * FROM document_sequences ORDER BY doc_type').all();
}

module.exports = {
  generate,
  getCurrent,
  reset,
  configure,
  getAll,
  VALID_DOC_TYPES,
};
