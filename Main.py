from fastapi import FastAPI, HTTPException, Depends, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timedelta
import os
from google.cloud import firestore, storage, tasks_v2
from google.oauth2 import id_token
from google.auth.transport import requests
import google.generativeai as genai
import json
import base64

app = FastAPI(title="AI Job Application Tracker")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# GCP Initialization
db = firestore.client()
storage_client = storage.Client()
tasks_client = tasks_v2.CloudTasksClient()
genai.configure(api_key=os.getenv("GEMINI_API_KEY"))

# OAuth2
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

# Pydantic Models
class Application(BaseModel):
    company: str
    role: str
    job_url: str
    applied_date: str
    resume_used: Optional[str] = None
    status: str = "applied"
    notes: Optional[str] = None

class User(BaseModel):
    email: str
    name: str

class ApplicationResponse(Application):
    id: str
    created_at: str
    ai_recommendation: Optional[str] = None

# Helper Functions
async def verify_token(token: str = Depends(oauth2_scheme)) -> str:
    """Verify Google OAuth token and return user email"""
    try:
        idinfo = id_token.verify_oauth2_token(
            token, requests.Request(), os.getenv("GOOGLE_CLIENT_ID")
        )
        return idinfo["email"]
    except Exception as e:
        raise HTTPException(status_code=401, detail="Invalid token")

def redact_pii(text: str) -> str:
    """Redact sensitive information before sending to Gemini"""
    import re
    text = re.sub(r'\b[\w\.-]+@[\w\.-]+\.\w+\b', '[EMAIL]', text)
    text = re.sub(r'\b\d{3}-\d{2}-\d{4}\b', '[SSN]', text)
    text = re.sub(r'\b\d{10}\b', '[PHONE]', text)
    return text

async def analyze_with_gemini(role: str, company: str, resume_text: str) -> str:
    """Use Gemini to analyze job fit and generate recommendations"""
    try:
        redacted_resume = redact_pii(resume_text)
        prompt = f"""
        Job Role: {role}
        Company: {company}
        Resume (redacted): {redacted_resume[:2000]}
        
        Provide a brief, actionable recommendation (2-3 sentences) for this application. 
        Focus on: fit assessment, follow-up timing, and key talking points.
        """
        model = genai.GenerativeModel('gemini-pro')
        response = model.generate_content(prompt)
        return response.text
    except Exception as e:
        return f"Analysis pending: {str(e)}"

async def schedule_reminder(user_email: str, app_id: str, delay_days: int = 3):
    """Schedule a follow-up reminder using Cloud Tasks"""
    try:
        project = os.getenv("GCP_PROJECT_ID")
        queue = os.getenv("CLOUD_TASKS_QUEUE", "job-reminders")
        location = os.getenv("GCP_REGION", "us-central1")
        
        parent = tasks_client.queue_path(project, location, queue)
        task = {
            "http_request": {
                "http_method": tasks_v2.HttpMethod.POST,
                "url": os.getenv("REMINDER_WEBHOOK_URL"),
                "headers": {"Content-Type": "application/json"},
                "body": json.dumps({"user_email": user_email, "app_id": app_id}).encode(),
            },
            "schedule_time": {
                "seconds": int((datetime.now() + timedelta(days=delay_days)).timestamp())
            },
        }
        tasks_client.create_task(request={"parent": parent, "task": task})
    except Exception as e:
        print(f"Error scheduling reminder: {e}")

# Routes
@app.get("/health")
async def health():
    return {"status": "ok"}

@app.post("/auth/login")
async def login(token: str):
    """Verify OAuth token and create/update user"""
    email = await verify_token(token)
    user_doc = db.collection("users").document(email)
    user_doc.set({"email": email, "last_login": datetime.now().isoformat()}, merge=True)
    return {"email": email, "status": "authenticated"}

@app.post("/applications", response_model=ApplicationResponse)
async def create_application(
    app: Application,
    resume_file: Optional[UploadFile] = None,
    user_email: str = Depends(verify_token)
):
    """Create a new job application"""
    try:
        app_data = app.dict()
        app_data["user_email"] = user_email
        app_data["created_at"] = datetime.now().isoformat()
        
        # Handle resume upload
        resume_text = ""
        if resume_file:
            content = await resume_file.read()
            resume_text = content.decode('utf-8') if isinstance(content, bytes) else content
            
            # Store in Cloud Storage
            bucket = storage_client.bucket(os.getenv("GCS_BUCKET"))
            blob = bucket.blob(f"resumes/{user_email}/{resume_file.filename}")
            blob.upload_from_string(content, content_type=resume_file.content_type)
            app_data["resume_path"] = blob.public_url
        
        # Get AI recommendation
        if resume_text or app.resume_used:
            ai_rec = await analyze_with_gemini(
                app.role, 
                app.company, 
                resume_text or app.resume_used
            )
            app_data["ai_recommendation"] = ai_rec
        
        # Save to Firestore
        doc_ref = db.collection("users").document(user_email).collection("applications").add(app_data)
        app_id = doc_ref[1].id
        
        # Schedule reminder
        await schedule_reminder(user_email, app_id)
        
        return {**app_data, "id": app_id}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/applications", response_model=List[ApplicationResponse])
async def list_applications(user_email: str = Depends(verify_token)):
    """List all applications for user"""
    try:
        apps = db.collection("users").document(user_email).collection("applications").stream()
        result = []
        for app in apps:
            data = app.to_dict()
            data["id"] = app.id
            result.append(data)
        return result
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/applications/{app_id}", response_model=ApplicationResponse)
async def get_application(app_id: str, user_email: str = Depends(verify_token)):
    """Get single application"""
    try:
        doc = db.collection("users").document(user_email).collection("applications").document(app_id).get()
        if not doc.exists:
            raise HTTPException(status_code=404, detail="Application not found")
        data = doc.to_dict()
        data["id"] = doc.id
        return data
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.put("/applications/{app_id}")
async def update_application(
    app_id: str,
    app: Application,
    user_email: str = Depends(verify_token)
):
    """Update application status/notes"""
    try:
        app_data = app.dict(exclude_unset=True)
        app_data["updated_at"] = datetime.now().isoformat()
        db.collection("users").document(user_email).collection("applications").document(app_id).update(app_data)
        return {"status": "updated", "id": app_id}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.delete("/applications/{app_id}")
async def delete_application(app_id: str, user_email: str = Depends(verify_token)):
    """Delete application"""
    try:
        db.collection("users").document(user_email).collection("applications").document(app_id).delete()
        return {"status": "deleted", "id": app_id}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/analytics")
async def get_analytics(user_email: str = Depends(verify_token)):
    """Get application analytics"""
    try:
        apps = db.collection("users").document(user_email).collection("applications").stream()
        stats = {"total": 0, "by_status": {}, "by_company": {}}
        
        for app in apps:
            data = app.to_dict()
            stats["total"] += 1
            status = data.get("status", "unknown")
            stats["by_status"][status] = stats["by_status"].get(status, 0) + 1
            company = data.get("company", "unknown")
            stats["by_company"][company] = stats["by_company"].get(company, 0) + 1
        
        return stats
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
