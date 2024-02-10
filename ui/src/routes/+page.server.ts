import { baseApiUrl } from '$lib/constants';
import type { Room } from '$lib/types';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const body = await fetch(baseApiUrl + '/rooms');
	const rooms: Room[] = await body.json();
	return { rooms: rooms };
};
