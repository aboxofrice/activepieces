---
name: pdc-ops
description: Inspect, monitor, query, and trigger PDC (Parts Distribution Center) sync workflows, file downloads, and flow runs on the local Activepieces instance.
---

# PDC & Local Flow Operations Skill

Use this skill whenever the user asks about:
- Whether PDC sync has run or is currently running
- Checking if PDC inventory files were downloaded today
- Investigating run statuses, failures, or SellerCloud sync reports
- Manually kicking off a PDC sync worker or flow run

## System Architecture & Ports

- **Activepieces Web / API**: `http://localhost:8080`
- **Postgres Container**: `postgres` (port `5432`, DB `activepieces`, user `postgres`)
- **Redis Container**: `redis` (port `6379`)
- **Upstream App**: `http://localhost:8081`

## Key Flows

| Flow Name | ID | Trigger |
| :--- | :--- | :--- |
| **PDC → SellerCloud: orchestrator** | `Spj2MffBKnLaiMwA4YU4G` | Schedule (`*/5 6-18 * * * ET`) |
| **PDC Inventory Files → Email** | `JzuKYRB39zrkwk2iRmWWy` | Schedule (`0 8,9,10 * * * ET`) |
| **PDC → SellerCloud: Orlando PDC (03159)** | `bh5RpZqnmGOjammyG1mlv` | Webhook |
| **PDC → SellerCloud: Centerline (03110)** | `lNeFotzjz8q19FPJEkFCU` | Webhook |
| **PDC → SellerCloud: Romulus (03125)** | `aXW3xj7wPLlHItqIhNnmA` | Webhook |
| **PDC → SellerCloud: Warren (03111)** | `D628ea8nSzXlcB7x8VS8s` | Webhook |
| **PDC → SellerCloud: Marysville (03115)** | `ewCPEOO90QntAzO7hBI3y` | Webhook |
| **PDC → SellerCloud: Sherwood (03117)** | `BiXEVNoWyqUK5vgR5rPJ0` | Webhook |
| **PDC → SellerCloud: Milwaukee (03129)** | `lmB6THJ05svsLE6TeDaJH` | Webhook |

## Operational Procedures

### 1. Check Today's PDC Sync Progress
The orchestrator writes the current state of all distribution centers to `store-entry`:
```bash
docker exec postgres psql -U postgres -d activepieces -c \
  "SELECT value FROM \"store-entry\" WHERE key = 'pdc_orch_day_daily';"
```

### 2. Check Downloaded Inventory Files
To see all inventory CSV files and archives downloaded today:
```bash
docker exec postgres psql -U postgres -d activepieces -c \
  "SELECT id, \"fileName\", size, created FROM file WHERE \"type\" = 'FLOW_STEP_FILE' AND created >= CURRENT_DATE ORDER BY created DESC;"
```

### 3. Check Recent Flow Runs
To inspect recent runs across all PDC flows:
```bash
docker exec postgres psql -U postgres -d activepieces -c \
  "SELECT fv.\"displayName\", r.id, r.status, r.\"startTime\", r.\"finishTime\", r.created \
   FROM flow_run r \
   JOIN flow f ON r.\"flowId\" = f.id \
   JOIN flow_version fv ON r.\"flowVersionId\" = fv.id \
   WHERE fv.\"displayName\" ILIKE '%pdc%' AND r.created >= CURRENT_DATE \
   ORDER BY r.created DESC LIMIT 15;"
```

### 4. Kick Off a Flow Run
To trigger any webhook-based worker flow:
```bash
curl -s -X POST http://localhost:8080/api/v1/webhooks/<FLOW_ID> \
  -H "Content-Type: application/json" \
  -d '{"data": {"token": "manual-trigger"}}'
```

### 5. Retry a Failed Run
```bash
curl -s -X POST http://localhost:8080/api/v1/flow-runs/<RUN_ID>/retry \
  -H "Content-Type: application/json" \
  -d '{"strategy": "FROM_FAILED_STEP", "projectId": "<PROJECT_ID>"}'
```
