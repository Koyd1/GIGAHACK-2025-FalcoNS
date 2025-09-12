Smart Parking — Demo Scenarios

Scenario 1: Quick user flow
- Open zones: GET http://localhost:8080/api/zones
- Start ticket: POST /api/tickets { vehicle: "AA123BB", zoneId: 1 }
- Close ticket: POST /api/tickets/{id}/close → amount
- Payment (consent in UI): POST /api/payments/{id}/pay
- Gate opens automatically after success; monitor closes after pass or 60s.

Scenario 2: Find by plate (prefill)
- Type plate in user UI input. If open session exists, UI jumps to “Open” stage.
- Close → Pay (confirm modal appears).

Scenario 3: Voice/Assistant
- "Начать парковку A123BC в зоне 1"
- "Закрыть парковку" (uses last ticket in session)
- "Оплатить"
- Gate control: "Открыть шлагбаум" → "Проехал"

Scenario 4: Admin
- Open sessions with running due (MDL): GET /api/admin/sessions/open
- Force close: POST /api/admin/sessions/{id}/close
- Incidents list/resolve.

Notes
- Currency: MDL. Dynamic pricing multiplier from AI module.
- Payment sandbox modes at http://localhost:5002/__sandbox/config

