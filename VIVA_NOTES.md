# V Spark architecture and key rules

The website has two parts. Express serves the public HTML, CSS, and JavaScript from `public/`, and also provides JSON routes. Those routes use the `pg` package to talk directly to Supabase Postgres. The browser never receives the database connection string.

Students create an account with their name, phone, email, CNIC, department, and password. Phone, email, and CNIC are unique in the database. Passwords are stored as bcrypt hashes. A student session is stored in an HTTP-only SameSite cookie. Admin accounts are in a separate table, and each admin route checks the session role on the server.

Game registration takes a transaction and locks the chosen game row. The server counts current registrations while holding that lock, then inserts only if a spot remains. This prevents two simultaneous requests from taking the final spot. Match creation checks that assigned players are registered for the chosen game and rejects any student whose match time overlaps another unfinished match.

Event date, venue, and university name live in the `event_settings` row. Game title, description, capacity, and players per match live in `games`, so an administrator can edit them without changing the site code. The initial admin password comes from `.env` and is hashed during seeding.

The public event page uses pinned GSAP and ScrollTrigger for chapter reveals, with a reduced-motion CSS rule. The admin page stays a plain functional dashboard. `/health` is available for service checks, and Render can start the app with `npm start`.
