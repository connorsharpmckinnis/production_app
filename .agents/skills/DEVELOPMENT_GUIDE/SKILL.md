---
name: development-guide
description: Use this skill to know the standards, rules, preferences, and styles that should govern the development of this application.
---

# Primary Goal

Build software that is easy for humans to understand, maintain, and extend.

The codebase should remain approachable for an intermediate Python developer years after it is written.

Readability is preferred over cleverness.


# Authoritative Documentation

Before implementing features, read:

* [docs/PROJECT.md](../../docs/PROJECT.md) — product vision, domain model, phases, and workflows
* [docs/DATABASE.md](../../docs/DATABASE.md) — PostgreSQL schema, naming conventions, and data-model decisions
* [docs/SCRIPT_FORMAT.md](../../docs/SCRIPT_FORMAT.md) — standard script format and import mapping
* [docs/IMPORT_SPEC.md](../../docs/IMPORT_SPEC.md) — importer line classification and error policy
* [docs/ROLES.md](../../docs/ROLES.md) — MVP role permissions

When product intent and schema details conflict, resolve in favor of PROJECT.md for *what* to build, DATABASE.md for *how* to store it, IMPORT_SPEC.md for *how* to parse scripts, and SCRIPT_FORMAT.md for *authoring rules*.


# Domain Principles

These rules come from the product vision and must guide implementation:

* **The script is sacred** — imported text is never modified; production data is layered on top.
* **Timeline-centered** — Moments are the atomic unit; other views filter or summarize Timeline data.
* **One source of truth** — each real-world object (Character, Prop, Song, etc.) exists once; avoid duplicated relationships.
* **Derived over stored** — compute Character→Scene, Prop→Scene, and similar links from Timeline data when practical.
* **Structured over free text** — store parseable data for blocking, cues, and assignments; dialogue stays free text.
* **Humans decide** — the importer produces a draft; it does not permanently infer production decisions.
* **Vertical slices** — ship complete workflows end-to-end rather than building unused infrastructure.


# Development Philosophy

When making implementation decisions, optimize for:

1. Readability
2. Simplicity
3. Maintainability
4. Consistency
5. Performance (only when necessary)

Do not optimize prematurely.

Prefer boring, well-understood solutions over clever or highly abstract ones.


# Architecture Principles

* Keep business logic in the backend.
* Keep the frontend focused on presentation.
* Favor explicit code over "magic."
* Prefer composition over inheritance.
* Keep modules small and focused.
* Avoid unnecessary abstractions.
* Build complete vertical features instead of isolated infrastructure.


# Technology Stack

Backend

* Python
* FastAPI
* SQLAlchemy
* Alembic
* PostgreSQL

Frontend

* React
* TypeScript
* Vite
* Tailwind CSS
* shadcn/ui

Infrastructure

* Docker
* uv
* Git


# Package Philosophy

Prefer the Python standard library whenever practical.

When external packages are needed:

* Choose mature, widely adopted libraries.
* Prefer fewer dependencies.
* Avoid niche or overly clever packages.
* Avoid introducing dependencies for small conveniences.

Every dependency should have a clear justification.


# Code Style

Write code that is easy to read from top to bottom.

Prefer:

* descriptive variable names
* descriptive function names
* descriptive filenames

Avoid:

* unnecessary one-liners
* deeply nested logic
* excessive chaining
* hidden side effects


# Function Guidelines

Functions should generally:

* perform one responsibility
* have descriptive names
* stay reasonably short
* return predictable values

Prefer several small functions over one very large function.


# Comments

Write comments for humans, not computers.

Assume the reader has approximately a 5th-grade reading level.

Good comments explain:

* why something exists
* why a decision was made
* what assumptions are being made

Avoid comments that merely restate the code.

Bad:

```python
# Increment i
i += 1
```

Good:

```python
# Skip the title row because it isn't part of the script.
```


# Documentation

Every significant feature should include documentation.

Minimum documentation:

* purpose
* setup
* usage
* testing
* known limitations

Complex systems should also explain their overall architecture.


# File Organization

Prefer many small files over a few very large ones.

Files should have one clear responsibility.

Avoid "utility" files that become dumping grounds.


# Error Handling

Fail clearly.

Provide useful error messages.

Avoid silent failures.

Raise meaningful exceptions.

Log enough information to diagnose problems.


# Logging

Log important events.

Do not spam logs.

Log:

* startup
* shutdown
* imports
* major operations
* warnings
* recoverable errors


# Database

See [docs/DATABASE.md](../../docs/DATABASE.md) for the full schema.

Summary rules:

* Keep schemas normalized.
* Use foreign keys.
* Use descriptive table and column names matching DATABASE.md conventions (`id`, `created_at`, `updated_at`, `{entity}_id`).
* Prefer derived relationships over duplicated data.
* Never bypass ORM conventions without a documented reason.
* Use Alembic for all schema changes.


# React Guidelines

Prefer:

* functional components
* hooks
* small reusable components
* composition

Avoid:

* overly deep component trees
* unnecessary global state
* excessive prop drilling

Keep UI logic separate from business logic.


# UI Philosophy

The Timeline should remain visible whenever practical. Edit objects through side panels or dialogs rather than navigating away from the Timeline.

Simple beats flashy.

Consistency beats novelty.

Prefer standard shadcn/ui components whenever possible.

Avoid unnecessary animations.

Avoid custom controls unless they provide significant value.


# Styling

Use Tailwind utilities.

Avoid inline styles.

Prefer consistent spacing and sizing.

Follow existing design patterns before creating new ones.


# Icons

Use shadcn/ui-supported icon libraries.

Use icons to support labels, not replace them.


# Testing Philosophy

Test every meaningful feature.

Prioritize:

* business logic
* parsing
* imports
* database behavior

UI tests are lower priority than backend correctness.


# Cross-Platform Development

Assume developers may use:

* macOS
* Windows
* Linux

Avoid OS-specific commands whenever possible.

Prefer platform-independent tooling.


# Commands

Prefer uv.

Examples:

```text
uv sync

uv run python main.py

uv run pytest
```

Avoid assuming PowerShell, Bash, or platform-specific shell syntax.


# Docker

Every service should run through Docker.

Local development should require minimal manual setup.

Document all containers.

Avoid unnecessary Docker complexity.


# Git Philosophy

Commit logical units of work.

Keep commits focused.

Do not mix unrelated changes.

Write meaningful commit messages.


# AI Coding Expectations

When implementing features:

1. Read [docs/PROJECT.md](../../docs/PROJECT.md), [docs/DATABASE.md](../../docs/DATABASE.md), and [docs/SCRIPT_FORMAT.md](../../docs/SCRIPT_FORMAT.md) first.
2. Follow existing patterns.
3. Do not invent new architectural styles.
4. Reuse existing components whenever practical.
5. Explain significant design decisions.
6. Keep generated code understandable.

Before introducing a new dependency, architectural pattern, database table, or API style, ask: "Does this match the existing project philosophy?"

If uncertain:

Choose the simpler solution.


# AI Response Expectations

For every significant coding task:

Explain:

* what changed
* why it changed
* any tradeoffs
* any future improvements

Do not simply provide code without explanation.


# Startup Documentation

Every major component should document:

* how to start it
* how to configure it
* required environment variables
* expected ports
* common troubleshooting steps


# Guiding Principle

Always write code that the future developer can confidently understand, modify, and debug without relying on AI assistance.

The best solution is usually the simplest solution that correctly solves the problem.
