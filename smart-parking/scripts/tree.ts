// index.ts
import sqlite3 from "sqlite3";
import { open } from "sqlite";

// Узел дерева
class Node {
  question?: string;
  trueBranch?: Node;
  falseBranch?: Node;
  result?: string;

  constructor(options: {
    question?: string;
    trueBranch?: Node;
    falseBranch?: Node;
    result?: string;
  }) {
    this.question = options.question;
    this.trueBranch = options.trueBranch;
    this.falseBranch = options.falseBranch;
    this.result = options.result;
  }

  async evaluate(data: any): Promise<string> {
    if (this.result) {
      return this.result;
    }

    if (!this.question) {
      throw new Error("No question or result at this node");
    }

    // динамический вызов функций по имени
    const func = (globalThis as any)[this.question];
    if (typeof func !== "function") {
      throw new Error(`Function ${this.question} not defined`);
    }

    const answer = await func(data);
    if (answer) {
      return this.trueBranch!.evaluate(data);
    } else {
      return this.falseBranch!.evaluate(data);
    }
  }
}

// БД
let db: sqlite3.Database | null = null;

async function initDB() {
  db = await open({
    filename: "Parking-2.db",
    driver: sqlite3.Database,
  });

  const tables = await db.all(
    "SELECT name FROM sqlite_master WHERE type='table';"
  );
  console.log("Таблицы:", tables);

  const tableName = "session";
  const columns = await db.all(`PRAGMA table_info(${tableName});`);
  const rows = await db.all(`SELECT * FROM ${tableName} LIMIT 20;`);

  console.log(`Таблица: ${tableName}`);
  console.log(columns.map((c: any) => c.name).join(" | "));
  console.log("-".repeat(40));
  rows.forEach((row: any) => {
    console.log(Object.values(row).join(" | "));
  });
}

// --- функции проверки --- //
async function isInDB(num: string): Promise<boolean> {
  if (!db) throw new Error("DB not initialized");
  const row = await db.get(
    "SELECT 1 FROM session WHERE licence_plate_entry = ?",
    [num]
  );
  return !!row;
}

async function isANPRCorrect(num: string): Promise<boolean> {
  if (!db) throw new Error("DB not initialized");
  const row = await db.get(
    "SELECT 1 FROM session WHERE licence_plate_entry = ?",
    [num]
  );
  if (row) {
    console.log("Проверка на правильно считанный номер.....успех");
    return true;
  } else {
    console.log("Проверка на правильно считанный номер.....неудача");
    return false;
  }
}

async function isPayed(num: string): Promise<boolean> {
  if (!db) throw new Error("DB not initialized");
  const row = await db.get(
    `
    SELECT status, amount_due_cents, amount_paid_cents
    FROM session
    WHERE licence_plate_entry = ?
    ORDER BY id DESC
    LIMIT 1
  `,
    [num]
  );
  if (!row) {
    console.log("проверка на оплату.....failed");
    return false;
  }
  const { status, amount_due_cents, amount_paid_cents } = row;
  if (status === "PAID" && amount_paid_cents >= amount_due_cents) {
    console.log("проверка на оплату.....успешно");
    return true;
  } else {
    console.log("проверка на оплату.....failed");
    return false;
  }
}

async function hasTicket(num: string): Promise<boolean> {
  const answer = prompt(`Есть ли тикет для номера ${num}? (y/n):`)?.toLowerCase();
  if (answer === "y" || answer === "yes") {
    console.log("проверка на тикет...успешно");
    return true;
  }
  console.log("проверка на тикет...неудача");
  return false;
}

async function inputPhone(num: string): Promise<boolean> {
  const phone = prompt(`Введите номер мобильного телефона для ${num} (9 цифр):`);
  if (phone && /^\d{9}$/.test(phone)) {
    return true;
  }
  console.log("Неверный номер. Номер должен состоять ровно из 9 цифр.");
  return false;
}

async function inputCarNum(): Promise<boolean> {
  const num = prompt("Введите номер машины:");
  console.log("ввод номера машины");
  if (num && /^\d+$/.test(num) && (await isANPRCorrect(num))) {
    return true;
  }
  console.log("Неверный номер. Повторите ввод.");
  return false;
}

// --- дерево --- //
const okNode = new Node({ result: "Открыть шлагбаум" });
const problemPayNodeSms = new Node({
  result: "Открыть шлагбум + смс с оплатой ",
});
const problemPayNodeTicket = new Node({
  result: "Открыть + оплатишь кодом с тикета",
});

const phoneNode = new Node({
  question: "inputPhone",
  trueBranch: problemPayNodeSms,
});

const ticketNode = new Node({
  question: "hasTicket",
  trueBranch: problemPayNodeTicket,
  falseBranch: phoneNode,
});

const paymentNode = new Node({
  question: "isPayed",
  trueBranch: okNode,
  falseBranch: ticketNode,
});

const paymentNodeHasntTicket = new Node({
  question: "isPayed",
  trueBranch: okNode,
  falseBranch: phoneNode,
});

const paymentNodeHasTicket = new Node({
  question: "isPayed",
  trueBranch: okNode,
  falseBranch: problemPayNodeTicket,
});

const scanTicketNode = new Node({
  question: "isANPRCorrect",
  trueBranch: paymentNode,
  falseBranch: phoneNode,
});

const carNumNode = new Node({
  question: "inputCarNum",
  trueBranch: paymentNodeHasntTicket,
});

const anprFalseTicketNode = new Node({
  question: "hasTicket",
  trueBranch: paymentNodeHasTicket,
  falseBranch: carNumNode,
});

const rootNode = new Node({
  question: "isANPRCorrect",
  trueBranch: paymentNode,
  falseBranch: anprFalseTicketNode,
});

// --- запуск --- //
(async () => {
  await initDB();
  const result = await rootNode.evaluate("ABC123");
  console.log("Результат:", result);
})();
