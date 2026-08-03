# Role Permissions (MVP)

**Version:** 0.1

Defines what each MVP role can do. Schema: [DATABASE.md](DATABASE.md) (`app_roles`, `user_app_roles`).

MVP roles: **Admin**, **Director**, **Actor**.

---

## Permission Matrix


| Action                             | Admin | Director | Actor                |
| ---------------------------------- | ----- | -------- | -------------------- |
| Create/Delete production           | Yes   | No       | No                   |
| Import script                      | Yes   | No       | No                   |
| Edit timeline (moments, structure) | Yes   | Yes      | No                   |
| View timeline                      | Yes   | Yes      | Yes                  |
| Search script / timeline           | Yes   | Yes      | Yes                  |
| Verify characters / songs          | Yes   | Yes      | No                   |
| Cast actors to characters          | Yes   | Yes      | No                   |
| Manage groups                      | Yes   | Yes      | No                   |
| Add notes (public or private)      | Yes   | Yes      | Yes                  |
| Add bookmarks                      | Yes   | Yes      | Yes                  |
| Create / edit / deactivate users   | Yes   | No       | No                   |
| Reset user passwords               | Yes   | No       | No                   |
| Assign roles to users              | Yes   | No       | No                   |
| Act as another user (session)      | Yes   | No       | No                   |
| Actor-filtered timeline view       | Yes   | Yes      | Yes (own characters) |
| Cue-only rehearsal mode            | Yes   | Yes      | Yes                  |


---



## Rules

- **Import is Admin-only.** Directors prepare productions but cannot upload or re-import scripts.
- **Actors are view-only on the Timeline** except for Notes and Bookmarks.
- **User management is Admin-only.** Includes account creation, password resets, role assignment, and deactivation.
- **Act as user is Admin-only.** An Admin may switch their session to another active org user to verify that account’s view. The JWT carries an impersonator claim; nested act-as is blocked; a banner + **Return to admin** restores the original Admin session. Not a separate SuperAdmin role.
- **Directors** can edit timeline and perform preparation work on existing productions. They cannot create, delete, or import productions, and cannot manage users.

---

