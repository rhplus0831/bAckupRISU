// content.js

console.log("Content script loaded!");

// 특정 사이트에서 실행되도록 matches 설정을 manifest.json 에서 조정하세요.
// 예: "matches": ["*://*.example.com/*"]

// IndexedDB 열기 helper 함수 (Promise 기반)
function openIndexedDB(dbName) {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(dbName);

        request.onerror = (event) => {
            reject("IndexedDB open error: " + event.target.errorCode);
        };

        request.onsuccess = (event) => {
            resolve(event.target.result); // DB 객체 resolve
        };
    });
}

// 객체 저장소의 모든 데이터 가져오기 helper 함수 (Promise 기반)
function getAllDataFromObjectStore(db, objectStoreName) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(objectStoreName, 'readonly');
        const objectStore = transaction.objectStore(objectStoreName);
        const request = objectStore.getAll(); // 또는 objectStore.openCursor() 등으로 데이터 처리 가능

        request.onerror = (event) => {
            reject("IndexedDB getAll error: " + event.target.errorCode);
        };

        request.onsuccess = (event) => {
            resolve(event.target.result); // 데이터 배열 resolve
        };
    });
}

function getCurrentDateTime() {
    const now = new Date();

    // 연, 월, 일, 시, 분, 초 가져오기
    const year = now.getFullYear(); // 연도
    const month = String(now.getMonth() + 1).padStart(2, '0'); // 월 (0부터 시작하므로 +1 필요)
    const day = String(now.getDate()).padStart(2, '0'); // 일
    const hours = String(now.getHours()).padStart(2, '0'); // 시
    const minutes = String(now.getMinutes()).padStart(2, '0'); // 분
    const seconds = String(now.getSeconds()).padStart(2, '0'); // 초

    // yyyyMMdd-hhmmss 형식으로 문자열 생성
    return `${year}${month}${day}-${hours}${minutes}${seconds}`;
}

function clearHashes() {
    return new Promise((resolve, reject) => {
        const dbName = 'processedHashesDB';
        const storeName = 'hashes';
        const request = indexedDB.open(dbName, 1);

        request.onerror = (event) => {
            console.error("Database open error:", event.target.errorCode);
            reject(new Error("Database open error"));
        };

        request.onsuccess = (event) => {
            const db = event.target.result;
            const transaction = db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            const clearRequest = store.clear(); // Object Store 내용 전체 삭제 요청

            clearRequest.onsuccess = (event) => {
                console.log("Object store 'hashes' cleared successfully.");
                db.close();
                resolve(); // 성공적으로 삭제 완료
            };

            clearRequest.onerror = (event) => {
                console.error("Object store clear error:", event.target.errorCode);
                db.close();
                reject(new Error("Object store clear error"));
            };

            transaction.onerror = (event) => {
                console.error("Transaction error during clear:", event.target.errorCode);
                db.close();
                reject(new Error("Transaction error during clear"));
            };
        };
    });
}

function checkIsAlreadyProcessed(hash) {
    return new Promise((resolve, reject) => {
        const dbName = 'processedHashesDB';
        const storeName = 'hashes';
        const request = indexedDB.open(dbName, 1); // 데이터베이스 열기 또는 생성 (버전 1)

        request.onerror = (event) => {
            console.error("Database open error:", event.target.errorCode);
            reject(new Error("Database open error"));
        };

        request.onsuccess = (event) => {
            const db = event.target.result;

            const transaction = db.transaction([storeName], 'readwrite'); // 읽기/쓰기 트랜잭션 시작
            const store = transaction.objectStore(storeName);
            const getRequest = store.get(hash); // hash로 데이터 가져오기 시도

            getRequest.onsuccess = (event) => {
                const result = event.target.result;
                if (result) {
                    console.log("Hash already processed:", hash);
                    // 이미 데이터가 있음 (hash가 처리됨)
                    db.close(); // DB 연결 닫기
                    resolve(true);
                } else {
                    // 데이터가 없음 (hash가 처음 처리됨)
                    console.log("Hash not processed yet:", hash);
                    const addRequest = store.add({hash: hash}); // hash 데이터 추가

                    addRequest.onsuccess = (event) => {
                        db.close(); // DB 연결 닫기
                        resolve(false);
                    };

                    addRequest.onerror = (event) => {
                        console.error("Data add error:", event.target.errorCode);
                        db.close(); // DB 연결 닫기 (에러 발생 시에도 닫아야 함)
                        reject(new Error("Data add error"));
                    };
                }
            };

            getRequest.onerror = (event) => {
                console.error("Data get error:", event.target.errorCode);
                db.close(); // DB 연결 닫기 (에러 발생 시에도 닫아야 함)
                reject(new Error("Data get error"));
            };

            transaction.onerror = (event) => {
                console.error("Transaction error:", event.target.errorCode);
                db.close(); // DB 연결 닫기 (트랜잭션 에러 시에도 닫아야 함)
                reject(new Error("Transaction error"));
            };
        };

        request.onupgradeneeded = (event) => {
            // 데이터베이스가 처음 생성되거나 버전이 업그레이드될 때 실행
            const db = event.target.result;
            if (!db.objectStoreNames.contains(storeName)) {
                db.createObjectStore(storeName, {keyPath: 'hash'}); // 'hash'를 keyPath로 사용하는 object store 생성
                console.log("Object store created");
            }
        };
    });
}

async function backupWebsiteData() {
    const assetMap = []

    // if ('caches' in window) {
    //     const cache = await caches.open('risuCache');
    //     const requests = await cache.keys();
    //     for (const request of requests) {
    //         const response = await cache.match(request);
    //         const blob = await response.blob();
    //         const blobURL = URL.createObjectURL(blob)
    //         const hash = crypto.randomUUID();
    //         cacheMap.push({
    //             hash,
    //             url: request.url,
    //             mime: response.headers.get('Content-Type')
    //         });
    //         chrome.runtime.sendMessage({
    //             command: "backup_asset",
    //             hash: hash,
    //             blobURL: blobURL
    //         }, function (response) {
    //             console.log(response);
    //             URL.revokeObjectURL(blobURL);
    //         });
    //         await new Promise(resolve => setTimeout(resolve, 10));
    //     }
    // }

    const db = await openIndexedDB('risuai');
    const transaction = db.transaction('keyvaluepairs', 'readonly');
    const objectStore = transaction.objectStore('keyvaluepairs');
    const request = objectStore.openCursor();

    const time = getCurrentDateTime();

    function requestDownload(fn, blob, useRevision) {
        const blobURL = URL.createObjectURL(blob);
        console.log(`requestDownload: ${fn}, ${blobURL}, ${useRevision}`);
        chrome.runtime.sendMessage({
            command: "backup_file",
            blobURL: blobURL,
            name: fn
        }, function (response) {
            console.log(response);
            URL.revokeObjectURL(blobURL);
            if (useRevision) {
                const split = fn.split('.');
                const newFn = `${split[0]}_${time}.${split[1]}`;
                requestDownload(newFn, blob, false);
                return;
            }
        });
    }

    request.onsuccess = (event) => {
        const cursor = event.target.result;

        if (cursor) {
            const key = cursor.key; // 커서로 현재 항목의 key 가져오기
            const value = cursor.value; // 커서로 현재 항목의 value 가져오기


            if (key.startsWith('assets')) {
                const fn = key.split('/').pop();
                assetMap.push({
                    name: fn,
                    path: key
                })

                checkIsAlreadyProcessed(key).then((isProcessed => {
                    console.log(`isProcessed: ${key}, ${isProcessed}`);
                    if (!isProcessed) {
                        // cache(or memory) key and prevent double-save in future launch

                        const blob = new Blob([value], {type: 'application/octet-stream'});
                        requestDownload(fn, blob, false);
                    }
                }))
            } else if (key === 'database/database.bin') {
                const blob = new Blob([value], {type: 'application/octet-stream'});
                requestDownload('database.bin', blob, true);
            }

            cursor.continue(); // 다음 항목으로 커서를 이동
        } else {
            console.log("All key-value pairs have been processed."); // 순회 완료

            const jsonStr = JSON.stringify(assetMap);
            const jsonBlob = new Blob([jsonStr], {type: 'application/json'});

            requestDownload('asset_map.json', jsonBlob, true);
        }
    };
}


// content.js

// 콘텐츠 스크립트 로드 확인 로그
console.log("Content script loaded");

// Thanks, GPT!
function createConfirmDialog({title = "Are you sure?", message = "", onConfirm, onCancel}) {
    // 다이얼로그 외부 배경 (dimmed overlay)
    const overlay = document.createElement("div");
    overlay.classList.add(
        "absolute",
        "top-0",
        "left-0",
        "w-full",
        "h-full",
        "bg-black",
        "bg-opacity-50",
        "flex",
        "justify-center",
        "items-center",
        "z-50"
    );

    // 다이얼로그 컨테이너
    const dialog = document.createElement("div");
    dialog.classList.add(
        "bg-white",
        "rounded-lg",
        "p-6",
        "w-80",
        "shadow-lg",
        "text-center"
    );

    // 제목
    const titleElement = document.createElement("h2");
    titleElement.classList.add("text-lg", "font-semibold", "mb-4");
    titleElement.textContent = title;

    // 메시지
    const messageElement = document.createElement("p");
    messageElement.classList.add("text-sm", "text-gray-600", "mb-6");
    messageElement.innerHTML = message;

    // 버튼 그룹
    const buttonContainer = document.createElement("div");
    buttonContainer.classList.add("flex", "justify-center", "gap-4");

    // 취소 버튼
    const cancelButton = document.createElement("button");
    cancelButton.classList.add(
        "px-4",
        "py-2",
        "text-sm",
        "bg-gray-200",
        "hover:bg-gray-300",
        "text-gray-800",
        "rounded"
    );
    cancelButton.textContent = "안하겠소!";
    cancelButton.onclick = () => {
        document.body.removeChild(overlay);
        if (onCancel) onCancel();
    };

    // 확인 버튼
    const confirmButton = document.createElement("button");
    confirmButton.classList.add(
        "px-4",
        "py-2",
        "text-sm",
        "bg-red-500",
        "hover:bg-red-600",
        "text-white",
        "rounded"
    );
    confirmButton.textContent = "대기...";

    setTimeout(() => {
        confirmButton.textContent = "네"
        confirmButton.onclick = () => {
            document.body.removeChild(overlay);
            if (onConfirm) onConfirm();
        };
    }, 3000)

    // 버튼 컨테이너에 버튼 추가
    buttonContainer.appendChild(cancelButton);
    buttonContainer.appendChild(confirmButton);

    // 다이얼로그에 구성 요소 추가
    dialog.appendChild(titleElement);
    dialog.appendChild(messageElement);
    dialog.appendChild(buttonContainer);

    // 오버레이에 다이얼로그 추가
    overlay.appendChild(dialog);

    // body에 추가하여 표시
    document.body.appendChild(overlay);
}

let button = null;
let backupAllButton = null;
let restoreButton = null;

// 버튼 삽입 함수
function checkButton() {
    console.log("checkButton");
    setTimeout(checkButton, 1000);

    const sidebarElement = document.querySelector('.flex.h-full.flex-col.p-4.pt-8.gap-2.overflow-y-auto.relative.rs-setting-cont-3.bg-darkbg');

    if (sidebarElement) {
        if (button && button.parentNode) {
            return;
        }
        // 리엑트야!! NEXTjs야!!! 너가 보고싶다!!!!

        restoreButton = document.createElement("button");
        restoreButton.textContent = '비공식 복원'
        restoreButton.classList.add("flex", "gap-2", "items-center", "hover:text-textcolor", "text-textcolor2")
        restoreButton.onclick = () => {
            createConfirmDialog({
                title: "데이터를 되돌릴까요?",
                message: "이 백업/복원 방식은 비공식이며, 최악의 경우에만 사용해야 합니다.<br/>데이터가 온전히 복구되지 못할 수 있습니다.<br/>현재 데이터가 있고 공식 백업을 진행하지 않았다면 공식 백업을 먼저 진행하고 시도하세요.",
                onConfirm: () => {
                    const folderInput = document.createElement("input");
                    folderInput.type = "file";
                    folderInput.webkitdirectory = true;

                    folderInput.addEventListener('change', async (event) => {
                        const files = folderInput.files;
                        let assetMapFile = undefined;
                        let databaseFile = undefined;
                        for (const file of files) {
                            if (file.name === 'asset_map.json') {
                                assetMapFile = file;
                            } else if (file.name === 'database.bin') {
                                databaseFile = file;
                            }
                        }
                        if (!assetMapFile || !databaseFile) {
                            alert('asset_map.json 혹은 database.bin 파일이 없습니다, 이 폴더로는 진행할 수 없습니다')
                            return;
                        }

                        async function readFile(file) {
                            return new Promise((resolve, reject) => {
                                const reader = new FileReader();
                                reader.onload = (event) => {
                                    resolve(event.target.result);
                                };
                                reader.onerror = (event) => {
                                    reject(event.target.error);
                                };
                                reader.readAsArrayBuffer(file);
                            })
                        }

                        const assetMapData = await readFile(assetMapFile);
                        const assetMap = JSON.parse(new TextDecoder().decode(assetMapData));
                        const database = await readFile(databaseFile);

                        async function putData(dest, file) {
                            const data = await readFile(file);
                            // ArrayBuffer를 UInt8Array로 변환
                            const uintData = new Uint8Array(data);
                            const db = await openIndexedDB('risuai');
                            const transaction = db.transaction('keyvaluepairs', 'readwrite');
                            const objectStore = transaction.objectStore('keyvaluepairs');
                            const req = objectStore.put(uintData, dest);
                            req.onsuccess = () => {
                                console.log(`Data written to ${dest}`);
                            };
                            req.onerror = () => {
                                console.error(`Error writing to ${dest}`);
                            };
                        }

                        for (const file of files) {
                            if (file.name.startsWith('asset_map') || file.name.startsWith('database')) {
                                continue;
                            }
                            const asset = assetMap.find(asset => asset.name === file.name);
                            if (!asset) {
                                console.error(`Asset ${file.name} not found in asset map`);
                                continue;
                            }
                            await putData(asset.path, file);
                        }

                        await putData('database/database.bin', databaseFile);

                        window.location.reload();
                    });

                    folderInput.click();
                },
                onCancel: () => {
                    console.log("Cancelled!");
                }
            });
        }
        sidebarElement.prepend(restoreButton)

        backupAllButton = document.createElement("button");
        backupAllButton.textContent = "비공식 백업(일괄)"; // 버튼에 표시할 텍스트
        backupAllButton.classList.add("flex", "gap-2", "items-center", "hover:text-textcolor", "text-textcolor2")

        backupAllButton.onclick = () => {
            clearHashes().catch(() => {
                alert('오류가 발생했습니다, 처음이라면 일반 백업을 실행해주세요.')
            }).then(() => {
                backupWebsiteData(); // 기존의 데이터를 수집하는 함수 호출
            })
        };
        sidebarElement.prepend(backupAllButton);

        button = document.createElement("button");
        button.textContent = "비공식 백업"; // 버튼에 표시할 텍스트
        button.classList.add("flex", "gap-2", "items-center", "hover:text-textcolor", "text-textcolor2")

        button.onclick = () => {
            backupWebsiteData(); // 기존의 데이터를 수집하는 함수 호출
        };

        sidebarElement.prepend(button);
    } else {
        if (button) {
            button = null;
        }
        if (restoreButton) {
            restoreButton = null;
        }
    }
}

// DOM이 완전히 로드된 후 버튼 추가
window.addEventListener('load', () => {
    checkButton();
});

document.addEventListener('keydown', function (event) {
    if (event.ctrlKey && event.shiftKey && event.key === 'S') {
        // Ctrl + Shift + S 키가 눌렸을 때 실행할 코드
        event.preventDefault(); // 브라우저의 기본 새로고침 동작 방지 (선택 사항)
        backupWebsiteData()
    }
});