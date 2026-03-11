let playerInstance = null;
let isPlayerInitialized = false;
let isLoading = false;
let loadingTimeout = null;
let toggleBtn = null;
let popup = null;

// 创建加载指示器元素
function createLoadingIndicator() {
    // 检查是否已存在加载指示器
    if (document.getElementById('playerLoadingIndicator')) return;
    
    
    const loadingIndicator = document.createElement('div');
    loadingIndicator.id = 'playerLoadingIndicator';
    loadingIndicator.className = 'player-loading-indicator';
    loadingIndicator.innerHTML = `
        <div class="loading-spinner-music">
            <div class="spinner-ring ring-1"></div>
            <div class="spinner-ring ring-2"></div>
            <div class="spinner-ring ring-3"></div>
            <div class="loading-text">
                <span>正在加载播放器</span>
                <span class="loading-dots"></span>
            </div>
            <div class="loading-progress"></div>
        </div>
    `;
    
    // 将加载指示器添加到播放器容器中
    popup.appendChild(loadingIndicator);
}

// 初始化播放器（延迟加载）
function initializePlayer() {
    if (isPlayerInitialized || isLoading) return;
    
    // 设置加载状态
    isLoading = true;
    
    // 创建并显示加载指示器
    createLoadingIndicator();
    const loadingIndicator = document.getElementById('playerLoadingIndicator');
    if (loadingIndicator) {
        loadingIndicator.style.display = 'block';
    }
    
    // 设置加载超时处理（10秒后超时）
    loadingTimeout = setTimeout(() => {
        if (isLoading) {
            hideLoadingIndicator();
            isLoading = false;
            console.error('音乐播放器初始化超时');
            // 显示错误提示
            showLoadError('播放器加载超时，请检查网络连接');
        }
    }, 10000);
    
    try {
        playerInstance = mediaPlayer(popup);
        
   
                // 加载音乐列表



        playerInstance.player.load(playerMusic.audio || mashiro_option.audio ||{});
        
        // 监听播放器加载完成事件
        const fetchPromise = playerInstance.player.fetch();
        
        fetchPromise.then(() => {
            // 加载成功，清除超时定时器
            if (loadingTimeout) {
                clearTimeout(loadingTimeout);
                loadingTimeout = null;
            }
            
            // 隐藏加载指示器
            hideLoadingIndicator();
            
            isPlayerInitialized = true;
            isLoading = false;
            console.log('音乐播放器初始化成功');
        }).catch((error) => {
            // 加载失败，清除超时定时器
            if (loadingTimeout) {
                clearTimeout(loadingTimeout);
                loadingTimeout = null;
            }
            
            // 隐藏加载指示器
            hideLoadingIndicator();
            
            isLoading = false;
            console.error('音乐播放器初始化失败:', error);
            showLoadError('播放器加载失败，请刷新页面重试');
        });

    } catch (error) {
        // 清除超时定时器
        if (loadingTimeout) {
            clearTimeout(loadingTimeout);
            loadingTimeout = null;
        }
        
        // 隐藏加载指示器
        hideLoadingIndicator();
        
        isLoading = false;
        console.error('音乐播放器初始化失败:', error);
        showLoadError('播放器初始化异常，请刷新页面重试');
    }
}

// 隐藏加载指示器
function hideLoadingIndicator() {
    const loadingIndicator = document.getElementById('playerLoadingIndicator');
    if (loadingIndicator) {
        loadingIndicator.style.display = 'none';
    }
}

// 显示加载错误信息
function showLoadError(message) {
    // 创建错误提示元素
    const errorElement = document.createElement('div');
    errorElement.className = 'player-load-error';
    errorElement.innerHTML = `
        <div class="error-content">
            <div class="error-icon">⚠️</div>
            <div class="error-message">${message}</div>
            <button class="retry-btn" onclick="retryInitializePlayer()">重试</button>
        </div>
    `;
    
    // 移除现有的加载指示器
    const existingIndicator = document.getElementById('playerLoadingIndicator');
    if (existingIndicator) {
        existingIndicator.parentNode.removeChild(existingIndicator);
    }
    
    // 添加错误提示到播放器
    popup.appendChild(errorElement);
}

// 重试初始化播放器
function retryInitializePlayer() {
    // 移除错误提示
    const errorElement = document.querySelector('.player-load-error');
    if (errorElement) {
        errorElement.parentNode.removeChild(errorElement);
    }
    
    // 重新初始化
    initializePlayer();
}

// 显示播放器
function showPlayer() {
    if (!isPlayerInitialized && !isLoading) {
        initializePlayer();
    }
    popup.classList.add('show');
    toggleBtn.style.display = 'none';
}

// 隐藏播放器
function hidePlayer() {
    popup.classList.remove('show');
    toggleBtn.style.display = 'block';
}

// DOM加载完成后初始化
document.addEventListener('DOMContentLoaded', function() {
    toggleBtn = document.getElementById('musicToggleBtn');
    popup = document.getElementById('playerMusic');
    
    if (toggleBtn) {
        toggleBtn.addEventListener('click', showPlayer);
    }
    
    document.addEventListener('click', function(event) {
        if (popup && toggleBtn && !popup.contains(event.target) && !toggleBtn.contains(event.target)) {
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