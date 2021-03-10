export default class Song {
    name: string;
    artist: string;
    time: number;
    link: string | undefined;
    listening: boolean;

    constructor(name: string, artist: string, time: number, link: string | undefined, listening: boolean = true) {
        this.name = name;
        this.artist = artist;
        this.time = time;
        this.link = link;
        this.listening = listening;
    }
}
