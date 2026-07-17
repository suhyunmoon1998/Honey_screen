-- Resync the fictional staff/admin login accounts' password hash with the
-- current DEV_STAFF_PASSWORD value ("jacklaw123"). The seed script upserts
-- this hash from env on every run, but seeding isn't part of the normal
-- deploy pipeline, so environments seeded before the password was changed
-- were left with a stale hash and could not log in.
UPDATE "StaffUser"
SET "passwordHash" = '70b87dedab9bf8ab5b4fd57693af8fb6dd6f4117850ac2dbac59f6d820f6d8d9ab3015cd977c993635ec4590b805f11c7c6fd3380612afd36d657a12163ff57f'
WHERE email IN ('admin.fictional@jacklaw.example', 'staff.fictional@jacklaw.example');
