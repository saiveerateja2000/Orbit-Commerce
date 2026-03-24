-- OrbitCommerce – PostgreSQL initialization script
-- Creates one database per microservice.
-- This file is executed once when the postgres container is first started.

\connect postgres

CREATE DATABASE user_db;
CREATE DATABASE product_db;
CREATE DATABASE order_db;
CREATE DATABASE payment_db;
CREATE DATABASE notification_db;

-- Grant the application user full access to each database
GRANT ALL PRIVILEGES ON DATABASE user_db         TO orbit;
GRANT ALL PRIVILEGES ON DATABASE product_db      TO orbit;
GRANT ALL PRIVILEGES ON DATABASE order_db        TO orbit;
GRANT ALL PRIVILEGES ON DATABASE payment_db      TO orbit;
GRANT ALL PRIVILEGES ON DATABASE notification_db TO orbit;
