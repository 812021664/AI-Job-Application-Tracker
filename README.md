# AI Job Application Tracker

A full-stack application that helps job seekers centralize and track job applications with AI-powered insights using Google Cloud Platform and Gemini AI.

## 🎯 Features

- **Centralized Application Management**: Track all job applications in one place
- **AI-Powered Insights**: Get resume-to-role fit analysis and follow-up recommendations using Gemini
- **Resume Analysis**: Upload resumes for intelligent resume matching
- **Status Tracking**: Track application lifecycle (applied → interview → offer)
- **Analytics Dashboard**: View trends across applications, companies, and statuses
- **Automated Reminders**: Cloud Tasks-powered follow-up reminders
- **Secure Authentication**: OAuth 2.0 with Google Sign-In
- **Privacy-First**: PII redaction before AI processing

## 🏗️ Technical Stack

### Backend
- **Framework**: FastAPI (Python)
- **Authentication**: Google OAuth 2.0
- **Database**: Firebase Firestore (NoSQL)
- **AI**: Google Generative AI (Gemini)
- **File Storage**: Google Cloud Storage
- **Task Scheduler**: Google Cloud Tasks
- **Deployment**: Cloud Run

### Frontend
- **Framework**: React.jsx
- **Authentication**: Google Login SDK
- **HTTP Client**: Axios
- **Styling**: Tailwind CSS
- **Build Tool**: Vite/Create React App

## 📋 Prerequisites

- Python 3.11+
- Node.js 16+
- Google Cloud Account with:
  - Firebase Firestore enabled
  - Cloud Run enabled
  - Cloud Tasks enabled
  - Cloud Storage bucket created
  - Service Account with appropriate permissions
  - Gemini API enabled
  - OAuth 2.0 credentials (Web Application)

## 🚀 Quick Start

### 1. Clone Repository
```bash
git clone https://github.com/your-username/ai-job-tracker.git
cd ai-job-tracker
```

### 2. Backend Setup

#### Create virtual environment
```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

#### Install dependencies
```bash
pip install -r requirements.txt
```

#### Configure environment
```bash
cp .env.example .env
# Edit .env with your GCP credentials:
# - GCP_PROJECT_ID
# - GOOGLE_CLIENT_ID
# - GEMINI_API_KEY
# - GCS_BUCKET
# - GOOGLE_APPLICATION_CREDENTIALS path
```

#### Set GCP credentials
```bash
# Download service account key JSON from GCP Console
export GOOGLE_APPLICATION_CREDENTIALS="path/to/service-account-key.json"
```

#### Run backend locally
```bash
python main.py
# API running at http://localhost:8000
# Docs at http://localhost:8000/docs
```

### 3. Frontend Setup

#### Create React app
```bash
npx create-react-app frontend
cd frontend
```

#### Install dependencies
```bash
npm install axios @react-oauth/google tailwindcss
```

#### Update App.jsx
```bash
cp App.jsx src/
```

#### Configure environment
```bash
# Create .env in frontend directory
REACT_APP_API_URL=http://localhost:8000
REACT_APP_GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
```

#### Run frontend
```bash
npm start
# App running at http://localhost:3000
```

## 📚 API Endpoints

### Authentication
- `POST /auth/login` - Verify OAuth token and create user

### Applications
- `POST /applications` - Create new application
- `GET /applications` - List all user applications
- `GET /applications/{app_id}` - Get single application
- `PUT /applications/{app_id}` - Update application
- `DELETE /applications/{app_id}` - Delete application

### Analytics
- `GET /analytics` - Get application statistics

### Health
- `GET /health` - Health check endpoint

## 🔐 Security Features

- OAuth 2.0 authentication (no passwords stored)
- PII redaction before Gemini API calls
- Firestore security rules per user
- Cloud Storage signed URLs
- Rate limiting per user
- Regional database replicas for availability
- CORS protection
- HTTPS enforcement in production

## 🐳 Docker Deployment

### Build image
```bash
docker build -t ai-job-tracker:latest .
```

### Run container
```bash
docker run -e GOOGLE_APPLICATION_CREDENTIALS=/app/key.json \
           -e GCP_PROJECT_ID=your-project \
           -e GEMINI_API_KEY=your-key \
           -e GCS_BUCKET=your-bucket \
           -v /path/to/key.json:/app/key.json \
           -p 8080:8080 \
           ai-job-tracker:latest
```

## ☁️ Cloud Run Deployment

### Build and push to Artifact Registry
```bash
gcloud builds submit --tag gcr.io/YOUR_PROJECT/ai-job-tracker
```

### Deploy to Cloud Run
```bash
gcloud run deploy ai-job-tracker \
  --image gcr.io/YOUR_PROJECT/ai-job-tracker:latest \
  --platform managed \
  --region us-central1 \
  --memory 512Mi \
  --allow-unauthenticated \
  --set-env-vars GEMINI_API_KEY=YOUR_KEY,GCS_BUCKET=YOUR_BUCKET,GCP_PROJECT_ID=YOUR_PROJECT
```

### Set up Cloud Tasks Queue
```bash
gcloud tasks queues create job-reminders \
  --location us-central1
```

## 📊 Database Schema (Firestore)

```
users/
  {user_email}/
    - email: string
    - last_login: timestamp
    applications/
      {app_id}/
        - company: string
        - role: string
        - job_url: string
        - applied_date: date
        - resume_path: string (GCS URL)
        - status: string (applied|interview|rejected|offer)
        - notes: string
        - ai_recommendation: string
        - created_at: timestamp
        - updated_at: timestamp
```

## 🔄 Application Flow

1. User logs in with Google OAuth
2. User submits job application with optional resume
3. System stores application in Firestore
4. Gemini AI analyzes resume vs job description
5. AI recommendation displayed to user
6. Cloud Tasks schedules follow-up reminder (3 days)
7. User can track status and update notes
8. Analytics dashboard shows trends and insights

## 🛠️ Development Workflow

### Running tests
```bash
pytest tests/
```

### Linting
```bash
pylint main.py
```

### Format code
```bash
black main.py
```

## 📝 Environment Variables Reference

| Variable | Description | Required |
|----------|-------------|----------|
| GCP_PROJECT_ID | Google Cloud project ID | ✅ |
| GOOGLE_CLIENT_ID | OAuth client ID | ✅ |
| GEMINI_API_KEY | Google Generative AI API key | ✅ |
| GCS_BUCKET | Cloud Storage bucket for resumes | ✅ |
| GCP_REGION | GCP region (default: us-central1) | ❌ |
| CLOUD_TASKS_QUEUE | Cloud Tasks queue name | ❌ |
| REMINDER_WEBHOOK_URL | Webhook URL for reminders | ❌ |

## 🐛 Troubleshooting

### Gemini API errors
- Verify API is enabled in GCP Console
- Check API quota limits
- Ensure API key is valid

### Firestore access denied
- Check service account permissions
- Verify Firestore security rules
- Confirm project ID is correct

### OAuth token issues
- Clear browser cookies/cache
- Verify client ID matches
- Check token expiration

## 📖 Additional Resources

- [FastAPI Documentation](https://fastapi.tiangolo.com/)
- [Google Cloud Platform](https://cloud.google.com/)
- [Firestore Documentation](https://firebase.google.com/docs/firestore)
- [Gemini AI Documentation](https://ai.google.dev/)

## 📄 License

MIT License - see LICENSE file for details

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📧 Support

For issues and questions, please open a GitHub issue or contact the maintainers.

---

**Built for Code Kitchen Season 01** 🚀
