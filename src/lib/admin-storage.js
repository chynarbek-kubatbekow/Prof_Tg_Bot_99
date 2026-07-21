import fs from "fs";
import path from "path";
import { DatabaseSync } from "node:sqlite";
import pg from "pg";
import { config } from "../const/config.js";

const { Pool } = pg;

export const APPLICATION_STATUSES = {
  new: "Новая",
  work: "В работе",
  contacted: "Связались",
  no_answer: "Не дозвонились",
  done: "Завершена",
};

export const INFO_SECTIONS = [
  { key: "about_lyceum", title: "🏫 О лицее" },
  { key: "admission", title: "🎓 Поступление" },
  { key: "documents", title: "📄 Документы" },
  { key: "education", title: "📚 Направления обучения" },
  { key: "dates", title: "📆 Сроки" },
  { key: "tuition", title: "💰 Условия обучения" },
  { key: "contacts", title: "📞 Контакты" },
];

export const CONTACT_FIELDS = [
  { key: "phone", title: "Телефон", defaultValue: config.adminNumber },
  { key: "whatsapp", title: "WhatsApp", defaultValue: "" },
  { key: "telegram", title: "Telegram", defaultValue: "" },
  { key: "address", title: "Адрес", defaultValue: "" },
  { key: "email", title: "Email", defaultValue: "" },
  { key: "work_hours", title: "График работы", defaultValue: "" },
  { key: "socials", title: "Социальные сети", defaultValue: "" },
];

export const SETTING_FIELDS = [
  {
    key: "welcome_message",
    title: "Приветственное сообщение",
    defaultValue: "Добро пожаловать\n\nЯ - оператор-помощник лицея\n/start - начать работу",
  },
  {
    key: "application_success_text",
    title: "Текст после заявки",
    defaultValue: "Заявка успешно принята и сохранена!",
  },
  {
    key: "error_message",
    title: "Сообщение ошибки",
    defaultValue: "Ошибка сохранения. Попробуйте ещё раз.",
  },
  { key: "button_ai_helper", title: "Кнопка вопроса", defaultValue: "Задать вопрос" },
  { key: "button_admin_contact", title: "Кнопка администрации", defaultValue: "Администрация" },
  { key: "button_faq", title: "Кнопка FAQ", defaultValue: "Частые вопросы" },
  { key: "button_register", title: "Кнопка заявки", defaultValue: "Записаться/Оставить заявку" },
];

function now() {
  return new Date().toISOString();
}

function adminName(admin) {
  if (!admin) {
    return "Неизвестно";
  }

  const parts = [admin.first_name, admin.last_name].filter(Boolean);
  return parts.join(" ") || admin.username || String(admin.id || "Неизвестно");
}

function normalizeStatus(status) {
  if (APPLICATION_STATUSES[status]) {
    return status;
  }

  const entry = Object.entries(APPLICATION_STATUSES).find(([, title]) => title === status);
  return entry?.[0] || "new";
}

function mapApplication(row) {
  if (!row) {
    return null;
  }

  return {
    id: Number(row.id),
    fullName: row.full_name,
    phone: row.phone,
    direction: row.direction || "",
    comment: row.comment || "",
    username: row.username || "Не указан",
    telegramId: row.telegram_id || "",
    status: row.status,
    statusTitle: APPLICATION_STATUSES[row.status] || row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapDirection(row) {
  if (!row) {
    return null;
  }

  return {
    id: Number(row.id),
    title: row.title,
    studyPeriod: row.study_period,
    description: row.description,
    requirements: row.requirements || "",
    opportunities: row.opportunities || "",
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapFaq(row) {
  if (!row) {
    return null;
  }

  return {
    id: Number(row.id),
    question: row.question,
    answer: row.answer,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapChangeLog(row) {
  if (!row) {
    return null;
  }

  return {
    id: Number(row.id),
    adminId: row.admin_id || "",
    adminName: row.admin_name || "Неизвестно",
    action: row.action,
    entity: row.entity,
    entityId: row.entity_id || "",
    details: row.details || "",
    createdAt: row.created_at,
  };
}

function mapKnowledgeSource(row) {
  if (!row) {
    return null;
  }

  return {
    key: row.key,
    title: row.title,
    sourceType: row.source_type,
    content: row.content,
    updatedAt: row.updated_at,
  };
}

function parseJsonValue(value) {
  if (value === undefined || value === null) {
    return undefined;
  }

  return typeof value === "string" ? JSON.parse(value) : value;
}

function sortByKnownKeys(rows, knownFields) {
  const order = new Map(knownFields.map((field, index) => [field.key, index]));
  return [...rows].sort((a, b) => (order.get(a.key) ?? 999) - (order.get(b.key) ?? 999));
}

async function buildDynamicKnowledgeContext(storage) {
  const blocks = [];

  const sections = (await storage.getInfoSections()).filter((section) => section.content.trim());
  if (sections.length > 0) {
    blocks.push(
      [
        "## Информация, обновленная администратором",
        ...sections.map((section) => `### ${section.title}\n${section.content.trim()}`),
      ].join("\n\n"),
    );
  }

  const directions = await storage.listDirections({ onlyActive: true });
  if (directions.length > 0) {
    blocks.push(
      [
        "## Активные направления обучения",
        ...directions.map((direction) =>
          [
            `### ${direction.title}`,
            `Срок обучения: ${direction.studyPeriod}`,
            `Описание: ${direction.description}`,
            direction.requirements ? `Требования: ${direction.requirements}` : "",
            direction.opportunities ? `Возможности после обучения: ${direction.opportunities}` : "",
          ]
            .filter(Boolean)
            .join("\n"),
        ),
      ].join("\n\n"),
    );
  }

  const faqItems = await storage.listFaq();
  if (faqItems.length > 0) {
    blocks.push(
      [
        "## FAQ, добавленный администратором",
        ...faqItems.map((item) => `Вопрос: ${item.question}\nОтвет: ${item.answer}`),
      ].join("\n\n"),
    );
  }

  const contacts = (await storage.listContacts()).filter((field) => field.value.trim());
  if (contacts.length > 0) {
    blocks.push(
      [
        "## Контакты, обновленные администратором",
        ...contacts.map((field) => `${field.title}: ${field.value.trim()}`),
      ].join("\n"),
    );
  }

  return blocks.join("\n\n");
}

async function buildStoredKnowledgeContext(storage) {
  const sources = await storage.listKnowledgeSources();
  if (sources.length === 0) {
    return "";
  }

  return sources
    .map((source) => [`## ${source.title}`, source.content].join("\n"))
    .join("\n\n");
}

function createPostgresPool(databaseUrl) {
  const parsedUrl = new URL(databaseUrl);
  const sslMode = parsedUrl.searchParams.get("sslmode");
  const channelBinding = parsedUrl.searchParams.get("channel_binding");

  parsedUrl.searchParams.delete("sslmode");
  parsedUrl.searchParams.delete("channel_binding");

  return new Pool({
    connectionString: parsedUrl.toString(),
    max: Number(process.env.DATABASE_POOL_MAX || 5),
    ssl: sslMode ? { rejectUnauthorized: true } : undefined,
    enableChannelBinding: channelBinding === "require",
  });
}

function createPostgresStorage(databaseUrl) {
  const pool = createPostgresPool(databaseUrl);

  async function query(sql, params = []) {
    const result = await pool.query(sql, params);
    return result.rows;
  }

  async function get(sql, params = []) {
    const rows = await query(sql, params);
    return rows[0] || null;
  }

  async function run(sql, params = []) {
    await pool.query(sql, params);
  }

  const storage = {
    kind: "postgres",
    dbPath: null,
    databaseUrl,
    ready: init(),
    close: () => pool.end(),
    async readSession(key) {
      const row = await get("SELECT value FROM bot_sessions WHERE key = $1", [key]);
      return parseJsonValue(row?.value);
    },
    async writeSession(key, value) {
      await run(
        `INSERT INTO bot_sessions (key, value, updated_at)
         VALUES ($1, $2::jsonb, $3)
         ON CONFLICT (key)
         DO UPDATE SET value = EXCLUDED.value,
                       updated_at = EXCLUDED.updated_at`,
        [key, JSON.stringify(value), now()],
      );
    },
    async deleteSession(key) {
      await run("DELETE FROM bot_sessions WHERE key = $1", [key]);
    },
    async logChange(admin, action, entity, entityId = "", details = "") {
      await run(
        `INSERT INTO change_logs (admin_id, admin_name, action, entity, entity_id, details, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          admin?.id ? String(admin.id) : "",
          adminName(admin),
          action,
          entity,
          entityId ? String(entityId) : "",
          details,
          now(),
        ],
      );
    },
    async createApplication(data) {
      const createdAt = now();
      const row = await get(
        `INSERT INTO applications
          (full_name, phone, direction, comment, username, telegram_id, status, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, 'new', $7, $8)
         RETURNING *`,
        [
          data.fullName,
          data.phone,
          data.direction || "",
          data.comment || "",
          data.username || "Не указан",
          data.telegramId || "",
          createdAt,
          createdAt,
        ],
      );
      return mapApplication(row);
    },
    async getApplication(id) {
      return mapApplication(await get("SELECT * FROM applications WHERE id = $1", [id]));
    },
    async listApplications(status = null, limit = 20, offset = 0) {
      const rows = status
        ? await query(
            "SELECT * FROM applications WHERE status = $1 ORDER BY id DESC LIMIT $2 OFFSET $3",
            [normalizeStatus(status), limit, offset],
          )
        : await query("SELECT * FROM applications ORDER BY id DESC LIMIT $1 OFFSET $2", [
            limit,
            offset,
          ]);
      return rows.map(mapApplication);
    },
    async countApplications(status = null) {
      const row = status
        ? await get("SELECT COUNT(*) AS count FROM applications WHERE status = $1", [
            normalizeStatus(status),
          ])
        : await get("SELECT COUNT(*) AS count FROM applications");
      return Number(row?.count || 0);
    },
    async updateApplicationStatus(id, status, admin) {
      const current = await storage.getApplication(id);
      if (!current) {
        return null;
      }

      const normalizedStatus = normalizeStatus(status);
      const row = await get(
        "UPDATE applications SET status = $1, updated_at = $2 WHERE id = $3 RETURNING *",
        [normalizedStatus, now(), id],
      );
      await storage.logChange(
        admin,
        "Изменил статус заявки",
        "applications",
        id,
        APPLICATION_STATUSES[normalizedStatus],
      );
      return mapApplication(row);
    },
    async listChangeLogs(limit = 20, offset = 0) {
      return (await query("SELECT * FROM change_logs ORDER BY id DESC LIMIT $1 OFFSET $2", [
        limit,
        offset,
      ])).map(mapChangeLog);
    },
    async upsertKnowledgeSource({ key, title, sourceType, content }) {
      const row = await get(
        `INSERT INTO knowledge_sources (key, title, source_type, content, updated_at)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (key)
         DO UPDATE SET title = EXCLUDED.title,
                       source_type = EXCLUDED.source_type,
                       content = EXCLUDED.content,
                       updated_at = EXCLUDED.updated_at
         RETURNING *`,
        [key, title, sourceType, content, now()],
      );
      return mapKnowledgeSource(row);
    },
    async listKnowledgeSources() {
      return (await query("SELECT * FROM knowledge_sources ORDER BY updated_at DESC")).map(
        mapKnowledgeSource,
      );
    },
    async getStoredKnowledgeContext() {
      return buildStoredKnowledgeContext(storage);
    },
    async getInfoSections() {
      return sortByKnownKeys(await query("SELECT * FROM info_sections"), INFO_SECTIONS);
    },
    async getInfoSection(key) {
      return get("SELECT * FROM info_sections WHERE key = $1", [key]);
    },
    async updateInfoSection(key, content, admin) {
      const row = await get(
        `UPDATE info_sections
         SET content = $1, updated_at = $2, updated_by = $3
         WHERE key = $4
         RETURNING *`,
        [content, now(), adminName(admin), key],
      );
      await storage.logChange(admin, "Изменил раздел информации", "info_sections", key);
      return row;
    },
    async listDirections(options = {}) {
      const rows = options.onlyActive
        ? await query("SELECT * FROM directions WHERE status = 'active' ORDER BY id DESC")
        : await query("SELECT * FROM directions ORDER BY id DESC");
      return rows.map(mapDirection);
    },
    async getDirection(id) {
      return mapDirection(await get("SELECT * FROM directions WHERE id = $1", [id]));
    },
    async createDirection(data, admin) {
      const createdAt = now();
      const row = await get(
        `INSERT INTO directions
          (title, study_period, description, requirements, opportunities, status, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING *`,
        [
          data.title,
          data.studyPeriod,
          data.description,
          data.requirements || "",
          data.opportunities || "",
          data.status || "active",
          createdAt,
          createdAt,
        ],
      );
      await storage.logChange(admin, "Добавил направление", "directions", row.id, data.title);
      return mapDirection(row);
    },
    async updateDirection(id, patch, admin) {
      const current = await storage.getDirection(id);
      if (!current) {
        return null;
      }

      const nextDirection = {
        ...current,
        ...patch,
        status: patch.status || current.status,
      };
      const row = await get(
        `UPDATE directions
         SET title = $1, study_period = $2, description = $3, requirements = $4,
             opportunities = $5, status = $6, updated_at = $7
         WHERE id = $8
         RETURNING *`,
        [
          nextDirection.title,
          nextDirection.studyPeriod,
          nextDirection.description,
          nextDirection.requirements || "",
          nextDirection.opportunities || "",
          nextDirection.status,
          now(),
          id,
        ],
      );
      await storage.logChange(admin, "Изменил направление", "directions", id, nextDirection.title);
      return mapDirection(row);
    },
    async deleteDirection(id, admin) {
      const current = await storage.getDirection(id);
      if (!current) {
        return false;
      }

      await run("DELETE FROM directions WHERE id = $1", [id]);
      await storage.logChange(admin, "Удалил направление", "directions", id, current.title);
      return true;
    },
    async listFaq() {
      return (await query("SELECT * FROM faq ORDER BY id DESC")).map(mapFaq);
    },
    async getFaq(id) {
      return mapFaq(await get("SELECT * FROM faq WHERE id = $1", [id]));
    },
    async createFaq(question, answer, admin) {
      const createdAt = now();
      const row = await get(
        `INSERT INTO faq (question, answer, created_at, updated_at)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [question, answer, createdAt, createdAt],
      );
      await storage.logChange(admin, "Добавил FAQ", "faq", row.id, question);
      return mapFaq(row);
    },
    async updateFaqAnswer(id, answer, admin) {
      const current = await storage.getFaq(id);
      if (!current) {
        return null;
      }

      const row = await get("UPDATE faq SET answer = $1, updated_at = $2 WHERE id = $3 RETURNING *", [
        answer,
        now(),
        id,
      ]);
      await storage.logChange(admin, "Изменил ответ FAQ", "faq", id, current.question);
      return mapFaq(row);
    },
    async deleteFaq(id, admin) {
      const current = await storage.getFaq(id);
      if (!current) {
        return false;
      }

      await run("DELETE FROM faq WHERE id = $1", [id]);
      await storage.logChange(admin, "Удалил FAQ", "faq", id, current.question);
      return true;
    },
    async listContacts() {
      return sortByKnownKeys(await query("SELECT * FROM contacts"), CONTACT_FIELDS);
    },
    async getContact(key) {
      return get("SELECT * FROM contacts WHERE key = $1", [key]);
    },
    async updateContact(key, value, admin) {
      const row = await get(
        `UPDATE contacts
         SET value = $1, updated_at = $2, updated_by = $3
         WHERE key = $4
         RETURNING *`,
        [value, now(), adminName(admin), key],
      );
      await storage.logChange(admin, "Изменил контакт", "contacts", key);
      return row;
    },
    async listSettings() {
      return sortByKnownKeys(await query("SELECT * FROM settings"), SETTING_FIELDS);
    },
    async getSetting(key) {
      return get("SELECT * FROM settings WHERE key = $1", [key]);
    },
    async getSettingValue(key, fallback = "") {
      return (await storage.getSetting(key))?.value || fallback;
    },
    async updateSetting(key, value, admin) {
      const row = await get(
        `UPDATE settings
         SET value = $1, updated_at = $2, updated_by = $3
         WHERE key = $4
         RETURNING *`,
        [value, now(), adminName(admin), key],
      );
      await storage.logChange(admin, "Изменил настройку", "settings", key);
      return row;
    },
    async getButtonLabels() {
      return {
        aiHelper: await storage.getSettingValue("button_ai_helper", "Задать вопрос"),
        adminContact: await storage.getSettingValue("button_admin_contact", "Администрация"),
        faq: await storage.getSettingValue("button_faq", "Частые вопросы"),
        register: await storage.getSettingValue("button_register", "Записаться/Оставить заявку"),
      };
    },
    async getDynamicKnowledgeContext() {
      return buildDynamicKnowledgeContext(storage);
    },
  };

  async function init() {
    await run(`
      CREATE TABLE IF NOT EXISTS applications (
        id SERIAL PRIMARY KEY,
        full_name TEXT NOT NULL,
        phone TEXT NOT NULL,
        direction TEXT DEFAULT '',
        comment TEXT DEFAULT '',
        username TEXT,
        telegram_id TEXT,
        status TEXT NOT NULL DEFAULT 'new',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS info_sections (
        key TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        content TEXT NOT NULL DEFAULT '',
        updated_at TEXT,
        updated_by TEXT
      );

      CREATE TABLE IF NOT EXISTS directions (
        id SERIAL PRIMARY KEY,
        title TEXT NOT NULL,
        study_period TEXT NOT NULL,
        description TEXT NOT NULL,
        requirements TEXT DEFAULT '',
        opportunities TEXT DEFAULT '',
        status TEXT NOT NULL DEFAULT 'active',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS faq (
        id SERIAL PRIMARY KEY,
        question TEXT NOT NULL,
        answer TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS contacts (
        key TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        value TEXT NOT NULL DEFAULT '',
        updated_at TEXT,
        updated_by TEXT
      );

      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        value TEXT NOT NULL DEFAULT '',
        updated_at TEXT,
        updated_by TEXT
      );

      CREATE TABLE IF NOT EXISTS change_logs (
        id SERIAL PRIMARY KEY,
        admin_id TEXT,
        admin_name TEXT,
        action TEXT NOT NULL,
        entity TEXT NOT NULL,
        entity_id TEXT,
        details TEXT,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS knowledge_sources (
        key TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        source_type TEXT NOT NULL,
        content TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS bot_sessions (
        key TEXT PRIMARY KEY,
        value JSONB NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);

    for (const section of INFO_SECTIONS) {
      await run(
        "INSERT INTO info_sections (key, title, content) VALUES ($1, $2, '') ON CONFLICT (key) DO NOTHING",
        [section.key, section.title],
      );
    }

    for (const field of CONTACT_FIELDS) {
      await run(
        "INSERT INTO contacts (key, title, value) VALUES ($1, $2, $3) ON CONFLICT (key) DO NOTHING",
        [field.key, field.title, field.defaultValue],
      );
    }

    for (const field of SETTING_FIELDS) {
      await run(
        "INSERT INTO settings (key, title, value) VALUES ($1, $2, $3) ON CONFLICT (key) DO NOTHING",
        [field.key, field.title, field.defaultValue],
      );
    }
  }

  return storage;
}

function createSqliteStorage(dbPath = config.databasePath) {
  if (dbPath !== ":memory:") {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  }

  const db = new DatabaseSync(dbPath);

  const storage = {
    kind: "sqlite",
    dbPath,
    ready: Promise.resolve().then(init),
    close: async () => db.close(),
    async readSession(key) {
      const row = db.prepare("SELECT value FROM bot_sessions WHERE key = ?").get(key);
      return parseJsonValue(row?.value);
    },
    async writeSession(key, value) {
      db.prepare(
        `INSERT INTO bot_sessions (key, value, updated_at)
         VALUES (?, ?, ?)
         ON CONFLICT(key)
         DO UPDATE SET value = excluded.value,
                       updated_at = excluded.updated_at`,
      ).run(key, JSON.stringify(value), now());
    },
    async deleteSession(key) {
      db.prepare("DELETE FROM bot_sessions WHERE key = ?").run(key);
    },
    async logChange(admin, action, entity, entityId = "", details = "") {
      db.prepare(
        `INSERT INTO change_logs (admin_id, admin_name, action, entity, entity_id, details, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        admin?.id ? String(admin.id) : "",
        adminName(admin),
        action,
        entity,
        entityId ? String(entityId) : "",
        details,
        now(),
      );
    },
    async createApplication(data) {
      const createdAt = now();
      const result = db.prepare(
        `INSERT INTO applications
          (full_name, phone, direction, comment, username, telegram_id, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, 'new', ?, ?)`,
      ).run(
        data.fullName,
        data.phone,
        data.direction || "",
        data.comment || "",
        data.username || "Не указан",
        data.telegramId || "",
        createdAt,
        createdAt,
      );
      return storage.getApplication(result.lastInsertRowid);
    },
    async getApplication(id) {
      return mapApplication(db.prepare("SELECT * FROM applications WHERE id = ?").get(id));
    },
    async listApplications(status = null, limit = 20, offset = 0) {
      if (status) {
        return db
          .prepare("SELECT * FROM applications WHERE status = ? ORDER BY id DESC LIMIT ? OFFSET ?")
          .all(normalizeStatus(status), limit, offset)
          .map(mapApplication);
      }

      return db
        .prepare("SELECT * FROM applications ORDER BY id DESC LIMIT ? OFFSET ?")
        .all(limit, offset)
        .map(mapApplication);
    },
    async countApplications(status = null) {
      if (status) {
        return Number(
          db
            .prepare("SELECT COUNT(*) AS count FROM applications WHERE status = ?")
            .get(normalizeStatus(status)).count,
        );
      }

      return Number(db.prepare("SELECT COUNT(*) AS count FROM applications").get().count);
    },
    async updateApplicationStatus(id, status, admin) {
      const current = await storage.getApplication(id);
      if (!current) {
        return null;
      }

      const normalizedStatus = normalizeStatus(status);
      db.prepare("UPDATE applications SET status = ?, updated_at = ? WHERE id = ?").run(
        normalizedStatus,
        now(),
        id,
      );
      await storage.logChange(
        admin,
        "Изменил статус заявки",
        "applications",
        id,
        APPLICATION_STATUSES[normalizedStatus],
      );
      return storage.getApplication(id);
    },
    async listChangeLogs(limit = 20, offset = 0) {
      return db
        .prepare("SELECT * FROM change_logs ORDER BY id DESC LIMIT ? OFFSET ?")
        .all(limit, offset)
        .map(mapChangeLog);
    },
    async upsertKnowledgeSource({ key, title, sourceType, content }) {
      const updatedAt = now();
      db.prepare(
        `INSERT INTO knowledge_sources (key, title, source_type, content, updated_at)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(key)
         DO UPDATE SET title = excluded.title,
                       source_type = excluded.source_type,
                       content = excluded.content,
                       updated_at = excluded.updated_at`,
      ).run(key, title, sourceType, content, updatedAt);
      return mapKnowledgeSource(
        db.prepare("SELECT * FROM knowledge_sources WHERE key = ?").get(key),
      );
    },
    async listKnowledgeSources() {
      return db
        .prepare("SELECT * FROM knowledge_sources ORDER BY updated_at DESC")
        .all()
        .map(mapKnowledgeSource);
    },
    async getStoredKnowledgeContext() {
      return buildStoredKnowledgeContext(storage);
    },
    async getInfoSections() {
      return db.prepare("SELECT * FROM info_sections ORDER BY rowid").all();
    },
    async getInfoSection(key) {
      return db.prepare("SELECT * FROM info_sections WHERE key = ?").get(key);
    },
    async updateInfoSection(key, content, admin) {
      db.prepare(
        "UPDATE info_sections SET content = ?, updated_at = ?, updated_by = ? WHERE key = ?",
      ).run(content, now(), adminName(admin), key);
      await storage.logChange(admin, "Изменил раздел информации", "info_sections", key);
      return storage.getInfoSection(key);
    },
    async listDirections(options = {}) {
      const rows = options.onlyActive
        ? db.prepare("SELECT * FROM directions WHERE status = 'active' ORDER BY id DESC").all()
        : db.prepare("SELECT * FROM directions ORDER BY id DESC").all();
      return rows.map(mapDirection);
    },
    async getDirection(id) {
      return mapDirection(db.prepare("SELECT * FROM directions WHERE id = ?").get(id));
    },
    async createDirection(data, admin) {
      const createdAt = now();
      const result = db.prepare(
        `INSERT INTO directions
          (title, study_period, description, requirements, opportunities, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        data.title,
        data.studyPeriod,
        data.description,
        data.requirements || "",
        data.opportunities || "",
        data.status || "active",
        createdAt,
        createdAt,
      );
      await storage.logChange(admin, "Добавил направление", "directions", result.lastInsertRowid, data.title);
      return storage.getDirection(result.lastInsertRowid);
    },
    async updateDirection(id, patch, admin) {
      const current = await storage.getDirection(id);
      if (!current) {
        return null;
      }

      const nextDirection = {
        ...current,
        ...patch,
        status: patch.status || current.status,
      };
      db.prepare(
        `UPDATE directions
         SET title = ?, study_period = ?, description = ?, requirements = ?, opportunities = ?, status = ?, updated_at = ?
         WHERE id = ?`,
      ).run(
        nextDirection.title,
        nextDirection.studyPeriod,
        nextDirection.description,
        nextDirection.requirements || "",
        nextDirection.opportunities || "",
        nextDirection.status,
        now(),
        id,
      );
      await storage.logChange(admin, "Изменил направление", "directions", id, nextDirection.title);
      return storage.getDirection(id);
    },
    async deleteDirection(id, admin) {
      const current = await storage.getDirection(id);
      if (!current) {
        return false;
      }

      db.prepare("DELETE FROM directions WHERE id = ?").run(id);
      await storage.logChange(admin, "Удалил направление", "directions", id, current.title);
      return true;
    },
    async listFaq() {
      return db.prepare("SELECT * FROM faq ORDER BY id DESC").all().map(mapFaq);
    },
    async getFaq(id) {
      return mapFaq(db.prepare("SELECT * FROM faq WHERE id = ?").get(id));
    },
    async createFaq(question, answer, admin) {
      const createdAt = now();
      const result = db
        .prepare("INSERT INTO faq (question, answer, created_at, updated_at) VALUES (?, ?, ?, ?)")
        .run(question, answer, createdAt, createdAt);
      await storage.logChange(admin, "Добавил FAQ", "faq", result.lastInsertRowid, question);
      return storage.getFaq(result.lastInsertRowid);
    },
    async updateFaqAnswer(id, answer, admin) {
      const current = await storage.getFaq(id);
      if (!current) {
        return null;
      }

      db.prepare("UPDATE faq SET answer = ?, updated_at = ? WHERE id = ?").run(answer, now(), id);
      await storage.logChange(admin, "Изменил ответ FAQ", "faq", id, current.question);
      return storage.getFaq(id);
    },
    async deleteFaq(id, admin) {
      const current = await storage.getFaq(id);
      if (!current) {
        return false;
      }

      db.prepare("DELETE FROM faq WHERE id = ?").run(id);
      await storage.logChange(admin, "Удалил FAQ", "faq", id, current.question);
      return true;
    },
    async listContacts() {
      return db.prepare("SELECT * FROM contacts ORDER BY rowid").all();
    },
    async getContact(key) {
      return db.prepare("SELECT * FROM contacts WHERE key = ?").get(key);
    },
    async updateContact(key, value, admin) {
      db.prepare("UPDATE contacts SET value = ?, updated_at = ?, updated_by = ? WHERE key = ?").run(
        value,
        now(),
        adminName(admin),
        key,
      );
      await storage.logChange(admin, "Изменил контакт", "contacts", key);
      return storage.getContact(key);
    },
    async listSettings() {
      return db.prepare("SELECT * FROM settings ORDER BY rowid").all();
    },
    async getSetting(key) {
      return db.prepare("SELECT * FROM settings WHERE key = ?").get(key);
    },
    async getSettingValue(key, fallback = "") {
      return (await storage.getSetting(key))?.value || fallback;
    },
    async updateSetting(key, value, admin) {
      db.prepare("UPDATE settings SET value = ?, updated_at = ?, updated_by = ? WHERE key = ?").run(
        value,
        now(),
        adminName(admin),
        key,
      );
      await storage.logChange(admin, "Изменил настройку", "settings", key);
      return storage.getSetting(key);
    },
    async getButtonLabels() {
      return {
        aiHelper: await storage.getSettingValue("button_ai_helper", "Задать вопрос"),
        adminContact: await storage.getSettingValue("button_admin_contact", "Администрация"),
        faq: await storage.getSettingValue("button_faq", "Частые вопросы"),
        register: await storage.getSettingValue("button_register", "Записаться/Оставить заявку"),
      };
    },
    async getDynamicKnowledgeContext() {
      return buildDynamicKnowledgeContext(storage);
    },
  };

  function init() {
    db.exec(`
      PRAGMA journal_mode = WAL;
      PRAGMA foreign_keys = ON;

      CREATE TABLE IF NOT EXISTS applications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        full_name TEXT NOT NULL,
        phone TEXT NOT NULL,
        direction TEXT DEFAULT '',
        comment TEXT DEFAULT '',
        username TEXT,
        telegram_id TEXT,
        status TEXT NOT NULL DEFAULT 'new',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS info_sections (
        key TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        content TEXT NOT NULL DEFAULT '',
        updated_at TEXT,
        updated_by TEXT
      );

      CREATE TABLE IF NOT EXISTS directions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        study_period TEXT NOT NULL,
        description TEXT NOT NULL,
        requirements TEXT DEFAULT '',
        opportunities TEXT DEFAULT '',
        status TEXT NOT NULL DEFAULT 'active',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS faq (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        question TEXT NOT NULL,
        answer TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS contacts (
        key TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        value TEXT NOT NULL DEFAULT '',
        updated_at TEXT,
        updated_by TEXT
      );

      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        value TEXT NOT NULL DEFAULT '',
        updated_at TEXT,
        updated_by TEXT
      );

      CREATE TABLE IF NOT EXISTS change_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        admin_id TEXT,
        admin_name TEXT,
        action TEXT NOT NULL,
        entity TEXT NOT NULL,
        entity_id TEXT,
        details TEXT,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS knowledge_sources (
        key TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        source_type TEXT NOT NULL,
        content TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS bot_sessions (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);

    const insertInfo = db.prepare(
      "INSERT OR IGNORE INTO info_sections (key, title, content) VALUES (?, ?, '')",
    );
    for (const section of INFO_SECTIONS) {
      insertInfo.run(section.key, section.title);
    }

    const insertContact = db.prepare(
      "INSERT OR IGNORE INTO contacts (key, title, value) VALUES (?, ?, ?)",
    );
    for (const field of CONTACT_FIELDS) {
      insertContact.run(field.key, field.title, field.defaultValue);
    }

    const insertSetting = db.prepare(
      "INSERT OR IGNORE INTO settings (key, title, value) VALUES (?, ?, ?)",
    );
    for (const field of SETTING_FIELDS) {
      insertSetting.run(field.key, field.title, field.defaultValue);
    }
  }

  return storage;
}

export function createAdminStorage(options = {}) {
  const explicitDbPath = typeof options === "string" ? options : options.dbPath;
  const databaseUrl =
    typeof options === "object" && options.databaseUrl !== undefined
      ? options.databaseUrl
      : config.databaseUrl;

  if (databaseUrl && !explicitDbPath) {
    return createPostgresStorage(databaseUrl);
  }

  return createSqliteStorage(explicitDbPath || config.databasePath);
}
