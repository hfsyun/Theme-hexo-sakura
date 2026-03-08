let playerInstance = null;
let isPlayerInitialized = false;
let isLoading = false;
let loadingTimeout = null;

let toggleBtn = null;
let popup = null;

function createLoadingIndicator() {
    if (document.getElementById('playerLoadingIndicator')) return;
    
    const loadingIndicator = document.createElement('div');
    loadingIndicator.id = 'playerLoadingIndicator';
    loadingIndicator.className = 'player-loading-indicator';
    loadingIndicator.innerHTML = `
        <div class="loading-spinner-music">
            <div class="spinner-icon"></div>
            <div class="loading-text">正在加载播放器...</div>
        </div>
    `;
    
    if (popup) {
        popup.appendChild(loadingIndicator);
    }
}

function initializePlayer() {
    if (isPlayerInitialized || isLoading) return;
    
    isLoading = true;
    
    createLoadingIndicator();
    const loadingIndicator = document.getElementById('playerLoadingIndicator');
    if (loadingIndicator) {
        loadingIndicator.style.display = 'block';
    }
    
    loadingTimeout = setTimeout(() => {
        if (isLoading) {
            hideLoadingIndicator();
            isLoading = false;
            console.error('音乐播放器初始化超时');
            showLoadError('播放器加载超时，请检查网络连接');
        }
    }, 10000);
    
    try {
        playerInstance = mediaPlayer(popup);
        
        playerInstance.player.load( playerMusic.audio || mashiro_option.audio ||{});
        
        const fetchPromise = playerInstance.player.fetch();
        
        fetchPromise.then(() => {
            if (loadingTimeout) {
                clearTimeout(loadingTimeout);
                loadingTimeout = null;
            }
            
            hideLoadingIndicator();
            
            isPlayerInitialized = true;
            isLoading = false;
            console.log('音乐播放器初始化成功');
        }).catch((error) => {
            if (loadingTimeout) {
                clearTimeout(loadingTimeout);
                loadingTimeout = null;
            }
            
            hideLoadingIndicator();
            
            isLoading = false;
            console.error('音乐播放器初始化失败:', error);
            showLoadError('播放器加载失败，请刷新页面重试');
        });

    } catch (error) {
        if (loadingTimeout) {
            clearTimeout(loadingTimeout);
            loadingTimeout = null;
        }
        
        hideLoadingIndicator();
        
        isLoading = false;
        console.error('音乐播放器初始化失败:', error);
        showLoadError('播放器初始化异常，请刷新页面重试');
    }
}

function hideLoadingIndicator() {
    const loadingIndicator = document.getElementById('playerLoadingIndicator');
    if (loadingIndicator) {
        loadingIndicator.style.display = 'none';
    }
}

function showLoadError(message) {
    const errorElement = document.createElement('div');
    errorElement.className = 'player-load-error';
    errorElement.innerHTML = `
        <div class="error-content">
            <div class="error-icon">⚠️</div>
            <div class="error-message">${message}</div>
            <button class="retry-btn" onclick="retryInitializePlayer()">重试</button>
        </div>
    `;
    
    const existingIndicator = document.getElementById('playerLoadingIndicator');
    if (existingIndicator) {
        existingIndicator.parentNode.removeChild(existingIndicator);
    }
    
    if (popup) {
        popup.appendChild(errorElement);
    }
}

function retryInitializePlayer() {
    const errorElement = document.querySelector('.player-load-error');
    if (errorElement) {
        errorElement.parentNode.removeChild(errorElement);
    }
    
    initializePlayer();
}

function showPlayer() {
    if (!popup) return;
    if (!isPlayerInitialized && !isLoading) {
        initializePlayer();
    }
    popup.classList.add('show');
    if (toggleBtn) {
        toggleBtn.style.display = 'none';
    }
}

function hidePlayer() {
    if (!popup) return;
    popup.classList.remove('show');
    if (toggleBtn) {
        toggleBtn.style.display = 'block';
    }
}

document.addEventListener('DOMContentLoaded', function() {
    toggleBtn = document.getElementById('musicToggleBtn');
    popup = document.getElementById('playerMusic');
    
    if (!toggleBtn || !popup) {
        console.warn('音乐播放器元素未找到，跳过初始化');
        return;
    }
    
    toggleBtn.addEventListener('click', showPlayer);

    document.addEventListener('click', function(event) {
        if (popup && !popup.contains(event.target) && toggleBtn && !toggleBtn.contains(event.target)) {
            if (popup.classList.contains('show')) {
                hidePlayer();
            }
        }
    });

    document.addEventListener('keydown', function(event) {
        if (popup && event.key === 'Escape' && popup.classList.contains('show')) {
            hidePlayer();
        }
    });
});
