// background.js

chrome.runtime.onInstalled.addListener(() => {
    console.log("확장 프로그램 설치 완료!");
});


const nameMap = {}

chrome.runtime.onMessage.addListener(
    function (request, sender, sendResponse) {
        if (request.command === "backup_file") {
            nameMap[request.blobURL] = request.name;
            chrome.downloads.download({
                url: request.blobURL,
                filename: `risuai/${request.name}`,
            });

            sendResponse({status: "success"});
            return true;
        }
    }
);


chrome.downloads.onDeterminingFilename.addListener(function (item, suggest) {
    if (item.byExtensionName === 'bAckupRISU') {
        console.log(item);
        const name = nameMap[item.url] ?? item.filename;
        console.log(nameMap);
        console.log(name);
        suggest({
            filename: "risuai/" + name, // <-- 원래 파일명을 다시 지정
            conflictAction: 'overwrite'
        });
        try {
            delete nameMap[item.url]
        } catch {

        }
        return true;
    }
});


async function downloadAsset(url) {
    const downloaded = await fetch(pathname);
    return await downloaded.blob();
}