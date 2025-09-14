import os
import requests
from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI(title="ai-module")


class RecommendInput(BaseModel):
    zoneId: int


@app.get("/")
def root():
    return {"name": "ai-module"}


@app.post("/recommend")
def recommend(body: RecommendInput):
    price_multiplier = 1.0 + (body.zoneId % 3) * 0.1
    return {"zoneId": body.zoneId, "multiplier": price_multiplier}


# === AI-Exit decision (adapted from tree.py, using Central API) ===
CENTRAL_URL = os.environ.get("CENTRAL_URL", "http://central:4000")
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY")


class ExitInput(BaseModel):
    vehicle: str | None = None
    has_ticket: bool | None = None
    phone: str | None = None
    ticket_code: str | None = None

@app.get("/ai/vehicle/check")
def vehicle_check(plate: str):
    try:
        r = requests.get(f"{CENTRAL_URL}/ai/vehicles/search", params={"plate": plate}, timeout=5)
        if r.status_code == 200:
            data = r.json()
            return {"exists": bool(data)}
    except Exception:
        return {"exists": False}
    return {"exists": True}



@app.post("/exit/decision")
def exit_decision(body: ExitInput):
    vehicle = (body.vehicle or '').upper().strip()
    ticket_code = (body.ticket_code or '').upper().strip()

    def find_session(v: str):
        try:
            if not v:
                return None
            r = requests.get(f"{CENTRAL_URL}/ai/sessions/search", params={"vehicle": v}, timeout=5)
            if r.status_code == 200:
                return r.json()
            return None
        except Exception:
            return None

    # If ticket_code present, try by ticket first
    def find_by_ticket(code: str):
        try:
            if not code:
                return None
            r = requests.get(f"{CENTRAL_URL}/ai/sessions/by-ticket", params={"code": code}, timeout=5)
            if r.status_code == 200:
                return r.json()
            return None
        except Exception:
            return None

    sess = find_by_ticket(ticket_code) or find_session(vehicle)

    # If ANPR/session found
    if sess:
        status = str(sess.get('status', '')).lower()
        due = float(sess.get('amount_due_cents') or 0)
        paid = float(sess.get('amount_paid_cents') or 0)
        sid = int(sess.get('id')) if sess.get('id') is not None else None

        # Paid — open immediately (only explicit paid or paid >= due)
        if status == 'paid' or (due > 0 and paid >= due):
            return {"decision": "open_gate", "message": "Оплата подтверждена.", "sessionId": sid}

        # Not paid yet
        if body.has_ticket is True:
            # Close to stop timer, then allow 48h late payment via QR.
            # Do a second close attempt after marking late-payment in case of race.
            try:
                print(f"[ai-exit] QR 48h for session {sid}: closing then late-payment")
                try:
                    rc = requests.post(f"{CENTRAL_URL}/ai/sessions/{sid}/close", timeout=6)
                    print(f"[ai-exit] close rc={rc.status_code}")
                except Exception:
                    print("[ai-exit] close call failed")
                try:
                    rl = requests.post(f"{CENTRAL_URL}/ai/sessions/{sid}/late-payment", json={"hours": 48, "method": "qr"}, timeout=5)
                    print(f"[ai-exit] late-payment rc={rl.status_code}")
                finally:
                    try:
                        rc2 = requests.post(f"{CENTRAL_URL}/ai/sessions/{sid}/close", timeout=6)
                        print(f"[ai-exit] close2 rc={rc2.status_code}")
                    except Exception:
                        print("[ai-exit] close2 call failed")
            except Exception:
                pass
            return {"decision": "open_qr_48h", "message": "Откроем шлагбаум. В течение 48 часов оплатите парковку, отсканировав QR‑код на талоне. Иначе окажетесь в чёрном списке. Иначе окажетесь в чёрном списке.", "sessionId": sid}
        if body.has_ticket is False:
            if body.phone and body.phone.isdigit() and len(body.phone) == 9:
                try:
                    print(f"[ai-exit] SMS 48h for session {sid} (phone={body.phone}): closing then late-payment")
                    # Close to stop timer, then allow 48h late payment via SMS.
                    # Do a second close attempt after marking late-payment.
                    try:
                        rc = requests.post(f"{CENTRAL_URL}/ai/sessions/{sid}/close", timeout=6)
                        print(f"[ai-exit] close rc={rc.status_code}")
                    except Exception:
                        print("[ai-exit] close call failed")
                    try:
                        rl = requests.post(f"{CENTRAL_URL}/ai/sessions/{sid}/late-payment", json={"hours": 48, "method": "sms"}, timeout=5)
                        print(f"[ai-exit] late-payment rc={rl.status_code}")
                    finally:
                        try:
                            rc2 = requests.post(f"{CENTRAL_URL}/ai/sessions/{sid}/close", timeout=6)
                            print(f"[ai-exit] close2 rc={rc2.status_code}")
                        except Exception:
                            print("[ai-exit] close2 call failed")
                except Exception:
                    pass
                return {"decision": "open_sms_48h", "message": f"Откроем шлагбаум. Ссылка на оплату отправлена на {body.phone}. Оплатите в течение 48 часов. Иначе окажетесь в чёрном списке.", "sessionId": sid}
            return {"decision": "need_phone", "message": "Введите номер телефона (9 цифр) для поздней оплаты.", "sessionId": sid}
        # ask about ticket
        return {"decision": "need_ticket", "message": "Оплата не произведена. У вас есть талон? (да/нет)", "sessionId": sid}

    # No session case — ANPR not recognized path from the scheme
    if body.has_ticket is True:
        # Ticket inserted → cannot verify payment without code here → allow 48h QR payment
        return {"decision": "open_qr_48h", "message": "Откроем шлагбаум. В течение 48 часов оплатите стоянку, отсканировав QR‑код на талоне.", "sessionId": None}

    if body.has_ticket is False:
        # No ticket → if we have phone, allow SMS late payment window even without located session
        if not vehicle:
            return {"decision": "need_vehicle", "message": "Пожалуйста, введите номер машины", "sessionId": None}
        if body.phone and body.phone.isdigit() and len(body.phone) == 9:
            return {"decision": "open_sms_48h", "message": f"Откроем шлагбаум. Ссылка на оплату отправлена на {body.phone}. Оплатите в течение 48 часов. Иначе окажетесь в чёрном списке. Иначе окажетесь в чёрном списке.", "sessionId": None}
        return {"decision": "need_phone", "message": "Введите номер телефона (9 цифр) для поздней оплаты", "sessionId": None}

    # No info yet — follow scheme: ANPR not recognized → спросить про талон
    if not vehicle:
        return {"decision": "need_vehicle", "message": "Пожалуйста, введите номер машины", "sessionId": None}
    return {"decision": "need_ticket", "message": "Оплата не найдена. У вас есть талон? (да/нет)", "sessionId": None}


class UnderstandInput(BaseModel):
    text: str
    lang: str | None = None


@app.post("/exit/understand")
def exit_understand(body: UnderstandInput):
    """LLM-aided parser: extracts vehicle, has_ticket (yes/no), phone from free text.
    Prefers Gemini if API key is provided; falls back to simple regex parsing.
    """
    text = (body.text or '').strip()
    lang = (body.lang or 'ru-RU')
    out = {"vehicle": None, "has_ticket": None, "phone": None}

    # Fallback regex extraction
    def fallback_extract():
        t = text
        # plate: simple RU/EN pattern: A123BC or A123BC77
        try:
            raw = t.upper().replace('-', ' ').replace('\n',' ')
            import re
            m = re.search(r"[A-ZА-Я][0-9]{3}[A-ZА-Я]{2}[0-9]{0,3}", raw)
            if m:
                out["vehicle"] = m.group(0)
        except Exception:
            pass
        tl = t.lower()
        if any(w in tl.split() for w in ['да','есть','yes','y','da']):
            out["has_ticket"] = True
        elif any(w in tl.split() for w in ['нет','no','n','nu']):
            out["has_ticket"] = False
        import re
        pm = re.search(r"(\d{9})", re.sub(r"[^0-9]", "", t))
        if pm:
            out["phone"] = pm.group(1)

    # Gemini extraction
    if GEMINI_API_KEY:
        try:
            url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={requests.utils.quote(GEMINI_API_KEY)}"
            sys = (
                "Return JSON only with keys: vehicle (string or null), has_ticket (true/false/null), phone (string of 9 digits or null). "
                "Understand RU/EN/RO. Examples for has_ticket yes: 'да','есть','yes','da'; for no: 'нет','no','nu'. "
                "If phone present, normalize to 9 digits (strip spaces and country code)."
            )
            payload = {
                "systemInstruction": {"parts": [{"text": sys}]},
                "generationConfig": {"responseMimeType": "application/json"},
                "contents": [{"role": "user", "parts": [{"text": f"Lang={lang}\nText={text}"}]}]
            }
            r = requests.post(url, json=payload, timeout=8)
            r.raise_for_status()
            data = r.json()
            txt = data.get('candidates', [{}])[0].get('content', {}).get('parts', [{}])[0].get('text', '{}')
            import json
            parsed = json.loads(txt)
            for k in ["vehicle","has_ticket","phone"]:
                if k in parsed:
                    out[k] = parsed[k]
        except Exception:
            fallback_extract()
    else:
        fallback_extract()

    # normalize phone to 9 digits if possible
    if out["phone"]:
        digits = ''.join(ch for ch in str(out["phone"]) if ch.isdigit())
        if len(digits) >= 9:
            out["phone"] = digits[-9:]
        else:
            out["phone"] = None

    return out
