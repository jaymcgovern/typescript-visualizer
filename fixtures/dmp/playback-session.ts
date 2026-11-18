enum PositionType {
    Start,
    Bookmark
}

export interface PlaybackSession {
    prepare(positionType: PositionType): Promise<void>;
    start(positionType: PositionType): Promise<void>;
    muted: boolean;
    volume: number;
}
