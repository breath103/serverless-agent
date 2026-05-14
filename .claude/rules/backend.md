---
paths:
  - "packages/backend/**"
---

# Backend (packages/backend)

- **For default values, inject from application code instead of SQL `DEFAULT` when possible.** Exception: `gen_random_uuid()` for PKs is fine.

See `documents/coding-guidelines/backend.md` for detailed coding standards.

## Environment Variables

Each developer keeps their own `.env`, `packages/backend/.env.development`,
and `packages/frontend/.env.development` locally. Nothing env-related is
committed to git — `.env.sample` files document the required keys.
