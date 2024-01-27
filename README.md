# multi-track-voice-record discord bot

## Installation 
[details](https://abal.moe/Eris/docs/0.17.2/getting-started) 

node >= 10.4.0
```
npm i
```

이후 실행 중 오류가 발생한다면
```
npm install -g node-gyp
```

## Run

.env의 DISCORD_BOT_TOKEN에 값 입력

```
npm run start
```
문제없이 잘 실행될 경우 console에 Ready! 출력

### bot command
- !ping:
  - 출력: Pong! 
  - 봇이 제대로 동작하는지 확인 

- !join:
  - 출력: hello
  - 먼저 음성 채널에 들어간 후에 전송
  - 음성 채널에 들어가 있지 않을 경우 오류 메시지 출력
  - 음성 채널에 들어가면 말할 때만 녹음되고 0.5초 이상 말하지 않으면 .pcm 파일이 .wav로 변환되어 저장

- !leave:
  - 출력: bye
  - 음성 채널에 나가기 전에 전송
  - 음성 채널에 들어가 있지 않을 경우 오류 메시지 출력

## Links
[Eris: A Node.JS Discord Library](https://abal.moe/Eris/)
