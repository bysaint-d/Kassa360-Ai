"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// server.ts
var import_express10 = __toESM(require("express"), 1);
var import_http = __toESM(require("http"), 1);
var import_path2 = __toESM(require("path"), 1);
var import_vite = require("vite");

// server/db/index.ts
var import_path = __toESM(require("path"), 1);
var import_fs = __toESM(require("fs"), 1);
var import_pg = __toESM(require("pg"), 1);
var import_node_sqlite = require("node:sqlite");
var DatabaseManager = class {
  pgPool = null;
  sqliteDb = null;
  isPostgres = false;
  initialized = false;
  constructor() {
    if (process.env.DATABASE_URL) {
      this.isPostgres = true;
      this.pgPool = new import_pg.default.Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: false } : void 0
      });
      console.log("\u{1F4E6} [Database] Initialized PostgreSQL connection pool");
    } else {
      this.isPostgres = false;
      const dbDir = import_path.default.join(process.cwd(), "data");
      if (!import_fs.default.existsSync(dbDir)) {
        import_fs.default.mkdirSync(dbDir, { recursive: true });
      }
      const dbPath = process.env.SQLITE_DB_PATH || import_path.default.join(dbDir, "kassa360.db");
      this.sqliteDb = new import_node_sqlite.DatabaseSync(dbPath);
      this.sqliteDb.exec("PRAGMA journal_mode = WAL;");
      this.sqliteDb.exec("PRAGMA foreign_keys = ON;");
      console.log(`\u{1F4E6} [Database] Initialized SQLite database at ${dbPath}`);
    }
  }
  async init() {
    if (this.initialized) return;
    const schemaPath = import_path.default.join(process.cwd(), "server", "db", "schema.sql");
    if (import_fs.default.existsSync(schemaPath)) {
      const schemaSql = import_fs.default.readFileSync(schemaPath, "utf-8");
      if (this.isPostgres && this.pgPool) {
        const pgSchema = schemaSql.replace(/INTEGER PRIMARY KEY AUTOINCREMENT/gi, "SERIAL PRIMARY KEY").replace(/CURRENT_TIMESTAMP/gi, "NOW()");
        await this.pgPool.query(pgSchema);
      } else if (this.sqliteDb) {
        this.sqliteDb.exec(schemaSql);
      }
      console.log("\u2705 [Database] Schema applied successfully");
    }
    this.initialized = true;
  }
  // Convert ? placeholder to $1, $2, etc. for PostgreSQL if running in Postgres mode
  formatQuery(sql, isPg) {
    if (!isPg) return sql;
    let paramIndex = 1;
    return sql.replace(/\?/g, () => `$${paramIndex++}`);
  }
  async query(sql, params = []) {
    await this.init();
    if (this.isPostgres && this.pgPool) {
      const formattedSql = this.formatQuery(sql, true);
      const res = await this.pgPool.query(formattedSql, params);
      return res.rows;
    } else if (this.sqliteDb) {
      const stmt = this.sqliteDb.prepare(sql);
      const rows = stmt.all(...params);
      return rows;
    }
    return [];
  }
  async queryOne(sql, params = []) {
    const rows = await this.query(sql, params);
    return rows.length > 0 ? rows[0] : null;
  }
  async execute(sql, params = []) {
    await this.init();
    if (this.isPostgres && this.pgPool) {
      const formattedSql = this.formatQuery(sql, true);
      const res = await this.pgPool.query(formattedSql, params);
      return { changes: res.rowCount || 0 };
    } else if (this.sqliteDb) {
      const stmt = this.sqliteDb.prepare(sql);
      const info = stmt.run(...params);
      return { changes: Number(info.changes || 0) };
    }
    return { changes: 0 };
  }
  async transaction(callback) {
    await this.init();
    if (this.isPostgres && this.pgPool) {
      const client = await this.pgPool.connect();
      try {
        await client.query("BEGIN");
        const trx = {
          query: async (q, p = []) => {
            const res = await client.query(this.formatQuery(q, true), p);
            return res.rows;
          },
          queryOne: async (q, p = []) => {
            const res = await client.query(this.formatQuery(q, true), p);
            return res.rows.length > 0 ? res.rows[0] : null;
          },
          execute: async (q, p = []) => {
            const res = await client.query(this.formatQuery(q, true), p);
            return { changes: res.rowCount || 0 };
          }
        };
        const result = await callback(trx);
        await client.query("COMMIT");
        return result;
      } catch (err) {
        await client.query("ROLLBACK");
        throw err;
      } finally {
        client.release();
      }
    } else if (this.sqliteDb) {
      this.sqliteDb.exec("BEGIN TRANSACTION;");
      try {
        const trx = {
          query: async (q, p = []) => {
            const stmt = this.sqliteDb.prepare(q);
            return stmt.all(...p);
          },
          queryOne: async (q, p = []) => {
            const stmt = this.sqliteDb.prepare(q);
            const rows = stmt.all(...p);
            return rows.length > 0 ? rows[0] : null;
          },
          execute: async (q, p = []) => {
            const stmt = this.sqliteDb.prepare(q);
            const info = stmt.run(...p);
            return { changes: Number(info.changes || 0) };
          }
        };
        const result = await callback(trx);
        this.sqliteDb.exec("COMMIT;");
        return result;
      } catch (err) {
        this.sqliteDb.exec("ROLLBACK;");
        throw err;
      }
    }
    throw new Error("Database not initialized");
  }
  isUsingPostgres() {
    return this.isPostgres;
  }
};
var db = new DatabaseManager();

// server/db/seed.ts
var import_bcryptjs = __toESM(require("bcryptjs"), 1);

// src/data/seedData.ts
var INITIAL_SETTING = {
  id: 1,
  storeName: "Calvotti Market",
  allowNegativeStock: false,
  currency: "\u20BC"
};
var INITIAL_CATEGORIES = [
  { id: 1, name: "S\xFCd v\u0259 Qat\u0131\u011F m\u0259hsullar\u0131" },
  { id: 2, name: "\u0130\xE7kil\u0259r v\u0259 \u015Eir\u0259l\u0259r" },
  { id: 3, name: "\xC7\xF6r\u0259k v\u0259 \u015Eirniyyat" },
  { id: 4, name: "Quru qidalar v\u0259 Paxlal\u0131lar" },
  { id: 5, name: "Ya\u011Flar v\u0259 Souslar" },
  { id: 6, name: "Q\u0259nnad\u0131 v\u0259 \u015Eokolad" },
  { id: 7, name: "M\u0259i\u015F\u0259t v\u0259 T\u0259mizlik" },
  { id: 8, name: "T\u0259r\u0259v\u0259z v\u0259 Meyv\u0259" }
];
var INITIAL_SUPPLIERS = [
  { id: 1, name: "Az\u0259rsun Holdinq", phone: "+994 12 404 12 12", notes: "\u018Frzaq v\u0259 ya\u011F t\u0259chizat\u0131" },
  { id: 2, name: "Milla Dairy MMC", phone: "+994 12 565 00 00", notes: "S\xFCd m\u0259hsullar\u0131 t\u0259chizat\xE7\u0131s\u0131" },
  { id: 3, name: "Coca-Cola Bottlers Azerbaijan", phone: "+994 12 447 20 20", notes: "S\u0259rinl\u0259\u015Fdirici i\xE7kil\u0259r" },
  { id: 4, name: "Sirab ASC", phone: "+994 12 310 10 10", notes: "T\u0259bii mineral sular" },
  { id: 5, name: "Veys\u0259lo\u011Flu \u015Eirk\u0259tl\u0259r Qrupu", phone: "+994 12 514 30 30", notes: "Q\u0259nnad\u0131 v\u0259 \u0259rzaq distrib\xFCtoru" }
];
var now = /* @__PURE__ */ new Date();
var formatDate = (daysAgo, hoursAgo = 0) => {
  const d = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1e3 - hoursAgo * 60 * 60 * 1e3);
  return d.toISOString();
};
var INITIAL_PRODUCTS = [
  {
    id: 1,
    barcode: "4760012300012",
    name: "Milla S\xFCd 3.2% 1L",
    category: "S\xFCd v\u0259 Qat\u0131\u011F m\u0259hsullar\u0131",
    brand: "Milla",
    color: "A\u011F",
    purchasePrice: 1.8,
    salePrice: 2.3,
    stockQuantity: 42,
    minimumStock: 10,
    supplier: "Milla Dairy MMC",
    notes: "TetraPak qabla\u015Fd\u0131rma",
    createdAt: formatDate(40),
    updatedAt: formatDate(1)
  },
  {
    id: 2,
    barcode: "4760012300029",
    name: "Milla Qat\u0131q 2.5% 500g",
    category: "S\xFCd v\u0259 Qat\u0131\u011F m\u0259hsullar\u0131",
    brand: "Milla",
    color: "A\u011F",
    purchasePrice: 1.1,
    salePrice: 1.5,
    stockQuantity: 28,
    minimumStock: 8,
    supplier: "Milla Dairy MMC",
    notes: "Plastik qab",
    createdAt: formatDate(35),
    updatedAt: formatDate(2)
  },
  {
    id: 3,
    barcode: "5449000000996",
    name: "Coca-Cola Classic 500ml",
    category: "\u0130\xE7kil\u0259r v\u0259 \u015Eir\u0259l\u0259r",
    brand: "Coca-Cola",
    color: "Q\u0131rm\u0131z\u0131",
    purchasePrice: 0.85,
    salePrice: 1.2,
    stockQuantity: 65,
    minimumStock: 15,
    supplier: "Coca-Cola Bottlers Azerbaijan",
    notes: "PET \u015F\xFC\u015F\u0259",
    createdAt: formatDate(45),
    updatedAt: formatDate(1)
  },
  {
    id: 4,
    barcode: "5449000001009",
    name: "Coca-Cola Zero 1L",
    category: "\u0130\xE7kil\u0259r v\u0259 \u015Eir\u0259l\u0259r",
    brand: "Coca-Cola",
    color: "Qara",
    purchasePrice: 1.4,
    salePrice: 1.9,
    stockQuantity: 4,
    minimumStock: 10,
    supplier: "Coca-Cola Bottlers Azerbaijan",
    notes: "Kritik stok h\u0259ddind\u0259dir",
    createdAt: formatDate(45),
    updatedAt: formatDate(1)
  },
  {
    id: 5,
    barcode: "4760011122334",
    name: "Sirab Qazs\u0131z Su 0.5L",
    category: "\u0130\xE7kil\u0259r v\u0259 \u015Eir\u0259l\u0259r",
    brand: "Sirab",
    color: "Mavi",
    purchasePrice: 0.4,
    salePrice: 0.7,
    stockQuantity: 80,
    minimumStock: 20,
    supplier: "Sirab ASC",
    notes: "T\u0259bii da\u011F suyu",
    createdAt: formatDate(50),
    updatedAt: formatDate(3)
  },
  {
    id: 6,
    barcode: "4760023456789",
    name: "M\xF6c\xFCz\u0259 Qar\u011F\u0131dal\u0131 Ya\u011F\u0131 1L",
    category: "Ya\u011Flar v\u0259 Souslar",
    brand: "M\xF6c\xFCz\u0259",
    color: "Sar\u0131",
    purchasePrice: 4.1,
    salePrice: 5.4,
    stockQuantity: 18,
    minimumStock: 8,
    supplier: "Az\u0259rsun Holdinq",
    notes: "Rafin\u0259 edilmi\u015F duru ya\u011F",
    createdAt: formatDate(30),
    updatedAt: formatDate(4)
  },
  {
    id: 7,
    barcode: "4760034567890",
    name: "Final K\u0259r\u0259 Ya\u011F\u0131 82% 200g",
    category: "Ya\u011Flar v\u0259 Souslar",
    brand: "Final",
    color: "A\u011F",
    purchasePrice: 3.2,
    salePrice: 4.2,
    stockQuantity: 3,
    minimumStock: 6,
    supplier: "Az\u0259rsun Holdinq",
    notes: "Kritik stok",
    createdAt: formatDate(30),
    updatedAt: formatDate(2)
  },
  {
    id: 8,
    barcode: "4760045678901",
    name: "Bizim Tarla Ya\u015F\u0131l Noxud 400g",
    category: "Quru qidalar v\u0259 Paxlal\u0131lar",
    brand: "Bizim Tarla",
    color: "Ya\u015F\u0131l",
    purchasePrice: 1.6,
    salePrice: 2.2,
    stockQuantity: 34,
    minimumStock: 10,
    supplier: "Az\u0259rsun Holdinq",
    notes: "Konservl\u0259\u015Fdirilmi\u015F",
    createdAt: formatDate(40),
    updatedAt: formatDate(5)
  },
  {
    id: 9,
    barcode: "4760056789012",
    name: "Doyum D\xFCy\xFC Super Basmati 1kg",
    category: "Quru qidalar v\u0259 Paxlal\u0131lar",
    brand: "Doyum",
    color: "A\u011F",
    purchasePrice: 4.8,
    salePrice: 6.5,
    stockQuantity: 22,
    minimumStock: 8,
    supplier: "Veys\u0259lo\u011Flu \u015Eirk\u0259tl\u0259r Qrupu",
    notes: "Uzund\u0259n\u0259li keyfiyy\u0259tli d\xFCy\xFC",
    createdAt: formatDate(25),
    updatedAt: formatDate(1)
  },
  {
    id: 10,
    barcode: "4760067890123",
    name: "Alpen Gold \u015Eokolad F\u0131nd\u0131ql\u0131 85g",
    category: "Q\u0259nnad\u0131 v\u0259 \u015Eokolad",
    brand: "Alpen Gold",
    color: "B\u0259n\xF6v\u015F\u0259yi",
    purchasePrice: 1.7,
    salePrice: 2.4,
    stockQuantity: 50,
    minimumStock: 12,
    supplier: "Veys\u0259lo\u011Flu \u015Eirk\u0259tl\u0259r Qrupu",
    notes: "S\xFCdl\xFC \u015Fokolad",
    createdAt: formatDate(20),
    updatedAt: formatDate(2)
  },
  {
    id: 11,
    barcode: "4760078901234",
    name: "Fairy Qabyuyan Maye Limon 650ml",
    category: "M\u0259i\u015F\u0259t v\u0259 T\u0259mizlik",
    brand: "Fairy",
    color: "Sar\u0131",
    purchasePrice: 3.1,
    salePrice: 4.3,
    stockQuantity: 15,
    minimumStock: 5,
    supplier: "Veys\u0259lo\u011Flu \u015Eirk\u0259tl\u0259r Qrupu",
    notes: "Qat\u0131 konsentrat",
    createdAt: formatDate(45),
    updatedAt: formatDate(1)
  },
  {
    id: 12,
    barcode: "4760089012345",
    name: "T\u0259ndir \xC7\xF6r\u0259yi \u0130sti 450g",
    category: "\xC7\xF6r\u0259k v\u0259 \u015Eirniyyat",
    brand: "Yerli T\u0259ndir",
    color: "Q\u0131z\u0131l\u0131",
    purchasePrice: 0.5,
    salePrice: 0.8,
    stockQuantity: 25,
    minimumStock: 10,
    supplier: "Veys\u0259lo\u011Flu \u015Eirk\u0259tl\u0259r Qrupu",
    notes: "G\xFCnd\u0259lik t\u0259z\u0259 bi\u015Firilir",
    createdAt: formatDate(10),
    updatedAt: formatDate(0)
  }
];
var INITIAL_SALES = [
  {
    id: 101,
    date: formatDate(0, 2),
    subtotal: 10.9,
    discount: 0.9,
    total: 10,
    paidAmount: 10,
    changeAmount: 0,
    debtAmount: 0,
    paymentMethod: "Na\u011Fd",
    customerName: "R\u0259\u015Fad \u018Fliyev",
    isReturned: false,
    items: [
      {
        id: 1,
        saleId: 101,
        productId: 1,
        productName: "Milla S\xFCd 3.2% 1L",
        productBarcode: "4760012300012",
        quantity: 2,
        salePrice: 2.3,
        costPrice: 1.8,
        total: 4.6,
        profit: 1
      },
      {
        id: 2,
        saleId: 101,
        productId: 3,
        productName: "Coca-Cola Classic 500ml",
        productBarcode: "5449000000996",
        quantity: 1,
        salePrice: 1.2,
        costPrice: 0.85,
        total: 1.2,
        profit: 0.35
      },
      {
        id: 3,
        saleId: 101,
        productId: 7,
        productName: "Final K\u0259r\u0259 Ya\u011F\u0131 82% 200g",
        productBarcode: "4760034567890",
        quantity: 1,
        salePrice: 4.2,
        costPrice: 3.2,
        total: 4.2,
        profit: 1
      },
      {
        id: 4,
        saleId: 101,
        productId: 5,
        productName: "Sirab Qazs\u0131z Su 0.5L",
        productBarcode: "4760011122334",
        quantity: 1,
        salePrice: 0.7,
        costPrice: 0.4,
        total: 0.7,
        profit: 0.3
      }
    ]
  },
  {
    id: 102,
    date: formatDate(0, 4),
    subtotal: 16.2,
    discount: 0,
    total: 16.2,
    paidAmount: 20,
    changeAmount: 3.8,
    debtAmount: 0,
    paymentMethod: "Kart",
    customerName: "Aysel M\u0259mm\u0259dova",
    isReturned: false,
    items: [
      {
        id: 5,
        saleId: 102,
        productId: 6,
        productName: "M\xF6c\xFCz\u0259 Qar\u011F\u0131dal\u0131 Ya\u011F\u0131 1L",
        productBarcode: "4760023456789",
        quantity: 2,
        salePrice: 5.4,
        costPrice: 4.1,
        total: 10.8,
        profit: 2.6
      },
      {
        id: 6,
        saleId: 102,
        productId: 6,
        productName: "Fairy Qabyuyan Maye Limon 650ml",
        productBarcode: "4760078901234",
        quantity: 1,
        salePrice: 4.3,
        costPrice: 3.1,
        total: 4.3,
        profit: 1.2
      },
      {
        id: 7,
        saleId: 102,
        productId: 12,
        productName: "T\u0259ndir \xC7\xF6r\u0259yi \u0130sti 450g",
        productBarcode: "4760089012345",
        quantity: 1,
        salePrice: 0.8,
        costPrice: 0.5,
        total: 0.8,
        profit: 0.3
      }
    ]
  },
  {
    id: 103,
    date: formatDate(1, 3),
    subtotal: 15.4,
    discount: 0.4,
    total: 15,
    paidAmount: 15,
    changeAmount: 0,
    debtAmount: 0,
    paymentMethod: "Na\u011Fd",
    customerName: "Samir Quliyev",
    isReturned: false,
    items: [
      {
        id: 8,
        saleId: 103,
        productId: 9,
        productName: "Doyum D\xFCy\xFC Super Basmati 1kg",
        productBarcode: "4760056789012",
        quantity: 2,
        salePrice: 6.5,
        costPrice: 4.8,
        total: 13,
        profit: 3.4
      },
      {
        id: 9,
        saleId: 103,
        productId: 10,
        productName: "Alpen Gold \u015Eokolad F\u0131nd\u0131ql\u0131 85g",
        productBarcode: "4760067890123",
        quantity: 1,
        salePrice: 2.4,
        costPrice: 1.7,
        total: 2.4,
        profit: 0.7
      }
    ]
  },
  {
    id: 104,
    date: formatDate(3, 5),
    subtotal: 24.5,
    discount: 1.5,
    total: 23,
    paidAmount: 23,
    changeAmount: 0,
    debtAmount: 0,
    paymentMethod: "Kart",
    customerName: "Leyla H\u0259s\u0259nova",
    isReturned: false,
    items: [
      {
        id: 10,
        saleId: 104,
        productId: 1,
        productName: "Milla S\xFCd 3.2% 1L",
        productBarcode: "4760012300012",
        quantity: 4,
        salePrice: 2.3,
        costPrice: 1.8,
        total: 9.2,
        profit: 2
      },
      {
        id: 11,
        saleId: 104,
        productId: 6,
        productName: "M\xF6c\xFCz\u0259 Qar\u011F\u0131dal\u0131 Ya\u011F\u0131 1L",
        productBarcode: "4760023456789",
        quantity: 2,
        salePrice: 5.4,
        costPrice: 4.1,
        total: 10.8,
        profit: 2.6
      },
      {
        id: 12,
        saleId: 104,
        productId: 8,
        productName: "Bizim Tarla Ya\u015F\u0131l Noxud 400g",
        productBarcode: "4760045678901",
        quantity: 2,
        salePrice: 2.2,
        costPrice: 1.6,
        total: 4.4,
        profit: 1.2
      }
    ]
  },
  {
    id: 105,
    date: formatDate(0, 4),
    subtotal: 20,
    discount: 0,
    total: 20,
    paidAmount: 15,
    changeAmount: 0,
    debtAmount: 5,
    initialPaidAmount: 10,
    initialDebtAmount: 10,
    paymentMethod: "Borc",
    customerName: "Elmir",
    notes: "A\u011F polo k\xF6yn\u0259k / nisy\u0259 d\u0259ft\u0259ri qeydi",
    isReturned: false,
    debtPayments: [
      {
        id: 1051,
        saleId: 105,
        date: formatDate(0, 4),
        amount: 10,
        previousDebt: 20,
        remainingDebt: 10,
        paymentMethod: "Na\u011Fd",
        notes: "\u0130lkin \xF6d\u0259ni\u015F (Sat\u0131\u015F an\u0131nda kassa)"
      },
      {
        id: 1052,
        saleId: 105,
        date: formatDate(0, 1),
        amount: 5,
        previousDebt: 10,
        remainingDebt: 5,
        paymentMethod: "Na\u011Fd",
        notes: "Hiss\u0259vi borc \xF6d\u0259ni\u015Fi (1-ci \xF6d\u0259ni\u015F)"
      }
    ],
    items: [
      {
        id: 13,
        saleId: 105,
        productId: 3,
        productName: "Milla K\u0259r\u0259 Ya\u011F\u0131 82.5% 200g",
        productBarcode: "4760012300036",
        quantity: 3,
        salePrice: 4.5,
        costPrice: 3.5,
        total: 13.5,
        profit: 3
      },
      {
        id: 14,
        saleId: 105,
        productId: 1,
        productName: "Milla S\xFCd 3.2% 1L",
        productBarcode: "4760012300012",
        quantity: 2,
        salePrice: 2.3,
        costPrice: 1.8,
        total: 4.6,
        profit: 1
      },
      {
        id: 15,
        saleId: 105,
        productId: 12,
        productName: "T\u0259ndir \xC7\xF6r\u0259yi \u0130sti 450g",
        productBarcode: "4760089012345",
        quantity: 2,
        salePrice: 0.95,
        costPrice: 0.5,
        total: 1.9,
        profit: 0.9
      }
    ]
  }
];
var INITIAL_STOCK_MOVEMENTS = [
  { id: 1, productId: 1, productName: "Milla S\xFCd 3.2% 1L", type: "\u0130lkin stok", quantity: 50, previousStock: 0, newStock: 50, date: formatDate(30), notes: "\u0130lkin daxilolma" },
  { id: 2, productId: 3, productName: "Coca-Cola Classic 500ml", type: "\u0130lkin stok", quantity: 70, previousStock: 0, newStock: 70, date: formatDate(30), notes: "\u0130lkin daxilolma" },
  { id: 3, productId: 1, productName: "Milla S\xFCd 3.2% 1L", type: "Sat\u0131\u015F", quantity: -2, previousStock: 44, newStock: 42, date: formatDate(0, 2), notes: "Sat\u0131\u015F #101" },
  { id: 4, productId: 6, productName: "M\xF6c\xFCz\u0259 Qar\u011F\u0131dal\u0131 Ya\u011F\u0131 1L", type: "Stok d\xFCz\u0259li\u015Fi", quantity: 3, previousStock: 15, newStock: 18, date: formatDate(2), notes: "\u0130nventarizasiya d\xFCz\u0259li\u015Fi" }
];

// server/db/seed.ts
async function seedInitialData() {
  await db.init();
  const existingUsers = await db.query("SELECT COUNT(*) as count FROM users");
  const userCount = Number(existingUsers[0]?.count || 0);
  if (userCount === 0) {
    console.log("\u{1F331} [Seed] Seeding default system roles and users...");
    const usersToSeed = [
      {
        id: "usr_admin",
        username: "admin",
        password: "admin123",
        full_name: "Ba\u015F Administrator",
        role: "admin"
      },
      {
        id: "usr_manager",
        username: "manager",
        password: "manager123",
        full_name: "Ma\u011Faza Meneceri",
        role: "manager"
      },
      {
        id: "usr_seller",
        username: "seller",
        password: "seller123",
        full_name: "Kassir / Sat\u0131c\u0131 (Nigar \u018Fliyeva)",
        role: "seller"
      },
      {
        id: "usr_warehouse",
        username: "warehouse",
        password: "warehouse123",
        full_name: "Anbardar (R\u0259\u015Fad M\u0259mm\u0259dov)",
        role: "warehouse"
      }
    ];
    for (const u of usersToSeed) {
      const hash = import_bcryptjs.default.hashSync(u.password, 10);
      await db.execute(
        `INSERT INTO users (id, username, password_hash, full_name, role, is_active)
         VALUES (?, ?, ?, ?, ?, 1)`,
        [u.id, u.username, hash, u.full_name, u.role]
      );
    }
  }
  const existingSettings = await db.query("SELECT COUNT(*) as count FROM settings");
  if (Number(existingSettings[0]?.count || 0) === 0) {
    console.log("\u{1F331} [Seed] Seeding store settings...");
    const defaultSettings = {
      storeName: INITIAL_SETTING.storeName || "CALVOTTI MARKET",
      address: INITIAL_SETTING.address || "Nizami k\xFC\xE7. 45, Bak\u0131",
      phone: INITIAL_SETTING.phone || "+994 50 123 45 67",
      currency: INITIAL_SETTING.currency || "AZN",
      receiptFooter: INITIAL_SETTING.receiptFooter || "Bizi se\xE7diyiniz \xFC\xE7\xFCn t\u0259\u015F\u0259kk\xFCr edirik! Geyim d\u0259yi\u015Fimi 3 g\xFCn \u0259rzind\u0259 q\u0259bzl\u0259 m\xFCmk\xFCnd\xFCr.",
      allowNegativeStock: INITIAL_SETTING.allowNegativeStock ? "true" : "false",
      defaultDiscountLimitPercent: "30",
      autoPrintReceipt: INITIAL_SETTING.autoPrintReceipt ? "true" : "false",
      taxPercent: String(INITIAL_SETTING.taxPercent || 0)
    };
    for (const [k, v] of Object.entries(defaultSettings)) {
      await db.execute("INSERT INTO settings (key, value) VALUES (?, ?)", [k, v]);
    }
  }
  const existingCategories = await db.query("SELECT COUNT(*) as count FROM categories");
  if (Number(existingCategories[0]?.count || 0) === 0) {
    console.log("\u{1F331} [Seed] Seeding clothing categories...");
    for (const cat of INITIAL_CATEGORIES) {
      await db.execute(
        "INSERT OR IGNORE INTO categories (id, name) VALUES (?, ?)",
        [String(cat.id), cat.name]
      );
    }
  }
  const existingSuppliers = await db.query("SELECT COUNT(*) as count FROM suppliers");
  if (Number(existingSuppliers[0]?.count || 0) === 0) {
    console.log("\u{1F331} [Seed] Seeding suppliers...");
    for (const sup of INITIAL_SUPPLIERS) {
      await db.execute(
        "INSERT OR IGNORE INTO suppliers (id, name, phone, notes) VALUES (?, ?, ?, ?)",
        [String(sup.id), sup.name, sup.phone || "", sup.notes || ""]
      );
    }
  }
  const existingProducts = await db.query("SELECT COUNT(*) as count FROM products");
  if (Number(existingProducts[0]?.count || 0) === 0) {
    console.log("\u{1F331} [Seed] Seeding initial clothing catalogue...");
    for (const prod of INITIAL_PRODUCTS) {
      const sizesJson = prod.sizes ? JSON.stringify(prod.sizes) : JSON.stringify([]);
      await db.execute(
        `INSERT INTO products (
          id, barcode, name, category, brand, color, color_hex, size, sizes_json,
          purchase_price, sale_price, stock_quantity, minimum_stock, supplier,
          image_path, notes, version
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
        [
          String(prod.id),
          prod.barcode || "",
          prod.name,
          prod.category,
          prod.brand || "",
          prod.color || "",
          prod.colorHex || "",
          prod.size || "",
          sizesJson,
          prod.purchasePrice || 0,
          prod.salePrice || 0,
          prod.stockQuantity || 0,
          prod.minimumStock || 3,
          prod.supplier || "",
          prod.imagePath || "",
          prod.notes || ""
        ]
      );
      if (prod.variants && prod.variants.length > 0) {
        for (const v of prod.variants) {
          await db.execute(
            `INSERT INTO product_variants (id, product_id, color, color_hex, size, stock_quantity, barcode)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
              v.id || `var_${prod.id}_${Math.random().toString(36).substring(2, 8)}`,
              String(prod.id),
              v.color || "",
              v.colorHex || "",
              v.size || "",
              v.stockQuantity || 0,
              v.barcode || ""
            ]
          );
        }
      }
    }
  }
  console.log("\u2705 [Seed] Database initialization and seed check complete");
}

// server/websocket/wsServer.ts
var import_ws = require("ws");
var RealtimeHub = class {
  wss = null;
  clients = /* @__PURE__ */ new Set();
  init(server) {
    this.wss = new import_ws.WebSocketServer({ server, path: "/ws" });
    this.wss.on("connection", (ws) => {
      this.clients.add(ws);
      console.log(`\u{1F50C} [WebSocket] Client connected. Total active clients: ${this.clients.size}`);
      ws.send(
        JSON.stringify({
          type: "CONNECTED",
          message: "Kassa360 Real-Time Sync Connected",
          timestamp: (/* @__PURE__ */ new Date()).toISOString()
        })
      );
      ws.on("close", () => {
        this.clients.delete(ws);
        console.log(`\u{1F50C} [WebSocket] Client disconnected. Total active clients: ${this.clients.size}`);
      });
      ws.on("error", (err) => {
        console.warn("\u{1F50C} [WebSocket] Client error:", err.message);
        this.clients.delete(ws);
      });
    });
  }
  broadcast(type, payload, sourceDeviceId) {
    if (!this.wss || this.clients.size === 0) return;
    const message = {
      type,
      payload,
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      sourceDeviceId
    };
    const data = JSON.stringify(message);
    for (const client of this.clients) {
      if (client.readyState === import_ws.WebSocket.OPEN) {
        try {
          client.send(data);
        } catch (err) {
          console.warn("Failed to send WS message to client:", err);
        }
      }
    }
  }
  getActiveClientCount() {
    return this.clients.size;
  }
};
var realtimeHub = new RealtimeHub();

// server/routes/authRoutes.ts
var import_express = require("express");
var import_bcryptjs2 = __toESM(require("bcryptjs"), 1);

// server/auth/jwt.ts
var import_jsonwebtoken = __toESM(require("jsonwebtoken"), 1);
var JWT_SECRET = process.env.JWT_SECRET || "kassa360-enterprise-pos-secret-2026-xyz";
function generateToken(payload) {
  return import_jsonwebtoken.default.sign(payload, JWT_SECRET, { expiresIn: "7d" });
}
function verifyToken(token) {
  try {
    return import_jsonwebtoken.default.verify(token, JWT_SECRET);
  } catch (err) {
    return null;
  }
}

// server/auth/middleware.ts
function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ error: "\u0130caz\u0259 t\u0259l\u0259b olunur (Token yoxdur)" });
    return;
  }
  const token = authHeader.split(" ")[1];
  const payload = verifyToken(token);
  if (!payload) {
    res.status(401).json({ error: "Token etibars\u0131zd\u0131r v\u0259 ya m\xFCdd\u0259ti bitib" });
    return;
  }
  req.user = payload;
  next();
}
function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.split(" ")[1];
    const payload = verifyToken(token);
    if (payload) {
      req.user = payload;
    }
  }
  next();
}
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      res.status(401).json({ error: "\u0130caz\u0259 t\u0259l\u0259b olunur" });
      return;
    }
    if (!roles.includes(req.user.role) && req.user.role !== "admin") {
      res.status(403).json({ error: "Bu \u0259m\u0259liyyat \xFC\xE7\xFCn s\u0259lahiyy\u0259tiniz \xE7atm\u0131r" });
      return;
    }
    next();
  };
}

// server/routes/authRoutes.ts
var router = (0, import_express.Router)();
router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      res.status(400).json({ error: "\u0130stifad\u0259\xE7i ad\u0131 v\u0259 \u015Fifr\u0259 daxil edilm\u0259lidir" });
      return;
    }
    const user = await db.queryOne("SELECT * FROM users WHERE username = ?", [username.trim()]);
    if (!user || user.is_active !== 1) {
      res.status(401).json({ error: "\u0130stifad\u0259\xE7i ad\u0131 v\u0259 ya \u015Fifr\u0259 yanl\u0131\u015Fd\u0131r" });
      return;
    }
    const isMatch = import_bcryptjs2.default.compareSync(password, user.password_hash);
    if (!isMatch) {
      res.status(401).json({ error: "\u0130stifad\u0259\xE7i ad\u0131 v\u0259 ya \u015Fifr\u0259 yanl\u0131\u015Fd\u0131r" });
      return;
    }
    const token = generateToken({
      userId: user.id,
      username: user.username,
      role: user.role,
      fullName: user.full_name
    });
    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        fullName: user.full_name,
        role: user.role
      }
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Giri\u015F zaman\u0131 x\u0259ta ba\u015F verdi" });
  }
});
router.get("/me", requireAuth, async (req, res) => {
  try {
    const user = await db.queryOne("SELECT id, username, full_name, role FROM users WHERE id = ?", [req.user.userId]);
    if (!user) {
      res.status(404).json({ error: "\u0130stifad\u0259\xE7i tap\u0131lmad\u0131" });
      return;
    }
    res.json({ user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router.get("/users", requireAuth, requireRole("admin", "manager"), async (_req, res) => {
  try {
    const users = await db.query(
      "SELECT id, username, full_name, role, is_active, created_at FROM users ORDER BY created_at ASC"
    );
    res.json({ users });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router.post("/users", requireAuth, requireRole("admin"), async (req, res) => {
  try {
    const { username, password, fullName, role } = req.body;
    if (!username || !password || !fullName || !role) {
      res.status(400).json({ error: "B\xFCt\xFCn m\u0259lumatlar doldurulmal\u0131d\u0131r" });
      return;
    }
    const existing = await db.queryOne("SELECT id FROM users WHERE username = ?", [username.trim()]);
    if (existing) {
      res.status(400).json({ error: "Bu istifad\u0259\xE7i ad\u0131 art\u0131q m\xF6vcuddur" });
      return;
    }
    const hash = import_bcryptjs2.default.hashSync(password, 10);
    const id = `usr_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    await db.execute(
      "INSERT INTO users (id, username, password_hash, full_name, role, is_active) VALUES (?, ?, ?, ?, ?, 1)",
      [id, username.trim(), hash, fullName.trim(), role]
    );
    res.status(201).json({
      success: true,
      user: { id, username: username.trim(), fullName: fullName.trim(), role }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
var authRoutes_default = router;

// server/routes/productRoutes.ts
var import_express2 = require("express");
var router2 = (0, import_express2.Router)();
function formatProductRow(p, variants = []) {
  let sizes = [];
  try {
    if (p.sizes_json) {
      sizes = JSON.parse(p.sizes_json);
    } else if (p.size) {
      sizes = p.size.split(/[,/]+/).map((s) => s.trim()).filter(Boolean);
    }
  } catch (e) {
    sizes = [];
  }
  return {
    id: p.id,
    barcode: p.barcode || "",
    name: p.name,
    category: p.category,
    brand: p.brand || "",
    color: p.color || "",
    colorHex: p.color_hex || "",
    size: p.size || "",
    sizes,
    purchasePrice: Number(p.purchase_price || 0),
    salePrice: Number(p.sale_price || 0),
    stockQuantity: Number(p.stock_quantity || 0),
    minimumStock: Number(p.minimum_stock || 3),
    supplier: p.supplier || "",
    imagePath: p.image_path || "",
    notes: p.notes || "",
    variants: variants.map((v) => ({
      id: v.id,
      color: v.color || "",
      colorHex: v.color_hex || "",
      size: v.size || "",
      stockQuantity: Number(v.stock_quantity || 0),
      barcode: v.barcode || ""
    }))
  };
}
router2.get("/", async (req, res) => {
  try {
    const { category, search } = req.query;
    let sql = "SELECT * FROM products WHERE 1=1";
    const params = [];
    if (category && category !== "all") {
      sql += " AND category = ?";
      params.push(String(category));
    }
    if (search && typeof search === "string" && search.trim()) {
      const q = `%${search.trim().toLowerCase()}%`;
      sql += " AND (LOWER(name) LIKE ? OR LOWER(barcode) LIKE ? OR LOWER(brand) LIKE ?)";
      params.push(q, q, q);
    }
    sql += " ORDER BY name ASC";
    const products = await db.query(sql, params);
    const allVariants = await db.query("SELECT * FROM product_variants");
    const variantMap = /* @__PURE__ */ new Map();
    for (const v of allVariants) {
      const list = variantMap.get(v.product_id) || [];
      list.push(v);
      variantMap.set(v.product_id, list);
    }
    const formatted = products.map((p) => formatProductRow(p, variantMap.get(p.id) || []));
    res.json({ products: formatted });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router2.get("/barcode/:barcode", async (req, res) => {
  try {
    const barcode = req.params.barcode.trim();
    const product = await db.queryOne("SELECT * FROM products WHERE barcode = ?", [barcode]);
    if (product) {
      const variants = await db.query("SELECT * FROM product_variants WHERE product_id = ?", [product.id]);
      res.json({ product: formatProductRow(product, variants) });
      return;
    }
    const variant = await db.queryOne("SELECT * FROM product_variants WHERE barcode = ?", [barcode]);
    if (variant) {
      const parentProduct = await db.queryOne("SELECT * FROM products WHERE id = ?", [variant.product_id]);
      if (parentProduct) {
        const variants = await db.query("SELECT * FROM product_variants WHERE product_id = ?", [parentProduct.id]);
        res.json({
          product: formatProductRow(parentProduct, variants),
          matchedVariantId: variant.id
        });
        return;
      }
    }
    res.status(404).json({ error: "Barkoda uy\u011Fun m\u0259hsul tap\u0131lmad\u0131" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router2.get("/:id", async (req, res) => {
  try {
    const product = await db.queryOne("SELECT * FROM products WHERE id = ?", [req.params.id]);
    if (!product) {
      res.status(404).json({ error: "M\u0259hsul tap\u0131lmad\u0131" });
      return;
    }
    const variants = await db.query("SELECT * FROM product_variants WHERE product_id = ?", [product.id]);
    res.json({ product: formatProductRow(product, variants) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router2.post("/", optionalAuth, async (req, res) => {
  try {
    const body = req.body;
    if (!body.name || !body.category) {
      res.status(400).json({ error: "M\u0259hsul ad\u0131 v\u0259 kateqoriya m\xFCtl\u0259qdir" });
      return;
    }
    const id = body.id ? String(body.id) : `prod_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const sizesJson = Array.isArray(body.sizes) ? JSON.stringify(body.sizes) : JSON.stringify([]);
    const stockQty = Number(body.stockQuantity || 0);
    await db.transaction(async (trx) => {
      await trx.execute(
        `INSERT INTO products (
          id, barcode, name, category, brand, color, color_hex, size, sizes_json,
          purchase_price, sale_price, stock_quantity, minimum_stock, supplier,
          image_path, notes, version
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
        [
          id,
          body.barcode?.trim() || null,
          body.name.trim(),
          body.category.trim(),
          body.brand?.trim() || "",
          body.color?.trim() || "",
          body.colorHex?.trim() || "",
          body.size?.trim() || "",
          sizesJson,
          Number(body.purchasePrice || 0),
          Number(body.salePrice || 0),
          stockQty,
          Number(body.minimumStock || 3),
          body.supplier?.trim() || "",
          body.imagePath || "",
          body.notes || ""
        ]
      );
      if (Array.isArray(body.variants)) {
        for (const v of body.variants) {
          const varId = v.id || `var_${id}_${Math.random().toString(36).substring(2, 6)}`;
          await trx.execute(
            `INSERT INTO product_variants (id, product_id, color, color_hex, size, stock_quantity, barcode)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
              varId,
              id,
              v.color?.trim() || "",
              v.colorHex?.trim() || "",
              v.size?.trim() || "",
              Number(v.stockQuantity || 0),
              v.barcode?.trim() || null
            ]
          );
        }
      }
      if (stockQty > 0) {
        await trx.execute(
          `INSERT INTO stock_movements (id, product_id, product_name, type, quantity, previous_stock, new_stock, notes, user_id, user_name, date)
           VALUES (?, ?, ?, '\u0130lkin stok', ?, 0, ?, 'M\u0259hsul yarad\u0131lark\u0259n qeyd\u0259 al\u0131nd\u0131', ?, ?, ?)`,
          [
            `mov_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            id,
            body.name.trim(),
            stockQty,
            stockQty,
            req.user?.userId || "system",
            req.user?.fullName || "Kassa360",
            (/* @__PURE__ */ new Date()).toISOString()
          ]
        );
      }
    });
    const created = await db.queryOne("SELECT * FROM products WHERE id = ?", [id]);
    const variants = await db.query("SELECT * FROM product_variants WHERE product_id = ?", [id]);
    const formatted = formatProductRow(created, variants);
    realtimeHub.broadcast("PRODUCT_CREATED", formatted, req.headers["x-device-id"]);
    res.status(201).json({ success: true, product: formatted });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router2.put("/:id", optionalAuth, async (req, res) => {
  try {
    const id = req.params.id;
    const body = req.body;
    const existing = await db.queryOne("SELECT * FROM products WHERE id = ?", [id]);
    if (!existing) {
      res.status(404).json({ error: "M\u0259hsul tap\u0131lmad\u0131" });
      return;
    }
    const sizesJson = Array.isArray(body.sizes) ? JSON.stringify(body.sizes) : existing.sizes_json;
    const newStockQty = body.stockQuantity !== void 0 ? Number(body.stockQuantity) : Number(existing.stock_quantity);
    const oldStockQty = Number(existing.stock_quantity);
    await db.transaction(async (trx) => {
      await trx.execute(
        `UPDATE products SET
          barcode = ?, name = ?, category = ?, brand = ?, color = ?, color_hex = ?,
          size = ?, sizes_json = ?, purchase_price = ?, sale_price = ?,
          stock_quantity = ?, minimum_stock = ?, supplier = ?, image_path = ?,
          notes = ?, version = version + 1, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?`,
        [
          body.barcode !== void 0 ? body.barcode.trim() : existing.barcode,
          body.name !== void 0 ? body.name.trim() : existing.name,
          body.category !== void 0 ? body.category.trim() : existing.category,
          body.brand !== void 0 ? body.brand.trim() : existing.brand,
          body.color !== void 0 ? body.color.trim() : existing.color,
          body.colorHex !== void 0 ? body.colorHex.trim() : existing.color_hex,
          body.size !== void 0 ? body.size.trim() : existing.size,
          sizesJson,
          body.purchasePrice !== void 0 ? Number(body.purchasePrice) : Number(existing.purchase_price),
          body.salePrice !== void 0 ? Number(body.salePrice) : Number(existing.sale_price),
          newStockQty,
          body.minimumStock !== void 0 ? Number(body.minimumStock) : Number(existing.minimum_stock),
          body.supplier !== void 0 ? body.supplier.trim() : existing.supplier,
          body.imagePath !== void 0 ? body.imagePath : existing.image_path,
          body.notes !== void 0 ? body.notes : existing.notes,
          id
        ]
      );
      if (Array.isArray(body.variants)) {
        await trx.execute("DELETE FROM product_variants WHERE product_id = ?", [id]);
        for (const v of body.variants) {
          const varId = v.id || `var_${id}_${Math.random().toString(36).substring(2, 6)}`;
          await trx.execute(
            `INSERT INTO product_variants (id, product_id, color, color_hex, size, stock_quantity, barcode)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
              varId,
              id,
              v.color?.trim() || "",
              v.colorHex?.trim() || "",
              v.size?.trim() || "",
              Number(v.stockQuantity || 0),
              v.barcode?.trim() || null
            ]
          );
        }
      }
      if (newStockQty !== oldStockQty) {
        const diff = newStockQty - oldStockQty;
        await trx.execute(
          `INSERT INTO stock_movements (id, product_id, product_name, type, quantity, previous_stock, new_stock, notes, user_id, user_name, date)
           VALUES (?, ?, ?, 'Stok d\xFCz\u0259li\u015Fi', ?, ?, ?, 'M\u0259hsul redakt\u0259sind\u0259 d\u0259yi\u015Fdirildi', ?, ?, ?)`,
          [
            `mov_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            id,
            body.name || existing.name,
            Math.abs(diff),
            oldStockQty,
            newStockQty,
            req.user?.userId || "system",
            req.user?.fullName || "Kassa360",
            (/* @__PURE__ */ new Date()).toISOString()
          ]
        );
      }
    });
    const updated = await db.queryOne("SELECT * FROM products WHERE id = ?", [id]);
    const variants = await db.query("SELECT * FROM product_variants WHERE product_id = ?", [id]);
    const formatted = formatProductRow(updated, variants);
    realtimeHub.broadcast("PRODUCT_UPDATED", formatted, req.headers["x-device-id"]);
    res.json({ success: true, product: formatted });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router2.delete("/:id", optionalAuth, requireRole("admin", "manager"), async (req, res) => {
  try {
    const id = req.params.id;
    const existing = await db.queryOne("SELECT * FROM products WHERE id = ?", [id]);
    if (!existing) {
      res.status(404).json({ error: "M\u0259hsul tap\u0131lmad\u0131" });
      return;
    }
    await db.transaction(async (trx) => {
      await trx.execute("DELETE FROM product_variants WHERE product_id = ?", [id]);
      await trx.execute("DELETE FROM products WHERE id = ?", [id]);
    });
    realtimeHub.broadcast("PRODUCT_DELETED", { id }, req.headers["x-device-id"]);
    res.json({ success: true, message: "M\u0259hsul u\u011Furla silindi" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router2.get("/meta/categories", async (_req, res) => {
  try {
    const categories = await db.query("SELECT * FROM categories ORDER BY name ASC");
    res.json({ categories });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router2.post("/meta/categories", async (req, res) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) {
      res.status(400).json({ error: "Kateqoriya ad\u0131 daxil edilm\u0259lidir" });
      return;
    }
    const id = `cat_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    await db.execute("INSERT OR IGNORE INTO categories (id, name) VALUES (?, ?)", [id, name.trim()]);
    res.status(201).json({ category: { id, name: name.trim() } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router2.get("/meta/suppliers", async (_req, res) => {
  try {
    const suppliers = await db.query("SELECT * FROM suppliers ORDER BY name ASC");
    res.json({ suppliers });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router2.post("/meta/suppliers", async (req, res) => {
  try {
    const { name, phone, notes } = req.body;
    if (!name || !name.trim()) {
      res.status(400).json({ error: "T\u0259chizat\xE7\u0131 ad\u0131 daxil edilm\u0259lidir" });
      return;
    }
    const id = `sup_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    await db.execute("INSERT OR IGNORE INTO suppliers (id, name, phone, notes) VALUES (?, ?, ?, ?)", [
      id,
      name.trim(),
      phone || "",
      notes || ""
    ]);
    res.status(201).json({ supplier: { id, name: name.trim(), phone, notes } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
var productRoutes_default = router2;

// server/routes/salesRoutes.ts
var import_express3 = require("express");

// server/financial/calculator.ts
function roundMoney(val) {
  return Math.round((val + Number.EPSILON) * 100) / 100;
}
function calculateServerSale(rawItems, globalDiscountAmount = 0, paidAmount = 0, paymentMethod = "Na\u011Fd") {
  let grossSubtotal = 0;
  let totalItemDiscounts = 0;
  const validatedItems = [];
  for (const item of rawItems) {
    const qty = Math.max(1, Math.floor(item.quantity || 1));
    const origPrice = roundMoney(item.dbOriginalPrice);
    const costPrice = roundMoney(item.dbCostPrice);
    const lineDiscount = Math.min(origPrice, Math.max(0, roundMoney(item.requestedDiscountAmount || 0)));
    const unitSalePrice = roundMoney(origPrice - lineDiscount);
    const lineTotal = roundMoney(unitSalePrice * qty);
    grossSubtotal += roundMoney(origPrice * qty);
    totalItemDiscounts += roundMoney(lineDiscount * qty);
    validatedItems.push({
      productId: item.productId,
      variantId: item.variantId,
      productName: item.productName,
      productBarcode: item.productBarcode,
      brand: item.brand,
      color: item.color,
      colorHex: item.colorHex,
      size: item.size,
      comment: item.comment?.trim() || void 0,
      quantity: qty,
      originalPrice: origPrice,
      discountAmount: lineDiscount,
      salePrice: unitSalePrice,
      costPrice,
      total: lineTotal,
      profit: 0
      // Calculated after global discount allocation
    });
  }
  grossSubtotal = roundMoney(grossSubtotal);
  totalItemDiscounts = roundMoney(totalItemDiscounts);
  const subtotalAfterItemDiscounts = roundMoney(Math.max(0, grossSubtotal - totalItemDiscounts));
  const effectiveGlobalDiscount = roundMoney(
    Math.min(subtotalAfterItemDiscounts, Math.max(0, globalDiscountAmount || 0))
  );
  const finalTotal = roundMoney(Math.max(0, subtotalAfterItemDiscounts - effectiveGlobalDiscount));
  const totalCombinedDiscount = roundMoney(totalItemDiscounts + effectiveGlobalDiscount);
  const globalDiscountPercent = subtotalAfterItemDiscounts > 0 ? roundMoney(effectiveGlobalDiscount / subtotalAfterItemDiscounts * 100) : 0;
  for (const itm of validatedItems) {
    const itemShareRatio = subtotalAfterItemDiscounts > 0 ? itm.total / subtotalAfterItemDiscounts : 0;
    const itemGlobalDiscount = roundMoney(effectiveGlobalDiscount * itemShareRatio);
    const finalItemRevenue = roundMoney(Math.max(0, itm.total - itemGlobalDiscount));
    const finalItemCost = roundMoney(itm.costPrice * itm.quantity);
    itm.profit = roundMoney(finalItemRevenue - finalItemCost);
  }
  let finalPaid = roundMoney(paidAmount || 0);
  let finalChange = 0;
  let finalDebt = 0;
  if (paymentMethod === "Borc") {
    finalDebt = roundMoney(Math.max(0, finalTotal - finalPaid));
  } else {
    if (finalPaid === 0 || finalPaid < finalTotal) {
      finalPaid = finalTotal;
    }
    finalChange = roundMoney(Math.max(0, finalPaid - finalTotal));
    finalDebt = 0;
  }
  return {
    subtotal: grossSubtotal,
    itemDiscountsTotal: totalItemDiscounts,
    subtotalAfterItemDiscounts,
    globalDiscount: effectiveGlobalDiscount,
    globalDiscountPercent,
    totalDiscount: totalCombinedDiscount,
    total: finalTotal,
    paidAmount: finalPaid,
    changeAmount: finalChange,
    debtAmount: finalDebt,
    items: validatedItems
  };
}

// server/routes/salesRoutes.ts
var router3 = (0, import_express3.Router)();
async function getFullSaleById(id) {
  const sale = await db.queryOne("SELECT * FROM sales WHERE id = ?", [id]);
  if (!sale) return null;
  const items = await db.query("SELECT * FROM sale_items WHERE sale_id = ?", [id]);
  const debtPayments = await db.query(
    "SELECT * FROM debt_payments WHERE sale_id = ? ORDER BY date ASC",
    [id]
  );
  return {
    id: sale.id,
    clientUuid: sale.client_uuid,
    deviceId: sale.device_id,
    sellerId: sale.seller_id,
    sellerName: sale.seller_name,
    date: sale.date,
    subtotal: Number(sale.subtotal),
    itemDiscountsTotal: Number(sale.item_discounts_total),
    subtotalAfterItemDiscounts: Number(sale.subtotal_after_item_discounts),
    globalDiscountPercent: Number(sale.global_discount_percent),
    discount: Number(sale.discount),
    totalDiscount: Number(sale.total_discount),
    total: Number(sale.total),
    paidAmount: Number(sale.paid_amount),
    changeAmount: Number(sale.change_amount),
    debtAmount: Number(sale.debt_amount),
    initialDebtAmount: Number(sale.initial_debt_amount),
    initialPaidAmount: Number(sale.initial_paid_amount),
    paymentMethod: sale.payment_method,
    partialPaymentMethod: sale.partial_payment_method,
    customerName: sale.customer_name || "",
    notes: sale.notes || "",
    isReturned: Boolean(sale.is_returned),
    syncStatus: sale.sync_status || "SYNCED",
    items: items.map((itm) => ({
      id: itm.id,
      saleId: itm.sale_id,
      productId: itm.product_id,
      productName: itm.product_name,
      productBarcode: itm.product_barcode || "",
      brand: itm.brand || "",
      color: itm.color || "",
      colorHex: itm.color_hex || "",
      size: itm.size || "",
      variantId: itm.variant_id,
      comment: itm.comment || "",
      quantity: Number(itm.quantity),
      originalPrice: Number(itm.original_price),
      discountAmount: Number(itm.discount_amount || 0),
      salePrice: Number(itm.sale_price),
      costPrice: Number(itm.cost_price || 0),
      total: Number(itm.total),
      profit: Number(itm.profit || 0)
    })),
    debtPayments: debtPayments.map((dp) => ({
      id: dp.id,
      saleId: dp.sale_id,
      amount: Number(dp.amount),
      previousDebt: Number(dp.previous_debt),
      remainingDebt: Number(dp.remaining_debt),
      paymentMethod: dp.payment_method,
      notes: dp.notes || "",
      date: dp.date
    }))
  };
}
router3.get("/", async (req, res) => {
  try {
    const { fromDate, toDate, paymentMethod, customerName, search } = req.query;
    let sql = "SELECT id FROM sales WHERE 1=1";
    const params = [];
    if (fromDate) {
      sql += " AND date >= ?";
      params.push(String(fromDate));
    }
    if (toDate) {
      sql += " AND date <= ?";
      params.push(String(toDate));
    }
    if (paymentMethod && paymentMethod !== "all") {
      sql += " AND payment_method = ?";
      params.push(String(paymentMethod));
    }
    if (customerName) {
      sql += " AND LOWER(customer_name) LIKE ?";
      params.push(`%${String(customerName).toLowerCase()}%`);
    }
    sql += " ORDER BY date DESC LIMIT 500";
    const rows = await db.query(sql, params);
    const sales = [];
    for (const r of rows) {
      const full = await getFullSaleById(r.id);
      if (full) {
        if (search && typeof search === "string" && search.trim()) {
          const q = search.trim().toLowerCase();
          const matches = full.id.toLowerCase().includes(q) || full.customerName.toLowerCase().includes(q) || full.items.some((i) => i.productName.toLowerCase().includes(q));
          if (!matches) continue;
        }
        sales.push(full);
      }
    }
    res.json({ sales });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router3.get("/:id", async (req, res) => {
  try {
    const sale = await getFullSaleById(req.params.id);
    if (!sale) {
      res.status(404).json({ error: "Sat\u0131\u015F tap\u0131lmad\u0131" });
      return;
    }
    res.json({ sale });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router3.post("/", optionalAuth, async (req, res) => {
  try {
    const body = req.body;
    const clientUuid = body.clientUuid || body.client_uuid;
    const deviceId = req.headers["x-device-id"] || body.deviceId || "device_default";
    if (clientUuid) {
      const existingSale = await db.queryOne("SELECT id FROM sales WHERE client_uuid = ?", [clientUuid]);
      if (existingSale) {
        console.log(`\u26A1 [Idempotency] Sale already processed with clientUuid: ${clientUuid}. Returning existing sale.`);
        const full = await getFullSaleById(existingSale.id);
        res.status(200).json({ success: true, sale: full, duplicate: true });
        return;
      }
    }
    const items = body.items;
    if (!Array.isArray(items) || items.length === 0) {
      res.status(400).json({ error: "S\u0259b\u0259t bo\u015Fdur" });
      return;
    }
    const rawItemsForCalc = [];
    const stockChecks = [];
    for (const itm of items) {
      const prodId = String(itm.productId);
      const prod = await db.queryOne("SELECT * FROM products WHERE id = ?", [prodId]);
      if (!prod) {
        res.status(400).json({ error: `M\u0259hsul tap\u0131lmad\u0131: ${itm.productName || prodId}` });
        return;
      }
      const qty = Math.max(1, Number(itm.quantity || 1));
      stockChecks.push({
        productId: prodId,
        variantId: itm.variantId ? String(itm.variantId) : void 0,
        qty,
        name: prod.name
      });
      rawItemsForCalc.push({
        productId: prodId,
        variantId: itm.variantId ? String(itm.variantId) : void 0,
        productName: prod.name,
        productBarcode: prod.barcode || "",
        brand: itm.brand || prod.brand || "",
        color: itm.color || prod.color || "",
        colorHex: itm.colorHex || prod.color_hex || "",
        size: itm.size || prod.size || "",
        comment: itm.comment || "",
        quantity: qty,
        dbOriginalPrice: Number(prod.sale_price),
        dbCostPrice: Number(prod.purchase_price),
        requestedDiscountAmount: Number(itm.discountAmount || 0)
      });
    }
    const negStockSetting = await db.queryOne("SELECT value FROM settings WHERE key = 'allowNegativeStock'");
    const allowNegativeStock = negStockSetting?.value === "true";
    if (!allowNegativeStock) {
      for (const sc of stockChecks) {
        if (sc.variantId) {
          const variant = await db.queryOne("SELECT stock_quantity FROM product_variants WHERE id = ?", [sc.variantId]);
          if (variant && Number(variant.stock_quantity) < sc.qty) {
            res.status(400).json({
              error: `"${sc.name}" (variant) \xFC\xE7\xFCn kifay\u0259t q\u0259d\u0259r stok yoxdur! M\xF6vcud: ${variant.stock_quantity}, T\u0259l\u0259b olunan: ${sc.qty}`
            });
            return;
          }
        } else {
          const prod = await db.queryOne("SELECT stock_quantity FROM products WHERE id = ?", [sc.productId]);
          if (prod && Number(prod.stock_quantity) < sc.qty) {
            res.status(400).json({
              error: `"${sc.name}" \xFC\xE7\xFCn kifay\u0259t q\u0259d\u0259r stok yoxdur! M\xF6vcud: ${prod.stock_quantity}, T\u0259l\u0259b olunan: ${sc.qty}`
            });
            return;
          }
        }
      }
    }
    const calc = calculateServerSale(
      rawItemsForCalc,
      Number(body.discount || 0),
      Number(body.paidAmount || 0),
      body.paymentMethod || "Na\u011Fd"
    );
    const saleId = body.id ? String(body.id) : `sale_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const saleDate = body.date || (/* @__PURE__ */ new Date()).toISOString();
    const sellerId = req.user?.userId || body.sellerId || "system";
    const sellerName = req.user?.fullName || body.sellerName || "Kassa360";
    const paymentMethod = body.paymentMethod || "Na\u011Fd";
    if (paymentMethod === "Borc" && (!body.customerName || !body.customerName.trim())) {
      res.status(400).json({ error: "Nisy\u0259 (borc) sat\u0131\u015F \xFC\xE7\xFCn m\xFC\u015Ft\u0259ri ad\u0131 m\xFCtl\u0259q daxil edilm\u0259lidir" });
      return;
    }
    await db.transaction(async (trx) => {
      await trx.execute(
        `INSERT INTO sales (
          id, client_uuid, device_id, seller_id, seller_name, date,
          subtotal, item_discounts_total, subtotal_after_item_discounts,
          global_discount_percent, discount, total_discount, total,
          paid_amount, change_amount, debt_amount, initial_debt_amount, initial_paid_amount,
          payment_method, partial_payment_method, customer_name, notes, is_returned, sync_status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 'SYNCED')`,
        [
          saleId,
          clientUuid || null,
          deviceId,
          sellerId,
          sellerName,
          saleDate,
          calc.subtotal,
          calc.itemDiscountsTotal,
          calc.subtotalAfterItemDiscounts,
          calc.globalDiscountPercent,
          calc.globalDiscount,
          calc.totalDiscount,
          calc.total,
          calc.paidAmount,
          calc.changeAmount,
          calc.debtAmount,
          calc.debtAmount,
          calc.paidAmount,
          paymentMethod,
          body.partialPaymentMethod || null,
          body.customerName?.trim() || null,
          body.notes?.trim() || null
        ]
      );
      for (const item of calc.items) {
        const itemId = `si_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
        await trx.execute(
          `INSERT INTO sale_items (
            id, sale_id, product_id, product_name, product_barcode, brand, color, color_hex,
            size, variant_id, comment, quantity, original_price, discount_amount, sale_price,
            cost_price, total, profit
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            itemId,
            saleId,
            item.productId,
            item.productName,
            item.productBarcode || null,
            item.brand || null,
            item.color || null,
            item.colorHex || null,
            item.size || null,
            item.variantId || null,
            item.comment || null,
            item.quantity,
            item.originalPrice,
            item.discountAmount,
            item.salePrice,
            item.costPrice,
            item.total,
            item.profit
          ]
        );
        const currentProd = await trx.queryOne("SELECT stock_quantity FROM products WHERE id = ?", [item.productId]);
        const oldStock = Number(currentProd?.stock_quantity || 0);
        const newStock = oldStock - item.quantity;
        await trx.execute("UPDATE products SET stock_quantity = ? WHERE id = ?", [newStock, item.productId]);
        if (item.variantId) {
          await trx.execute(
            "UPDATE product_variants SET stock_quantity = stock_quantity - ? WHERE id = ?",
            [item.quantity, item.variantId]
          );
        }
        await trx.execute(
          `INSERT INTO stock_movements (id, product_id, product_name, type, quantity, previous_stock, new_stock, notes, user_id, user_name, date)
           VALUES (?, ?, ?, 'Sat\u0131\u015F', ?, ?, ?, ?, ?, ?, ?)`,
          [
            `mov_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            item.productId,
            item.productName,
            item.quantity,
            oldStock,
            newStock,
            `Sat\u0131\u015F #${saleId}`,
            sellerId,
            sellerName,
            saleDate
          ]
        );
      }
      if (paymentMethod === "Borc" && calc.paidAmount > 0) {
        await trx.execute(
          `INSERT INTO debt_payments (id, sale_id, amount, previous_debt, remaining_debt, payment_method, notes, date)
           VALUES (?, ?, ?, ?, ?, ?, '\u0130lkin \xF6d\u0259ni\u015F', ?)`,
          [
            `dp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            saleId,
            calc.paidAmount,
            calc.total,
            calc.debtAmount,
            body.partialPaymentMethod || "Na\u011Fd",
            saleDate
          ]
        );
      }
    });
    const fullSale = await getFullSaleById(saleId);
    realtimeHub.broadcast("SALE_CREATED", fullSale, deviceId);
    realtimeHub.broadcast("STOCK_UPDATED", { saleId, affectedProducts: stockChecks.map((s) => s.productId) }, deviceId);
    res.status(201).json({ success: true, sale: fullSale });
  } catch (err) {
    console.error("Error creating sale:", err);
    res.status(500).json({ error: err.message });
  }
});
router3.put("/:id", optionalAuth, async (req, res) => {
  try {
    const saleId = req.params.id;
    const existing = await getFullSaleById(saleId);
    if (!existing) {
      res.status(404).json({ error: "Sat\u0131\u015F tap\u0131lmad\u0131" });
      return;
    }
    if (existing.isReturned) {
      res.status(400).json({ error: "Qaytar\u0131lm\u0131\u015F \xE7eki redakt\u0259 etm\u0259k m\xFCmk\xFCn deyil" });
      return;
    }
    const body = req.body;
    const newItems = body.items || existing.items;
    const rawItemsForCalc = [];
    for (const itm of newItems) {
      const prodId = String(itm.productId);
      const prod = await db.queryOne("SELECT * FROM products WHERE id = ?", [prodId]);
      const originalPrice = prod ? Number(prod.sale_price) : Number(itm.originalPrice || itm.salePrice);
      const costPrice = prod ? Number(prod.purchase_price) : Number(itm.costPrice || 0);
      rawItemsForCalc.push({
        productId: prodId,
        variantId: itm.variantId ? String(itm.variantId) : void 0,
        productName: itm.productName || prod?.name || "M\u0259hsul",
        productBarcode: itm.productBarcode || prod?.barcode || "",
        brand: itm.brand || prod?.brand || "",
        color: itm.color || prod?.color || "",
        colorHex: itm.colorHex || prod?.color_hex || "",
        size: itm.size !== void 0 ? itm.size : prod?.size || "",
        // Updated size (e.g. M -> L)
        comment: itm.comment || "",
        quantity: Math.max(1, Number(itm.quantity || 1)),
        dbOriginalPrice: originalPrice,
        dbCostPrice: costPrice,
        requestedDiscountAmount: Number(itm.discountAmount || 0)
      });
    }
    const calc = calculateServerSale(
      rawItemsForCalc,
      Number(body.discount !== void 0 ? body.discount : existing.discount),
      Number(body.paidAmount !== void 0 ? body.paidAmount : existing.paidAmount),
      body.paymentMethod || existing.paymentMethod
    );
    await db.transaction(async (trx) => {
      for (const oldItm of existing.items) {
        await trx.execute("UPDATE products SET stock_quantity = stock_quantity + ? WHERE id = ?", [
          oldItm.quantity,
          oldItm.productId
        ]);
        if (oldItm.variantId) {
          await trx.execute(
            "UPDATE product_variants SET stock_quantity = stock_quantity + ? WHERE id = ?",
            [oldItm.quantity, oldItm.variantId]
          );
        }
      }
      for (const newItm of calc.items) {
        await trx.execute("UPDATE products SET stock_quantity = stock_quantity - ? WHERE id = ?", [
          newItm.quantity,
          newItm.productId
        ]);
        if (newItm.variantId) {
          await trx.execute(
            "UPDATE product_variants SET stock_quantity = stock_quantity - ? WHERE id = ?",
            [newItm.quantity, newItm.variantId]
          );
        }
      }
      await trx.execute("DELETE FROM sale_items WHERE sale_id = ?", [saleId]);
      for (const item of calc.items) {
        const itemId = `si_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
        await trx.execute(
          `INSERT INTO sale_items (
            id, sale_id, product_id, product_name, product_barcode, brand, color, color_hex,
            size, variant_id, comment, quantity, original_price, discount_amount, sale_price,
            cost_price, total, profit
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            itemId,
            saleId,
            item.productId,
            item.productName,
            item.productBarcode || null,
            item.brand || null,
            item.color || null,
            item.colorHex || null,
            item.size || null,
            item.variantId || null,
            item.comment || null,
            item.quantity,
            item.originalPrice,
            item.discountAmount,
            item.salePrice,
            item.costPrice,
            item.total,
            item.profit
          ]
        );
      }
      await trx.execute(
        `UPDATE sales SET
          subtotal = ?, item_discounts_total = ?, subtotal_after_item_discounts = ?,
          global_discount_percent = ?, discount = ?, total_discount = ?, total = ?,
          paid_amount = ?, change_amount = ?, debt_amount = ?, customer_name = ?,
          notes = ?, payment_method = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?`,
        [
          calc.subtotal,
          calc.itemDiscountsTotal,
          calc.subtotalAfterItemDiscounts,
          calc.globalDiscountPercent,
          calc.globalDiscount,
          calc.totalDiscount,
          calc.total,
          calc.paidAmount,
          calc.changeAmount,
          calc.debtAmount,
          body.customerName !== void 0 ? body.customerName.trim() : existing.customerName,
          body.notes !== void 0 ? body.notes.trim() : existing.notes,
          body.paymentMethod || existing.paymentMethod,
          saleId
        ]
      );
    });
    const updatedSale = await getFullSaleById(saleId);
    realtimeHub.broadcast("SALE_UPDATED", updatedSale, req.headers["x-device-id"]);
    realtimeHub.broadcast("STOCK_UPDATED", { saleId }, req.headers["x-device-id"]);
    res.json({ success: true, sale: updatedSale });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router3.post("/:id/return", optionalAuth, async (req, res) => {
  try {
    const saleId = req.params.id;
    const sale = await getFullSaleById(saleId);
    if (!sale) {
      res.status(404).json({ error: "Sat\u0131\u015F tap\u0131lmad\u0131" });
      return;
    }
    if (sale.isReturned) {
      res.status(400).json({ error: "Bu sat\u0131\u015F art\u0131q qaytar\u0131l\u0131b" });
      return;
    }
    const sellerId = req.user?.userId || "system";
    const sellerName = req.user?.fullName || "Kassa360";
    const returnDate = (/* @__PURE__ */ new Date()).toISOString();
    await db.transaction(async (trx) => {
      for (const itm of sale.items) {
        const curProd = await trx.queryOne("SELECT stock_quantity FROM products WHERE id = ?", [itm.productId]);
        const oldStock = Number(curProd?.stock_quantity || 0);
        const newStock = oldStock + itm.quantity;
        await trx.execute("UPDATE products SET stock_quantity = ? WHERE id = ?", [newStock, itm.productId]);
        if (itm.variantId) {
          await trx.execute(
            "UPDATE product_variants SET stock_quantity = stock_quantity + ? WHERE id = ?",
            [itm.quantity, itm.variantId]
          );
        }
        await trx.execute(
          `INSERT INTO stock_movements (id, product_id, product_name, type, quantity, previous_stock, new_stock, notes, user_id, user_name, date)
           VALUES (?, ?, ?, 'Qaytarma', ?, ?, ?, ?, ?, ?, ?)`,
          [
            `mov_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            itm.productId,
            itm.productName,
            itm.quantity,
            oldStock,
            newStock,
            `Sat\u0131\u015F #${saleId} qaytar\u0131ld\u0131`,
            sellerId,
            sellerName,
            returnDate
          ]
        );
      }
      await trx.execute(
        "UPDATE sales SET is_returned = 1, debt_amount = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
        [saleId]
      );
    });
    const returnedSale = await getFullSaleById(saleId);
    realtimeHub.broadcast("SALE_RETURNED", returnedSale, req.headers["x-device-id"]);
    realtimeHub.broadcast("STOCK_UPDATED", { saleId }, req.headers["x-device-id"]);
    res.json({ success: true, sale: returnedSale });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router3.post("/:id/payments", optionalAuth, async (req, res) => {
  try {
    const saleId = req.params.id;
    const sale = await getFullSaleById(saleId);
    if (!sale) {
      res.status(404).json({ error: "Sat\u0131\u015F tap\u0131lmad\u0131" });
      return;
    }
    const paymentAmount = roundMoney(Number(req.body.amount || 0));
    if (paymentAmount <= 0) {
      res.status(400).json({ error: "\xD6d\u0259ni\u015F m\u0259bl\u0259\u011Fi 0-dan b\xF6y\xFCk olmal\u0131d\u0131r" });
      return;
    }
    if (paymentAmount > sale.debtAmount) {
      res.status(400).json({
        error: `\xD6d\u0259ni\u015F m\u0259bl\u0259\u011Fi qalan borcdan (${sale.debtAmount} AZN) \xE7ox ola bilm\u0259z`
      });
      return;
    }
    const previousDebt = sale.debtAmount;
    const remainingDebt = roundMoney(previousDebt - paymentAmount);
    const newPaidAmount = roundMoney(sale.paidAmount + paymentAmount);
    const paymentDate = req.body.date || (/* @__PURE__ */ new Date()).toISOString();
    await db.transaction(async (trx) => {
      const dpId = `dp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      await trx.execute(
        `INSERT INTO debt_payments (id, sale_id, amount, previous_debt, remaining_debt, payment_method, notes, date)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          dpId,
          saleId,
          paymentAmount,
          previousDebt,
          remainingDebt,
          req.body.paymentMethod || "Na\u011Fd",
          req.body.notes || "Nisy\u0259 \xF6d\u0259ni\u015Fi",
          paymentDate
        ]
      );
      await trx.execute(
        "UPDATE sales SET debt_amount = ?, paid_amount = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
        [remainingDebt, newPaidAmount, saleId]
      );
    });
    const updatedSale = await getFullSaleById(saleId);
    realtimeHub.broadcast("SALE_UPDATED", updatedSale, req.headers["x-device-id"]);
    res.json({ success: true, sale: updatedSale });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router3.delete("/:id", optionalAuth, async (req, res) => {
  try {
    const saleId = req.params.id;
    const sale = await getFullSaleById(saleId);
    if (!sale) {
      res.status(404).json({ error: "Sat\u0131\u015F tap\u0131lmad\u0131" });
      return;
    }
    const restoreStock = req.query.restoreStock !== "false";
    await db.transaction(async (trx) => {
      if (restoreStock && !sale.isReturned) {
        for (const itm of sale.items) {
          await trx.execute("UPDATE products SET stock_quantity = stock_quantity + ? WHERE id = ?", [
            itm.quantity,
            itm.productId
          ]);
          if (itm.variantId) {
            await trx.execute(
              "UPDATE product_variants SET stock_quantity = stock_quantity + ? WHERE id = ?",
              [itm.quantity, itm.variantId]
            );
          }
        }
      }
      await trx.execute("DELETE FROM debt_payments WHERE sale_id = ?", [saleId]);
      await trx.execute("DELETE FROM sale_items WHERE sale_id = ?", [saleId]);
      await trx.execute("DELETE FROM sales WHERE id = ?", [saleId]);
    });
    realtimeHub.broadcast("SALE_DELETED", { id: saleId }, req.headers["x-device-id"]);
    realtimeHub.broadcast("STOCK_UPDATED", { saleId }, req.headers["x-device-id"]);
    res.json({ success: true, message: "Sat\u0131\u015F u\u011Furla silindi" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
var salesRoutes_default = router3;

// server/routes/inventoryRoutes.ts
var import_express4 = require("express");
var router4 = (0, import_express4.Router)();
router4.get("/movements", async (req, res) => {
  try {
    const { productId, type, limit } = req.query;
    let sql = "SELECT * FROM stock_movements WHERE 1=1";
    const params = [];
    if (productId) {
      sql += " AND product_id = ?";
      params.push(String(productId));
    }
    if (type && type !== "all") {
      sql += " AND type = ?";
      params.push(String(type));
    }
    sql += " ORDER BY created_at DESC LIMIT ?";
    params.push(limit ? Math.min(1e3, Number(limit)) : 300);
    const movements = await db.query(sql, params);
    res.json({
      movements: movements.map((m) => ({
        id: m.id,
        productId: m.product_id,
        productName: m.product_name,
        type: m.type,
        quantity: Number(m.quantity),
        previousStock: Number(m.previous_stock),
        newStock: Number(m.new_stock),
        notes: m.notes || "",
        userId: m.user_id,
        userName: m.user_name,
        date: m.date,
        createdAt: m.created_at
      }))
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router4.post("/adjust", optionalAuth, async (req, res) => {
  try {
    const { productId, variantId, quantityChange, notes } = req.body;
    if (!productId || quantityChange === void 0) {
      res.status(400).json({ error: "M\u0259hsul v\u0259 d\u0259yi\u015Fiklik miqdar\u0131 daxil edilm\u0259lidir" });
      return;
    }
    const change = Number(quantityChange);
    const prod = await db.queryOne("SELECT * FROM products WHERE id = ?", [String(productId)]);
    if (!prod) {
      res.status(404).json({ error: "M\u0259hsul tap\u0131lmad\u0131" });
      return;
    }
    const oldStock = Number(prod.stock_quantity);
    const newStock = oldStock + change;
    await db.transaction(async (trx) => {
      await trx.execute("UPDATE products SET stock_quantity = ? WHERE id = ?", [newStock, String(productId)]);
      if (variantId) {
        await trx.execute(
          "UPDATE product_variants SET stock_quantity = stock_quantity + ? WHERE id = ?",
          [change, String(variantId)]
        );
      }
      await trx.execute(
        `INSERT INTO stock_movements (id, product_id, product_name, type, quantity, previous_stock, new_stock, notes, user_id, user_name, date)
         VALUES (?, ?, ?, 'Stok d\xFCz\u0259li\u015Fi', ?, ?, ?, ?, ?, ?, ?)`,
        [
          `mov_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          String(productId),
          prod.name,
          Math.abs(change),
          oldStock,
          newStock,
          notes || "\u018Fll\u0259 stok t\u0259nziml\u0259m\u0259si",
          req.user?.userId || "system",
          req.user?.fullName || "Kassa360",
          (/* @__PURE__ */ new Date()).toISOString()
        ]
      );
    });
    realtimeHub.broadcast("STOCK_UPDATED", { productId, newStock }, req.headers["x-device-id"]);
    res.json({ success: true, newStock });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router4.get("/warnings", async (_req, res) => {
  try {
    const lowStock = await db.query(
      "SELECT id, name, category, stock_quantity, minimum_stock FROM products WHERE stock_quantity <= minimum_stock ORDER BY stock_quantity ASC"
    );
    res.json({
      lowStock: lowStock.map((p) => ({
        id: p.id,
        name: p.name,
        category: p.category,
        stockQuantity: Number(p.stock_quantity),
        minimumStock: Number(p.minimum_stock)
      }))
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
var inventoryRoutes_default = router4;

// server/routes/purchasesRoutes.ts
var import_express5 = require("express");
var router5 = (0, import_express5.Router)();
router5.get("/", async (_req, res) => {
  try {
    const rows = await db.query("SELECT * FROM purchases ORDER BY date DESC");
    res.json({
      purchases: rows.map((p) => ({
        id: p.id,
        date: p.date,
        supplierName: p.supplier_name,
        totalAmount: Number(p.total_amount),
        paymentMethod: p.payment_method,
        notes: p.notes || "",
        items: JSON.parse(p.items_json || "[]")
      }))
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router5.post("/", optionalAuth, async (req, res) => {
  try {
    const { supplierName, items, totalAmount, paymentMethod, notes, date } = req.body;
    if (!Array.isArray(items) || items.length === 0) {
      res.status(400).json({ error: "Al\u0131\u015F \xFC\xE7\xFCn \u0259n az\u0131 bir m\u0259hsul daxil edilm\u0259lidir" });
      return;
    }
    const purchaseId = `pur_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const purchaseDate = date || (/* @__PURE__ */ new Date()).toISOString();
    await db.transaction(async (trx) => {
      await trx.execute(
        `INSERT INTO purchases (id, date, supplier_name, total_amount, payment_method, notes, items_json)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          purchaseId,
          purchaseDate,
          supplierName || "Nam\u0259lum t\u0259chizat\xE7\u0131",
          Number(totalAmount || 0),
          paymentMethod || "Na\u011Fd",
          notes || "",
          JSON.stringify(items)
        ]
      );
      for (const itm of items) {
        if (itm.productId) {
          const qty = Number(itm.quantity || 0);
          const curProd = await trx.queryOne("SELECT stock_quantity, name FROM products WHERE id = ?", [
            String(itm.productId)
          ]);
          if (curProd) {
            const oldStock = Number(curProd.stock_quantity);
            const newStock = oldStock + qty;
            await trx.execute("UPDATE products SET stock_quantity = ? WHERE id = ?", [
              newStock,
              String(itm.productId)
            ]);
            if (itm.variantId) {
              await trx.execute(
                "UPDATE product_variants SET stock_quantity = stock_quantity + ? WHERE id = ?",
                [qty, String(itm.variantId)]
              );
            }
            await trx.execute(
              `INSERT INTO stock_movements (id, product_id, product_name, type, quantity, previous_stock, new_stock, notes, user_id, user_name, date)
               VALUES (?, ?, ?, 'Al\u0131\u015F', ?, ?, ?, ?, ?, ?, ?)`,
              [
                `mov_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
                String(itm.productId),
                curProd.name,
                qty,
                oldStock,
                newStock,
                `Al\u0131\u015F qaim\u0259si #${purchaseId}`,
                req.user?.userId || "system",
                req.user?.fullName || "Kassa360",
                purchaseDate
              ]
            );
          }
        }
      }
    });
    realtimeHub.broadcast("STOCK_UPDATED", { purchaseId }, req.headers["x-device-id"]);
    res.status(201).json({
      success: true,
      purchase: {
        id: purchaseId,
        date: purchaseDate,
        supplierName,
        totalAmount: Number(totalAmount || 0),
        paymentMethod,
        notes,
        items
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
var purchasesRoutes_default = router5;

// server/routes/financeRoutes.ts
var import_express6 = require("express");
var router6 = (0, import_express6.Router)();
router6.get("/expenses", async (_req, res) => {
  try {
    const rows = await db.query("SELECT * FROM expenses ORDER BY date DESC");
    res.json({
      expenses: rows.map((r) => ({
        id: r.id,
        date: r.date,
        amount: Number(r.amount),
        category: r.category,
        notes: r.notes || ""
      }))
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router6.post("/expenses", optionalAuth, async (req, res) => {
  try {
    const { amount, category, notes, date } = req.body;
    if (!amount || !category) {
      res.status(400).json({ error: "M\u0259bl\u0259\u011F v\u0259 kateqoriya m\xFCtl\u0259qdir" });
      return;
    }
    const id = `exp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const expDate = date || (/* @__PURE__ */ new Date()).toISOString();
    await db.execute("INSERT INTO expenses (id, date, amount, category, notes) VALUES (?, ?, ?, ?, ?)", [
      id,
      expDate,
      Number(amount),
      category,
      notes || ""
    ]);
    res.status(201).json({
      success: true,
      expense: { id, date: expDate, amount: Number(amount), category, notes }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router6.delete("/expenses/:id", optionalAuth, async (req, res) => {
  try {
    await db.execute("DELETE FROM expenses WHERE id = ?", [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router6.get("/incomes", async (_req, res) => {
  try {
    const rows = await db.query("SELECT * FROM incomes ORDER BY date DESC");
    res.json({
      incomes: rows.map((r) => ({
        id: r.id,
        date: r.date,
        amount: Number(r.amount),
        source: r.source,
        notes: r.notes || ""
      }))
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router6.post("/incomes", optionalAuth, async (req, res) => {
  try {
    const { amount, source, notes, date } = req.body;
    if (!amount || !source) {
      res.status(400).json({ error: "M\u0259bl\u0259\u011F v\u0259 m\u0259nb\u0259 m\xFCtl\u0259qdir" });
      return;
    }
    const id = `inc_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const incDate = date || (/* @__PURE__ */ new Date()).toISOString();
    await db.execute("INSERT INTO incomes (id, date, amount, source, notes) VALUES (?, ?, ?, ?, ?)", [
      id,
      incDate,
      Number(amount),
      source,
      notes || ""
    ]);
    res.status(201).json({
      success: true,
      income: { id, date: incDate, amount: Number(amount), source, notes }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router6.get("/recurring-expenses", async (_req, res) => {
  try {
    const rows = await db.query("SELECT * FROM recurring_expenses ORDER BY day_of_month ASC");
    res.json({
      recurringExpenses: rows.map((r) => ({
        id: r.id,
        name: r.name,
        amount: Number(r.amount),
        category: r.category,
        frequency: r.frequency,
        dayOfMonth: Number(r.day_of_month),
        isActive: Boolean(r.is_active)
      }))
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router6.post("/recurring-expenses", optionalAuth, async (req, res) => {
  try {
    const { name, amount, category, frequency, dayOfMonth } = req.body;
    const id = `rec_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    await db.execute(
      `INSERT INTO recurring_expenses (id, name, amount, category, frequency, day_of_month, is_active)
       VALUES (?, ?, ?, ?, ?, ?, 1)`,
      [id, name, Number(amount || 0), category, frequency || "Ayl\u0131q", Number(dayOfMonth || 1)]
    );
    res.status(201).json({ success: true, id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
var financeRoutes_default = router6;

// server/routes/settingsRoutes.ts
var import_express7 = require("express");
var router7 = (0, import_express7.Router)();
router7.get("/", async (_req, res) => {
  try {
    const rows = await db.query("SELECT key, value FROM settings");
    const settingsObj = {};
    for (const r of rows) {
      if (r.value === "true") settingsObj[r.key] = true;
      else if (r.value === "false") settingsObj[r.key] = false;
      else if (!isNaN(Number(r.value)) && r.value.trim() !== "") settingsObj[r.key] = Number(r.value);
      else settingsObj[r.key] = r.value;
    }
    res.json({ settings: settingsObj });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router7.put("/", optionalAuth, async (req, res) => {
  try {
    const settings = req.body;
    if (!settings || typeof settings !== "object") {
      res.status(400).json({ error: "T\u0259nziml\u0259m\u0259 obyekti t\u0259l\u0259b olunur" });
      return;
    }
    await db.transaction(async (trx) => {
      for (const [k, v] of Object.entries(settings)) {
        await trx.execute("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)", [k, String(v)]);
      }
    });
    realtimeHub.broadcast("SETTING_UPDATED", settings, req.headers["x-device-id"]);
    res.json({ success: true, settings });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
var settingsRoutes_default = router7;

// server/routes/syncRoutes.ts
var import_express8 = require("express");
var router8 = (0, import_express8.Router)();
router8.post("/bootstrap", optionalAuth, async (req, res) => {
  try {
    const { products, sales, categories, suppliers, setting, expenses, recurringExpenses, incomes } = req.body;
    let importedProducts = 0;
    let importedSales = 0;
    let importedCategories = 0;
    let importedSuppliers = 0;
    await db.transaction(async (trx) => {
      if (Array.isArray(categories)) {
        for (const cat of categories) {
          const exists = await trx.queryOne("SELECT id FROM categories WHERE id = ? OR name = ?", [
            String(cat.id),
            cat.name
          ]);
          if (!exists) {
            await trx.execute("INSERT INTO categories (id, name) VALUES (?, ?)", [String(cat.id), cat.name]);
            importedCategories++;
          }
        }
      }
      if (Array.isArray(suppliers)) {
        for (const sup of suppliers) {
          const exists = await trx.queryOne("SELECT id FROM suppliers WHERE id = ?", [String(sup.id)]);
          if (!exists) {
            await trx.execute("INSERT INTO suppliers (id, name, phone, notes) VALUES (?, ?, ?, ?)", [
              String(sup.id),
              sup.name,
              sup.phone || "",
              sup.notes || ""
            ]);
            importedSuppliers++;
          }
        }
      }
      if (Array.isArray(products)) {
        for (const prod of products) {
          const exists = await trx.queryOne("SELECT id FROM products WHERE id = ?", [String(prod.id)]);
          if (!exists) {
            const sizesJson = prod.sizes ? JSON.stringify(prod.sizes) : JSON.stringify([]);
            await trx.execute(
              `INSERT INTO products (
                id, barcode, name, category, brand, color, color_hex, size, sizes_json,
                purchase_price, sale_price, stock_quantity, minimum_stock, supplier,
                image_path, notes, version
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
              [
                String(prod.id),
                prod.barcode || null,
                prod.name,
                prod.category,
                prod.brand || "",
                prod.color || "",
                prod.colorHex || "",
                prod.size || "",
                sizesJson,
                Number(prod.purchasePrice || 0),
                Number(prod.salePrice || 0),
                Number(prod.stockQuantity || 0),
                Number(prod.minimumStock || 3),
                prod.supplier || "",
                prod.imagePath || "",
                prod.notes || ""
              ]
            );
            if (Array.isArray(prod.variants)) {
              for (const v of prod.variants) {
                await trx.execute(
                  `INSERT INTO product_variants (id, product_id, color, color_hex, size, stock_quantity, barcode)
                   VALUES (?, ?, ?, ?, ?, ?, ?)`,
                  [
                    v.id || `var_${prod.id}_${Math.random().toString(36).substring(2, 6)}`,
                    String(prod.id),
                    v.color || "",
                    v.colorHex || "",
                    v.size || "",
                    Number(v.stockQuantity || 0),
                    v.barcode || null
                  ]
                );
              }
            }
            importedProducts++;
          }
        }
      }
      if (Array.isArray(sales)) {
        for (const s of sales) {
          const exists = await trx.queryOne("SELECT id FROM sales WHERE id = ?", [String(s.id)]);
          if (!exists) {
            await trx.execute(
              `INSERT INTO sales (
                id, client_uuid, device_id, seller_id, seller_name, date,
                subtotal, item_discounts_total, subtotal_after_item_discounts,
                global_discount_percent, discount, total_discount, total,
                paid_amount, change_amount, debt_amount, initial_debt_amount, initial_paid_amount,
                payment_method, partial_payment_method, customer_name, notes, is_returned, sync_status
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'SYNCED')`,
              [
                String(s.id),
                s.clientUuid || null,
                s.deviceId || "bootstrap",
                s.sellerId || "system",
                s.sellerName || "Kassa360",
                s.date || (/* @__PURE__ */ new Date()).toISOString(),
                Number(s.subtotal || s.total || 0),
                Number(s.itemDiscountsTotal || 0),
                Number(s.subtotalAfterItemDiscounts || s.total || 0),
                Number(s.globalDiscountPercent || 0),
                Number(s.discount || 0),
                Number(s.totalDiscount || s.discount || 0),
                Number(s.total || 0),
                Number(s.paidAmount || s.total || 0),
                Number(s.changeAmount || 0),
                Number(s.debtAmount || 0),
                Number(s.initialDebtAmount || s.debtAmount || 0),
                Number(s.initialPaidAmount || s.paidAmount || 0),
                s.paymentMethod || "Na\u011Fd",
                s.partialPaymentMethod || null,
                s.customerName || null,
                s.notes || null,
                s.isReturned ? 1 : 0
              ]
            );
            if (Array.isArray(s.items)) {
              for (const itm of s.items) {
                const itemId = itm.id ? String(itm.id) : `si_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
                await trx.execute(
                  `INSERT INTO sale_items (
                    id, sale_id, product_id, product_name, product_barcode, brand, color, color_hex,
                    size, variant_id, comment, quantity, original_price, discount_amount, sale_price,
                    cost_price, total, profit
                  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                  [
                    itemId,
                    String(s.id),
                    String(itm.productId),
                    itm.productName,
                    itm.productBarcode || null,
                    itm.brand || null,
                    itm.color || null,
                    itm.colorHex || null,
                    itm.size || null,
                    itm.variantId || null,
                    itm.comment || null,
                    Number(itm.quantity || 1),
                    Number(itm.originalPrice || itm.salePrice || 0),
                    Number(itm.discountAmount || 0),
                    Number(itm.salePrice || 0),
                    Number(itm.costPrice || 0),
                    Number(itm.total || 0),
                    Number(itm.profit || 0)
                  ]
                );
              }
            }
            if (Array.isArray(s.debtPayments)) {
              for (const dp of s.debtPayments) {
                const dpId = dp.id ? String(dp.id) : `dp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
                await trx.execute(
                  `INSERT INTO debt_payments (id, sale_id, amount, previous_debt, remaining_debt, payment_method, notes, date)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                  [
                    dpId,
                    String(s.id),
                    Number(dp.amount || 0),
                    Number(dp.previousDebt || 0),
                    Number(dp.remainingDebt || 0),
                    dp.paymentMethod || "Na\u011Fd",
                    dp.notes || "",
                    dp.date || (/* @__PURE__ */ new Date()).toISOString()
                  ]
                );
              }
            }
            importedSales++;
          }
        }
      }
      if (setting && typeof setting === "object") {
        for (const [k, v] of Object.entries(setting)) {
          if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") {
            await trx.execute("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)", [k, String(v)]);
          }
        }
      }
    });
    console.log(
      `\u2705 [Bootstrap] Imported: ${importedProducts} products, ${importedSales} sales, ${importedCategories} categories, ${importedSuppliers} suppliers.`
    );
    res.json({
      success: true,
      imported: {
        products: importedProducts,
        sales: importedSales,
        categories: importedCategories,
        suppliers: importedSuppliers
      }
    });
  } catch (err) {
    console.error("Bootstrap error:", err);
    res.status(500).json({ error: err.message });
  }
});
router8.post("/push", optionalAuth, async (req, res) => {
  try {
    const { operations } = req.body;
    if (!Array.isArray(operations)) {
      res.status(400).json({ error: "operations array t\u0259l\u0259b olunur" });
      return;
    }
    const results = [];
    for (const op of operations) {
      const clientUuid = op.clientUuid;
      if (!clientUuid) {
        results.push({ clientUuid: "unknown", status: "FAILED", error: "clientUuid t\u0259l\u0259b olunur" });
        continue;
      }
      const existing = await db.queryOne("SELECT id FROM sales WHERE client_uuid = ?", [clientUuid]);
      if (existing) {
        results.push({ clientUuid, status: "DUPLICATE" });
        continue;
      }
      if (op.type === "SALE_CREATE") {
        try {
          const saleData = op.payload;
          const items = saleData.items || [];
          const rawItems = [];
          for (const itm of items) {
            const prod = await db.queryOne("SELECT * FROM products WHERE id = ?", [String(itm.productId)]);
            const origPrice = prod ? Number(prod.sale_price) : Number(itm.originalPrice || itm.salePrice || 0);
            const costPrice = prod ? Number(prod.purchase_price) : Number(itm.costPrice || 0);
            rawItems.push({
              productId: String(itm.productId),
              variantId: itm.variantId ? String(itm.variantId) : void 0,
              productName: itm.productName || (prod ? prod.name : "M\u0259hsul"),
              productBarcode: itm.productBarcode || (prod ? prod.barcode : ""),
              brand: itm.brand || "",
              color: itm.color || "",
              colorHex: itm.colorHex || "",
              size: itm.size || "",
              comment: itm.comment || "",
              quantity: Math.max(1, Number(itm.quantity || 1)),
              dbOriginalPrice: origPrice,
              dbCostPrice: costPrice,
              requestedDiscountAmount: Number(itm.discountAmount || 0)
            });
          }
          const calc = calculateServerSale(
            rawItems,
            Number(saleData.discount || 0),
            Number(saleData.paidAmount || 0),
            saleData.paymentMethod || "Na\u011Fd"
          );
          const saleId = saleData.id || `sale_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
          const saleDate = saleData.date || (/* @__PURE__ */ new Date()).toISOString();
          await db.transaction(async (trx) => {
            await trx.execute(
              `INSERT INTO sales (
                id, client_uuid, device_id, seller_id, seller_name, date,
                subtotal, item_discounts_total, subtotal_after_item_discounts,
                global_discount_percent, discount, total_discount, total,
                paid_amount, change_amount, debt_amount, initial_debt_amount, initial_paid_amount,
                payment_method, partial_payment_method, customer_name, notes, is_returned, sync_status
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 'SYNCED')`,
              [
                saleId,
                clientUuid,
                op.deviceId || "mobile_offline",
                req.user?.userId || "system",
                req.user?.fullName || "Sat\u0131c\u0131",
                saleDate,
                calc.subtotal,
                calc.itemDiscountsTotal,
                calc.subtotalAfterItemDiscounts,
                calc.globalDiscountPercent,
                calc.globalDiscount,
                calc.totalDiscount,
                calc.total,
                calc.paidAmount,
                calc.changeAmount,
                calc.debtAmount,
                calc.debtAmount,
                calc.paidAmount,
                saleData.paymentMethod || "Na\u011Fd",
                saleData.partialPaymentMethod || null,
                saleData.customerName || null,
                saleData.notes || null
              ]
            );
            for (const item of calc.items) {
              const itemId = `si_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
              await trx.execute(
                `INSERT INTO sale_items (
                  id, sale_id, product_id, product_name, product_barcode, brand, color, color_hex,
                  size, variant_id, comment, quantity, original_price, discount_amount, sale_price,
                  cost_price, total, profit
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                  itemId,
                  saleId,
                  item.productId,
                  item.productName,
                  item.productBarcode || null,
                  item.brand || null,
                  item.color || null,
                  item.colorHex || null,
                  item.size || null,
                  item.variantId || null,
                  item.comment || null,
                  item.quantity,
                  item.originalPrice,
                  item.discountAmount,
                  item.salePrice,
                  item.costPrice,
                  item.total,
                  item.profit
                ]
              );
              await trx.execute("UPDATE products SET stock_quantity = stock_quantity - ? WHERE id = ?", [
                item.quantity,
                item.productId
              ]);
              if (item.variantId) {
                await trx.execute(
                  "UPDATE product_variants SET stock_quantity = stock_quantity - ? WHERE id = ?",
                  [item.quantity, item.variantId]
                );
              }
            }
            await trx.execute(
              `INSERT INTO sync_operations (id, client_uuid, device_id, entity_type, operation, status)
               VALUES (?, ?, ?, 'sale', 'create', 'SUCCESS')`,
              [`sync_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`, clientUuid, op.deviceId || "mobile"]
            );
          });
          realtimeHub.broadcast("SALE_CREATED", { id: saleId, clientUuid }, op.deviceId);
          realtimeHub.broadcast("STOCK_UPDATED", { saleId }, op.deviceId);
          results.push({ clientUuid, status: "SUCCESS" });
        } catch (opErr) {
          results.push({ clientUuid, status: "FAILED", error: opErr.message });
        }
      }
    }
    res.json({ results });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router8.get("/pull", async (req, res) => {
  try {
    const { since } = req.query;
    let productSql = "SELECT * FROM products";
    const productParams = [];
    if (since) {
      productSql += " WHERE updated_at >= ?";
      productParams.push(String(since));
    }
    const products = await db.query(productSql, productParams);
    const variants = await db.query("SELECT * FROM product_variants");
    const categories = await db.query("SELECT * FROM categories");
    const settings = await db.query("SELECT * FROM settings");
    res.json({
      serverTime: (/* @__PURE__ */ new Date()).toISOString(),
      productsCount: products.length,
      categories,
      settings: settings.reduce((acc, row) => {
        acc[row.key] = row.value;
        return acc;
      }, {})
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
var syncRoutes_default = router8;

// server/routes/reportsRoutes.ts
var import_express9 = require("express");
var router9 = (0, import_express9.Router)();
router9.get("/summary", async (_req, res) => {
  try {
    const salesSummary = await db.queryOne(`
      SELECT 
        COALESCE(SUM(s.total), 0) as totalRevenue,
        COALESCE(SUM(s.total_discount), 0) as totalDiscount,
        COUNT(s.id) as totalSalesCount,
        COALESCE(SUM(s.debt_amount), 0) as totalDebt,
        COALESCE((SELECT SUM(si.profit) FROM sale_items si JOIN sales s2 ON si.sale_id = s2.id WHERE s2.is_returned = 0), 0) as totalProfit
      FROM sales s
      WHERE s.is_returned = 0
    `);
    const inventorySummary = await db.queryOne(`
      SELECT 
        COUNT(id) as totalProductsCount,
        COALESCE(SUM(stock_quantity), 0) as totalItemsInStock,
        COALESCE(SUM(stock_quantity * purchase_price), 0) as inventoryCostValue,
        COALESCE(SUM(stock_quantity * sale_price), 0) as inventoryRetailValue
      FROM products
    `);
    const expensesSummary = await db.queryOne(
      "SELECT COALESCE(SUM(amount), 0) as totalExpenses FROM expenses"
    );
    const grossProfit = Number(salesSummary?.totalProfit || 0);
    const expenses = Number(expensesSummary?.totalExpenses || 0);
    const netProfit = roundMoney(grossProfit - expenses);
    res.json({
      summary: {
        totalRevenue: roundMoney(Number(salesSummary?.totalRevenue || 0)),
        totalProfit: roundMoney(grossProfit),
        netProfit,
        totalExpenses: roundMoney(expenses),
        totalDiscount: roundMoney(Number(salesSummary?.totalDiscount || 0)),
        totalSalesCount: Number(salesSummary?.totalSalesCount || 0),
        totalDebt: roundMoney(Number(salesSummary?.totalDebt || 0)),
        totalProductsCount: Number(inventorySummary?.totalProductsCount || 0),
        totalItemsInStock: Number(inventorySummary?.totalItemsInStock || 0),
        inventoryCostValue: roundMoney(Number(inventorySummary?.inventoryCostValue || 0)),
        inventoryRetailValue: roundMoney(Number(inventorySummary?.inventoryRetailValue || 0))
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router9.get("/top-products", async (req, res) => {
  try {
    const limit = Math.min(50, Number(req.query.limit || 10));
    const rows = await db.query(
      `SELECT 
        product_id as productId,
        product_name as productName,
        SUM(quantity) as totalQuantity,
        SUM(total) as totalRevenue,
        SUM(profit) as totalProfit
       FROM sale_items si
       JOIN sales s ON si.sale_id = s.id
       WHERE s.is_returned = 0
       GROUP BY product_id, product_name
       ORDER BY totalQuantity DESC
       LIMIT ?`,
      [limit]
    );
    res.json({ topProducts: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
var reportsRoutes_default = router9;

// server/geminiClient.ts
var import_genai = require("@google/genai");
var aiClient = null;
function getGeminiClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey.trim() === "") {
    return null;
  }
  if (!aiClient) {
    aiClient = new import_genai.GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build"
        }
      }
    });
  }
  return aiClient;
}

// server/aiService.ts
async function generateProductImage(params) {
  const ai = getGeminiClient();
  const prompt = [
    `Professional studio product photography of ${params.name || "fashion item"}.`,
    params.category ? `Category: ${params.category}.` : "",
    params.color ? `Color: ${params.color}.` : "",
    params.brand ? `Brand: ${params.brand}.` : "",
    params.notes ? `Details: ${params.notes}.` : "",
    "Clean minimalist neutral light grey background, high resolution e-commerce catalog style, centered garment, soft studio lighting, textile texture, sharp focus, 1:1 aspect ratio, commercial retail presentation without human face, premium fashion apparel look."
  ].filter(Boolean).join(" ");
  if (!ai) {
    return {
      imageUrl: createPlaceholderSvg(params.name, params.color, params.category),
      promptUsed: prompt
    };
  }
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-lite-image",
      contents: {
        parts: [{ text: prompt }]
      },
      config: {
        imageConfig: {
          aspectRatio: "1:1"
        }
      }
    });
    const parts = response.candidates?.[0]?.content?.parts || [];
    for (const part of parts) {
      if (part.inlineData && part.inlineData.data) {
        const mimeType = part.inlineData.mimeType || "image/jpeg";
        return {
          imageUrl: `data:${mimeType};base64,${part.inlineData.data}`,
          promptUsed: prompt
        };
      }
    }
  } catch (err) {
    console.warn("Image generation error or fallback:", err?.message || err);
  }
  return {
    imageUrl: createPlaceholderSvg(params.name, params.color, params.category),
    promptUsed: prompt
  };
}
function createPlaceholderSvg(name, color, category) {
  const bg = color?.toLowerCase().includes("qara") || color?.toLowerCase().includes("black") ? "#1e293b" : color?.toLowerCase().includes("q\u0131rm\u0131z\u0131") || color?.toLowerCase().includes("red") ? "#b91c1c" : color?.toLowerCase().includes("mavi") || color?.toLowerCase().includes("g\xF6y") || color?.toLowerCase().includes("blue") ? "#1d4ed8" : "#475569";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400">
    <defs>
      <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#f8fafc"/>
        <stop offset="100%" stop-color="#e2e8f0"/>
      </linearGradient>
    </defs>
    <rect width="400" height="400" rx="24" fill="url(#grad)"/>
    <circle cx="200" cy="180" r="85" fill="${bg}" opacity="0.9"/>
    <!-- Stylized hanger/apparel icon -->
    <path d="M200 135 C190 135 185 145 190 152 L170 180 L230 180 L210 152 C215 145 210 135 200 135 Z" fill="#ffffff" opacity="0.9"/>
    <path d="M150 190 L250 190 L240 240 L160 240 Z" fill="#ffffff" opacity="0.8"/>
    <text x="200" y="310" font-family="system-ui, sans-serif" font-size="16" font-weight="bold" fill="#1e293b" text-anchor="middle">${escapeXml(name.slice(0, 28))}</text>
    <text x="200" y="335" font-family="system-ui, sans-serif" font-size="13" fill="#64748b" text-anchor="middle">${escapeXml(category || "Tekstil / Geyim")} ${color ? `\u2022 ${escapeXml(color)}` : ""}</text>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
function escapeXml(unsafe) {
  return unsafe.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case "&":
        return "&amp;";
      case "'":
        return "&apos;";
      case '"':
        return "&quot;";
      default:
        return c;
    }
  });
}
async function generateProductDescription(params) {
  const ai = getGeminiClient();
  const details = [
    `M\u0259hsul ad\u0131: ${params.name}`,
    params.category ? `Kateqoriya: ${params.category}` : "",
    params.brand ? `Brend: ${params.brand}` : "",
    params.color ? `R\u0259ng: ${params.color}` : "",
    params.sizes && params.sizes.length > 0 ? `M\xF6vcud \xF6l\xE7\xFCl\u0259r: ${params.sizes.join(", ")}` : "",
    params.salePrice ? `Sat\u0131\u015F qiym\u0259ti: ${params.salePrice} AZN` : "",
    params.existingNotes ? `\u018Flav\u0259 qeydl\u0259r: ${params.existingNotes}` : ""
  ].filter(Boolean).join("\n");
  if (!ai) {
    return `${params.name} \u2014 Y\xFCks\u0259k keyfiyy\u0259tli par\xE7adan haz\u0131rlanm\u0131\u015F, g\xFCnd\u0259lik v\u0259 x\xFCsusi g\xFCnl\u0259r \xFC\xE7\xFCn rahat ${params.category || "geyim"}. ${params.color ? `R\u0259ng: ${params.color}. ` : ""}${params.sizes && params.sizes.length > 0 ? `\xD6l\xE7\xFCl\u0259r: ${params.sizes.join(", ")}. ` : ""}B\u0259d\u0259n\u0259 tam oturan k\u0259sim v\u0259 d\u0259riy\u0259 n\u0259f\u0259s ald\u0131ran material.`;
  }
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.8-flash",
      contents: `S\u0259n Kassa360 geyim v\u0259 tekstil ma\u011Fazas\u0131 \xFC\xE7\xFCn pe\u015F\u0259kar sat\u0131\u015F v\u0259 e-ticar\u0259t kopirayteris\u0259n.
A\u015Fa\u011F\u0131dak\u0131 m\u0259hsul m\u0259lumatlar\u0131na \u0259sas\u0259n Az\u0259rbaycan dilind\u0259 2-3 c\xFCml\u0259lik c\u0259lbedici, lakonik, pe\u015F\u0259kar m\u0259hsul t\u0259sviri yaz:
${details}

T\u0259l\u0259bl\u0259r:
- Yaln\u0131z son t\u0259svir m\u0259tnini qaytar (\u0259lav\u0259 ba\u015Fl\u0131q, salamlama v\u0259 ya d\u0131rnaq i\u015Far\u0259si olmadan).
- Par\xE7a keyfiyy\u0259ti, rahatl\u0131\u011F\u0131 v\u0259 k\u0259simi vur\u011Fula.
- Ma\u011Fazan\u0131n m\xFC\u015Ft\u0259ril\u0259rin\u0259 birba\u015Fa t\u0259qdim edil\u0259c\u0259k t\u0259bii dild\u0259 olsun.`
    });
    return response.text?.trim() || "Keyfiyy\u0259tli v\u0259 rahat geyim m\u0259hsulu.";
  } catch (err) {
    console.error("Error generating product description:", err);
    return `${params.name} \u2014 Rahat v\u0259 keyfiyy\u0259tli materialdan haz\u0131rlanm\u0131\u015F, h\u0259m g\xFCnd\u0259lik, h\u0259m d\u0259 z\xF6vql\xFC g\xF6r\xFCn\xFC\u015F \xFC\xE7\xFCn ideal se\xE7im.`;
  }
}
async function suggestProductCategory(params) {
  const ai = getGeminiClient();
  if (!ai || params.existingCategories.length === 0) {
    const lower = params.productName.toLowerCase();
    const match = params.existingCategories.find(
      (cat) => lower.includes(cat.toLowerCase()) || cat.toLowerCase().includes(lower)
    );
    if (match) {
      return {
        suggestedCategory: match,
        isExisting: true,
        confidence: 0.85,
        reasoning: "M\u0259hsul ad\u0131ndak\u0131 a\xE7ar s\xF6z\u0259 \u0259sas\u0259n m\xFC\u0259yy\u0259n edildi."
      };
    }
    if (lower.includes("k\xF6yn\u0259k") || lower.includes("rubaska") || lower.includes("t-shirt") || lower.includes("futbolka")) {
      const shirtCat = params.existingCategories.find((c) => c.toLowerCase().includes("k\xF6yn\u0259k") || c.toLowerCase().includes("geyim"));
      if (shirtCat) return { suggestedCategory: shirtCat, isExisting: true, confidence: 0.8, reasoning: "Geyim/K\xF6yn\u0259k kateqoriyas\u0131 il\u0259 uy\u011Funla\u015Fd\u0131r\u0131ld\u0131." };
    }
    if (lower.includes("\u015Falvar") || lower.includes("cins") || lower.includes("jeans")) {
      const pantsCat = params.existingCategories.find((c) => c.toLowerCase().includes("\u015Falvar") || c.toLowerCase().includes("geyim"));
      if (pantsCat) return { suggestedCategory: pantsCat, isExisting: true, confidence: 0.8, reasoning: "\u015Ealvar/Geyim kateqoriyas\u0131 il\u0259 uy\u011Funla\u015Fd\u0131r\u0131ld\u0131." };
    }
    if (lower.includes("kostyum") || lower.includes("penc\u0259k") || lower.includes("jaket")) {
      const suitCat = params.existingCategories.find((c) => c.toLowerCase().includes("kostyum") || c.toLowerCase().includes("geyim"));
      if (suitCat) return { suggestedCategory: suitCat, isExisting: true, confidence: 0.8, reasoning: "Kostyum kateqoriyas\u0131 il\u0259 uy\u011Funla\u015Fd\u0131r\u0131ld\u0131." };
    }
    return {
      suggestedCategory: params.existingCategories[0] || "Geyim",
      isExisting: true,
      confidence: 0.5,
      reasoning: "Standart m\xF6vcud kateqoriya t\u0259klif edildi."
    };
  }
  try {
    const prompt = `M\u0259hsul ad\u0131: "${params.productName}"
${params.brand ? `Brend: ${params.brand}` : ""}
${params.color ? `R\u0259ng: ${params.color}` : ""}

M\xF6vcud ma\u011Faza kateqoriyalar\u0131:
${JSON.stringify(params.existingCategories)}

Tap\u015F\u0131r\u0131q:
Bu m\u0259hsul \xFC\xE7\xFCn \u0259n uy\u011Fun M\xD6VCUD kateqoriyan\u0131 se\xE7. Yaln\u0131z m\xF6vcud kateqoriyalar siyah\u0131s\u0131ndan birini se\xE7m\u0259y\u0259 \xFCst\xFCnl\xFCk ver.
Cavab\u0131 yaln\u0131z etibarl\u0131 JSON format\u0131nda ver:
{
  "suggestedCategory": "se\xE7il\u0259n kateqoriya ad\u0131",
  "isExisting": true v\u0259 ya false,
  "confidence": 0.0 il\u0259 1.0 aras\u0131 \u0259msal,
  "reasoning": "q\u0131sa izahat (Az\u0259rbaycan dilind\u0259)"
}`;
    const response = await ai.models.generateContent({
      model: "gemini-3.8-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json"
      }
    });
    const parsed = JSON.parse(response.text || "{}");
    const isExisting = params.existingCategories.includes(parsed.suggestedCategory);
    return {
      suggestedCategory: parsed.suggestedCategory || params.existingCategories[0],
      isExisting,
      confidence: typeof parsed.confidence === "number" ? parsed.confidence : 0.8,
      reasoning: parsed.reasoning || "AI t\u0259r\u0259find\u0259n \u0259n uy\u011Fun kateqoriya olaraq se\xE7ildi."
    };
  } catch (err) {
    console.error("Error suggesting category:", err);
    return {
      suggestedCategory: params.existingCategories[0] || "Geyim",
      isExisting: true,
      confidence: 0.6,
      reasoning: "M\xF6vcud kateqoriyalar \u0259sas\u0131nda se\xE7ildi."
    };
  }
}
async function parseNaturalLanguageSearch(query, categories = []) {
  const ai = getGeminiClient();
  const fallbackParse = () => {
    let q = query.trim().toLowerCase();
    let maxPrice;
    let minPrice;
    let size;
    let color;
    let category;
    let keyword;
    const explicitSizeMatch = q.match(/(?:razmer|ölçü|ölçüsü|size)\s*([a-z0-9]+)/i) || q.match(/([a-z0-9]+)\s*(?:razmer|ölçü|ölçüsü|size)/i);
    if (explicitSizeMatch && !["azn", "manat"].includes(explicitSizeMatch[1].toLowerCase())) {
      size = explicitSizeMatch[1].toUpperCase();
    } else {
      const standardSizeMatch = q.match(/\b(xs|s|m|l|xl|xxl|xxxl|2xl|3xl|4xl)\b/i);
      if (standardSizeMatch) {
        size = standardSizeMatch[1].toUpperCase();
      }
    }
    const maxPriceMatch = q.match(/(\d+(?:\.\d+)?)\s*(?:azn|manat|m)?(?:\s*(?:altında|aşağı|dən aşağı|dan aşağı|under|less than|ucuz))/i) || q.match(/(?:altında|aşağı|under|max|maks)\s*(\d+(?:\.\d+)?)/i) || q.match(/(\d+(?:\.\d+)?)\s*(?:-dək|-dak|-ə qədər|-a qədər)/i);
    if (maxPriceMatch) {
      maxPrice = parseFloat(maxPriceMatch[1]);
    }
    const minPriceMatch = q.match(/(\d+(?:\.\d+)?)\s*(?:azn|manat|m)?(?:\s*(?:yuxarı|dən yuxarı|dan yuxarı|baha|over|more than))/i);
    if (minPriceMatch) {
      minPrice = parseFloat(minPriceMatch[1]);
    }
    const colors = [
      { name: "Qara", patterns: ["qara", "black", "\u0447\u0451\u0440\u043D\u044B\u0439", "\u0447\u0435\u0440\u043D\u044B\u0439"] },
      { name: "A\u011F", patterns: ["a\u011F", "ag", "white", "\u0431\u0435\u043B\u044B\u0439"] },
      { name: "G\xF6y", patterns: ["g\xF6y", "goy", "mavi", "blue", "\u0441\u0438\u043D\u0438\u0439", "\u0433\u043E\u043B\u0443\u0431\u043E\u0439", "marin"] },
      { name: "Q\u0131rm\u0131z\u0131", patterns: ["q\u0131rm\u0131z\u0131", "qirmizi", "red", "\u043A\u0440\u0430\u0441\u043D\u044B\u0439"] },
      { name: "Boz", patterns: ["boz", "grey", "gray", "\u0441\u0435\u0440\u044B\u0439"] },
      { name: "Bej", patterns: ["bej", "beige", "\u0431\u0435\u0436\u0435\u0432\u044B\u0439"] },
      { name: "Ya\u015F\u0131l", patterns: ["ya\u015F\u0131l", "yasil", "green", "\u0437\u0435\u043B\u0435\u043D\u044B\u0439"] },
      { name: "Sar\u0131", patterns: ["sar\u0131", "sari", "yellow", "\u0436\u0435\u043B\u0442\u044B\u0439"] },
      { name: "Q\u0259hv\u0259yi", patterns: ["q\u0259hv\u0259yi", "qehveyi", "brown", "\u043A\u043E\u0440\u0438\u0447\u043D\u0435\u0432\u044B\u0439"] }
    ];
    for (const c of colors) {
      if (c.patterns.some((p) => q.includes(p))) {
        color = c.name;
        break;
      }
    }
    for (const cat of categories) {
      if (q.includes(cat.toLowerCase())) {
        category = cat;
        break;
      }
    }
    let clean = q.replace(/\b(?:azn|manat|razmer|ölçü|size|under|aşağı|dən aşağı|dan aşağı|altında|ucuz|baha|olan|qiyməti|manata|manatdan)\b/gi, " ").replace(/\d+/g, " ").trim();
    if (clean.length > 1) {
      keyword = clean;
    }
    return {
      keyword,
      category,
      color,
      size,
      minPrice,
      maxPrice,
      explanation: `Axtar\u0131\u015F filtri: ${[
        category ? `Kateqoriya: ${category}` : "",
        color ? `R\u0259ng: ${color}` : "",
        size ? `\xD6l\xE7\xFC: ${size}` : "",
        maxPrice ? `Maks. qiym\u0259t: ${maxPrice} AZN` : "",
        minPrice ? `Min. qiym\u0259t: ${minPrice} AZN` : "",
        keyword ? `A\xE7ar s\xF6z: ${keyword}` : ""
      ].filter(Boolean).join(", ") || query}`
    };
  };
  if (!ai) {
    return fallbackParse();
  }
  try {
    const prompt = `A\u015Fa\u011F\u0131dak\u0131 t\u0259bii dild\u0259 yaz\u0131lm\u0131\u015F geyim ma\u011Fazas\u0131 axtar\u0131\u015F sor\u011Fusunu strukturla\u015Fd\u0131r\u0131lm\u0131\u015F axtar\u0131\u015F filtrl\u0259rin\u0259 \xE7evir:
Sor\u011Fu: "${query}"

M\xF6vcud kateqoriyalar:
${JSON.stringify(categories)}

Yaln\u0131z etibarl\u0131 JSON qaytar:
{
  "keyword": "m\u0259hsul n\xF6v\xFC v\u0259 ya a\xE7ar s\xF6z (m\u0259s: kostyum, k\xF6yn\u0259k, \u015Falvar)",
  "category": "m\xF6vcud kateqoriyalardan \u0259n uy\u011Funu v\u0259 ya null",
  "color": "r\u0259ng (Az\u0259rbaycan dilind\u0259, m\u0259s: Qara, A\u011F, G\xF6y, Q\u0131rm\u0131z\u0131 v\u0259 s.) v\u0259 ya null",
  "size": "\xF6l\xE7\xFC (m\u0259s: 52, M, XL, 42) v\u0259 ya null",
  "minPrice": minimum r\u0259q\u0259m v\u0259 ya null,
  "maxPrice": maksimum r\u0259q\u0259m v\u0259 ya null,
  "brand": "brend ad\u0131 v\u0259 ya null",
  "explanation": "sor\u011Funun az\u0259rbaycanca q\u0131sa izah\u0131"
}`;
    const response = await ai.models.generateContent({
      model: "gemini-3.8-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json"
      }
    });
    const parsed = JSON.parse(response.text || "{}");
    return {
      keyword: parsed.keyword || void 0,
      category: parsed.category || void 0,
      color: parsed.color || void 0,
      size: parsed.size ? String(parsed.size).toUpperCase() : void 0,
      minPrice: typeof parsed.minPrice === "number" ? parsed.minPrice : void 0,
      maxPrice: typeof parsed.maxPrice === "number" ? parsed.maxPrice : void 0,
      brand: parsed.brand || void 0,
      explanation: parsed.explanation || `T\u0259bii axtar\u0131\u015F strukturu: "${query}"`
    };
  } catch (err) {
    console.error("Error in parseNaturalLanguageSearch:", err);
    return fallbackParse();
  }
}
async function analyzeSalesData(params) {
  const ai = getGeminiClient();
  const contextData = JSON.stringify(params.salesData, null, 2);
  if (!ai) {
    const topProd = params.salesData.topProducts[0];
    const topCat = params.salesData.categoryRevenue[0];
    const curr = params.salesData.monthlyComparison.currentMonth;
    const prev = params.salesData.monthlyComparison.lastMonth;
    const revDiff = curr.revenue - prev.revenue;
    const revPct = prev.revenue > 0 ? (revDiff / prev.revenue * 100).toFixed(1) : "100";
    return `\u{1F4CA} **Real Sat\u0131\u015F M\u0259lumatlar\u0131 \u018Fsas\u0131nda Hesabat:**

\u2022 **\u018Fn \xE7ox sat\u0131lan m\u0259hsul:** ${topProd ? `${topProd.name} (${topProd.quantity} \u0259d\u0259d, ${topProd.revenue.toFixed(2)} AZN)` : "M\u0259lumat yoxdur"}
\u2022 **\u018Fn \xE7ox g\u0259lir g\u0259tir\u0259n kateqoriya:** ${topCat ? `${topCat.category} (${topCat.revenue.toFixed(2)} AZN)` : "M\u0259lumat yoxdur"}
\u2022 **Cari ay d\xF6vriyy\u0259si:** ${curr.revenue.toFixed(2)} AZN (${curr.salesCount} \xE7ek)
\u2022 **Ke\xE7\u0259n ayla m\xFCqayis\u0259:** ${revDiff >= 0 ? `+${revDiff.toFixed(2)} AZN art\u0131m (+${revPct}%)` : `${revDiff.toFixed(2)} AZN azalma (${revPct}%)`}
\u2022 **C\u0259mi xalis m\u0259nf\u0259\u0259t:** ${params.salesData.totalProfit.toFixed(2)} AZN`;
  }
  try {
    const prompt = `S\u0259n Kassa360 POS sisteminin ba\u015F maliyy\u0259 v\u0259 sat\u0131\u015F analitikis\u0259n.
\u0130stifad\u0259\xE7inin sual\u0131: "${params.question}"

Ma\u011Fazan\u0131n BAZASINDAN REAL SATI\u015E STAT\u0130ST\u0130KASI:
${contextData}

T\u018FL\u018FBL\u018FR:
1. YALNIZ v\u0259 YALNIZ yuxar\u0131dak\u0131 real veril\u0259nl\u0259r\u0259 \u0259saslanaraq cavab ver. He\xE7 vaxt saxta r\u0259q\u0259m, m\u0259hsul v\u0259 ya t\u0259xmin uydurma!
2. Suala d\u0259qiq, ayd\u0131n, r\u0259q\u0259ml\u0259r v\u0259 faizl\u0259rl\u0259 z\u0259nginl\u0259\u015Fdirilmi\u015F pe\u015F\u0259kar hesabat \u015F\u0259klind\u0259 cavab ver.
3. M\xFCqayis\u0259 ist\u0259nilibs\u0259 (cari ay v\u0259 ke\xE7\u0259n ay), konkret r\u0259q\u0259ml\u0259rl\u0259 f\u0259rqi v\u0259 dinamikan\u0131 g\xF6st\u0259r.
4. Az\u0259rbaycan dilind\u0259, s\u0259liq\u0259li Markdown format\u0131nda (qal\u0131n \u015Frift, b\u0259ndl\u0259r) cavab ver.`;
    const response = await ai.models.generateContent({
      model: "gemini-3.8-flash",
      contents: prompt
    });
    return response.text?.trim() || "Sat\u0131\u015F analizi tamamland\u0131.";
  } catch (err) {
    console.error("Error in analyzeSalesData:", err);
    return "Sat\u0131\u015F analizi zaman\u0131 x\u0259ta ba\u015F verdi. Real baza g\xF6st\u0259ricil\u0259ri panelind\u0259ki qrafikl\u0259ri n\u0259z\u0259rd\u0259n ke\xE7irin.";
  }
}
async function analyzePricingData(params) {
  const ai = getGeminiClient();
  const sampleProducts = params.products.slice(0, 40);
  if (!ai) {
    const recs = sampleProducts.slice(0, 5).map((p) => {
      const margin = p.marginPercent;
      if (margin < 20 && p.soldCount > 5) {
        return {
          productId: p.id,
          productName: p.name,
          currentPrice: p.salePrice,
          suggestedPrice: Number((p.salePrice * 1.1).toFixed(2)),
          reason: `Marja a\u015Fa\u011F\u0131d\u0131r (${margin.toFixed(1)}%), lakin t\u0259l\u0259bat y\xFCks\u0259kdir. Qiym\u0259ti azac\u0131q art\u0131rmaq rentabelliyi g\xFCcl\u0259ndir\u0259r.`,
          actionType: "increase"
        };
      }
      if (p.stockQuantity > 15 && p.soldCount === 0) {
        return {
          productId: p.id,
          productName: p.name,
          currentPrice: p.salePrice,
          suggestedPrice: Number((p.salePrice * 0.88).toFixed(2)),
          reason: `Stokda \xE7oxdur (${p.stockQuantity} \u0259d\u0259d), lakin sat\u0131\u015F yoxdur. Likvidliyi art\u0131rmaq \xFC\xE7\xFCn f\u0259sli endirim t\u0259klif edilir.`,
          actionType: "discount_campaign"
        };
      }
      return {
        productId: p.id,
        productName: p.name,
        currentPrice: p.salePrice,
        suggestedPrice: p.salePrice,
        reason: `Balansla\u015Fd\u0131r\u0131lm\u0131\u015F marja (${margin.toFixed(1)}%) v\u0259 stabil sat\u0131\u015F tempi.`,
        actionType: "maintain"
      };
    });
    return {
      insights: "\u{1F4CA} **Qiym\u0259t v\u0259 Marja Analizi:**\n\nMa\u011Fazadak\u0131 m\u0259hsullar\u0131n maya v\u0259 sat\u0131\u015F qiym\u0259tl\u0259ri, faktiki marjalar v\u0259 sat\u0131\u015F d\xF6vriyy\u0259si t\u0259hlil edildi. B\u0259zi y\xFCks\u0259k t\u0259l\u0259batl\u0131 mallarda marjan\u0131 optimalla\u015Fd\u0131rmaq, h\u0259r\u0259k\u0259tsiz qalan stoklarda is\u0259 x\xFCsusi kampaniyalar t\u0259tbiq etm\u0259k t\xF6vsiy\u0259 olunur. Qeyd: Qiym\u0259tl\u0259r he\xE7 vaxt avtomatik d\u0259yi\u015Fdirilmir, q\u0259rar ma\u011Faza sahibin\u0259 m\u0259xsusdur.",
      recommendations: recs
    };
  }
  try {
    const prompt = `S\u0259n Kassa360 p\u0259rak\u0259nd\u0259 tekstil v\u0259 geyim ma\u011Fazas\u0131 \xFC\xE7\xFCn qiym\u0259t v\u0259 marja ekspertis\u0259n.
A\u015Fa\u011F\u0131dak\u0131 real m\u0259hsul v\u0259 sat\u0131\u015F g\xF6st\u0259ricil\u0259rini t\u0259hlil et:
${JSON.stringify(sampleProducts, null, 2)}

T\u018FL\u018FBL\u018FR:
1. X\u018FB\u018FRDARLIQ: Sistem he\xE7 vaxt qiym\u0259tl\u0259ri avtomatik d\u0259yi\u015Fmir. T\u0259hlil yaln\u0131z t\xF6vsiy\u0259 xarakterlidir.
2. Qiym\u0259t elastikliyi, marja faizi, anbar qal\u0131\u011F\u0131 v\u0259 sat\u0131\u015F s\xFCr\u0259tini n\u0259z\u0259r\u0259 al.
3. Yaln\u0131z etibarl\u0131 JSON qaytar:
{
  "insights": "\xFCmumi qiym\u0259t v\u0259ziyy\u0259ti, riskl\u0259r v\u0259 potensiallar haqq\u0131nda az\u0259rbaycanca \u0259trafl\u0131 hesabat m\u0259tni",
  "recommendations": [
    {
      "productId": 123,
      "productName": "m\u0259hsul ad\u0131",
      "currentPrice": 50,
      "suggestedPrice": 55,
      "reason": "qiym\u0259t t\u0259klifinin d\u0259qiq iqtisadi \u0259sas\u0131",
      "actionType": "increase" v\u0259 ya "decrease" v\u0259 ya "maintain" v\u0259 ya "discount_campaign"
    }
  ]
}`;
    const response = await ai.models.generateContent({
      model: "gemini-3.8-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json"
      }
    });
    const parsed = JSON.parse(response.text || "{}");
    return {
      insights: parsed.insights || "Qiym\u0259t t\u0259hlili tamamland\u0131.",
      recommendations: Array.isArray(parsed.recommendations) ? parsed.recommendations : []
    };
  } catch (err) {
    console.error("Error in analyzePricingData:", err);
    return {
      insights: "Qiym\u0259t analizi tamamland\u0131. M\u0259hsul siyah\u0131s\u0131ndak\u0131 marjalara \u0259sas\u0259n q\u0259rarlar q\u0259bul ed\u0259 bil\u0259rsiniz.",
      recommendations: []
    };
  }
}
async function analyzeSizeData(params) {
  const ai = getGeminiClient();
  if (!ai) {
    const sorted = [...params.sizeStats].sort((a, b) => b.unitsSold - a.unitsSold);
    const top = sorted.slice(0, 3).map((s) => s.size);
    const slow = sorted.filter((s) => s.unitsSold === 0 && s.currentStock > 0).map((s) => s.size);
    return {
      analysis: `\u{1F4CF} **\xD6l\xE7\xFC Sat\u0131\u015F Dinamikas\u0131:**

\u018Fn \xE7ox sat\u0131lan \xF6l\xE7\xFCl\u0259r: **${top.join(", ") || "M\u0259lumat yoxdur"}**.
L\u0259ng h\u0259r\u0259k\u0259t ed\u0259n v\u0259 ya anbarda y\u0131\u011F\u0131l\u0131b qalan \xF6l\xE7\xFCl\u0259r: **${slow.slice(0, 4).join(", ") || "Yoxdur"}**.
Standart h\u0259rfli \xF6l\xE7\xFCl\u0259r (M, L, XL) v\u0259 \u0259n \xE7ox t\u0259l\u0259b olunan \u015Falvar/kostyum n\xF6mr\u0259l\u0259ri (48, 50, 52) \u0259n y\xFCks\u0259k d\xF6vriyy\u0259ni t\u0259min edir.`,
      topSizes: top,
      slowSizes: slow.slice(0, 5),
      recommendations: [
        "Top \xF6l\xE7\xFCl\u0259r \xFC\xE7\xFCn minimum anbar ehtiyat\u0131 x\u0259b\u0259rdarl\u0131\u011F\u0131n\u0131 art\u0131r\u0131n ki, vitrind\u0259 \xF6l\xE7\xFC q\u0131r\u0131lmas\u0131 ya\u015Fanmas\u0131n.",
        "L\u0259ng \xF6l\xE7\xFCl\u0259r \xFC\xE7\xFCn kombinasiyal\u0131 sat\u0131\u015F v\u0259 ya x\xFCsusi \xF6l\xE7\xFC endirimi kampaniyas\u0131 t\u0259\u015Fkil edin.",
        "Yeni t\u0259dar\xFCk zaman\u0131 assortiment paylanmas\u0131nda \xE7ox sat\u0131lan \xF6l\xE7\xFCl\u0259r\u0259 daha y\xFCks\u0259k faiz ay\u0131r\u0131n."
      ]
    };
  }
  try {
    const prompt = `S\u0259n Kassa360 geyim v\u0259 tekstil POS sisteminin anbar \xF6l\xE7\xFC \xE7e\u015Fidi (size-curve) ekspertis\u0259n.
A\u015Fa\u011F\u0131dak\u0131 real \xF6l\xE7\xFC statistikalar\u0131n\u0131 t\u0259hlil et:
${JSON.stringify(params.sizeStats, null, 2)}

T\u018FL\u018FBL\u018FR:
1. H\u0259m h\u0259rf \xF6l\xE7\xFCl\u0259rini (XS, S, M, L, XL, XXL, 3XL), h\u0259m n\xF6mr\u0259li \xF6l\xE7\xFCl\u0259ri (36-44 ayaqqab\u0131, 46-56 kostyum/\u015Falvar), h\u0259m d\u0259 x\xFCsusi \xF6l\xE7\xFCl\u0259ri (Standart, Battal v\u0259 s.) t\u0259hlil et.
2. Hans\u0131 \xF6l\xE7\xFCl\u0259rin s\xFCr\u0259tli ("hot sizes"), hans\u0131 \xF6l\xE7\xFCl\u0259rin is\u0259 anbarda dondurucu ("slow-moving") oldu\u011Funu m\xFC\u0259yy\u0259n et.
3. Yaln\u0131z etibarl\u0131 JSON qaytar:
{
  "analysis": "az\u0259rbaycanca detall\u0131 analitik izahat m\u0259tni",
  "topSizes": ["\u0259n \xE7ox sat\u0131lan \xF6l\xE7\xFCl\u0259r siyah\u0131s\u0131"],
  "slowSizes": ["l\u0259ng h\u0259r\u0259k\u0259t ed\u0259n \xF6l\xE7\xFCl\u0259r"],
  "recommendations": ["t\u0259chizat v\u0259 anbar balansla\u015Fd\u0131r\u0131lmas\u0131 \xFC\xE7\xFCn 3-4 add\u0131m"]
}`;
    const response = await ai.models.generateContent({
      model: "gemini-3.8-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json"
      }
    });
    const parsed = JSON.parse(response.text || "{}");
    return {
      analysis: parsed.analysis || "\xD6l\xE7\xFC analizi tamamland\u0131.",
      topSizes: Array.isArray(parsed.topSizes) ? parsed.topSizes : [],
      slowSizes: Array.isArray(parsed.slowSizes) ? parsed.slowSizes : [],
      recommendations: Array.isArray(parsed.recommendations) ? parsed.recommendations : []
    };
  } catch (err) {
    console.error("Error in analyzeSizeData:", err);
    return {
      analysis: "\xD6l\xE7\xFC analizi apar\u0131ld\u0131.",
      topSizes: [],
      slowSizes: [],
      recommendations: []
    };
  }
}
async function handleSellerAssistant(params) {
  const ai = getGeminiClient();
  const q = params.message.trim().toLowerCase();
  const searchControlledProducts = (queryText) => {
    const parts = queryText.toLowerCase().split(/\s+/).filter(Boolean);
    return params.storeContext.sampleProducts.filter((p) => {
      const matchName = parts.some((part) => p.name.toLowerCase().includes(part));
      const matchBrand = p.brand && parts.some((part) => p.brand.toLowerCase().includes(part));
      const matchCat = parts.some((part) => p.category.toLowerCase().includes(part));
      const matchColor = p.color && parts.some((part) => p.color.toLowerCase().includes(part));
      const matchBarcode = p.barcode && p.barcode.toLowerCase() === queryText.toLowerCase();
      return matchName || matchBrand || matchCat || matchColor || matchBarcode;
    }).slice(0, 6);
  };
  if (q.includes("bug\xFCnk\xFC sat\u0131\u015F") || q.includes("bugun nece") || q.includes("kassa") || q.includes("today")) {
    const total = params.storeContext.todaySalesTotal.toFixed(2);
    const count = params.storeContext.todaySalesCount;
    return {
      reply: `\u{1F4C5} **Bug\xFCnk\xFC Sat\u0131\u015F G\xF6st\u0259ricil\u0259ri:**

\u2022 **C\u0259mi m\u0259bl\u0259\u011F:** ${total} AZN
\u2022 **Sat\u0131\u015F say\u0131:** ${count} q\u0259bz
\u2022 Ma\u011Fazada aktiv m\u0259hsul \xE7e\u015Fidi: ${params.storeContext.productsCount} \u0259d\u0259d.`,
      suggestedActions: [
        { label: "Kassaya bax", action: "NAVIGATE_TAB", payload: "Sat\u0131\u015F" },
        { label: "Hesabat\u0131 a\xE7", action: "NAVIGATE_TAB", payload: "Hesabatlar" }
      ]
    };
  }
  const matches = searchControlledProducts(q);
  if (!ai) {
    if (matches.length > 0) {
      const list = matches.map(
        (m) => `\u2022 **${m.name}** \u2014 Qiym\u0259t: **${m.salePrice} AZN** | Stok: **${m.stockQuantity} \u0259d\u0259d** | R\u0259ng: ${m.color || "Qeyd yoxdur"} | \xD6l\xE7\xFCl\u0259r: ${(m.sizes || []).join(", ") || "T\u0259k \xF6l\xE7\xFC"}`
      ).join("\n");
      return {
        reply: `Tap\u0131lan m\u0259hsullar (${matches.length} \u0259d\u0259d):

${list}`,
        matchedProducts: matches,
        suggestedActions: matches.map((m) => ({
          label: `${m.name} (${m.salePrice} AZN) - Sat\u0131\u015Fa \u0259lav\u0259 et`,
          action: "ADD_TO_CART",
          payload: m
        }))
      };
    }
    return {
      reply: `Sor\u011Funuz \xFCzr\u0259 birba\u015Fa m\u0259hsul tap\u0131lmad\u0131. M\u0259hsul ad\u0131n\u0131, barkodunu v\u0259 ya "Qara kostyum 52 razmer" kimi t\u0259bii t\u0259svir daxil ed\u0259 bil\u0259rsiniz.`,
      suggestedActions: [
        { label: "Bug\xFCnk\xFC sat\u0131\u015Flar\u0131 g\xF6st\u0259r", action: "ASK", payload: "Bug\xFCnk\xFC sat\u0131\u015Flar nec\u0259dir?" },
        { label: "B\xFCt\xFCn mallara bax", action: "NAVIGATE_TAB", payload: "Mallar" }
      ]
    };
  }
  try {
    const prompt = `S\u0259n Kassa360 ma\u011Faza sat\u0131c\u0131 k\xF6m\u0259k\xE7isi v\u0259 a\u011F\u0131ll\u0131 assistentis\u0259n (Az\u0259rbaycan dilind\u0259).
Sat\u0131c\u0131 soru\u015Fur: "${params.message}"

N\u0259zar\u0259t olunan ma\u011Faza m\u0259lumatlar\u0131:
- Aktiv m\u0259hsul say\u0131: ${params.storeContext.productsCount}
- Bug\xFCnk\xFC sat\u0131\u015F: ${params.storeContext.todaySalesTotal} AZN (${params.storeContext.todaySalesCount} \xE7ek)
- Uy\u011Fun g\u0259l\u0259n m\u0259hsullar bazas\u0131:
${JSON.stringify(matches, null, 2)}

T\u018FL\u018FBL\u018FR:
1. Sat\u0131c\u0131ya n\u0259zak\u0259tli, operativ, lakonik v\u0259 pe\u015F\u0259kar cavab ver.
2. Qiym\u0259t, stok qal\u0131\u011F\u0131 v\u0259 ya \xF6l\xE7\xFC soru\u015Fulubsa, d\u0259qiq m\u0259lumatlar\u0131 qeyd et.
3. \u018Fsla saxta m\u0259hsul v\u0259 ya inventar uydurma. Yaln\u0131z verilmi\u015F bazadak\u0131 m\u0259hsullar\u0131 g\xF6st\u0259r.
4. Az\u0259rbaycan dilind\u0259 t\u0259bii dan\u0131\u015F.`;
    const response = await ai.models.generateContent({
      model: "gemini-3.8-flash",
      contents: prompt
    });
    return {
      reply: response.text?.trim() || "Sor\u011Funuz q\u0259bul edildi.",
      matchedProducts: matches,
      suggestedActions: matches.slice(0, 3).map((m) => ({
        label: `${m.name} (${m.salePrice} AZN) - S\u0259b\u0259t\u0259 at`,
        action: "ADD_TO_CART",
        payload: m
      }))
    };
  } catch (err) {
    console.error("Error in seller assistant:", err);
    return {
      reply: matches.length > 0 ? `Tap\u0131lan m\u0259hsullar:
${matches.map((m) => `\u2022 ${m.name}: ${m.salePrice} AZN (Stok: ${m.stockQuantity})`).join("\n")}` : "Sor\u011Funuzu d\u0259qiql\u0259\u015Fdirin v\u0259 ya barkodla axtar\u0131n.",
      matchedProducts: matches
    };
  }
}

// server.ts
async function startServer() {
  const app = (0, import_express10.default)();
  const PORT = 3e3;
  const server = import_http.default.createServer(app);
  app.use(import_express10.default.json({ limit: "20mb" }));
  app.use(import_express10.default.urlencoded({ extended: true, limit: "20mb" }));
  try {
    await db.init();
    await seedInitialData();
  } catch (dbErr) {
    console.error("\u274C [Database] Failed to initialize database:", dbErr);
  }
  realtimeHub.init(server);
  app.get("/api/health", (_req, res) => {
    res.json({
      status: "ok",
      hasApiKey: Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim().length > 0),
      isPostgres: db.isUsingPostgres(),
      activeWsClients: realtimeHub.getActiveClientCount()
    });
  });
  app.use("/api/auth", authRoutes_default);
  app.use("/api/products", productRoutes_default);
  app.use("/api/sales", salesRoutes_default);
  app.use("/api/inventory", inventoryRoutes_default);
  app.use("/api/purchases", purchasesRoutes_default);
  app.use("/api/finance", financeRoutes_default);
  app.use("/api/settings", settingsRoutes_default);
  app.use("/api/sync", syncRoutes_default);
  app.use("/api/reports", reportsRoutes_default);
  app.post("/api/ai/product-image", async (req, res) => {
    try {
      const { name, category, color, brand, notes } = req.body;
      if (!name || typeof name !== "string") {
        res.status(400).json({ error: "M\u0259hsul ad\u0131 t\u0259l\u0259b olunur." });
        return;
      }
      const result = await generateProductImage({ name, category, color, brand, notes });
      res.json(result);
    } catch (err) {
      console.error("Error in /api/ai/product-image:", err);
      res.status(500).json({ error: err?.message || "\u015E\u0259kil yarad\u0131lark\u0259n x\u0259ta ba\u015F verdi." });
    }
  });
  app.post("/api/ai/product-description", async (req, res) => {
    try {
      const { name, category, color, brand, sizes, salePrice, existingNotes } = req.body;
      if (!name || typeof name !== "string") {
        res.status(400).json({ error: "M\u0259hsul ad\u0131 t\u0259l\u0259b olunur." });
        return;
      }
      const description = await generateProductDescription({
        name,
        category,
        color,
        brand,
        sizes,
        salePrice,
        existingNotes
      });
      res.json({ description });
    } catch (err) {
      console.error("Error in /api/ai/product-description:", err);
      res.status(500).json({ error: err?.message || "T\u0259svir yarad\u0131lark\u0259n x\u0259ta ba\u015F verdi." });
    }
  });
  app.post("/api/ai/product-category", async (req, res) => {
    try {
      const { productName, existingCategories, brand, color } = req.body;
      if (!productName || typeof productName !== "string") {
        res.status(400).json({ error: "M\u0259hsul ad\u0131 t\u0259l\u0259b olunur." });
        return;
      }
      const result = await suggestProductCategory({
        productName,
        existingCategories: Array.isArray(existingCategories) ? existingCategories : [],
        brand,
        color
      });
      res.json(result);
    } catch (err) {
      console.error("Error in /api/ai/product-category:", err);
      res.status(500).json({ error: err?.message || "Kateqoriya m\xFC\u0259yy\u0259n edil\u0259rk\u0259n x\u0259ta ba\u015F verdi." });
    }
  });
  app.post("/api/ai/natural-search", async (req, res) => {
    try {
      const { query, existingCategories } = req.body;
      if (!query || typeof query !== "string") {
        res.status(400).json({ error: "Axtar\u0131\u015F m\u0259tni t\u0259l\u0259b olunur." });
        return;
      }
      const structuredFilter = await parseNaturalLanguageSearch(
        query,
        Array.isArray(existingCategories) ? existingCategories : []
      );
      res.json({ structuredFilter });
    } catch (err) {
      console.error("Error in /api/ai/natural-search:", err);
      res.status(500).json({ error: err?.message || "Axtar\u0131\u015F t\u0259hlili zaman\u0131 x\u0259ta ba\u015F verdi." });
    }
  });
  app.post("/api/ai/sales-analysis", async (req, res) => {
    try {
      const { question, salesData } = req.body;
      if (!question || !salesData) {
        res.status(400).json({ error: "Sual v\u0259 sat\u0131\u015F m\u0259lumatlar\u0131 t\u0259l\u0259b olunur." });
        return;
      }
      const answer = await analyzeSalesData({ question, salesData });
      res.json({ answer });
    } catch (err) {
      console.error("Error in /api/ai/sales-analysis:", err);
      res.status(500).json({ error: err?.message || "Sat\u0131\u015F analizi zaman\u0131 x\u0259ta ba\u015F verdi." });
    }
  });
  app.post("/api/ai/pricing-analysis", async (req, res) => {
    try {
      const { products } = req.body;
      if (!products || !Array.isArray(products)) {
        res.status(400).json({ error: "M\u0259hsul siyah\u0131s\u0131 t\u0259l\u0259b olunur." });
        return;
      }
      const result = await analyzePricingData({ products });
      res.json(result);
    } catch (err) {
      console.error("Error in /api/ai/pricing-analysis:", err);
      res.status(500).json({ error: err?.message || "Qiym\u0259t analizi zaman\u0131 x\u0259ta ba\u015F verdi." });
    }
  });
  app.post("/api/ai/size-analysis", async (req, res) => {
    try {
      const { sizeStats } = req.body;
      if (!sizeStats || !Array.isArray(sizeStats)) {
        res.status(400).json({ error: "\xD6l\xE7\xFC statistikalar\u0131 t\u0259l\u0259b olunur." });
        return;
      }
      const result = await analyzeSizeData({ sizeStats });
      res.json(result);
    } catch (err) {
      console.error("Error in /api/ai/size-analysis:", err);
      res.status(500).json({ error: err?.message || "\xD6l\xE7\xFC analizi zaman\u0131 x\u0259ta ba\u015F verdi." });
    }
  });
  app.post("/api/ai/seller-assistant", async (req, res) => {
    try {
      const { message, storeContext } = req.body;
      if (!message || typeof message !== "string") {
        res.status(400).json({ error: "Mesaj t\u0259l\u0259b olunur." });
        return;
      }
      const result = await handleSellerAssistant({
        message,
        storeContext: storeContext || {
          productsCount: 0,
          todaySalesTotal: 0,
          todaySalesCount: 0,
          topProductsSummary: [],
          sampleProducts: []
        }
      });
      res.json(result);
    } catch (err) {
      console.error("Error in /api/ai/seller-assistant:", err);
      res.status(500).json({ error: err?.message || "Sat\u0131c\u0131 k\xF6m\u0259k\xE7isi x\u0259tas\u0131." });
    }
  });
  if (process.env.NODE_ENV !== "production") {
    const vite = await (0, import_vite.createServer)({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = import_path2.default.join(process.cwd(), "dist");
    app.use(import_express10.default.static(distPath));
    app.get("*all", (_req, res) => {
      res.sendFile(import_path2.default.join(distPath, "index.html"));
    });
  }
  server.listen(PORT, "0.0.0.0", () => {
    console.log(`\u{1F680} Kassa360 Server with WebSocket running on http://0.0.0.0:${PORT}`);
  });
}
startServer();
//# sourceMappingURL=server.cjs.map
