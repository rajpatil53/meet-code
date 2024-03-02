export function createVideoWindow(id: string, stream?: MediaStream) {
	const videoContainer = document.createElement('div');
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
	videoContainer.appendChild(video);

	return videoContainer;
}

export function addFloatingWindowStyles(containerElement: HTMLElement) {
	containerElement.classList.add('join-item');
	containerElement.style.width = '200px';
	containerElement.style.height = 'auto';
}
