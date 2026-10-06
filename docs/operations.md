# Operations and pre-deploy notes

## First OWNER account

After migrations and seed, create the first account interactively:

```bash
npm run staff:create-owner
```

The command does not contain a default username or password. It requires an interactive terminal, hides password input, requires a 12-character minimum password, stores only a bcrypt hash, and assigns the seeded `OWNER` role. Do not pass credentials as command-line arguments or commit them.

## Backup before migration

Take a consistent logical backup before `prisma migrate deploy`. Substitute connection values through a protected environment or secret manager; do not place them in shell history or documents.

```bash
mysqldump --single-transaction --routines --triggers \
  --host="$MYSQL_HOST" --port="$MYSQL_PORT" \
  --user="$MYSQL_USER" --password \
  "$MYSQL_DATABASE" > shabu-buffet-$(date +%Y%m%d-%H%M%S).sql
```

Check migration status, then apply only forward migrations:

```bash
npm run db:migrate:status
npm run db:migrate:deploy
```

Never use `prisma migrate reset` or remove the MySQL volume for a production operation.

Restore to a deliberately selected database after verifying the backup and maintenance plan:

```bash
mysql --host="$MYSQL_HOST" --port="$MYSQL_PORT" \
  --user="$MYSQL_USER" --password "$MYSQL_DATABASE" < backup.sql
```

The application currently supports local image paths and external image URLs as `imageKey`; it does not upload binary files. A production storage provider, bucket policy, upload endpoint, file limits, and malware/content validation must be selected before enabling binary uploads.

QR printing uses the browser's `window.print()` dialog. It has not been verified with a physical printer model in this environment.
