import { PUBLIC_HTTP_BASE_URL } from '$env/static/public';
import type { Room } from '$lib/types';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const body = await fetch(PUBLIC_HTTP_BASE_URL + '/rooms');
	const rooms: Room[] = await body.json();
	return { rooms: rooms };
};
