# Guest pricing and table slips

## Data and migration

Migration `0006_guest_pricing_and_session_slip` changes only the source prices of
`PORK_BEEF` (adult 339, child 169) and `PORK` (adult 299, child 149). It adds
`child_price_per_person` to packages and `adult_count`, `child_count`, and
`child_price_per_person_snapshot` to table sessions. The existing
`price_per_person_snapshot` remains the adult price snapshot. New totals are
computed by the server from the package prices and both counts.

Historical sessions did not distinguish children. The migration copies their
existing `guest_count` into `adult_count` and leaves `child_count` at zero. Their
child price snapshot stays null. It does not update historical package names,
adult price snapshots, totals, timestamps, QR records, payments, or events.

Back up the production database first. Review `npm run db:migrate:status`, then
apply this forward migration with `npm run db:migrate:deploy` using the production
environment. Run `npm run db:generate`, `npm ci`, and `npm run build` with
`NEXT_PUBLIC_APP_URL=https://qr-order.811544.xyz` set at build time, then restart
the service and verify readiness. Do not run the full seed on production; its
job is to prepare a new local/test database, while this migration changes the
two live package prices precisely.

## Printing

Both slips read the stored session counts and the actual `startedAt` and
`endsAt`. If the session has not started, both times say “ยังไม่เริ่ม”. The date
uses the start date when present, otherwise the original opening date. Dates
use DD-MM-YYYY with a Gregorian year, and times use HH:mm:ss in Asia/Bangkok.
Reprinting leaves the stored counts and times unchanged. Beef QR reprinting
still rotates the token and revokes the previous one; pork slips never create a
QR token. The beef page and rotation API require `QR_REPRINT`; the pork slip
requires `QR_PRINT`. Both pages use no-store privacy headers.

Print CSS responds to 58 mm and 80 mm paper width. Chrome print preview was
checked at both widths. A physical thermal printer, its driver, cutting,
scaling, and QR readability on paper still need a device test before relying on
the printed slips in service.
