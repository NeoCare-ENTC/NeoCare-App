# 🫀 NeoCare App - Heart Health Monitoring

A cross-platform React Native application with FastAPI backend for heart health monitoring using PPG (Photoplethysmography) technology.

## 🚀 Quick Start Guide

### Prerequisites
- Node.js (v20+)
- Python (3.8+)
- Docker (optional)
- Expo Go app (for mobile testing)

### 📁 Project Structure
```
NeoCare-App/
├── backend/          # FastAPI Python backend
├── frontend/NeoCareApp/  # React Native Expo frontend
├── .venv/           # Python virtual environment
└── README.md
```

## 🏃‍♂️ Quick Setup (5 minutes)

### 1. Start Backend Server
```bash
# From project root
python backend/main.py
# Backend runs on: http://localhost:8001
```

### 2. Start Frontend App
```bash
# Navigate to frontend
cd frontend/NeoCareApp
npm start
# Scan QR code with Expo Go app or press 'w' for web
```

## 📱 Access Your App

| Platform | URL | Description |
|----------|-----|-------------|
| **Web** | http://localhost:8081 | Browser version |
| **Mobile** | Scan QR code | Expo Go app required |
| **Network** | http://[YOUR-IP]:8081 | Access from other devices |

## ✨ Features

- ✅ **Real-time Connection Testing** - Verify backend connectivity
- ✅ **PPG Heart Rate Processing** - Simulate heart rate calculation  
- ✅ **Cross-platform Support** - Web, iOS, Android
- ✅ **Network Accessibility** - Works across different WiFi networks


## 🔧 Key Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/` | GET | Health check |
| `/process_ppg/` | POST | Process PPG signal |

## 🛠️ Development Commands

```bash
# Backend
pip install fastapi uvicorn numpy
python backend/main.py

# Frontend  
npm install
npm start           # Start development server
npx expo start --web  # Web only
npx expo start --tunnel  # For external access
```

## 📊 Database (Optional)
- PostgreSQL database available via Docker
- pgAdmin interface at http://localhost:8080
- Credentials: admin@neocare.com / admin123

## 🔗 Network Configuration
- Backend: `http://[YOUR-IP]:8001`
- Frontend: `http://[YOUR-IP]:8081`
- Update IP address in `frontend/NeoCareApp/app/(tabs)/index.tsx`


---
Made with ❤️ for health monitoring