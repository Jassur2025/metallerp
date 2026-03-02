/**
 * onEmployeeChange — Firestore trigger (Задача 8.3)
 *
 * Fires when an employee document is updated.
 * If status changed to "inactive":
 *   1. Revoke the user's Firebase Auth refresh tokens
 *   2. Log the event to journalEvents
 *
 * This ensures that deactivated employees are immediately signed out
 * and cannot access the system until reactivated.
 */

import { onDocumentUpdated } from "firebase-functions/v2/firestore";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

export const onEmployeeChange = onDocumentUpdated(
  {
    document: "employees/{employeeId}",
    region: "europe-west1",
  },
  async (event) => {
    const before = event.data?.before?.data();
    const after = event.data?.after?.data();

    if (!before || !after) return;

    // Only react when status changes TO "inactive"
    if (before.status === after.status) return;
    if (after.status !== "inactive") return;

    const employeeId = event.params.employeeId;
    const employeeName = after.name || after.email || employeeId;
    const employeeEmail = after.email as string | undefined;

    console.log(
      `Employee deactivated: ${employeeName} (${employeeId})`,
    );

    const auth = getAuth();
    const db = getFirestore();

    // Try to find the Firebase Auth user and revoke tokens
    let revokedUid: string | null = null;

    try {
      if (employeeEmail) {
        // Look up by email
        const userRecord = await auth.getUserByEmail(employeeEmail);
        await auth.revokeRefreshTokens(userRecord.uid);
        revokedUid = userRecord.uid;
        console.log(`Revoked refresh tokens for UID ${userRecord.uid} (${employeeEmail})`);
      } else {
        // If employeeId is a UID, try directly
        try {
          const userRecord = await auth.getUser(employeeId);
          await auth.revokeRefreshTokens(userRecord.uid);
          revokedUid = userRecord.uid;
          console.log(`Revoked refresh tokens for UID ${employeeId}`);
        } catch {
          console.log(`No Firebase Auth user found for employee ${employeeId}`);
        }
      }
    } catch (err) {
      console.error(`Failed to revoke tokens for employee ${employeeId}:`, err);
    }

    // Log to journalEvents
    try {
      await db.collection("journalEvents").add({
        action: "employee_deactivated",
        description: `Сотрудник ${employeeName} деактивирован` +
          (revokedUid ? ` (токены отозваны)` : ` (токены не найдены)`),
        userId: "system",
        userEmail: "cloud-function",
        metadata: {
          employeeId,
          employeeName,
          employeeEmail: employeeEmail || null,
          revokedUid,
          previousStatus: before.status,
        },
        createdAt: new Date().toISOString(),
      });
    } catch (err) {
      console.error("Failed to write journal event:", err);
    }
  },
);
export {};
