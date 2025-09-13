import sqlite3
#создание класса дерева
class Node:
    def __init__(self, question=None, true_branch=None, false_branch=None, result=None):
        self.question = question
        self.true_branch = true_branch
        self.false_branch = false_branch
        self.result = result

    def evaluate(self, data):
        if self.result is not None:
            return self.result

        func = globals()[self.question]
        answer = func(data)

        if answer:
            return self.true_branch.evaluate(data)
        else:
            return self.false_branch.evaluate(data)


conn = sqlite3.connect("Parking-2.db")
cursor = conn.cursor()

cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
print(cursor.fetchall())

table_name = "session"
limit = 20
cursor.execute(f"PRAGMA table_info({table_name});")
columns = [col[1] for col in cursor.fetchall()]
# получаем строки
cursor.execute(f"SELECT * FROM {table_name} LIMIT {limit};")
rows = cursor.fetchall()

# conn.close()

    # печатаем красиво
print(f"Таблица: {table_name}")
print(" | ".join(columns))
print("-" * 40)
for row in rows:
    print(" | ".join(str(x) for x in row))

def isInDB(num):
    cursor.execute("SELECT 1 FROM session WHERE licence_plate_entry = ?", (num,))
    return cursor.fetchone() is not None


# Проверка наличия номера в сессии
def isANPRCorrect(num):
    cursor.execute("SELECT 1 FROM session WHERE licence_plate_entry = ?", (num,))
    if cursor.fetchone() is not None:
      print("Проверка на правильно считанный номер.....успех")
      return True
    else:
      print("Проверка на правильно считанный номер.....неудача")
      return False

# Проверка оплаты
def isPayed(num):
    cursor.execute("""
        SELECT status, amount_due_cents, amount_paid_cents
        FROM session
        WHERE licence_plate_entry = ?
        ORDER BY id DESC
        LIMIT 1
    """, (num,))
    row = cursor.fetchone()
    if row is None:
        print("проверка на оплату.....failed")
        return False
    status, due, paid = row
    if status == "PAID" and paid >= due:
      print("проверка на оплату.....успешно")
      return True
    else:
      print("проверка на оплату.....failed")
      return False


# Проверка наличия тикета
def hasTicket(num):
    while True:

        answer = input(f"Есть ли тикет для номера {num}? (y/n): ").strip().lower()
        if answer in ("y", "yes"):
            print("проверка на тикет...успешно")
            return True
        elif answer in ("n", "no"):
            print("проверка на тикет...неудача")
            return False
        else:
            print("Введите 'y' для Да или 'n' для Нет.")


# Ввод номера телефона
def inputPhone(num):
    while True:
        print("ввод номера телефона")
        phone = input(f"Введите номер мобильного телефона для {num} (9 цифр): ").strip()

        if phone.isdigit() and len(phone) == 9:
            return True
        else:
            print("Неверный номер. Номер должен состоять ровно из 9 цифр.")

def inputCarNum():
    while True:
        num = input(f"Введите номер машины:").strip()
        print("ввод номера машины")
        if num.isdigit() and isANPRCorrect(num):
            return True
        else:
            print("Неверный номер. Повторите ввод.")

ok_node = Node(result="Открыть шлагбаум")
problem_pay_node_sms = Node(result="Открыть шлагбум + смс с оплатой ")
problem_pay_node_ticket = Node(result="Открыть + оплатишь кодом с тикета")

# функция, запускается раз в сутки проевряет если есть должники, если есть ч.с.

# ввод номера телефона
phone_node = Node(
    question="inputPhone",
    true_branch=problem_pay_node_sms
)

# проверка тикета после неоплаченной сессии
ticket_node = Node(
    question="hasTicket",
    true_branch=problem_pay_node_ticket,
    false_branch=phone_node
)

# оплата после ANPR верного
payment_node = Node(
    question="isPayed",
    true_branch=ok_node,
    false_branch=ticket_node
)
payment_node_hasnt_ticket = Node(
    question="isPayed",
    true_branch=ok_node,
    false_branch=phone_node
)
payment_node_has_ticket=Node(
    question = "isPayed",
    true_branch = ok_node,
    false_branch = problem_pay_node_ticket
)

scan_ticket_node = Node(
    question="isANPRCorrect",
    true_branch = payment_node,
    false_branch = phone_node

)
car_num_node = Node(
    question = "inputCarNum",
    true_branch = payment_node_hasnt_ticket
)
anpr_false_ticket_node = Node(
    question="hasTicket",
    true_branch=payment_node_has_ticket,
    false_branch=car_num_node
)

# корневой узел
root_node = Node(
    question="isANPRCorrect",
    true_branch=payment_node,
    false_branch=anpr_false_ticket_node
)



print(root_node.evaluate("ABC123"))
