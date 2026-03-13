# SafeSight – Deep Fake & Sensitive Image Detection System

## Project Overview

SafeSight is an AI-powered web application that detects whether an uploaded image is **AI-generated (deepfake) or a real human image** and also checks if the image contains **sensitive or harmful content** such as violence, adult content, or harassment.

The system helps prevent harmful or misleading images from being uploaded to online platforms.

---

## Features

* **Deep Fake Detection** – Identifies whether an image is AI-generated or real.
* **Sensitive Content Detection** – Detects adult, violent, or inappropriate images.
* **Image Upload Interface** – Users can upload images easily through the web interface.
* **Real-Time Analysis** – The system analyzes images instantly and returns results.
* **Confidence Score** – Displays AI detection confidence levels.

---

## Technologies Used

* Frontend: React + TypeScript
* Build Tool: Vite
* UI Framework: Tailwind CSS + shadcn-ui
* Backend: Supabase Edge Functions
* Image Analysis: Google Cloud Vision API

---

## Project Architecture

1. User uploads an image through the web interface.
2. The image is sent to a backend Edge Function.
3. The backend calls Google Cloud Vision API for:

   * SafeSearch detection (sensitive content)
   * Label detection (AI generation heuristic)
4. The system returns:

   * AI Generated / Real Image
   * Confidence Score
   * Sensitive Content Warning

---

## Installation & Setup

### 1. Clone the repository

```
git clone <YOUR_GITHUB_REPO_URL>
```

### 2. Navigate to the project directory

```
cd safe-sight
```

### 3. Install dependencies

```
npm install
```

### 4. Start the development server

```
npm run dev
```

Open the application in your browser:

```
http://localhost:8080
```

---

## Environment Variables

Create a `.env` file and add:

```
VITE_SUPABASE_PROJECT_ID=your_project_id
VITE_SUPABASE_PUBLISHABLE_KEY=your_publishable_key
VITE_SUPABASE_URL=your_supabase_url
```

---

## Future Improvements

* Integrate a **real deepfake detection ML model**
* Improve AI detection accuracy
* Add video deepfake detection
* Add user authentication
* Build an admin moderation dashboard

---

## Author

Adepu Prasanna
B.Tech – Computer Science Engineering
