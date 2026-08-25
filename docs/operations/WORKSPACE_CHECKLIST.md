# Workspace Provisioning Checklist

## Repository
- [x] Create GitHub repository `pcrus1988-bit/coquette`
- [x] Confirm repository is isolated from other projects
- [x] Establish `main` as default branch
- [x] Add secret-safe `.gitignore`
- [x] Add `.env.example`
- [x] Add public-repository security policy
- [x] Prepare workspace bootstrap branch
- [ ] Merge workspace bootstrap into `main`
- [ ] Add CI and protect `main` once the application stack is finalized

## Vercel
- [x] Confirm existing Vercel projects do not contain COQUETTE
- [ ] Create dedicated Vercel project for COQUETTE
- [ ] Connect only to `pcrus1988-bit/coquette`
- [ ] Configure preview/staging environment
- [ ] Configure production domain only at approved cutover

## Data
- [ ] Select database/storage stack in blueprint
- [ ] Create dedicated COQUETTE database project
- [ ] Create dedicated storage
- [ ] Define backup policy
- [ ] Create private migration/export area for Magento source data

## Integrations
- [ ] PayPal dedicated app/credentials
- [ ] Klarna dedicated credentials
- [ ] AADE/myDATA dedicated configuration
- [ ] Courier credentials
- [ ] Email provider/domain configuration

## Security
- [x] Document no-shared-secrets rule
- [ ] Separate production/staging credentials
- [ ] Add credential rotation record
- [ ] Add webhook ownership inventory
- [ ] Add automated secret scanning to CI
