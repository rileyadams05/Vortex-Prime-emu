# Start Backend Server in new window
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd backend; python -m uvicorn server:app --host 0.0.0.0 --port 8000 --reload"

# Wait a moment for backend to start
Start-Sleep -Seconds 2

# Start Frontend Server (blocking - keeps this window open)
cd frontend
npm start
