# STHMC Documentation

STHMC is a healthcare clinic management system built on Wix Velo (Wix CLI + Wix Data CMS). It manages patients and medical charts using a custom email/password authentication system — it does not use Wix Members. All data lives in four Wix CMS collections. The name STHMC refers to the clinic site itself.

## Reading Order

1. README.md (this file) — orientation and navigation
2. 01-architecture.md — system structure, file map, and design decisions
3. 02-authentication.md — login, logout, sessions, and rate limiting
4. 03-data-model.md — CMS collections and field schemas
5. 04-backend-api.md — backend function signatures and return contracts
6. 05-pages.md — per-page behavior and how to add new pages
7. 06-setup.md — local setup and running the project

## Quick Lookup

| If you need to understand...                  | Read...            |
|-----------------------------------------------|--------------------|
| How the system is structured                  | 01-architecture.md |
| How login / logout / sessions work            | 02-authentication.md |
| CMS collections and field schemas             | 03-data-model.md   |
| What a backend function does                  | 04-backend-api.md  |
| How a page works or how to add a new page     | 05-pages.md        |
| How to set up and run the project locally     | 06-setup.md        |
