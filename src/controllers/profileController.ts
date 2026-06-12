import { Request, Response } from 'express';
import { AppDataSource } from '../db/config';
import { Radprofile } from '../db/entities/Radprofile';
import { Raduserprofile } from '../db/entities/Raduserprofile';
import { body, validationResult } from 'express-validator';
import { redisClient } from "../redisClient";

const sendResponse = (res: Response, success: boolean, status: number, message: string, data: any = null) => {
    res.status(status).json({ success, message, data });
};

export const ProfileController = {
    getProfiles: async (req: Request, res: Response) => {
        try {
            const cachedProfiles = await redisClient.get('profiles');
            if (cachedProfiles) {
                return sendResponse(res, true, 200, 'Profiles fetched successfully', JSON.parse(cachedProfiles));
            }

            const profileRepository = AppDataSource.getRepository(Radprofile);
            const profiles = await profileRepository.find();
            await redisClient.set('profiles', JSON.stringify(profiles), { EX: 3600 }); // Cache for 1 hour
            sendResponse(res, true, 200, 'Profiles fetched successfully', profiles);
        } catch (error) {
            console.error(error);
            sendResponse(res, false, 500, 'Error fetching profiles');
        }
    },

    /** Per-profile usage: how many users are assigned to each profile (and how many of them are active). */
    getProfilesUsage: async (req: Request, res: Response) => {
        try {
            const rows = (await AppDataSource.getRepository(Raduserprofile)
                .createQueryBuilder("up")
                .select("up.profileId", "profileId")
                .addSelect("COUNT(*)", "usersCount")
                .addSelect(
                    "SUM(CASE WHEN LOWER(COALESCE(up.accountStatus, '')) = 'active' THEN 1 ELSE 0 END)",
                    "activeCount"
                )
                .groupBy("up.profileId")
                .getRawMany()) as Array<{ profileId: number; usersCount: string; activeCount: string }>;

            const usage = rows.map((r) => ({
                profileId: Number(r.profileId),
                usersCount: Number(r.usersCount || 0),
                activeCount: Number(r.activeCount || 0),
            }));
            sendResponse(res, true, 200, 'Profile usage fetched successfully', usage);
        } catch (error) {
            console.error(error);
            sendResponse(res, false, 500, 'Error fetching profile usage');
        }
    },

    getProfile: async (req: Request, res: Response) => {
        try {
            const { id } = req.params;
            const cacheKey = `profile:${id}`;
            const cachedProfile = await redisClient.get(cacheKey);
            if (cachedProfile) {
                return sendResponse(res, true, 200, 'Profile fetched successfully', JSON.parse(cachedProfile));
            }

            const profileRepository = AppDataSource.getRepository(Radprofile);
            const profile = await profileRepository.findOne({ where: { id: Number(id) } });
            if (!profile) {
                return sendResponse(res, false, 404, 'Profile not found');
            }

            await redisClient.set(cacheKey, JSON.stringify(profile), { EX: 3600 }); // Cache for 1 hour
            sendResponse(res, true, 200, 'Profile fetched successfully', profile);
        } catch (error) {
            console.error(error);
            sendResponse(res, false, 500, 'Error fetching profile');
        }
    },

    createProfile: [
        body('profileName').isString().notEmpty(),
        body('dailyQuota').isString().notEmpty(),
        body('monthlyQuota').isString().notEmpty(),
        async (req: Request, res: Response) => {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return sendResponse(res, false, 400, 'Validation errors', errors.array());
            }

            const { profileName, dailyQuota, monthlyQuota, price, nightStart, nightEnd, speedDown, speedUp, sessionTimeout, idleTimeout, maxSessions } = req.body;
            try {
                const profileRepository = AppDataSource.getRepository(Radprofile);
                const existingProfile = await profileRepository.findOne({ where: { profileName } });
                if (existingProfile) {
                    return sendResponse(res, false, 409, 'Profile already exists');
                }

                const profile = new Radprofile();
                profile.profileName = profileName;
                profile.dailyQuota = dailyQuota;
                profile.monthlyQuota = monthlyQuota;
                profile.price = price != null ? Number(price) : 0;
                profile.nightStart = nightStart;
                profile.nightEnd = nightEnd;
                profile.speedDown = speedDown;
                profile.speedUp = speedUp;
                profile.sessionTimeout = sessionTimeout;
                profile.idleTimeout = idleTimeout;
                profile.maxSessions = maxSessions;
                await profileRepository.save(profile);
                await redisClient.del('profiles'); // Invalidate cache
                sendResponse(res, true, 201, 'Profile created successfully');
            } catch (error) {
                console.error(error);
                sendResponse(res, false, 500, 'Error creating profile');
            }
        }
    ],

    updateProfile: [
        body('profileName').isString().notEmpty(),
        body('dailyQuota').isString().notEmpty(),
        body('monthlyQuota').isString().notEmpty(),
        async (req: Request, res: Response) => {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return sendResponse(res, false, 400, 'Validation errors', errors.array());
            }

            const { id } = req.params;
            const { profileName, dailyQuota, monthlyQuota, price, nightStart, nightEnd, speedDown, speedUp, sessionTimeout, idleTimeout, maxSessions } = req.body;
            try {
                const profileRepository = AppDataSource.getRepository(Radprofile);
                const profile = await profileRepository.findOne({ where: { id: Number(id) } });
                if (!profile) {
                    return sendResponse(res, false, 404, 'Profile not found');
                }

                profile.profileName = profileName;
                profile.dailyQuota = dailyQuota;
                profile.monthlyQuota = monthlyQuota;
                if (price != null) profile.price = Number(price);
                profile.nightStart = nightStart;
                profile.nightEnd = nightEnd;
                profile.speedDown = speedDown;
                profile.speedUp = speedUp;
                profile.sessionTimeout = sessionTimeout;
                profile.idleTimeout = idleTimeout;
                profile.maxSessions = maxSessions;
                await profileRepository.save(profile);
                await redisClient.del('profiles'); // Invalidate cache
                await redisClient.del(`profile:${id}`); // Invalidate individual profile cache
                sendResponse(res, true, 200, 'Profile updated successfully');
            } catch (error) {
                console.error(error);
                sendResponse(res, false, 500, 'Error updating profile');
            }
        }
    ],

    deleteProfile: async (req: Request, res: Response) => {
        const { id } = req.params;
        try {
            const parsedId = Number(id);
            const profileRepository = AppDataSource.getRepository(Radprofile);
            const profile = await profileRepository.findOne({ where: { id: parsedId } });
            if (!profile) {
                return sendResponse(res, false, 404, 'Profile not found');
            }

            // Refuse to delete a profile that still has users assigned — deleting it
            // would orphan their RADIUS configuration.
            const assignedUsers = await AppDataSource.getRepository(Raduserprofile).count({
                where: { profileId: parsedId } as any,
            });
            if (assignedUsers > 0) {
                return sendResponse(
                    res,
                    false,
                    409,
                    `Profile "${profile.profileName}" still has ${assignedUsers} assigned user(s). Reassign them before deleting.`
                );
            }

            await profileRepository.remove(profile);
            await redisClient.del('profiles'); // Invalidate cache
            await redisClient.del(`profile:${id}`); // Invalidate individual profile cache
            sendResponse(res, true, 200, 'Profile deleted successfully');
        } catch (error) {
            console.error(error);
            sendResponse(res, false, 500, 'Error deleting profile');
        }
    }
};
