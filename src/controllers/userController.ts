import { Request, Response } from 'express';
import { AppDataSource } from '../db/config';
import { Raduserprofile } from '../db/entities/Raduserprofile';
import { body, validationResult } from 'express-validator';
import { redisClient } from "../redisClient"
import { UserMac } from '../db/entities/UserMac';
import { Radusagestats } from '../db/entities/Radusagestats';
import { Radcheck } from '../db/entities/Radcheck';
import { promisify } from "util";
import { exec } from 'child_process';
import eventBus from '../bus/eventBusSingleton';
import { CacheService } from '../services/cacheService';
import { QuotaService } from '../services/quotaServices';
import { UserDetails } from '../db/entities/UserDetails';
import { SessionTracking } from '../db/entities/SessionTracking';
import { Invoices } from '../db/entities/Invoices';



const sendResponse = (res: Response, success: boolean, status: number, message: string, data: any = null) => {
    res.status(status).json({ success, message, data });
};

function getResellerFilter(req: Request): { isReseller: boolean; resellerId: number | null } {
    const role = (req.user as any)?.role as string | undefined;
    const resellerIdRaw = (req.user as any)?.resellerId as number | null | undefined;
    const resellerId = typeof resellerIdRaw === "number" && Number.isFinite(resellerIdRaw) ? resellerIdRaw : null;
    return { isReseller: role === "reseller" && !!resellerId, resellerId };
}

const deleteCacheKeys = async () => {
    try {
        // Patterns to match different types of user caches
        const patterns = [
            "users_page_*",      // For paginated user lists
            "users_status_*",    // For user online status
            "user:*",            // For individual user caches
            "user_search_*"      // For search results
        ];

        for (const pattern of patterns) {
            let tmpcursor = 0;
            do {
                const { cursor, keys }: { cursor: number; keys: string[]; } = await redisClient.scan(tmpcursor, {
                    MATCH: pattern,
                    COUNT: 100
                });

                tmpcursor = cursor;

                if (keys.length > 0) {
                    await redisClient.del(keys);
                }
            } while (tmpcursor !== 0);
        }
    } catch (error) {
        console.error("Error clearing cache:", error);
        throw new Error("Failed to clear cache");
    }
};

function formatUsersWithStatus(entities: any, raw: any) {
    return entities.map((user: any, index: number) => ({
        ...user,
        // TypeORM raw values may be boolean/number/string depending on driver
        isOnline: raw[index].isOnline === true || raw[index].isOnline === 1 || raw[index].isOnline === "1",
        // TypeORM raw aliases can vary depending on driver/casing; accept common shapes
        lastTimeActive:
            raw[index].lastTimeActive ??
            raw[index].lasttimeactive ??
            raw[index].last_time_active ??
            null,
    }));
}

async function getFreshUsersStatusMap(
    usernames: string[],
    staleCutoff: Date
): Promise<Record<string, { isOnline: boolean; lastTimeActive: any }>> {
    if (!Array.isArray(usernames) || usernames.length === 0) return {};

    const sessionRepo = AppDataSource.getRepository(SessionTracking);

    // Match the same "online" definition used by the OnlineUsers endpoint:
    // - SessionTracking is active
    // - AND there exists an open radacct session with a recent update (>= staleCutoff)
    const rows = await sessionRepo
        .createQueryBuilder("st")
        .select("st.username", "username")
        .addSelect("MAX(CASE WHEN ra.acctsessionid IS NOT NULL THEN 1 ELSE 0 END)", "isOnline")
        .addSelect(
            "MAX(COALESCE(ra.acctupdatetime, ra.acctstarttime, st.last_update, st.start_time))",
            "lastTimeActive"
        )
        .leftJoin(
            "radacct",
            "ra",
            "ra.acctsessionid = st.session_id AND ra.acctstoptime IS NULL AND COALESCE(ra.acctupdatetime, ra.acctstarttime) >= :staleCutoff",
            { staleCutoff }
        )
        .where("st.status = 'active'")
        .andWhere("st.username IN (:...usernames)", { usernames })
        .groupBy("st.username")
        .getRawMany<{ username: string; isOnline: any; lastTimeActive: any }>();

    return rows.reduce((acc, row) => {
        const username = row?.username;
        if (!username) return acc;
        acc[username] = {
            isOnline: row.isOnline === true || row.isOnline === 1 || row.isOnline === "1",
            lastTimeActive: row.lastTimeActive ?? null,
        };
        return acc;
    }, {} as Record<string, { isOnline: boolean; lastTimeActive: any }>);
}


export const UserController = {
    quotaService: new QuotaService(AppDataSource, eventBus, new CacheService()),
    getRadUsers: async (req: Request, res: Response) => {
        try {
            const { isReseller, resellerId } = getResellerFilter(req);
            // 🔹 Get pagination parameters
            let page = parseInt(req.query.page as string) || 1;
            let limit = parseInt(req.query.pageSize as string) || 10;
            if (page < 1) page = 1;
            if (limit < 1) limit = 10;
            const offset = (page - 1) * limit;

            const scope = isReseller ? `reseller_${resellerId}` : "global";
            const cacheKey = `users_page_${scope}_${page}_limit_${limit}`;
            const statusCacheKey = `users_status_${scope}_${page}_limit_${limit}`;

            // Keep "online" consistent with OnlineUsers:
            // treat sessions as online only if we saw a recent radacct update.
            const staleSecondsRaw = parseInt(process.env.ONLINE_SESSION_STALE_SECONDS || "300", 10);
            const staleSeconds = Number.isFinite(staleSecondsRaw) && staleSecondsRaw > 0 ? staleSecondsRaw : 300;
            const staleCutoff = new Date(Date.now() - staleSeconds * 1000);

            // 🔹 Check Redis cache for user data
            const cachedResponse = await redisClient.get(cacheKey);

            // If the user list is cached, still refresh the status from DB so UI stays in sync.
            if (cachedResponse) {
                const userData = JSON.parse(cachedResponse);
                const users = Array.isArray(userData?.users) ? userData.users : [];
                const usernames = users.map((u: any) => u?.username).filter(Boolean);

                const freshStatus = await getFreshUsersStatusMap(usernames, staleCutoff);

                const mergedData = {
                    ...userData,
                    users: users.map((user: any) => ({
                        ...user,
                        isOnline: !!freshStatus[user.username]?.isOnline,
                        lastTimeActive: freshStatus[user.username]?.lastTimeActive ?? user.lastTimeActive ?? null,
                    })),
                };

                return sendResponse(res, true, 200, "Users fetched successfully", mergedData);
            }

            const userRepository = AppDataSource.getRepository(Raduserprofile);

            // 🔹 Count total users for pagination
            const totalUsersQb = userRepository.createQueryBuilder("user");
            if (isReseller) totalUsersQb.andWhere("user.ownerResellerId = :rid", { rid: resellerId });
            const totalUsers = await totalUsersQb.getCount();

            // 🔹 Fetch users with profile relation and left join UserMac
            // Keep "online" consistent with the OnlineUsers page:
            // a user is online only if there is an active SessionTracking row AND a corresponding
            // radacct session with a recent update (prevents stale "online" forever).
            const qb = userRepository
                .createQueryBuilder("user")
                .leftJoinAndSelect("user.profile", "profile")
                .leftJoinAndMapOne(
                    "user.macAddress",
                    UserMac,
                    "mac",
                    "user.username = mac.username"
                )
                .leftJoinAndMapOne(
                    "user.password",
                    Radcheck,
                    "radcheck",
                    "user.username = radcheck.username AND radcheck.attribute = 'Cleartext-Password'"
                )
                .leftJoinAndMapOne(
                    "user.userDetails",
                    UserDetails,
                    "userDetails",
                    "user.username = userDetails.username"
                )
                .leftJoin(
                    (qb) =>
                        qb
                            .from(SessionTracking, "st")
                            .select([
                                "st.username AS st_username",
                                // Online = there exists an active session with a matching open radacct row
                                // that has been updated recently (acctupdatetime/starttime within staleCutoff).
                                "MAX(CASE WHEN ra.acctsessionid IS NOT NULL THEN 1 ELSE 0 END) AS is_online",
                                "MAX(COALESCE(ra.acctupdatetime, ra.acctstarttime, st.last_update, st.start_time)) AS last_online_ping",
                            ])
                            .where("st.status = 'active'")
                            .leftJoin(
                                "radacct",
                                "ra",
                                "ra.acctsessionid = st.session_id AND ra.acctstoptime IS NULL AND COALESCE(ra.acctupdatetime, ra.acctstarttime) >= :staleCutoff",
                                { staleCutoff }
                            )
                            .groupBy("st.username"),
                    "activeSess",
                    "user.username = activeSess.st_username"
                )
                .leftJoin(
                    (qb) =>
                        qb
                            .from(SessionTracking, "st2")
                            .select([
                                "st2.username AS la_username",
                                "MAX(COALESCE(st2.last_update, st2.end_time, st2.start_time)) AS last_time_active",
                            ])
                            .groupBy("st2.username"),
                    "lastActive",
                    "user.username = lastActive.la_username"
                )
                .select([
                    "user.id",
                    "user.username",
                    "user.profileId",
                    "user.isFallback",
                    "user.isMonthlyExceeded",
                    "user.quotaResetDay",
                    "user.accountStatus",
                    "profile.id",
                    "profile.profileName",
                    "profile.dailyQuota",
                    "profile.monthlyQuota",
                    "profile.speedDown",
                    "profile.speedUp",
                    "mac.macAddress",
                    "radcheck.value",
                    "userDetails.fullName",
                    "userDetails.address",
                    "userDetails.phoneNumber",
                    "userDetails.email",
                ])
                .addSelect(
                    "CASE WHEN COALESCE(activeSess.is_online, 0) = 1 THEN true ELSE false END",
                    "isOnline"
                )
                .addSelect(
                    "COALESCE(activeSess.last_online_ping, lastActive.last_time_active)",
                    "lastTimeActive"
                )
                .orderBy("user.id", "ASC")
                .limit(limit)
                .offset(offset)
                .setParameters({ staleCutoff })
            
            if (isReseller) {
                qb.andWhere("user.ownerResellerId = :rid", { rid: resellerId });
            }

            const { entities, raw } = await qb.getRawAndEntities();

            const users = formatUsersWithStatus(entities, raw);

            if (users.length === 0) {
                return sendResponse(res, true, 200, "No users found", []);
            }

            // Create a status map for caching
            const statusMap = users.reduce((acc: any, user: any) => {
                acc[user.username] = { isOnline: user.isOnline, lastTimeActive: (user as any).lastTimeActive ?? null };
                return acc;
            }, {});

            // 🔹 Structure response with pagination metadata
            const responseData = {
                totalUsers,
                totalPages: Math.ceil(totalUsers / limit),
                currentPage: page,
                limit,
                users
            };

            // Cache user data for 1 hour
            await redisClient.set(cacheKey, JSON.stringify(responseData), { EX: 3600 });
            
            // Cache status data for only 30 seconds
            await redisClient.set(statusCacheKey, JSON.stringify(statusMap), { EX: 30 });

            return sendResponse(res, true, 200, "Users fetched successfully", responseData);
        } catch (error) {
            console.error("Error fetching users:", error);
            return sendResponse(res, false, 500, "Error fetching users");
        }
    },
    getRadUser: async (req: Request, res: Response) => {
        try {
            const { id } = req.params;
            const cacheKey = `user:${id}`;
            const cachedUser = await redisClient.get(cacheKey);
            if (cachedUser) {
                return sendResponse(res, true, 200, 'User fetched successfully', JSON.parse(cachedUser));
            }

            const userRepository = AppDataSource.getRepository(Raduserprofile);
            const user = await userRepository.findOne({ where: { id: Number(id) } });
            if (!user) {
                return sendResponse(res, false, 404, 'User not found');
            }

            await redisClient.set(cacheKey, JSON.stringify(user), { EX: 3600 }); // Cache for 1 hour
            sendResponse(res, true, 200, 'User fetched successfully', user);
        } catch (error) {
            console.error(error);
            sendResponse(res, false, 500, 'Error fetching user');
        }
    },
    createUser: [
        body('username').isString().notEmpty(),
        body('password').isString().notEmpty(),
        body('profileId').isInt().notEmpty(),
        body('quotaResetDay').isInt().optional(),
        body('fullName').isString().notEmpty(),
        body('address').isString().optional(),
        body('phoneNumber').isString().optional(),
        body('email').optional().custom((value) => {
            if (value === '' || value === null || value === undefined) {
                return true; // Allow empty string, null, or undefined
            }
            if (typeof value === 'string' && value.trim().length > 0) {
                // Use a regex or a library like validator.js to check if it's a valid email
                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                if (emailRegex.test(value)) {
                    return true;
                }
            }
            throw new Error('Invalid email');
        }), // Email is optional,
        async (req: Request, res: Response) => {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return sendResponse(res, false, 400, 'Validation errors', errors.array());
            }

            const { username, password, profileId, quotaResetDay, fullName, address, phoneNumber, email } = req.body;
            try {
                const userRepository = AppDataSource.getRepository(Raduserprofile);
                const existingUser = await userRepository.findOne({ where: { username } });
                const userDetailsRepository = AppDataSource.getRepository(UserDetails);

                if (existingUser) {
                    return sendResponse(res, false, 409, 'User already exists');
                }

                const radcheckRepository = AppDataSource.getRepository(Radcheck);
                if (await radcheckRepository.findOne({ where: { username } })) {
                    return sendResponse(res, false, 409, 'User already exists');
                }
                const radcheck = new Radcheck();
                radcheck.username = username;
                radcheck.attribute = 'Cleartext-Password';
                radcheck.op = ':=';
                radcheck.value = password;
                await radcheckRepository.save(radcheck);

                const user = new Raduserprofile();
                user.username = username;
                user.profileId = profileId;
                user.isFallback = false;
                user.isMonthlyExceeded = false;
                user.quotaResetDay = quotaResetDay || new Date().getDate();
                user.accountStatus = 'active';
                await userRepository.save(user);

                // Create UserDetails entity
                const userDetails = new UserDetails();
                userDetails.username = username;
                userDetails.fullName = fullName || null;
                userDetails.address = address || null;
                userDetails.phoneNumber = phoneNumber || null;
                userDetails.email = email || null;
                await userDetailsRepository.save(userDetails);

                await deleteCacheKeys(); // Invalidate cache
                sendResponse(res, true, 201, 'User created successfully');
            } catch (error) {
                console.error(error);
                sendResponse(res, false, 500, 'Error creating user');
            }
        }
    ],
    updateUser: [
        body('username').isString().notEmpty(), // Username is required
        body('password').optional().isString().notEmpty(), // Password is optional
        body('profileId').optional().isInt(), // Profile ID is optional
        body('accountStatus').optional().isString().isIn(["active", "suspended", "terminated"]), // Validate account status
        body('fullName').optional().isString(), // Full name is optional
        body('address').optional().isString(), // Address is optional
        body('phoneNumber').optional().isString(), // Phone number is optional
        body('email').optional().custom((value) => {
            if (value === '' || value === null || value === undefined) {
                return true; // Allow empty string, null, or undefined
            }
            if (typeof value === 'string' && value.trim().length > 0) {
                // Use a regex or a library like validator.js to check if it's a valid email
                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                if (emailRegex.test(value)) {
                    return true;
                }
            }
            throw new Error('Invalid email');
        }), // Email is optional
        async (req: Request, res: Response) => {
            // Validate request data
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return sendResponse(res, false, 400, 'Validation errors', errors.array());
            }

            const { username, password, profileId, accountStatus, fullName, address, phoneNumber, email } = req.body;

            try {
                const userRepository = AppDataSource.getRepository(Raduserprofile);
                const radcheckRepository = AppDataSource.getRepository(Radcheck);
                const userDetailsRepository = AppDataSource.getRepository(UserDetails);

                // 🔹 Check if the user exists in Raduserprofile
                const user = await userRepository.findOne({ where: { username } });
                if (!user) {
                    return sendResponse(res, false, 404, "User not found");
                }

                // 🔹 Update password if provided
                if (password) {
                    const radcheck = await radcheckRepository.findOne({ where: { username, attribute: "Cleartext-Password" } });
                    if (radcheck) {
                        radcheck.value = password;
                        await radcheckRepository.save(radcheck);
                    } else {
                        // If no password entry exists, create one
                        const newRadcheck = new Radcheck();
                        newRadcheck.username = username;
                        newRadcheck.attribute = "Cleartext-Password";
                        newRadcheck.op = ":=";
                        newRadcheck.value = password;
                        await radcheckRepository.save(newRadcheck);
                    }
                }

                // 🔹 Update profile details if provided
                if (profileId) user.profileId = profileId;
                if (accountStatus) user.accountStatus = accountStatus;

                await userRepository.save(user); // Save updates

                // 🔹 Update or create user details
                let userDetails = await userDetailsRepository.findOne({ where: { username } });
                if (!userDetails) {
                    userDetails = new UserDetails();
                    userDetails.username = username;
                }

                if (fullName !== undefined) userDetails.fullName = fullName;
                if (address !== undefined) userDetails.address = address;
                if (phoneNumber !== undefined) userDetails.phoneNumber = phoneNumber;
                if (email !== undefined) userDetails.email = email;

                await userDetailsRepository.save(userDetails);

                // 🔹 Invalidate all cached user pages
                await deleteCacheKeys();

                return sendResponse(res, true, 200, "User updated successfully");
            } catch (error) {
                console.error(error);
                return sendResponse(res, false, 500, "Error updating user");
            }
        }
    ],
    deleteUser: async (req: Request, res: Response) => {
        const { username } = req.params;
        try {
            const userRepository = AppDataSource.getRepository(Raduserprofile);
            const radcheckRepository = AppDataSource.getRepository(Radcheck);
            const userDetailsRepository = AppDataSource.getRepository(UserDetails);
            const invoiceRepository = AppDataSource.getRepository(Invoices);

            // First find the user to get their ID
            const user = await userRepository.findOne({ where: { username } });
            if (!user) {
                return sendResponse(res, false, 404, 'User not found');
            }

            // Delete related invoices first
            await invoiceRepository
                .createQueryBuilder()
                .delete()
                .where("user_profile_id = :userId", { userId: user.id })
                .execute();

            // Remove user from UserDetails
            const userDetails = await userDetailsRepository.findOne({ where: { username } });
            if (userDetails) {
                await userDetailsRepository.remove(userDetails);
            }

            // Remove user from Raduserprofile
            await userRepository.remove(user);

            // Remove user from Radcheck
            const radcheck = await radcheckRepository.findOne({ where: { username } });
            if (radcheck) {
                await radcheckRepository.remove(radcheck);
            }

            await deleteCacheKeys();
            await redisClient.del(`user:${username}`); // Invalidate individual user cache
            sendResponse(res, true, 200, 'User deleted successfully');
        } catch (error) {
            console.error('Error deleting user:', error);
            sendResponse(res, false, 500, 'Error deleting user');
        }
    },
    resetMacAddress: async (req: Request, res: Response) => {
        const { username } = req.params;
        try {
            const userMacRepository = AppDataSource.getRepository(UserMac);
            const userMac = await userMacRepository.findOne({ where: { username } });
            if (!userMac) {
                return sendResponse(res, false, 404, 'MAC address not found for the user');
            }
            await userMacRepository.remove(userMac);
            await deleteCacheKeys();
            await redisClient.del(`user:${username}`); // Invalidate individual user cache
            sendResponse(res, true, 200, 'MAC address reset successfully');
        } catch (error) {
            console.error(error);
            sendResponse(res, false, 500, 'Error resetting MAC address');
        }
    },
    resetDailyQuota: async (req: Request, res: Response) => {
        const { username } = req.params;
        try {
            await UserController.quotaService.resetDailyQuota(username);
            sendResponse(res, true, 200, `✅ Daily quota reset successfully for ${username}`);
        } catch (error) {
            console.error(`❌ Error resetting daily quota for ${username}:`, error);
            sendResponse(res, false, 500, 'Error resetting daily quota');
        }
    },
    resetMonthlyQuota: async (req: Request, res: Response) => { },
    changeUserProfile: async (req: Request, res: Response) => { },
    disconnectUser: (username: string, nasIp: string, secret: string, port: number = 1700) => {
        const command = `echo "User-Name = ${username}" | radclient -x ${nasIp}:${port} disconnect ${secret}`;

        exec(command, (error, stdout, stderr) => {
            if (error) {
                console.error(`❌ Error disconnecting user ${username}:`, error.message);
                return;
            }
            if (stderr) {
                console.error(`⚠️ Warning: ${stderr}`);
            }
            console.log(`✅ User ${username} disconnected successfully:`, stdout);
        });
    },
    searchUsers: async (req: Request, res: Response) => {
        try {
            const { query } = req.query;
            const { isReseller, resellerId } = getResellerFilter(req);

            console.log('Received search query:', query);

            if (!query) {
                return sendResponse(res, false, 400, 'Search query is required');
            }

            const userRepository = AppDataSource.getRepository(Raduserprofile);

            const staleSecondsRaw = parseInt(process.env.ONLINE_SESSION_STALE_SECONDS || "300", 10);
            const staleSeconds = Number.isFinite(staleSecondsRaw) && staleSecondsRaw > 0 ? staleSecondsRaw : 300;
            const staleCutoff = new Date(Date.now() - staleSeconds * 1000);

            const qb = userRepository
                .createQueryBuilder("user")
                .leftJoinAndSelect("user.profile", "profile")
                .leftJoinAndMapOne(
                    "user.macAddress",
                    UserMac,
                    "mac",
                    "user.username = mac.username"
                )
                .leftJoinAndMapOne(
                    "user.password",
                    Radcheck,
                    "radcheck",
                    "user.username = radcheck.username AND radcheck.attribute = 'Cleartext-Password'"
                )
                .leftJoinAndMapOne(
                    "user.userDetails",
                    UserDetails,
                    "userDetails",
                    "user.username = userDetails.username"
                )
                .leftJoin(
                    (qb) =>
                        qb
                            .from(SessionTracking, "st")
                            .select([
                                "st.username AS st_username",
                                "MAX(CASE WHEN ra.acctsessionid IS NOT NULL THEN 1 ELSE 0 END) AS is_online",
                                "MAX(COALESCE(ra.acctupdatetime, ra.acctstarttime, st.last_update, st.start_time)) AS last_online_ping",
                            ])
                            .where("st.status = 'active'")
                            .leftJoin(
                                "radacct",
                                "ra",
                                "ra.acctsessionid = st.session_id AND ra.acctstoptime IS NULL AND COALESCE(ra.acctupdatetime, ra.acctstarttime) >= :staleCutoff",
                                { staleCutoff }
                            )
                            .groupBy("st.username"),
                    "activeSess",
                    "user.username = activeSess.st_username"
                )
                .leftJoin(
                    (qb) =>
                        qb
                            .from(SessionTracking, "st2")
                            .select([
                                "st2.username AS la_username",
                                "MAX(COALESCE(st2.last_update, st2.end_time, st2.start_time)) AS last_time_active",
                            ])
                            .groupBy("st2.username"),
                    "lastActive",
                    "user.username = lastActive.la_username"
                )
                .addSelect(
                    "CASE WHEN COALESCE(activeSess.is_online, 0) = 1 THEN true ELSE false END",
                    "isOnline"
                )
                .addSelect(
                    "COALESCE(activeSess.last_online_ping, lastActive.last_time_active)",
                    "lastTimeActive"
                )
                .where("user.username LIKE :query", { query: `%${query}%` })
                .orWhere("userDetails.email LIKE :query", { query: `%${query}%` })
                .orWhere("userDetails.fullName LIKE :query", { query: `%${query}%` })
            
            // Apply reseller scoping (this will become (A OR B OR C) AND owner_reseller_id = rid)
            if (isReseller) qb.andWhere("user.ownerResellerId = :rid", { rid: resellerId });

            const { entities, raw } = await qb
                .select([
                    "user.id",
                    "user.username",
                    "user.profileId",
                    "user.isFallback",
                    "user.isMonthlyExceeded",
                    "user.quotaResetDay",
                    "user.accountStatus",
                    "user.ownerResellerId",
                    "profile.id",
                    "profile.profileName",
                    "profile.dailyQuota",
                    "profile.monthlyQuota",
                    "profile.speedDown",
                    "profile.speedUp",
                    "mac.macAddress",
                    "radcheck.value",
                    "userDetails.fullName",
                    "userDetails.address",
                    "userDetails.phoneNumber",
                    "userDetails.email",
                ])
                .orderBy("user.id", "ASC")
                .setParameters({ staleCutoff })
                .getRawAndEntities();

            const users = formatUsersWithStatus(entities, raw);

            if (users.length === 0) {
                return sendResponse(res, true, 200, "No users found", []);
            }

            const responseData = {
                totalUsers: users.length,
                totalPages: 1,
                currentPage: 1,
                limit: users.length,
                users
            };

            return sendResponse(res, true, 200, "Users fetched successfully", responseData);
        } catch (error) {
            console.error("Error searching users:", error);
            return sendResponse(res, false, 500, "Error searching users");
        }
    }
};


