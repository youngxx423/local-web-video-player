const fileInput = document.getElementById('file-input');
const audioPlayer = document.getElementById('audio-player');
const playBtn = document.getElementById('play-btn');
const prevBtn = document.getElementById('prev-btn');
const nextBtn = document.getElementById('next-btn');
const progressBar = document.getElementById('progress-bar');
const currentTimeEl = document.getElementById('current-time');
const durationEl = document.getElementById('duration');
const songTitle = document.getElementById('song-title');
const artistName = document.getElementById('artist-name');
const recordWrapper = document.getElementById('record-wrapper');
const playlistEl = document.getElementById('playlist');
const songCountEl = document.getElementById('song-count');
const volumeSlider = document.getElementById('volume-slider');
const coverImg = document.getElementById('cover-img');
const lyricsBox = document.getElementById('lyrics-box');

// 默认封面图
const defaultCover = "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?q=80&w=1000&auto=format&fit=crop";

let songs = [];      // 存放音频文件
let imageFiles = []; // 新增：存放所有图片文件，用于查找封面
let currentSongIndex = 0;
let isPlaying = false;

const jsmediatags = window.jsmediatags;

// 1. 文件上传监听
fileInput.addEventListener('change', (e) => {
    const files = Array.from(e.target.files);

    // A. 筛选音频文件 (保留之前的 ALAC/FLAC 修复逻辑)
    songs = files.filter(file => {
        const isAudioType = file.type.startsWith('audio/');
        const fileName = file.name.toLowerCase();
        const isAudioExt = fileName.endsWith('.m4a') || 
                           fileName.endsWith('.mp3') || 
                           fileName.endsWith('.flac') || 
                           fileName.endsWith('.wav') ||
                           fileName.endsWith('.ogg');
        return isAudioType || isAudioExt;
    });

    // B. 新增：筛选图片文件 (用于查找 Cover.jpg)
    imageFiles = files.filter(file => {
        return file.type.startsWith('image/') || 
               file.name.toLowerCase().endsWith('.jpg') || 
               file.name.toLowerCase().endsWith('.png') ||
               file.name.toLowerCase().endsWith('.jpeg');
    });
    
    if (songs.length > 0) {
        songCountEl.innerText = songs.length;
        renderPlaylist();
        loadSong(0); 
    } else {
        alert("未找到音频文件，请确认文件夹内容。");
    }
});

// 2. 渲染播放列表
function renderPlaylist() {
    playlistEl.innerHTML = '';
    songs.forEach((song, index) => {
        const li = document.createElement('li');
        li.innerText = song.name;
        li.addEventListener('click', () => {
            loadSong(index);
            playSong();
        });
        playlistEl.appendChild(li);
    });
}

// 3. 辅助函数：查找同文件夹下的 Cover.jpg
function findFolderCover(currentSong) {
    if (!currentSong.webkitRelativePath) return null;

    // 获取当前歌曲的文件夹路径
    // 例如：Music/JayChou/Fantasy/01.mp3 -> 文件夹路径是 Music/JayChou/Fantasy
    const songPathParts = currentSong.webkitRelativePath.split('/');
    songPathParts.pop(); // 去掉文件名，只留文件夹
    const songFolderPath = songPathParts.join('/');

    // 在图片列表中查找
    const foundImage = imageFiles.find(img => {
        // 获取图片的文件夹路径
        const imgPathParts = img.webkitRelativePath.split('/');
        const imgName = imgPathParts.pop().toLowerCase(); // 获取文件名并转小写
        const imgFolderPath = imgPathParts.join('/');

        // 判定条件：
        // 1. 图片和歌曲在同一个文件夹
        // 2. 图片名叫 cover.jpg (忽略大小写，所以 Cover.jpg 也可以)
        return imgFolderPath === songFolderPath && (imgName === 'cover.jpg' || imgName === 'cover.jpeg' || imgName === 'cover.png');
    });

    return foundImage;
}

// 4. 加载歌曲 (核心修改)
function loadSong(index) {
    currentSongIndex = index;
    const song = songs[index];
    
    audioPlayer.src = URL.createObjectURL(song);
    
    // --- Step A: 基础重置 ---
    songTitle.innerText = song.name.replace(/\.[^/.]+$/, "");
    artistName.innerText = "本地音乐";
    lyricsBox.innerText = "正在读取信息..."; // 临时状态

    // --- Step B: 优先尝试加载同文件夹下的 Cover.jpg ---
    const folderCoverFile = findFolderCover(song);
    if (folderCoverFile) {
        // 如果找到了 cover.jpg，先显示它
        coverImg.src = URL.createObjectURL(folderCoverFile);
    } else {
        // 没找到则显示默认图
        coverImg.src = defaultCover;
    }

    // --- Step C: 读取内嵌 ID3 信息 (如果读取成功，会覆盖上面的 cover.jpg) ---
    // 逻辑：内嵌封面的优先级 > 文件夹里的 cover.jpg > 默认图片
    jsmediatags.read(song, {
        onSuccess: function(tag) {
            const tags = tag.tags;
            
            if (tags.title) songTitle.innerText = tags.title;
            if (tags.artist) artistName.innerText = tags.artist;

            // 1. 处理封面
            if (tags.picture) {
                const { data, format } = tags.picture;
                let base64String = "";
                for (let i = 0; i < data.length; i++) {
                    base64String += String.fromCharCode(data[i]);
                }
                // 如果有内嵌图片，这里会覆盖掉刚才加载的 cover.jpg
                coverImg.src = `data:${format};base64,${window.btoa(base64String)}`;
            }

            // 2. 处理歌词
            if (tags.lyrics) {
                if (typeof tags.lyrics === 'object' && tags.lyrics.lyrics) {
                    lyricsBox.innerText = tags.lyrics.lyrics;
                } else {
                    lyricsBox.innerText = tags.lyrics;
                }
            } else {
                lyricsBox.innerText = "暂无内嵌歌词";
            }
        },
        onError: function(error) {
            console.log("无法读取标签:", error);
            lyricsBox.innerText = "无歌词信息";
            // 读取失败时，如果 Step B 找到了 Cover.jpg，保持显示 Cover.jpg，否则保持默认图
        }
    });

    // 高亮列表
    const items = playlistEl.querySelectorAll('li');
    items.forEach(item => item.classList.remove('active'));
    if(items[index]) items[index].classList.add('active');
    
    progressBar.value = 0;
}

// 5. 播放控制
function playSong() {
    audioPlayer.play();
    isPlaying = true;
    recordWrapper.classList.add('playing');
    playBtn.innerHTML = '<i class="fa-solid fa-pause"></i>';
}

function pauseSong() {
    audioPlayer.pause();
    isPlaying = false;
    recordWrapper.classList.remove('playing');
    playBtn.innerHTML = '<i class="fa-solid fa-play"></i>';
}

playBtn.addEventListener('click', () => {
    if (songs.length === 0) return alert("请先选择文件夹");
    isPlaying ? pauseSong() : playSong();
});

prevBtn.addEventListener('click', () => {
    if (songs.length === 0) return;
    currentSongIndex = (currentSongIndex - 1 + songs.length) % songs.length;
    loadSong(currentSongIndex);
    playSong();
});

nextBtn.addEventListener('click', () => {
    if (songs.length === 0) return;
    currentSongIndex = (currentSongIndex + 1) % songs.length;
    loadSong(currentSongIndex);
    playSong(); // 自动播放
});

// 6. 进度条更新
audioPlayer.addEventListener('timeupdate', (e) => {
    const { duration, currentTime } = e.target;
    if (duration) {
        const progressPercent = (currentTime / duration) * 100;
        progressBar.value = progressPercent;
        currentTimeEl.innerText = formatTime(currentTime);
        durationEl.innerText = formatTime(duration);
    }
});

progressBar.addEventListener('input', () => {
    const duration = audioPlayer.duration;
    audioPlayer.currentTime = (progressBar.value / 100) * duration;
});

audioPlayer.addEventListener('ended', () => {
    nextBtn.click();
});

volumeSlider.addEventListener('input', (e) => {
    audioPlayer.volume = e.target.value;
});

// 监听播放错误 (针对 ALAC 提示)
audioPlayer.addEventListener('error', (e) => {
    const error = e.target.error;
    if (songs[currentSongIndex] && songs[currentSongIndex].name.endsWith('.m4a') && (error.code === 3 || error.code === 4)) {
       // 可以在这里 console.log，或者选择不弹窗打扰用户，这里静默处理或在歌词栏提示
       lyricsBox.innerText = "播放失败：浏览器不支持此 ALAC 格式音频";
    }
});

function formatTime(seconds) {
    if (isNaN(seconds)) return "00:00";
    const min = Math.floor(seconds / 60);
    const sec = Math.floor(seconds % 60);
    return `${min < 10 ? '0' + min : min}:${sec < 10 ? '0' + sec : sec}`;
}