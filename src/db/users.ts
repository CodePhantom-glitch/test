import { db } from './index.ts';
import {
  users,
  userSettings,
  strategies,
  simulations,
  auditLogs,
  walletSessions,
  contractActions,
  botExecutionJobs,
} from './schema.ts';
import { eq, desc } from 'drizzle-orm';

export async function getOrCreateUser(uid: string, email: string, displayName?: string) {
  try {
    const result = await db
      .insert(users)
      .values({
        uid,
        email,
        displayName: displayName || email.split('@')[0],
      })
      .onConflictDoUpdate({
        target: users.uid,
        set: {
          email,
          displayName: displayName || email.split('@')[0],
        },
      })
      .returning();

    await db
      .insert(userSettings)
      .values({
        userUid: uid,
        executionMode: 'DEMO',
      })
      .onConflictDoNothing({
        target: userSettings.userUid,
      });

    return result[0];
  } catch (error) {
    console.error('Database query failed in getOrCreateUser:', error);
    throw new Error('Failed to synchronize user profile.', { cause: error });
  }
}

export async function getUserSettings(uid: string) {
  try {
    const rows = await db
      .select()
      .from(userSettings)
      .where(eq(userSettings.userUid, uid));
    return rows[0] || null;
  } catch (error) {
    console.error('Database query failed in getUserSettings:', error);
    throw new Error('Failed to load user settings.', { cause: error });
  }
}

export async function updateUserSettings(
  uid: string,
  updates: {
    executionMode?: string;
    rpcEndpoint?: string;
    wsEndpoint?: string;
    maxGlobalGasGwei?: number;
    staleBlockThresholdSec?: number;
    emergencyStopActive?: boolean;
  }
) {
  try {
    const result = await db
      .insert(userSettings)
      .values({
        userUid: uid,
        executionMode: updates.executionMode || 'DEMO',
        rpcEndpoint: updates.rpcEndpoint || 'https://ethereum-rpc.publicnode.com',
        wsEndpoint: updates.wsEndpoint || 'wss://ethereum-rpc.publicnode.com',
        maxGlobalGasGwei: updates.maxGlobalGasGwei ?? 45,
        staleBlockThresholdSec: updates.staleBlockThresholdSec ?? 24,
        emergencyStopActive: updates.emergencyStopActive ?? false,
      })
      .onConflictDoUpdate({
        target: userSettings.userUid,
        set: {
          ...updates,
          updatedAt: new Date(),
        },
      })
      .returning();
    return result[0];
  } catch (error) {
    console.error('Database query failed in updateUserSettings:', error);
    throw new Error('Failed to update user settings.', { cause: error });
  }
}

export async function getStoredStrategies(uid?: string) {
  try {
    if (uid) {
      return await db
        .select()
        .from(strategies)
        .where(eq(strategies.userUid, uid))
        .orderBy(desc(strategies.updatedAt));
    }
    return await db.select().from(strategies).orderBy(desc(strategies.updatedAt)).limit(20);
  } catch (error) {
    console.error('Database query failed in getStoredStrategies:', error);
    throw new Error('Failed to fetch stored strategies.', { cause: error });
  }
}

export async function saveStrategyRecord(data: typeof strategies.$inferInsert) {
  try {
    const result = await db.insert(strategies).values(data).returning();
    return result[0];
  } catch (error) {
    console.error('Database query failed in saveStrategyRecord:', error);
    throw new Error('Failed to save strategy configuration.', { cause: error });
  }
}

export async function pauseAllStoredStrategies() {
  try {
    await db.update(strategies).set({
      status: 'Paused',
      updatedAt: new Date(),
    });
  } catch (error) {
    console.error('Database query failed in pauseAllStoredStrategies:', error);
    throw new Error('Failed to pause stored strategies.', { cause: error });
  }
}

export async function cancelAllQueuedJobs() {
  try {
    await db
      .update(botExecutionJobs)
      .set({
        status: 'CANCELLED_BY_STOP',
        updatedAt: new Date(),
      })
      .where(eq(botExecutionJobs.status, 'QUEUED'));
  } catch (error) {
    console.error('Database query failed in cancelAllQueuedJobs:', error);
    throw new Error('Failed to cancel queued jobs.', { cause: error });
  }
}

export async function getRecentSimulations(limitCount = 30) {
  try {
    return await db
      .select()
      .from(simulations)
      .orderBy(desc(simulations.createdAt))
      .limit(limitCount);
  } catch (error) {
    console.error('Database query failed in getRecentSimulations:', error);
    throw new Error('Failed to fetch simulation history.', { cause: error });
  }
}

export async function recordSimulationResult(data: typeof simulations.$inferInsert) {
  try {
    const result = await db.insert(simulations).values(data).returning();
    return result[0];
  } catch (error) {
    console.error('Database query failed in recordSimulationResult:', error);
    throw new Error('Failed to record simulation result.', { cause: error });
  }
}

export async function recordAuditLog(data: typeof auditLogs.$inferInsert) {
  try {
    const result = await db.insert(auditLogs).values(data).returning();
    return result[0];
  } catch (error) {
    console.error('Database query failed in recordAuditLog:', error);
    throw new Error('Failed to write audit log.', { cause: error });
  }
}

export async function getRecentAuditLogs(limitCount = 40) {
  try {
    return await db
      .select()
      .from(auditLogs)
      .orderBy(desc(auditLogs.createdAt))
      .limit(limitCount);
  } catch (error) {
    console.error('Database query failed in getRecentAuditLogs:', error);
    throw new Error('Failed to fetch audit logs.', { cause: error });
  }
}

export async function recordWalletSession(data: typeof walletSessions.$inferInsert) {
  try {
    const result = await db.insert(walletSessions).values(data).returning();
    return result[0];
  } catch (error) {
    console.error('Database query failed in recordWalletSession:', error);
    throw new Error('Failed to record wallet session.', { cause: error });
  }
}

export async function recordContractAction(data: typeof contractActions.$inferInsert) {
  try {
    const result = await db
      .insert(contractActions)
      .values(data)
      .onConflictDoNothing({ target: contractActions.idempotencyKey })
      .returning();
    return result[0] || null;
  } catch (error) {
    console.error('Database query failed in recordContractAction:', error);
    throw new Error('Failed to record contract action.', { cause: error });
  }
}

export async function getRecentContractActions(limitCount = 25) {
  try {
    return await db
      .select()
      .from(contractActions)
      .orderBy(desc(contractActions.createdAt))
      .limit(limitCount);
  } catch (error) {
    console.error('Database query failed in getRecentContractActions:', error);
    throw new Error('Failed to fetch contract actions.', { cause: error });
  }
}
