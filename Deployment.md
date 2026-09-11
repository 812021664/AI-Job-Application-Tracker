# Deployment Guide - AI Job Application Tracker

Complete step-by-step guide to deploy the application to Google Cloud Platform.

## Prerequisites

- Google Cloud Account
- `gcloud` CLI installed
- Docker installed (for local testing)
- GitHub account (for CI/CD)

## Phase 1: GCP Setup

### 1.1 Create GCP Project

```bash
gcloud projects create ai-job-tracker-PROJECT_ID --name "AI Job Application Tracker"
gcloud config set project ai-job-tracker-PROJECT_ID
```

### 1.2 Enable Required APIs

```bash
gcloud services enable \
  compute.googleapis.com \
  run.googleapis.com \
  firestore.googleapis.com \
  storage-component.googleapis.com \
  cloudtasks.googleapis.com \
  artifactregistry.googleapis.com \
  cloudbuild.googleapis.com \
  generativelanguage.googleapis.com
```

### 1.3 Create Cloud Storage Bucket

```bash
gsutil mb gs://job-tracker-resumes-YOUR_PROJECT_ID
# Set lifecycle policy to delete old resumes after 90 days
```

### 1.4 Create Firestore Database

```bash
# In GCP Console:
# 1. Go to Firestore
# 2. Click "Create database"
# 3. Select "Datastore mode" or "Native mode" (Native recommended)
# 4. Choose "us-central1" region
# 5. Create

# Or via CLI (if available):
# gcloud firestore databases create --location=us-central1
```

### 1.5 Set Firestore Security Rules

```bash
# In GCP Console, go to Firestore > Rules and set:

rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users can only access their own data
    match /users/{userId} {
      allow read, write: if request.auth.uid == userId;
      
      match /applications/{docId=**} {
        allow read, write: if request.auth.uid == userId;
      }
    }
  }
}
```

## Phase 2: Authentication Setup

### 2.1 Create OAuth 2.0 Credentials

```bash
# In GCP Console:
# 1. Go to APIs & Services > Credentials
# 2. Click "Create Credentials" > "OAuth 2.0 Client IDs"
# 3. Choose "Web application"
# 4. Add authorized redirect URIs:
#    - http://localhost:3000
#    - http://localhost:3000/auth/callback
#    - https://your-domain.com
#    - https://your-domain.com/auth/callback
# 5. Download JSON and save securely
```

Save the credentials locally:
```bash
# Save client ID for later
GOOGLE_CLIENT_ID="xxx.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="xxx"
```

### 2.2 Create Service Account

```bash
gcloud iam service-accounts create ai-job-tracker \
  --display-name "AI Job Application Tracker"

# Grant necessary permissions
gcloud projects add-iam-policy-binding PROJECT_ID \
  --member="serviceAccount:ai-job-tracker@PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/datastore.user"

gcloud projects add-iam-policy-binding PROJECT_ID \
  --member="serviceAccount:ai-job-tracker@PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/storage.objectAdmin"

gcloud projects add-iam-policy-binding PROJECT_ID \
  --member="serviceAccount:ai-job-tracker@PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/cloudtasks.taskRunner"

# Create and download key
gcloud iam service-accounts keys create service-account-key.json \
  --iam-account=ai-job-tracker@PROJECT_ID.iam.gserviceaccount.com
```

### 2.3 Enable Gemini API

```bash
# In GCP Console:
# 1. Go to APIs & Services > Library
# 2. Search for "Generative Language API"
# 3. Click "Enable"
# 4. Go to Credentials > API Keys
# 5. Create new API key or use existing
# 6. Restrict key to Generative Language API
```

Save API key:
```bash
GEMINI_API_KEY="xxx"
```

## Phase 3: Create Artifact Registry

```bash
gcloud artifacts repositories create ai-job-tracker \
  --repository-format=docker \
  --location=us-central1 \
  --description="Docker repository for AI Job Tracker"

# Configure Docker authentication
gcloud auth configure-docker us-central1-docker.pkg.dev
```

## Phase 4: Deploy Backend to Cloud Run

### 4.1 Build Docker Image

```bash
# Tag image
docker tag ai-job-tracker:latest \
  us-central1-docker.pkg.dev/PROJECT_ID/ai-job-tracker/ai-job-tracker:latest

# Push to Artifact Registry
docker push us-central1-docker.pkg.dev/PROJECT_ID/ai-job-tracker/ai-job-tracker:latest
```

### 4.2 Deploy to Cloud Run

```bash
gcloud run deploy ai-job-tracker \
  --image us-central1-docker.pkg.dev/PROJECT_ID/ai-job-tracker/ai-job-tracker:latest \
  --platform managed \
  --region us-central1 \
  --memory 512Mi \
  --cpu 1 \
  --timeout 3600 \
  --set-env-vars="GCP_PROJECT_ID=PROJECT_ID" \
  --set-env-vars="GCS_BUCKET=job-tracker-resumes-PROJECT_ID" \
  --set-env-vars="CLOUD_TASKS_QUEUE=job-reminders" \
  --set-env-vars="GCP_REGION=us-central1" \
  --allow-unauthenticated \
  --service-account=ai-job-tracker@PROJECT_ID.iam.gserviceaccount.com

# Note: Set secrets via Secret Manager (see below)
```

### 4.3 Configure Secrets in Secret Manager

```bash
# Create secrets
echo -n "YOUR_GEMINI_API_KEY" | gcloud secrets create gemini-api-key --data-file=-
echo -n "YOUR_GOOGLE_CLIENT_ID" | gcloud secrets create google-client-id --data-file=-

# Grant Cloud Run service account access to secrets
gcloud secrets add-iam-policy-binding gemini-api-key \
  --member=serviceAccount:ai-job-tracker@PROJECT_ID.iam.gserviceaccount.com \
  --role=roles/secretmanager.secretAccessor

gcloud secrets add-iam-policy-binding google-client-id \
  --member=serviceAccount:ai-job-tracker@PROJECT_ID.iam.gserviceaccount.com \
  --role=roles/secretmanager.secretAccessor

# Update Cloud Run deployment with secrets
gcloud run deploy ai-job-tracker \
  --image us-central1-docker.pkg.dev/PROJECT_ID/ai-job-tracker/ai-job-tracker:latest \
  --update-secrets=GEMINI_API_KEY=gemini-api-key:latest \
  --update-secrets=GOOGLE_CLIENT_ID=google-client-id:latest
```

### 4.4 Get Cloud Run URL

```bash
gcloud run services describe ai-job-tracker --region us-central1 --format='value(status.url)'
# Save this URL for frontend configuration
```

## Phase 5: Create Cloud Tasks Queue

```bash
gcloud tasks queues create job-reminders \
  --location=us-central1 \
  --max-attempts=3 \
  --max-retry-delay=3600s \
  --min-backoff=30s

# Update REMINDER_WEBHOOK_URL in Cloud Run env vars
gcloud run deploy ai-job-tracker \
  --update-env-vars="REMINDER_WEBHOOK_URL=https://CLOUD_RUN_URL.run.app/webhook/reminder"
```

## Phase 6: Deploy Frontend

### 6.1 Setup Firebase Hosting (Optional)

```bash
# Initialize Firebase
firebase login
firebase init hosting

# Configure for React SPA:
# Public directory: build
# Rewrite all URLs to index.html: yes
```

### 6.2 Update Frontend Environment

Create `.env.production`:
```
REACT_APP_API_URL=https://ai-job-tracker-xxxxx.run.app
REACT_APP_GOOGLE_CLIENT_ID=YOUR_CLIENT_ID.apps.googleusercontent.com
```

### 6.3 Build and Deploy

```bash
# Build
npm run build

# Deploy to Firebase Hosting
firebase deploy --only hosting

# OR if using Vercel
vercel --prod
```

## Phase 7: Set Up CI/CD with GitHub Actions

### 7.1 Create Workload Identity Federation

```bash
# Create workload identity provider
gcloud iam workload-identity-pools create "github-pool" \
  --project=PROJECT_ID \
  --location=global \
  --display-name="GitHub Actions Pool"

# Get the provider resource name
export WIF_PROVIDER="projects/PROJECT_NUMBER/locations/global/workloadIdentityPools/github-pool/providers/github-provider"

# Create provider
gcloud iam workload-identity-pools providers create-oidc "github-provider" \
  --project=PROJECT_ID \
  --location=global \
  --workload-identity-pool="github-pool" \
  --display-name="GitHub Provider" \
  --attribute-mapping="google.subject=assertion.sub,attribute.actor=assertion.actor,attribute.aud=assertion.aud,attribute.repository=assertion.repository" \
  --issuer-uri="https://token.actions.githubusercontent.com" \
  --attribute-condition="assertion.repository == 'YOUR_GITHUB_REPO'"

# Grant permissions
gcloud iam service-accounts add-iam-policy-binding \
  "ai-job-tracker@PROJECT_ID.iam.gserviceaccount.com" \
  --project=PROJECT_ID \
  --role=roles/iam.workloadIdentityUser \
  --member="principalSet://iam.googleapis.com/projects/PROJECT_NUMBER/locations/global/workloadIdentityPools/github-pool/attribute.repository/YOUR_GITHUB_REPO"
```

### 7.2 Add GitHub Secrets

In GitHub repository settings, add:
```
WIF_PROVIDER: projects/PROJECT_NUMBER/locations/global/workloadIdentityPools/github-pool/providers/github-provider
WIF_SERVICE_ACCOUNT: ai-job-tracker@PROJECT_ID.iam.gserviceaccount.com
GCP_PROJECT_ID: PROJECT_ID
```

### 7.3 Move workflow file

```bash
mkdir -p .github/workflows
mv deploy.yml .github/workflows/
git add .github/workflows/deploy.yml
git commit -m "Add GitHub Actions CI/CD"
git push
```

## Phase 8: Verification

### 8.1 Test Backend

```bash
# Get Cloud Run URL
CLOUD_RUN_URL=$(gcloud run services describe ai-job-tracker \
  --region us-central1 --format='value(status.url)')

# Test health endpoint
curl $CLOUD_RUN_URL/health

# View logs
gcloud run logs read ai-job-tracker --region us-central1
```

### 8.2 Test Frontend

```bash
# Visit https://your-frontend-url
# Login with Google account
# Create a test application
# Verify AI recommendation appears
# Check Firestore console for data
```

### 8.3 Monitor Costs

```bash
# View Cloud Billing dashboard
# Set up budget alerts for:
# - Cloud Run
# - Firestore
# - Cloud Storage
# - Cloud Tasks
```

## Phase 9: Ongoing Maintenance

### Regular Updates

```bash
# Pull latest code
git pull origin main

# Rebuild and push image
docker build -t us-central1-docker.pkg.dev/PROJECT_ID/ai-job-tracker/ai-job-tracker:latest .
docker push us-central1-docker.pkg.dev/PROJECT_ID/ai-job-tracker/ai-job-tracker:latest

# Deploy new version (CI/CD will do this automatically)
gcloud run deploy ai-job-tracker --image us-central1-docker.pkg.dev/PROJECT_ID/ai-job-tracker/ai-job-tracker:latest
```

### Backup Firestore

```bash
# Enable automated backups in Firestore console
# Or manual export:
gcloud firestore export gs://job-tracker-backups-PROJECT_ID/
```

### Monitor Performance

```bash
# View metrics
gcloud monitoring dashboards create --config-from-file=monitoring-config.json

# Set up alerts
gcloud alpha monitoring policies create \
  --notification-channels=CHANNEL_ID \
  --display-name="Cloud Run Error Rate" \
  --condition-display-name="High error rate"
```

## Troubleshooting

### Cloud Run deployment fails
```bash
# Check logs
gcloud run logs read ai-job-tracker --region us-central1 --limit 100

# Verify service account permissions
gcloud projects get-iam-policy PROJECT_ID \
  --flatten="bindings[].members" \
  --filter="bindings.members:serviceAccount:ai-job-tracker*"
```

### Firestore write errors
```bash
# Check security rules
gcloud firestore security-rules describe

# Verify service account has datastore.user role
gcloud projects get-iam-policy PROJECT_ID \
  --flatten="bindings[].members" \
  --filter="bindings.members:serviceAccount:ai-job-tracker*"
```

### API authentication errors
```bash
# Verify OAuth credentials
gcloud auth application-default print-access-token

# Check client ID and secret
gcloud services oauth-consentscreen describe
```

## Support

For deployment issues, check:
1. GCP logs in Cloud Run console
2. Cloud Build history
3. GitHub Actions workflow runs
4. Firestore database status

---

**Happy deploying! 🚀**
