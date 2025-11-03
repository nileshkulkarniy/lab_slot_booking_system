# Lab Slot Booking System

A comprehensive web application for managing laboratory slot bookings in educational institutions. This system allows administrators to manage labs, slots, and users, while faculty members can book and manage their lab reservations.

## Table of Contents

- [Features](#features)
- [Technology Stack](#technology-stack)
- [Project Structure](#project-structure)
- [Installation](#installation)
- [Configuration](#configuration)
- [Running the Application](#running-the-application)
- [API Endpoints](#api-endpoints)
- [Database Schema](#database-schema)
- [Frontend Pages](#frontend-pages)
- [Development](#development)
- [Deployment](#deployment)
  - [Production Environment](#production-environment)
  - [Bcrypt Deployment Issue Resolution](#bcrypt-deployment-issue-resolution)
  - [Hosting Options](#hosting-options)
  - [GitHub Deployment](#github-deployment)
  - [Heroku Deployment](#heroku-deployment)
  - [Vercel Deployment](#vercel-deployment)
- [Contributing](#contributing)
- [Author](#author)
- [License](#license)

## Features

### Administrator Features
- User management (faculty accounts)
- Lab management (create, update, delete labs)
- Slot management (define time slots for labs)
- Booking oversight (view, manage all bookings)
- Reporting and analytics
- Export data in PDF format

### Faculty Features
- Account registration and authentication
- Browse available labs
- View lab schedules and availability
- Book lab slots
- Manage personal bookings (view, cancel)
- Profile management

### System Features
- Real-time slot availability
- Automatic slot status updates (available/booked)
- Role-based access control
- Secure authentication with JWT
- Responsive web design
- Data validation and error handling
- Global slot conflict prevention (only one slot per time period across all labs)

## Technology Stack

- **Backend**: Node.js, Express.js
- **Database**: MongoDB with Mongoose ODM
- **Frontend**: HTML5, CSS3, JavaScript (Vanilla)
- **Authentication**: JWT (JSON Web Tokens)
- **Password Security**: Bcrypt
- **Email Service**: Nodemailer
- **Environment Management**: Dotenv

## Project Structure

```
Lab Slot Booking System/
├── config/                 # Database configuration
├── controllers/            # Request handlers
├── frontend/public/        # Static frontend files
│   ├── css/               # Stylesheets
│   ├── js/                # Client-side JavaScript
│   ├── images/            # Image assets
│   └── *.html             # HTML pages
├── Middlewares/            # Authentication middleware
├── models/                 # Database models
├── routes/                 # API route definitions
├── utils/                  # Utility functions
├── .env                    # Environment variables
├── package.json            # Project dependencies
└── server.js               # Entry point
```

## Installation

1. Clone the repository:
```bash
git clone https://github.com/nileshkulkarniy/lab_slot_booking_system.git
cd lab_slot_booking_system
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables (see [Configuration](#configuration))

## Configuration

Create a `.env` file in the root directory with the following variables:

```env
# Server Configuration
PORT=5002
NODE_ENV=development

# Database Configuration
MONGO_URI=mongodb://localhost:27017/labslotbooking

# JWT Configuration
JWT_SECRET=your_jwt_secret_key
JWT_EXPIRE=30d

# Email Configuration (optional)
EMAIL_HOST=smtp.example.com
EMAIL_PORT=587
EMAIL_USER=your_email@example.com
EMAIL_PASS=your_email_password
```

## Running the Application

1. Make sure MongoDB is running on your system

2. Start the development server:
```bash
npm start
```

3. Open your browser and navigate to `http://localhost:5002`

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new faculty
- `POST /api/auth/login` - Faculty login
- `POST /api/auth/forgot-password` - Forgot password
- `PUT /api/auth/reset-password/:token` - Reset password

### Admin Routes
- `POST /api/admin/register` - Register new admin
- `POST /api/admin/login` - Admin login
- `GET /api/admin/labs` - Get all labs
- `POST /api/admin/labs` - Create new lab
- `PUT /api/admin/labs/:id` - Update lab
- `DELETE /api/admin/labs/:id` - Delete lab
- `GET /api/admin/users` - Get all users
- `PUT /api/admin/users/:id` - Update user
- `DELETE /api/admin/users/:id` - Delete user

### Lab Routes
- `GET /api/labs` - Get all active labs
- `GET /api/labs/:id` - Get specific lab

### Slot Routes
- `GET /api/slots` - Get all slots
- `GET /api/slots/lab/:labId` - Get slots for specific lab
- `POST /api/slots` - Create new slot (admin only)
- `PUT /api/slots/:id` - Update slot (admin only)
- `DELETE /api/slots/:id` - Delete slot (admin only)

### Booking Routes
- `GET /api/bookings` - Get all bookings (admin)
- `GET /api/bookings/my-bookings` - Get faculty's bookings
- `POST /api/bookings` - Create new booking
- `DELETE /api/bookings/:id` - Cancel booking

### Reports
- `GET /api/reports/export-pdf` - Export bookings as PDF

## Database Schema

### User
- `name`: String (required)
- `email`: String (required, unique)
- `password`: String (required, hashed)
- `role`: String (enum: 'faculty', 'admin')
- `profilePicture`: String (optional)
- `isActive`: Boolean (default: true)

### Lab
- `name`: String (required, unique when active)
- `description`: String
- `capacity`: Number (default: 30)
- `location`: String
- `equipment`: Array of Strings
- `isActive`: Boolean (default: true)

### Slot
- `lab`: ObjectId (reference to Lab)
- `date`: Date (required)
- `startTime`: String (required, HH:MM format)
- `endTime`: String (required, HH:MM format)
- `capacity`: Number (copied from lab)
- `bookedCount`: Number (default: 0)
- `status`: String (enum: 'available', 'booked', 'cancelled')
- `isActive`: Boolean (default: true)
- **Note**: Slots have a unique constraint on date, startTime, and endTime to prevent global conflicts across all labs

### Booking
- `faculty`: ObjectId (reference to User)
- `slot`: ObjectId (reference to Slot)
- `status`: String (enum: 'booked', 'cancelled', 'completed', 'no-show')
- `notes`: String
- `bookedAt`: Date (default: now)
- `cancelledAt`: Date

## Frontend Pages

### Public Pages
- `index.html` - Landing page with role selection
- `faculty-login.html` - Faculty login
- `faculty-register.html` - Faculty registration
- `faculty-forgot-password.html` - Faculty password reset
- `admin-login.html` - Admin login
- `admin-register.html` - Admin registration
- `admin-forgot-password.html` - Admin password reset

### Faculty Pages
- `faculty-dashboard.html` - Faculty dashboard
- `Available-labs-faculty.html` - Browse available labs
- `book-slot.html` - Book a lab slot
- `my-bookings.html` - View personal bookings
- `faculty-profile.html` - Profile management

### Admin Pages
- `admin-dashboard.html` - Admin dashboard
- `manage-labs.html` - Lab management
- `manage-slots.html` - Slot management
- `manage-users.html` - User management
- `view-bookings.html` - View all bookings
- `admin-reports.html` - Reports and exports

## Development

### Adding New Features

1. Create new routes in the `routes/` directory
2. Implement controllers in the `controllers/` directory
3. Add new models in the `models/` directory if needed
4. Create corresponding frontend pages in `frontend/public/`

### Code Style

- Use consistent naming conventions (camelCase for variables/functions, PascalCase for constructors)
- Follow RESTful API design principles
- Maintain separation of concerns (MVC pattern)
- Write modular, reusable code

## Deployment

### Production Environment

1. Set `NODE_ENV=production` in your environment variables
2. Configure your production MongoDB URI
3. Set strong JWT secret
4. Configure email service for password resets

### Bcrypt Deployment Issue Resolution

When deploying to cloud platforms like Render, you may encounter an `invalid ELF header` error with bcrypt. This happens because bcrypt contains platform-specific binaries that were compiled on your local machine (Windows) but are being executed on a different platform (Linux).

To resolve this issue, we've implemented a postinstall script that automatically rebuilds bcrypt for the target platform during deployment. The solution includes:

1. A postinstall script that runs during npm install
2. Platform detection to only rebuild when deploying to production
3. Automatic rebuilding of bcrypt binaries for the correct architecture

This ensures that bcrypt works correctly across different deployment environments without manual intervention.

### Hosting Options

- Deploy on cloud platforms like Heroku, AWS, or DigitalOcean
- Use MongoDB Atlas for database hosting
- Set up reverse proxy with Nginx (optional)

Example deployment with Heroku:
```bash
heroku create your-app-name
heroku addons:create mongolab:sandbox
git push heroku master
```

### GitHub Deployment

The project has been successfully deployed to GitHub at:
[https://github.com/nileshkulkarniy/lab_slot_booking_system](https://github.com/nileshkulkarniy/lab_slot_booking_system)

To clone the repository:
```bash
git clone https://github.com/nileshkulkarniy/lab_slot_booking_system.git
cd lab_slot_booking_system
npm install
npm start
```

### Heroku Deployment

1. Create a Heroku account at [heroku.com](https://heroku.com)
2. Install the Heroku CLI
3. Login to Heroku CLI:
   ```bash
   heroku login
   ```
4. Create a new Heroku app:
   ```bash
   heroku create your-app-name
   ```
5. Add MongoDB addon:
   ```bash
   heroku addons:create mongolab:sandbox
   ```
6. Set environment variables:
   ```bash
   heroku config:set NODE_ENV=production
   heroku config:set JWT_SECRET=your_strong_jwt_secret
   ```
7. Deploy the application:
   ```bash
   git push heroku main
   ```
8. Open the application:
   ```bash
   heroku open
   ```

### Vercel Deployment

1. Create a Vercel account at [vercel.com](https://vercel.com)
2. Install Vercel CLI:
   ```bash
   npm install -g vercel
   ```
3. Login to Vercel:
   ```bash
   vercel login
   ```
4. Deploy the project:
   ```bash
   vercel
   ```
5. Follow the prompts to configure your project

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a pull request

## Author

**Nilesh Kulkarni**
- Email: knilesh996@gmail.com
- GitHub: [Nilesh Kulkarni](https://github.com/nileshkulkarniy)
- Facebook: [Nilesh Kulkarni](https://www.facebook.com/nileshkulkarniyd)
- Instagram: [Nilesh Kulkarni](https://www.instagram.com/nileshkulkarniy)
- Twitter: [Nilesh Kulkarni](https://twitter.com/nileshkulkarniy)
- LinkedIn: [Nilesh Kulkarni](https://www.linkedin.com/in/nileshkulkarniy)


## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

**Note**: This system was designed for educational institutions to efficiently manage laboratory bookings and reduce administrative overhead.