# Akara Studio - AWS Native Platform

Premium wallpapers and music platform built on AWS with modern web technologies.

## Architecture

- **Frontend**: Public site (Next.js 14 + TypeScript + Tailwind)
- **Admin**: Private admin interface (Next.js 14 + TypeScript + Tailwind)
- **Lambdas**: Serverless API (Node.js + TypeScript)
- **Infra**: Infrastructure as Code (Terraform)
- **Catalogs**: JSON schemas and data contracts

## Quick Start

### Prerequisites

- Node.js 18+ and npm 9+
- AWS CLI configured
- Terraform (for infrastructure)

### Development

```bash
# Install dependencies
npm install

# Start frontend development server
npm run dev:frontend

# Start admin development server
npm run dev:admin

# Build all workspaces
npm run build:frontend
npm run build:admin
npm run build:lambdas
```

### Environment Setup

1. Copy environment files:
   ```bash
   cp frontend/.env.example frontend/.env.local
   cp admin/.env.example admin/.env.local
   cp lambdas/.env.example lambdas/.env
   ```

2. Configure AWS credentials and update environment variables

### Deployment

```bash
# Deploy infrastructure first
npm run deploy:infra

# Deploy applications
npm run deploy:frontend
npm run deploy:admin
npm run deploy:lambdas
```

## Project Structure

```
akara/
├── frontend/          # Public site (Next.js)
├── admin/            # Admin interface (Next.js)
├── lambdas/          # Serverless functions
├── infra/            # Terraform infrastructure
├── catalogs/         # Data schemas and samples
└── .github/workflows/ # CI/CD pipelines
```

## Design Principles

- **Static + CDN**: Public browsing uses static catalogs, no DB calls
- **Manual-first Admin**: Upload, edit, publish workflow
- **Premium Experience**: Apple-like quality, mobile-first, accessible
- **Phase-based Delivery**: Ship incrementally with clear milestones

## Data Flow

1. **Admin**: Upload media → Edit metadata → Publish
2. **Publish**: Generate catalogs → Update S3 → Invalidate CloudFront
3. **Public**: Browse static catalogs → Stream optimized media

## Environments

- **Development**: Local development with sample data
- **Staging**: AWS staging environment for testing
- **Production**: Live site at akara.studio

## License

Private - All rights reserved
