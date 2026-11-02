# PDC → SellerCloud Sync Feature

## Summary
The PDC (Parts Distribution Center) sync system is a set of automated workflows in Activepieces that downloads daily Mopar inventory CSV files from PDC distribution centers, reconciles parts inventory against SellerCloud, imports catalog stock levels, and sends daily reports and email summaries to operations.

## Key Flows & IDs

| Flow Display Name | Flow ID | Trigger Type | Schedule / Purpose |
| :--- | :--- | :--- | :--- |
| **PDC → SellerCloud: orchestrator** | `Spj2MffBKnLaiMwA4YU4G` | Schedule (`@activepieces/piece-schedule`) | `*/5 6-18 * * * ET` (every 5 min during business hours) |
| **PDC Inventory Files → Email** | `JzuKYRB39zrkwk2iRmWWy` | Schedule (`@activepieces/piece-schedule`) | `0 8,9,10 * * * ET` |
| **PDC → SellerCloud: Orlando PDC (03159)** | `bh5RpZqnmGOjammyG1mlv` | Webhook (`catch_webhook`) | Worker for Center 03159 (Forsyth) |
| **PDC → SellerCloud: Centerline (03110)** | `lNeFotzjz8q19FPJEkFCU` | Webhook (`catch_webhook`) | Worker for Center 03110 (Centerline) |
| **PDC → SellerCloud: Romulus (03125)** | `aXW3xj7wPLlHItqIhNnmA` | Webhook (`catch_webhook`) | Worker for Center 03125 (Romulus) |
| **PDC → SellerCloud: Warren (03111)** | `D628ea8nSzXlcB7x8VS8s` | Webhook (`catch_webhook`) | Worker for Center 03111 (Warren) |
| **PDC → SellerCloud: Marysville (03115)** | `ewCPEOO90QntAzO7hBI3y` | Webhook (`catch_webhook`) | Worker for Center 03115 (Marysville) |
| **PDC → SellerCloud: Sherwood (03117)** | `BiXEVNoWyqUK5vgR5rPJ0` | Webhook (`catch_webhook`) | Worker for Center 03117 (Sherwood) |
| **PDC → SellerCloud: Milwaukee (03129)** | `lmB6THJ05svsLE6TeDaJH` | Webhook (`catch_webhook`) | Worker for Center 03129 (Milwaukee) |

## State Management
- **Key**: `pdc_orch_day_daily` in the `store-entry` table.
- Stores the daily progress JSON containing:
  - `date`: Today's sync date (e.g., `2026-10-10`).
  - `emailed`: `true` once summary email is dispatched.
  - `centers`: Status map for each center (`03159`, `03110`, `03125`, `03111`, `03115`, `03117`, `03129`).
    - `status`: `done` | `pending` | `in_progress`
    - `imported`: Rows processed, SellerCloud jobId, matched products, unmatched counts.

## Local Infrastructure Connection

- **HTTP API / Webhook Prefix**: `http://localhost:8080/api/v1`
- **PostgreSQL**: Running in container `postgres` (port `5432`, DB `activepieces`, user `postgres`).
- **Redis Queue**: Running in container `redis` (port `6379`).

### Common SQL Queries

1. **Check today's sync progress**:
   ```sql
   docker exec postgres psql -U postgres -d activepieces -c "SELECT value FROM \"store-entry\" WHERE key = 'pdc_orch_day_daily';"
   ```

2. **Check downloaded files today**:
   ```sql
   docker exec postgres psql -U postgres -d activepieces -c "SELECT id, \"fileName\", size, created FROM file WHERE \"type\" = 'FLOW_STEP_FILE' AND created >= CURRENT_DATE ORDER BY created DESC;"
   ```

3. **Check recent runs for a flow**:
   ```sql
   docker exec postgres psql -U postgres -d activepieces -c "SELECT id, status, \"startTime\", \"finishTime\", created FROM flow_run WHERE \"flowId\" = 'Spj2MffBKnLaiMwA4YU4G' ORDER BY created DESC LIMIT 5;"
   ```

### Triggering Flows

- **Trigger worker flow via webhook**:
  ```bash
  curl -s -X POST http://localhost:8080/api/v1/webhooks/<FLOW_ID> -H "Content-Type: application/json" -d '{"data": {"token": "manual-trigger"}}'
  ```
