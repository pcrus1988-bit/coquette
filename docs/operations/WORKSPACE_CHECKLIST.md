# Workspace Provisioning Checklist

## Repository
- [x] Create GitHub repository `pcrus1988-bit/coquette`
- [x] Confirm repository is isolated from other projects
- [x] Establish `main` as default branch
- [x] Add secret-safe `.gitignore`
- [x] Add `.env.example`
- [x] Add public-repository security policy
- [x] Prepare and merge the repository workspace bootstrap into `main`
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
- [ ] Finalize backup/restore policy after stack selection
- [ ] Create private migration/export area for Magento source data outside public GitHub

## Integrations
- [ ] PayPal dedicated app/credentials
- [ ] Klarna dedicated credentials
- [ ] AADE/myDATA dedicated configuration
- [ ] Courier credentials
- [ ] Email provider/domain configuration

## Security
- [x] Document no-shared-secrets rule
- [x] Add webhook ownership inventory
- [x] Add credential ownership inventory
- [ ] Separate production/staging credentials when provisioned
- [ ] Add credential rotation record
- [ ] Add automated secret scanning to CI
