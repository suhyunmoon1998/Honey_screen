import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";
import { getEnv } from "@honey/config";
import { hashPassword, hashToken } from "@honey/domain";

function runCommand(
  command: string,
  args: string[],
  extraEnv: Record<string, string> = {},
) {
  execFileSync(command, args, {
    cwd: process.cwd(),
    env: {
      ...process.env,
      ...extraEnv,
    },
    stdio: "inherit",
  });
}

function toPsqlConnectionUrl(url: URL) {
  const psqlUrl = new URL(url.toString());
  psqlUrl.searchParams.delete("schema");
  return psqlUrl.toString();
}

async function main() {
  const env = getEnv();
  const baseUrl = new URL(env.DATABASE_URL);
  const tempDbName = `honey_task02_upgrade_${Date.now()}`;
  const tempUrl = new URL(baseUrl.toString());
  tempUrl.pathname = `/${tempDbName}`;
  const adminUrl = new URL(baseUrl.toString());
  adminUrl.pathname = "/postgres";

  const tempPrismaDir = mkdtempSync(join(tmpdir(), "honey-task01-prisma-"));
  const task01SqlPath = resolve(
    "packages/db/prisma/migrations/20260710215353_init_task01/migration.sql",
  );
  const fixtureSqlPath = join(tempPrismaDir, "task01-fixtures.sql");

  const fixtureSql = `
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

INSERT INTO "public"."Organization" ("id", "name", "defaultTimeZone", "createdAt")
VALUES ('org_upgrade', 'Upgrade Verification Org', 'America/Los_Angeles', '2026-07-10T00:00:00.000Z');

INSERT INTO "public"."StaffUser" ("id", "organizationId", "email", "displayName", "role", "passwordHash", "allowlisted", "createdAt")
VALUES
  ('staff_admin_upgrade', 'org_upgrade', 'admin.upgrade@jacklaw.example', 'Upgrade Admin', 'ADMIN', '${hashPassword("FictionalPass123!")}', true, '2026-07-10T00:00:00.000Z'),
  ('staff_notify_upgrade', 'org_upgrade', 'staff.upgrade@jacklaw.example', 'Upgrade Staff', 'STAFF', '${hashPassword("FictionalPass123!")}', true, '2026-07-10T00:00:00.000Z');

INSERT INTO "public"."Client" ("id", "organizationId", "phoneE164", "locale", "timeZone", "onboardingCompletedAt", "createdAt", "updatedAt")
VALUES ('client_upgrade', 'org_upgrade', '+15555550155', 'es', 'America/Los_Angeles', '2026-07-10T09:00:00.000Z', '2026-07-10T09:00:00.000Z', '2026-07-10T09:00:00.000Z');

INSERT INTO "public"."Session" ("id", "tokenHash", "actorType", "actorId", "organizationId", "role", "locale", "expiresAt", "createdAt")
VALUES ('session_upgrade', '${hashToken("upgrade-session-token")}', 'CLIENT', 'client_upgrade', 'org_upgrade', 'CLIENT', 'es', '2099-01-01T00:00:00.000Z', '2026-07-10T09:05:00.000Z');

INSERT INTO "public"."ConsentRecord" ("id", "clientId", "consentType", "granted", "policyVersion", "locale", "createdAt")
VALUES
  ('consent_privacy_upgrade', 'client_upgrade', 'PRIVACY_NOTICE', true, '2026-07-10', 'es', '2026-07-10T09:01:00.000Z'),
  ('consent_messages_upgrade', 'client_upgrade', 'TRANSACTIONAL_MESSAGES', true, '2026-07-10', 'es', '2026-07-10T09:01:00.000Z');

INSERT INTO "public"."QuestionDefinition" ("id", "organizationId", "stableKey", "category", "createdAt")
VALUES
  ('qd_upgrade_1', 'org_upgrade', 'upgrade.schedule.hours', 'work_schedule', '2026-07-10T00:00:00.000Z'),
  ('qd_upgrade_2', 'org_upgrade', 'upgrade.meal.missed', 'meal_periods', '2026-07-10T00:00:00.000Z'),
  ('qd_upgrade_3', 'org_upgrade', 'upgrade.offclock.after', 'off_the_clock', '2026-07-10T00:00:00.000Z');

INSERT INTO "public"."QuestionVersion" ("id", "definitionId", "versionNumber", "promptEs", "promptEn", "answerType", "legalReviewStatus", "displayOrder", "createdAt")
VALUES
  ('qv_upgrade_1', 'qd_upgrade_1', 1, 'Pregunta de horario ficticia', 'Fictional schedule question', 'BOOLEAN', 'APPROVED', 1, '2026-07-10T00:00:00.000Z'),
  ('qv_upgrade_2', 'qd_upgrade_2', 1, 'Pregunta de comida ficticia', 'Fictional meal question', 'BOOLEAN', 'APPROVED', 2, '2026-07-10T00:00:00.000Z'),
  ('qv_upgrade_3', 'qd_upgrade_3', 1, 'Pregunta off clock ficticia', 'Fictional off-clock question', 'BOOLEAN', 'APPROVED', 3, '2026-07-10T00:00:00.000Z');

INSERT INTO "public"."Mission" ("id", "organizationId", "clientId", "requestedSize", "state", "locale", "createdAt", "completedAt")
VALUES
  ('mission_active_upgrade', 'org_upgrade', 'client_upgrade', 3, 'ACTIVE', 'es', '2026-07-10T10:00:00.000Z', NULL),
  ('mission_done_upgrade', 'org_upgrade', 'client_upgrade', 3, 'COMPLETED', 'es', '2026-07-09T10:00:00.000Z', '2026-07-09T11:00:00.000Z');

INSERT INTO "public"."MissionSlot" ("id", "missionId", "position", "questionVersionId", "state", "allocatedAt", "answeredAt")
VALUES
  ('slot_active_1', 'mission_active_upgrade', 1, 'qv_upgrade_1', 'ANSWERED', '2026-07-10T10:00:00.000Z', '2026-07-10T10:05:00.000Z'),
  ('slot_active_2', 'mission_active_upgrade', 2, 'qv_upgrade_2', 'ALLOCATED', '2026-07-10T10:00:00.000Z', NULL),
  ('slot_active_3', 'mission_active_upgrade', 3, 'qv_upgrade_3', 'ALLOCATED', '2026-07-10T10:00:00.000Z', NULL),
  ('slot_done_1', 'mission_done_upgrade', 1, 'qv_upgrade_1', 'ANSWERED', '2026-07-09T10:00:00.000Z', '2026-07-09T10:05:00.000Z'),
  ('slot_done_2', 'mission_done_upgrade', 2, 'qv_upgrade_2', 'ANSWERED', '2026-07-09T10:00:00.000Z', '2026-07-09T10:10:00.000Z'),
  ('slot_done_3', 'mission_done_upgrade', 3, 'qv_upgrade_3', 'ANSWERED', '2026-07-09T10:00:00.000Z', '2026-07-09T10:15:00.000Z');

INSERT INTO "public"."AnswerRevision" ("id", "organizationId", "clientId", "missionSlotId", "questionVersionId", "revisionNumber", "valueJson", "idempotencyKey", "createdAt")
VALUES
  ('answer_active_1', 'org_upgrade', 'client_upgrade', 'slot_active_1', 'qv_upgrade_1', 1, 'true', 'slot_active_1:true', '2026-07-10T10:05:00.000Z'),
  ('answer_done_1', 'org_upgrade', 'client_upgrade', 'slot_done_1', 'qv_upgrade_1', 1, 'true', 'slot_done_1:true', '2026-07-09T10:05:00.000Z'),
  ('answer_done_2', 'org_upgrade', 'client_upgrade', 'slot_done_2', 'qv_upgrade_2', 1, 'false', 'slot_done_2:false', '2026-07-09T10:10:00.000Z'),
  ('answer_done_3', 'org_upgrade', 'client_upgrade', 'slot_done_3', 'qv_upgrade_3', 1, 'true', 'slot_done_3:true', '2026-07-09T10:15:00.000Z');

INSERT INTO "public"."AnswerCurrent" ("missionSlotId", "latestRevisionId", "updatedAt")
VALUES
  ('slot_active_1', 'answer_active_1', '2026-07-10T10:05:00.000Z'),
  ('slot_done_1', 'answer_done_1', '2026-07-09T10:05:00.000Z'),
  ('slot_done_2', 'answer_done_2', '2026-07-09T10:10:00.000Z'),
  ('slot_done_3', 'answer_done_3', '2026-07-09T10:15:00.000Z');

INSERT INTO "public"."OutboxEvent" ("id", "organizationId", "eventType", "aggregateType", "aggregateId", "idempotencyKey", "payloadJson", "status", "availableAt", "processedAt", "attemptCount", "createdAt")
VALUES
  ('outbox_upgrade_registration', 'org_upgrade', 'STAFF_IN_APP_NOTIFICATION', 'CLIENT', 'client_upgrade', 'registration:client_upgrade:staff_notify_upgrade', '{"recipientId":"staff_notify_upgrade","type":"CLIENT_REGISTERED"}', 'PENDING', '2026-07-10T09:10:00.000Z', NULL, 0, '2026-07-10T09:10:00.000Z'),
  ('outbox_upgrade_mission', 'org_upgrade', 'STAFF_IN_APP_NOTIFICATION', 'MISSION', 'mission_done_upgrade', 'mission_complete:mission_done_upgrade:staff_notify_upgrade', '{"recipientId":"staff_notify_upgrade","type":"MISSION_COMPLETED"}', 'PROCESSED', '2026-07-09T11:00:00.000Z', '2026-07-09T11:01:00.000Z', 1, '2026-07-09T11:00:00.000Z');

INSERT INTO "public"."InAppNotification" ("id", "organizationId", "recipientId", "type", "title", "body", "sourceEventId", "readAt", "createdAt")
VALUES ('notif_upgrade_1', 'org_upgrade', 'staff_notify_upgrade', 'MISSION_COMPLETED', 'Mision completada', 'Contenido ficticio de notificacion', 'outbox_upgrade_mission', NULL, '2026-07-09T11:01:00.000Z');
`;

  writeFileSync(fixtureSqlPath, fixtureSql);

  let client: PrismaClient | null = null;

  try {
    runCommand("psql", [
      toPsqlConnectionUrl(adminUrl),
      "-v",
      "ON_ERROR_STOP=1",
      "-c",
      `CREATE DATABASE "${tempDbName}"`,
    ]);
    runCommand("psql", [
      toPsqlConnectionUrl(tempUrl),
      "-v",
      "ON_ERROR_STOP=1",
      "-f",
      task01SqlPath,
    ]);
    runCommand(
      "pnpm",
      [
        "--filter",
        "@honey/db",
        "prisma",
        "migrate",
        "resolve",
        "--applied",
        "20260710215353_init_task01",
      ],
      { DATABASE_URL: tempUrl.toString() },
    );
    runCommand("psql", [
      toPsqlConnectionUrl(tempUrl),
      "-v",
      "ON_ERROR_STOP=1",
      "-f",
      fixtureSqlPath,
    ]);
    runCommand(
      "pnpm",
      ["--filter", "@honey/db", "prisma", "migrate", "deploy"],
      { DATABASE_URL: tempUrl.toString() },
    );

    client = new PrismaClient({
      datasources: {
        db: {
          url: tempUrl.toString(),
        },
      },
    });

    const [
      clientRow,
      sessionRow,
      activeMission,
      completedMission,
      activeAnswers,
      outboxCount,
      notificationCount,
      questionVersion,
      missionSlot,
      answerRevision,
    ] = await Promise.all([
      client.client.findUnique({ where: { id: "client_upgrade" } }),
      client.session.findUnique({ where: { id: "session_upgrade" } }),
      client.mission.findUnique({
        where: { id: "mission_active_upgrade" },
        include: { slots: { orderBy: { position: "asc" } } },
      }),
      client.mission.findUnique({ where: { id: "mission_done_upgrade" } }),
      client.answerRevision.findMany({
        where: { missionSlotId: "slot_active_1" },
      }),
      client.outboxEvent.count(),
      client.inAppNotification.count(),
      client.questionVersion.findUnique({ where: { id: "qv_upgrade_1" } }),
      client.missionSlot.findUnique({ where: { id: "slot_active_1" } }),
      client.answerRevision.findUnique({ where: { id: "answer_active_1" } }),
    ]);

    if (!clientRow) {
      throw new Error("VERIFY_UPGRADE_CLIENT_MISSING");
    }
    if (
      !sessionRow ||
      sessionRow.expiresAt <= new Date("2026-07-10T00:00:00.000Z")
    ) {
      throw new Error("VERIFY_UPGRADE_SESSION_INVALID");
    }
    if (
      !activeMission ||
      activeMission.state !== "ACTIVE" ||
      activeMission.slots[1]?.state !== "ALLOCATED"
    ) {
      throw new Error("VERIFY_UPGRADE_ACTIVE_MISSION_BROKEN");
    }
    if (!completedMission || completedMission.state !== "COMPLETED") {
      throw new Error("VERIFY_UPGRADE_COMPLETED_MISSION_BROKEN");
    }
    if (
      activeAnswers.length !== 1 ||
      answerRevision?.questionVersionId !== "qv_upgrade_1"
    ) {
      throw new Error("VERIFY_UPGRADE_ANSWER_ASSOCIATION_BROKEN");
    }
    if (outboxCount !== 2 || notificationCount !== 1) {
      throw new Error("VERIFY_UPGRADE_NOTIFICATION_ROWS_BROKEN");
    }
    if (
      !questionVersion ||
      questionVersion.category !== "work_schedule" ||
      questionVersion.fictionalSeed !== false
    ) {
      throw new Error("VERIFY_UPGRADE_QUESTION_BACKFILL_BROKEN");
    }
    if (!missionSlot || missionSlot.questionDefinitionId !== "qd_upgrade_1") {
      throw new Error("VERIFY_UPGRADE_SLOT_BACKFILL_BROKEN");
    }
    if (answerRevision?.createdLocalDate !== null) {
      throw new Error("VERIFY_UPGRADE_ANSWER_LOCAL_DATE_EXPECTED_NULL");
    }
    if (activeMission.kind !== "QUICK" || activeMission.localDate !== null) {
      throw new Error("VERIFY_UPGRADE_MISSION_DEFAULTS_BROKEN");
    }

    console.log(
      JSON.stringify(
        {
          status: "PASS",
          database: tempDbName,
          verified: {
            clientReadable: true,
            sessionReadable: true,
            activeMissionResumable: true,
            completedMissionPreserved: true,
            answersAssociated: true,
            outboxReadable: true,
            notificationReadable: true,
            backfillsSafe: true,
          },
        },
        null,
        2,
      ),
    );
  } finally {
    if (client) {
      await client.$disconnect();
    }

    rmSync(tempPrismaDir, { recursive: true, force: true });
    runCommand("psql", [
      toPsqlConnectionUrl(adminUrl),
      "-v",
      "ON_ERROR_STOP=1",
      "-c",
      `DROP DATABASE IF EXISTS "${tempDbName}" WITH (FORCE)`,
    ]);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
