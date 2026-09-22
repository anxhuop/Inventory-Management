# Inventory Management with PostgreSQL

1. Install PostgreSQL and create a database called `inventory_management`.
2. In the `outputs` folder, copy `.env.example` to `.env` and replace `your_password`.
3. Run the schema: `psql -U postgres -d inventory_management -f schema.sql`
4. Install packages: `npm install`
5. Start the app: `npm start`
6. Open `http://localhost:3000/staff.html` for staff, or `http://localhost:3000/admin.html` for admin.

The first time the staff page loads with an empty database, it imports the products saved in the old browser version. Sales can be added through `POST /api/sales`; every sale reduces stock and becomes visible in the admin reports.
