type UserVoiceData = {
    streams: any;
    lastTime: number;
    startTime: number;
    filename: string;
};

type MemberData = {
    id: string;
    name: string;
    language: string;
};

type TTSQueueItem = {
    filename: string;
    text: string;
    name: string;
    language: string;
    finish: boolean;
};

export class ChannelData {
    channelID: string;
    userVoiceDataMap: Map<string, UserVoiceData>;
    memberMap: Map<string, MemberData>;
    channelGame: string;
    ttsQueue: TTSQueueItem[];

    constructor(channelID: string) {
        this.channelID = channelID;
        this.userVoiceDataMap = new Map();
        this.memberMap = new Map();
        this.channelGame = "LOL";
        this.ttsQueue = [];
    }

    addMember(memberId: string, memberName: string) {
        if (!this.memberMap.has(memberId))
            this.memberMap.set(memberId, { id: memberId, name: memberName, language: "en-US" });
    }

    removeMember(memberId: string) {
        if (this.memberMap.has(memberId))
            this.memberMap.delete(memberId);
    }
}