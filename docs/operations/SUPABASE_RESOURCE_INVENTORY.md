# Supabase Resource Inventory

This file contains non-secret identifiers only.

## Project

- name: `coquette`
- project ref: `pijetwrxqznxaoacnakr`
- organization: `SP BUSINESS LAB`
- region: `eu-central-1`
- database engine: PostgreSQL 17
- project URL: `https://pijetwrxqznxaoacnakr.supabase.co`
- database host: `db.pijetwrxqznxaoacnakr.supabase.co`

## Storage

### `coquette-media`

- public: yes
- max object size: 25 MiB
- MIME types: JPEG, PNG, WebP, AVIF, GIF
- purpose: public commerce and editorial imagery

### `coquette-imports`

- public: no
- purpose: temporary private Magento migration/import material

## Managed Supabase infrastructure migrations

- create COQUETTE storage buckets
- restrict COQUETTE public media bucket

Medusa application tables are not duplicated in Supabase migration files. They are installed and upgraded through Medusa's own migration system.

## Secrets intentionally absent

Never add any of the following to this document or Git history:

- database passwords / `DATABASE_URL`
- Supabase secret/service keys
- S3 access-key ID
- S3 secret access key
- payment credentials
- AADE credentials
- courier credentials

Those belong only in the relevant COQUETTE runtime secret store.
