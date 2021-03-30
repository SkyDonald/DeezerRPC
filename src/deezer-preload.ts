import dayjs from 'dayjs';
import Song from './model/Song';
import { ipcRenderer } from 'electron';

function initializeListeners() {
    setInterval(function () {
        const songContent = document.querySelector("div.marquee-content")?.querySelectorAll("a.track-link")
        const isListening = document.querySelector("button.svg-icon-group-btn.is-highlight")?.querySelector("svg.svg-icon.svg-icon-pause") != null

        if (songContent != null && songContent.length > 0) {
            ipcRenderer.send('song-changed', new Song(
                songContent[0].textContent!,
                songContent[1].textContent!,
                timestamp(),
                `https://www.deezer.com${songContent[0].getAttribute('href')}`,
                isListening
            ));
            return;
        }

        const queueContent = document.querySelector("div.queuelist-cover-title")

        if (queueContent != null) {
            ipcRenderer.send('song-changed', new Song(
                queueContent.textContent!,
                document.querySelector("div.queuelist-cover-subtitle")?.textContent!,
                timestamp(),
                `https://www.deezer.com${songContent ? songContent[0].getAttribute('href') : ''}`,
                isListening
            ));
            return;
        }

        const customContent = document.querySelector("div.marquee-content")?.textContent?.split(" · ");

        if (customContent != null) {
            ipcRenderer.send('song-changed', new Song(
                customContent[0],
                customContent[1],
                timestamp(),
                `https://www.deezer.com${songContent ? songContent[0].getAttribute('href') : ''}`,
                isListening
            ));
        }
    }, 5000)
}

function timestamp(): number {
    const sMax = document.querySelector("div.slider-counter.slider-counter-max")!.textContent
    const sCurrent = document.querySelector("div.slider-counter.slider-counter-current")!.textContent
    if (!sMax || !sCurrent) return 0;

    return dayjs(Date.now())
        .add(parseInt(sMax.substring(0, 2)), "m")
        .add(parseInt(sMax.substring(3)), "s")
        .subtract(parseInt(sCurrent.substring(0, 2)), "m")
        .subtract(parseInt(sCurrent.substring(3)), "s")
        .unix();
}

setTimeout(initializeListeners, 3000);
