// Stockage local des données : un simple fichier JSON persistant.
//
// Il expose exactement les opérations que le SDK Zite (`zite.<table>.*`)
// utilisait dans le code d'origine : findAll / findOne / create / update /
// delete / bulkCreate, avec les mêmes options (filters, fields, limit, offset).
//
// Le fichier vit dans DATA_DIR/db.json (volume Docker). Au premier démarrage il
// est créé à partir de seed.json (les données exportées du projet Zite).

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { TABLES, type FieldType } from './schema';

export type Row = Record<string, any>;

type DbFile = {
  version: number;
  tables: Record<string, Row[]>;
};

const NUMERIC: FieldType[] = ['number', 'currency', 'autonumber'];

const nowIso = () => new Date().toISOString();

function isPlainObject(value: unknown): value is Record<string, any> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Identifiant de colonne d'après son type (date, created_at, …). */
function fieldsOfType(table: string, type: FieldType): string[] {
  const fields = TABLES[table]?.fields ?? {};
  return Object.keys(fields).filter((name) => fields[name] === type);
}

function normalizeValue(type: FieldType | undefined, value: any) {
  if (value === undefined) return undefined;
  if (type === 'date' && typeof value === 'string' && value.includes('T')) {
    // Les champs date de Zite sont des journées : YYYY-MM-DD.
    return value.slice(0, 10);
  }
  if (type && NUMERIC.includes(type) && typeof value === 'string' && value.trim() !== '') {
    const n = Number(value);
    if (!Number.isNaN(n)) return n;
  }
  return value;
}

function equalish(a: any, b: any): boolean {
  if (a === b) return true;
  if (a === null || a === undefined || b === null || b === undefined) {
    return (a ?? null) === (b ?? null);
  }
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((v, i) => equalish(v, b[i]));
  }
  return String(a) === String(b);
}

function matchesCondition(value: any, condition: any): boolean {
  if (!isPlainObject(condition)) return equalish(value, condition);

  for (const [op, operand] of Object.entries(condition)) {
    switch (op) {
      case 'contains':
        if (Array.isArray(value)) {
          if (!value.some((v) => equalish(v, operand))) return false;
        } else if (typeof value === 'string') {
          if (!value.toLowerCase().includes(String(operand).toLowerCase())) return false;
        } else if (!equalish(value, operand)) {
          return false;
        }
        break;
      case 'not':
        if (operand === null) {
          if (value === null || value === undefined) return false;
        } else if (equalish(value, operand)) {
          return false;
        }
        break;
      case 'in':
        if (!Array.isArray(operand) || operand.length === 0) return false;
        if (!operand.some((v) => equalish(value, v))) return false;
        break;
      case 'notIn':
        if (Array.isArray(operand) && operand.some((v) => equalish(value, v))) return false;
        break;
      case 'lt':
        if (!(value < operand)) return false;
        break;
      case 'lte':
        if (!(value <= operand)) return false;
        break;
      case 'gt':
        if (!(value > operand)) return false;
        break;
      case 'gte':
        if (!(value >= operand)) return false;
        break;
      default:
        if (!equalish(value, condition[op])) return false;
    }
  }
  return true;
}

function matchesFilters(row: Row, filters: Record<string, any> | undefined): boolean {
  if (!filters) return true;
  for (const [field, condition] of Object.entries(filters)) {
    if (condition === undefined) continue;
    if (!matchesCondition(row[field], condition)) return false;
  }
  return true;
}

function project(row: Row, fields?: string[]): Row {
  if (!fields || fields.length === 0) return { ...row };
  const out: Row = {};
  for (const field of fields) out[field] = row[field];
  if (out.id === undefined) out.id = row.id;
  return out;
}

export class Store {
  private file: string;
  private db: DbFile;

  constructor(options: { dir: string; seed?: DbFile }) {
    const dir = options.dir;
    fs.mkdirSync(dir, { recursive: true });
    this.file = path.join(dir, 'db.json');

    if (fs.existsSync(this.file)) {
      this.db = JSON.parse(fs.readFileSync(this.file, 'utf8'));
    } else {
      this.db = options.seed ?? { version: 1, tables: {} };
      this.persist();
    }
    for (const table of Object.keys(TABLES)) {
      if (!this.db.tables[table]) this.db.tables[table] = [];
    }
  }

  private persist() {
    const tmp = `${this.file}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(this.db, null, 1));
    fs.renameSync(tmp, this.file);
  }

  private rows(table: string): Row[] {
    if (!TABLES[table]) throw new Error(`Table inconnue : ${table}`);
    if (!this.db.tables[table]) this.db.tables[table] = [];
    return this.db.tables[table];
  }

  private prepareRecord(table: string, record: Row, mode: 'create' | 'update'): Row {
    const schema = TABLES[table];
    const cleaned: Row = {};
    for (const [key, raw] of Object.entries(record)) {
      if (raw === undefined) continue;
      if (key === 'id' || key === '__createdAt' || key === '__updatedAt') continue;
      // Les champs calculés/auto-gérés ne s'écrivent pas à la main.
      const type = schema.fields[key];
      if (type === 'created_at' || type === 'updated_at' || type === 'autonumber') continue;
      cleaned[key] = normalizeValue(type, raw);
    }
    return cleaned;
  }

  findAll(
    table: string,
    params: { filters?: Record<string, any>; fields?: string[]; limit?: number; offset?: number; sort?: any } = {},
  ) {
    const rows = this.rows(table);
    const filtered = rows.filter((row) => matchesFilters(row, params.filters));
    const offset = Math.max(0, Number(params.offset) || 0);
    const limit = Math.min(Math.max(1, Number(params.limit) || 500), 2000);
    const page = filtered.slice(offset, offset + limit);
    return {
      records: page.map((row) => project(row, params.fields)),
      hasMore: filtered.length > offset + limit,
    };
  }

  findOne(
    table: string,
    params: { id?: string; filters?: Record<string, any>; fields?: string[] } = {},
  ) {
    const rows = this.rows(table);
    const found = params.id
      ? rows.find((row) => row.id === params.id)
      : rows.find((row) => matchesFilters(row, params.filters));
    return found ? project(found, params.fields) : undefined;
  }

  create(table: string, params: { record: Row }) {
    const rows = this.rows(table);
    const timestamp = nowIso();
    const row: Row = {
      id: crypto.randomUUID(),
      ...this.prepareRecord(table, params.record ?? {}, 'create'),
    };
    for (const field of fieldsOfType(table, 'created_at')) row[field] = row[field] ?? timestamp;
    for (const field of fieldsOfType(table, 'updated_at')) row[field] = timestamp;
    for (const field of fieldsOfType(table, 'autonumber')) {
      if (row[field] === undefined) {
        const max = rows.reduce((acc, r) => (typeof r[field] === 'number' && r[field] > acc ? r[field] : acc), 0);
        row[field] = max + 1;
      }
    }
    row.__createdAt = row.__createdAt ?? timestamp;
    row.__updatedAt = timestamp;
    rows.push(row);
    this.persist();
    return { ...row };
  }

  update(table: string, params: { id: string; record: Row }) {
    const rows = this.rows(table);
    const row = rows.find((r) => r.id === params.id);
    if (!row) throw new Error(`Enregistrement introuvable dans ${table} : ${params.id}`);
    const patch = this.prepareRecord(table, params.record ?? {}, 'update');
    Object.assign(row, patch);
    const timestamp = nowIso();
    for (const field of fieldsOfType(table, 'updated_at')) row[field] = timestamp;
    row.__updatedAt = timestamp;
    this.persist();
    return { id: row.id, fields: patch };
  }

  delete(table: string, params: { id: string }) {
    const rows = this.rows(table);
    const index = rows.findIndex((r) => r.id === params.id);
    if (index === -1) return { success: false, id: params.id };
    rows.splice(index, 1);
    this.persist();
    return { success: true, id: params.id };
  }

  bulkCreate(table: string, params: { records: Row[]; matchOn?: string[] }) {
    const created: Row[] = [];
    for (const record of params.records ?? []) {
      const match = params.matchOn?.length
        ? this.rows(table).find((row) => params.matchOn!.every((field) => equalish(row[field], record[field])))
        : undefined;
      if (match) {
        this.update(table, { id: match.id, record });
        created.push(this.findOne(table, { id: match.id })!);
      } else {
        created.push(this.create(table, { record }));
      }
    }
    return { success: true, records: created };
  }

  /** Remplace toute une table (utilisé par les scripts d'import). */
  replaceTable(table: string, rows: Row[]) {
    this.db.tables[table] = rows;
    this.persist();
  }

  stats() {
    return Object.fromEntries(Object.entries(this.db.tables).map(([k, v]) => [k, v.length]));
  }
}
