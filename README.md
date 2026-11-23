# V Spark – E-Gaming Arena

## Live website

https://v-spark-e-gaming-2t32.vercel.app/

## What is V Spark?

V Spark is an online gaming competition website for COMSATS University Islamabad, Vehari Campus.

Students can:

- Create an account
- Register for games
- View match time and result
- Cancel an upcoming registration
- Upload a profile picture
- See the winners board

Admins can:

- Manage games and capacity
- Manage student registrations
- Create and control matches
- Add winners and scores
- Change event date and venue
- Manage other admin accounts

## Games

- Tekken 3
- FIFA
- PUBG Mobile

## Technologies used

- **HTML** – website structure
- **CSS** – design and responsive layout
- **JavaScript** – website actions and API communication
- **Node.js** – backend runtime
- **Express.js** – backend server and API
- **PostgreSQL** – database
- **Supabase** – hosted PostgreSQL database
- **`pg`** – connects Node.js to PostgreSQL
- **GSAP and ScrollTrigger** – scroll animations
- **bcrypt** – password hashing
- **Helmet** – security headers
- **Vercel** – website hosting
- **GitHub** – source code and version control

## Simple architecture

```text
Student/Admin browser
        ↓
Express.js backend on Vercel
        ↓
PostgreSQL database on Supabase
```

The browser talks to the Express backend. The backend talks to Supabase. Database passwords are never sent to the browser.

## Security used

- Passwords are stored as bcrypt hashes.
- SQL queries are parameterized to help prevent SQL injection.
- Students and admins have separate permissions.
- Admin routes are protected on the server.
- Sessions use secure HTTP-only cookies.
- CSRF protection is enabled for form requests.
- Login and signup requests are rate limited.
- Input is validated on the server.
- Secrets are stored in environment variables, not in GitHub.
- User text is escaped before being shown in HTML.

## Run locally

Open PowerShell in the project folder:

```powershell
npm install
npm start
```

Open:

- Website: http://localhost:3000
- Admin panel: http://localhost:3000/admin
- Health check: http://localhost:3000/health

## Environment variables

Create a private `.env` file:

```env
DATABASE_URL=your_supabase_database_url
SESSION_SECRET=your_private_session_secret
ADMIN_USERNAME=admin
ADMIN_PASSWORD=your_admin_password
NODE_ENV=production
```

Never upload `.env` to GitHub.

## Admin login

- Admin page: https://v-spark-e-gaming-2t32.vercel.app/admin
- Username: the value of `ADMIN_USERNAME`
- Password: the value of `ADMIN_PASSWORD`

The admin password is not stored in this README. It is private.

## Easy viva questions

**What is the purpose of this project?**
It manages university gaming registrations, matches, and results online.

**Why did you use PostgreSQL?**
The project has related data such as students, games, registrations, and matches. PostgreSQL manages these relationships reliably.

**Why did you use Supabase?**
Supabase gives us a hosted PostgreSQL database that we can use in production.

**Why did you use Express.js?**
Express makes it easy to create backend routes and APIs with Node.js.

**How are passwords protected?**
Passwords are hashed with bcrypt before they are stored.

**How is the admin panel protected?**
The server checks the user role before allowing access to admin routes.

**How do you stop game overbooking?**
The server uses a database transaction and row lock while checking game capacity.

**Where is the website deployed?**
The website is deployed on Vercel and the database is hosted on Supabase.

## Main files

- `server.js` – Express backend and API routes
- `schema.sql` – PostgreSQL database structure
- `scripts/seed.js` – adds games and the first admin
- `public/index.html` – student website
- `public/admin.html` – admin panel
- `public/app.js` – student-side JavaScript
- `public/admin.js` – admin-side JavaScript
- `public/styles.css` – student website design
- `public/admin.css` – admin panel design
