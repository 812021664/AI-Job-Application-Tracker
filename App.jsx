import React, { useState, useEffect } from 'react';
import { GoogleLogin } from '@react-oauth/google';
import axios from 'axios';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:8000';

export default function App() {
  const [user, setUser] = useState(null);
  const [applications, setApplications] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [analytics, setAnalytics] = useState(null);
  const [formData, setFormData] = useState({
    company: '',
    role: '',
    job_url: '',
    applied_date: new Date().toISOString().split('T')[0],
    notes: '',
  });
  const [resumeFile, setResumeFile] = useState(null);

  const api = axios.create({
    baseURL: API_BASE,
    headers: {
      Authorization: `Bearer ${user?.credential}`,
    },
  });

  useEffect(() => {
    if (user?.credential) {
      fetchApplications();
      fetchAnalytics();
    }
  }, [user]);

  const handleLoginSuccess = (credentialResponse) => {
    setUser({ credential: credentialResponse.credential });
    localStorage.setItem('auth_token', credentialResponse.credential);
  };

  const handleLoginFailure = () => {
    console.error('Login failed');
  };

  const fetchApplications = async () => {
    try {
      const response = await api.get('/applications', {
        headers: { Authorization: `Bearer ${user?.credential}` },
      });
      setApplications(response.data);
    } catch (error) {
      console.error('Failed to fetch applications:', error);
    }
  };

  const fetchAnalytics = async () => {
    try {
      const response = await api.get('/analytics', {
        headers: { Authorization: `Bearer ${user?.credential}` },
      });
      setAnalytics(response.data);
    } catch (error) {
      console.error('Failed to fetch analytics:', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const formDataToSend = new FormData();
      Object.keys(formData).forEach((key) => {
        formDataToSend.append(key, formData[key]);
      });
      if (resumeFile) {
        formDataToSend.append('resume_file', resumeFile);
      }

      const response = await api.post('/applications', formDataToSend, {
        headers: {
          'Content-Type': 'multipart/form-data',
          Authorization: `Bearer ${user?.credential}`,
        },
      });

      setApplications([...applications, response.data]);
      setFormData({
        company: '',
        role: '',
        job_url: '',
        applied_date: new Date().toISOString().split('T')[0],
        notes: '',
      });
      setResumeFile(null);
      setShowForm(false);
      fetchAnalytics();
    } catch (error) {
      console.error('Failed to create application:', error);
    }
  };

  const updateStatus = async (appId, newStatus) => {
    try {
      await api.put(`/applications/${appId}`, { status: newStatus }, {
        headers: { Authorization: `Bearer ${user?.credential}` },
      });
      fetchApplications();
      fetchAnalytics();
    } catch (error) {
      console.error('Failed to update application:', error);
    }
  };

  const deleteApp = async (appId) => {
    try {
      await api.delete(`/applications/${appId}`, {
        headers: { Authorization: `Bearer ${user?.credential}` },
      });
      setApplications(applications.filter((app) => app.id !== appId));
      fetchAnalytics();
    } catch (error) {
      console.error('Failed to delete application:', error);
    }
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-r from-blue-600 to-purple-600">
        <div className="bg-white p-8 rounded-lg shadow-xl text-center">
          <h1 className="text-4xl font-bold mb-4">Job Application Tracker</h1>
          <p className="text-gray-600 mb-6">AI-powered job search management</p>
          <GoogleLogin onSuccess={handleLoginSuccess} onError={handleLoginFailure} />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900">Job Application Tracker</h1>
          <button
            onClick={() => setShowForm(!showForm)}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            {showForm ? 'Cancel' : 'New Application'}
          </button>
        </div>

        {/* Stats */}
        {analytics && (
          <div className="grid grid-cols-3 gap-4 mb-8">
            <div className="bg-white p-4 rounded-lg shadow">
              <p className="text-gray-600 text-sm">Total Applications</p>
              <p className="text-3xl font-bold text-blue-600">{analytics.total}</p>
            </div>
            <div className="bg-white p-4 rounded-lg shadow">
              <p className="text-gray-600 text-sm">Applied</p>
              <p className="text-3xl font-bold text-green-600">{analytics.by_status?.applied || 0}</p>
            </div>
            <div className="bg-white p-4 rounded-lg shadow">
              <p className="text-gray-600 text-sm">Companies</p>
              <p className="text-3xl font-bold text-purple-600">{Object.keys(analytics.by_company || {}).length}</p>
            </div>
          </div>
        )}

        {/* Form */}
        {showForm && (
          <div className="bg-white p-6 rounded-lg shadow-lg mb-8">
            <form onSubmit={handleSubmit}>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <input
                  type="text"
                  placeholder="Company"
                  value={formData.company}
                  onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                  required
                  className="p-3 border border-gray-300 rounded-lg"
                />
                <input
                  type="text"
                  placeholder="Job Role"
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  required
                  className="p-3 border border-gray-300 rounded-lg"
                />
                <input
                  type="url"
                  placeholder="Job URL"
                  value={formData.job_url}
                  onChange={(e) => setFormData({ ...formData, job_url: e.target.value })}
                  required
                  className="p-3 border border-gray-300 rounded-lg"
                />
                <input
                  type="date"
                  value={formData.applied_date}
                  onChange={(e) => setFormData({ ...formData, applied_date: e.target.value })}
                  className="p-3 border border-gray-300 rounded-lg"
                />
              </div>
              <textarea
                placeholder="Notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className="w-full p-3 border border-gray-300 rounded-lg mb-4"
              />
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">Upload Resume (PDF/TXT)</label>
                <input
                  type="file"
                  onChange={(e) => setResumeFile(e.target.files[0])}
                  className="p-3 border border-gray-300 rounded-lg w-full"
                />
              </div>
              <button
                type="submit"
                className="w-full px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Add Application
              </button>
            </form>
          </div>
        )}

        {/* Applications List */}
        <div className="space-y-4">
          {applications.map((app) => (
            <div key={app.id} className="bg-white p-6 rounded-lg shadow-lg">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">{app.role}</h2>
                  <p className="text-gray-600">{app.company}</p>
                </div>
                <select
                  value={app.status}
                  onChange={(e) => updateStatus(app.id, e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg"
                >
                  <option>applied</option>
                  <option>interview</option>
                  <option>rejected</option>
                  <option>offer</option>
                </select>
              </div>
              <p className="text-sm text-gray-500 mb-3">Applied: {app.applied_date}</p>
              {app.notes && <p className="text-gray-700 mb-3">{app.notes}</p>}
              {app.ai_recommendation && (
                <div className="bg-blue-50 p-3 rounded-lg mb-3">
                  <p className="text-sm font-semibold text-blue-900">AI Recommendation:</p>
                  <p className="text-sm text-blue-800">{app.ai_recommendation}</p>
                </div>
              )}
              <div className="flex gap-2">
                <a
                  href={app.job_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline"
                >
                  View Job
                </a>
                <button
                  onClick={() => deleteApp(app.id)}
                  className="text-red-600 hover:underline"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
