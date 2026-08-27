SELECT 'CREATE DATABASE estoca_test'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'estoca_test')
\gexec
