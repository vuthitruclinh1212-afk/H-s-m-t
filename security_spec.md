# Security Specification (Phase 0 TDD)

## 1. Data Invariants
1. **Strict Account Isolation**: Every user's vault state (`/users/{userId}`), items (`/users/{userId}/items/{itemId}`), and comments (`/users/{userId}/comments/{commentId}`) belong exclusively to `request.auth.uid == userId` with `request.auth.token.email_verified == true`.
2. **Relational Parent Gate**: A vault item or comment in `/users/{userId}/...` can only be created, read, updated, or deleted if the parent `/users/{userId}` document exists (or is created in the same batch via `existsAfter`) and `ownerId == userId == request.auth.uid`.
3. **Immutable Identity & Creation Timestamps**: `ownerId`, `id`, and `createdAt` can never be mutated on update.
4. **Server Timestamp Enforcement**: `createdAt` on create and `updatedAt` on update must equal `request.time`.

## 2. The "Dirty Dozen" Payloads
1. **Unauthenticated Write**: `auth = null` attempting to create `/users/u1` -> `PERMISSION_DENIED`.
2. **Unverified Email Spoof**: `auth = { uid: 'u1', token: { email_verified: false } }` attempting to create `/users/u1` -> `PERMISSION_DENIED`.
3. **Cross-Tenant Read (PII / Vault Leak)**: `auth.uid = 'attacker'` attempting `get` or `list` on `/users/victim/items` -> `PERMISSION_DENIED`.
4. **Owner Spoofing on Create**: `auth.uid = 'u1'` creating `/users/u1/items/item1` with `ownerId: 'u2'` -> `PERMISSION_DENIED`.
5. **Shadow Field Injection on Create**: Adding `isAdmin: true` to `/users/u1` -> `PERMISSION_DENIED` via `.keys().hasOnly(...)`.
6. **Shadow Field Injection on Update**: Updating `/users/u1` with an undeclared key `hacked: 1` -> `PERMISSION_DENIED` via `affectedKeys().hasOnly(...)`.
7. **Immutable Field Mutation**: Updating `createdAt` or `ownerId` on `/users/u1/items/item1` -> `PERMISSION_DENIED`.
8. **Forged Client Timestamp**: Setting `createdAt` or `updatedAt` to a past/future timestamp instead of `request.time` -> `PERMISSION_DENIED`.
9. **Path ID Poisoning**: Creating `/users/u1/items/invalid$id!with spaces` -> `PERMISSION_DENIED` via `isValidId()`.
10. **Denial of Wallet Oversized String**: Sending a 900KB `payloadJson` or 500-char `title` -> `PERMISSION_DENIED`.
11. **Invalid Enum Value**: Setting `type: 'executable'` on `/users/u1/items/item1` -> `PERMISSION_DENIED`.
12. **Orphaned Subcollection Write**: Creating `/users/u1/items/item1` when `/users/u1` does not exist -> `PERMISSION_DENIED` via parent `exists()` / `existsAfter()` gate.
