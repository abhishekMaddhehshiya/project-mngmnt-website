# PixelForge Nexus

A secure project management system with React frontend and Node.js/Express backend.

## Prerequisites

- Node.js (v18 or higher)
- MongoDB (local or Atlas connection)
- npm or yarn

## Setup

### 1. Clone the repository

```bash
git clone <repository-url>
cd megaassignment
```

### 2. Backend Setup

```bash
cd backend
npm install
```

Create a `.env` file in the `backend` folder with the following variables:

```env
NODE_ENV=development
PORT=5000
MONGODB_URI=mongodb://localhost:27017/pixelforge
JWT_SECRET=your_jwt_secret_key
JWT_REFRESH_SECRET=your_jwt_refresh_secret_key
JWT_EXPIRATION=15m
JWT_REFRESH_EXPIRATION=7d
BCRYPT_ROUNDS=10
CORS_ORIGIN=http://localhost:3000
UPLOAD_DIR=./uploads
MAX_FILE_SIZE=5242880
ALLOWED_FILE_TYPES=pdf,doc,docx,txt
```

### 3. Frontend Setup

```bash
cd frontend
npm install
```

### 4. Create Admin User

Since there is no signup functionality, you need to create an admin user directly in MongoDB.

**Option A: Using MongoDB Shell (mongosh)**

```javascript
use pixelforge

db.users.insertOne({
  username: "admin@example.com",
  email: "admin@example.com",
  password: "$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy", // password: "Admin123!@#"
  role: "admin",
  fullName: "Admin User",
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date()
})
```

**Option B: Using a script**

Create a file `createAdmin.js` in the backend folder:

```javascript
import mongoose from 'mongoose';
import bcryptjs from 'bcryptjs';
import dotenv from 'dotenv';

dotenv.config();

const createAdmin = async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  
  const hashedPassword = await bcryptjs.hash('YourSecurePassword123!', 10);
  
  await mongoose.connection.db.collection('users').insertOne({
    username: 'admin@example.com',
    email: 'admin@example.com',
    password: hashedPassword,
    role: 'admin',
    fullName: 'Admin User',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date()
  });
  
  console.log('Admin user created!');
  process.exit(0);
};

createAdmin();
```

Run with: `node createAdmin.js`

## Running the Application

### Start Backend Server

```bash
cd backend
npm run dev    # Development mode with hot reload
# or
npm start      # Production mode
```

The backend server will run on `http://localhost:5000`

### Start Frontend Server

```bash
cd frontend
npm start
```

The frontend will run on `http://localhost:3000`

## Available Scripts

### Backend

| Command | Description |
|---------|-------------|
| `npm start` | Start the server |
| `npm run dev` | Start with nodemon (hot reload) |
| `npm test` | Run all tests |
| `npm run test:auth` | Run authentication tests |
| `npm run test:security` | Run security tests |

### Frontend

| Command | Description |
|---------|-------------|
| `npm start` | Start development server |
| `npm run build` | Build for production |
| `npm test` | Run tests |

## Project Structure

```
megaassignment/
├── backend/
│   ├── config/         # Configuration files
│   ├── controllers/    # Route controllers
│   ├── middleware/     # Express middleware
│   ├── models/         # Mongoose models
│   ├── routes/         # API routes
│   ├── utils/          # Utility functions
│   └── server.js       # Entry point
├── frontend/
│   ├── public/         # Static files
│   └── src/
│       ├── components/ # React components
│       ├── pages/      # Page components
│       ├── lib/        # API utilities
│       └── store/      # State management
```

## Tech Stack

**Backend:**
- Express.js
- MongoDB with Mongoose
- JWT Authentication
- Bcrypt for password hashing
- Helmet for security headers

**Frontend:**
- React 18
- React Router
- Zustand (state management)
- Axios (HTTP client)
