import { isWithin20Hours } from '@/external/risTransports';
import { Cache, CacheDatabase } from '@/server/cache';
import { getNewDBCoachSequence } from '@/server/coachSequence/DB/bahnDe';
import { getRisTransportsCoachSequence } from '@/server/coachSequence/DB/risTransports';
import type { CoachSequenceInformation } from '@/types/coachSequence';
import { format } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';

const formatDate = (date?: Date) =>
	date ? format(toZonedTime(date, 'Europe/Berlin'), 'yyyyMMddHHmm') : undefined;
// const formatPlannedDate = (date?: Date) =>
//   date ? format(utcToZonedTime(date, 'Europe/Berlin'), 'yyyyMMdd') : undefined;

const coachSequenceCache = new Cache<CoachSequenceInformation>(
	CacheDatabase.ParsedCoachSequenceFound,
);

const blockedCategories = new Set(['TRAM', 'STR', 'BUS', 'BSV', 'FLUG']);

export async function DBCoachSequence(
	trainNumber: string,
	date: Date,
	plannedStartDate?: Date,
	trainCategory?: string,
	stopEva?: string,
): Promise<CoachSequenceInformation | undefined> {
	if (trainCategory && blockedCategories.has(trainCategory)) {
		return undefined;
	}
	if (!isWithin20Hours(date)) {
		return undefined;
	}

	const formattedDate = formatDate(date);

	const cacheKey = `${trainNumber}-${formattedDate}-${trainCategory}-${stopEva}`;
	const cached = await coachSequenceCache.get(cacheKey);
	if (cached) {
		return cached;
	}

	if (plannedStartDate && trainCategory && stopEva) {
		const risTransportsSequence = await getRisTransportsCoachSequence(
			trainCategory,
			trainNumber,
			stopEva,
			date,
			plannedStartDate,
		);
		if (risTransportsSequence) {
			void coachSequenceCache.set(cacheKey, risTransportsSequence);
			return risTransportsSequence;
		}

		// ris not found, lets try bahn.de - should never find something though

		const newDbSequence = await getNewDBCoachSequence(
			trainCategory,
			trainNumber,
			stopEva,
			date,
			plannedStartDate,
		);
		if (newDbSequence) {
			void coachSequenceCache.set(cacheKey, newDbSequence);
			return newDbSequence;
		}
	}
}
