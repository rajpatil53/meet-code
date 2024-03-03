export function createVideoWindow(id: string, stream?: MediaStream) {
	const videoContainer = document.createElement('div');
	const videoWrapper = document.createElement('div');
	videoWrapper.classList.add('h-auto', 'w-full', 'relative');
	videoContainer.classList.add('video-container');
	if (id == 'screen') {
		videoContainer.classList.add('screen-active');
	}
	const video = document.createElement('video');
	video.id = id;
	video.autoplay = true;
	video.playsInline = true;
	video.controls = false;
	video.classList.add('not-prose');
	if (stream) {
		video.srcObject = stream;
	}
	const muteIndicator = createMuteIndicator();
	videoWrapper.appendChild(video);
	videoWrapper.appendChild(muteIndicator);
	videoContainer.appendChild(videoWrapper);

	return videoContainer;
}

export function addFloatingWindowStyles(containerElement: HTMLElement) {
	containerElement.classList.add('join-item');
	containerElement.style.width = '200px';
	containerElement.style.height = 'auto';
}

function createMuteIndicator() {
	const muteIndicator = document.createElement('div');
	muteIndicator.classList.add(
		'absolute',
		'top-2',
		'left-2',
		'badge',
		'badge-lg',
		'badge-error',
		'hidden'
	);
	muteIndicator.innerHTML = `
	<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24" {...$$props}>
		<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2">
			<path d="m2 2l20 20m-3.11-8.77A7.12 7.12 0 0 0 19 12v-2M5 10v2a7 7 0 0 0 12 5m-2-7.66V5a3 3 0 0 0-5.68-1.33" />
			<path d="M9 9v3a3 3 0 0 0 5.12 2.12M12 19v3" />
		</g>
	</svg>`;
	return muteIndicator;
}
