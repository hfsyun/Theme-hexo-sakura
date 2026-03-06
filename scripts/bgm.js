'use strict';

const { existsSync, readFileSync, writeFileSync } = require('fs');
const { join } = require('path');
const axios = require('axios');
const config = hexo.config.bgm || hexo.config.theme_config.bgm || {};
const userId = config.vmid;

class BangumiModel {
  constructor() {
    this.dataFile = join(process.cwd(), 'source/bilibili/bgm.json');
    this.configFile = join(process.cwd(), '_config.bgm.yml');
  }

  /**
   * 获取Bangumi用户收藏数据
   * @param {string} type - 数据类型 (anime/game/real)
   * @returns {Promise<Array>} 收藏数据数组
   */
  async fetchBangumiData(type = 'anime') {
    try {
      const typeMap = {
        'anime': {subject_type: 2},
        'game': {subject_type: 4},
        'real': {subject_type: 6}
      };
      
      // 获取用户收藏数据
      const userCollections = await this.fetchUserCollections(typeMap);
      
      // 合并所有类型的用户收藏数据
      const mergedCollections = Object.values(userCollections).flat();
      
      return mergedCollections;
    } catch (error) {
      if (error.response && error.response.status === 401) {
        console.error('认证失败：请检查BGM_TOKEN环境变量是否有效');
      } else {
        console.error('Bangumi API请求失败:', error.message);
      }
      return [];
    }
  }

  /**
   * 获取用户收藏数据
   * @param {Object} typeMap - 类型映射
   * @returns {Promise<Object>} 各类型收藏数据
   */
  async fetchUserCollections(typeMap) {
    const allTypes = ['anime', 'game', 'real'];
    const allData = {};
    
    // 状态列表：1=想看，2=在看，3=看过
    const collectionTypes = [1, 2, 3];
    
    for (const t of allTypes) {
      console.log(`正在获取用户${userId}的${t}类型收藏数据...`);
      allData[t] = [];
      
      // 对每个媒体类型，获取所有收藏状态的数据
      for (const collectionType of collectionTypes) {
        try {
          const response = await axios.get(`https://api.bgm.tv/v0/users/${userId}/collections`, {
            params: {
              subject_type: typeMap[t].subject_type,
              type: collectionType
            },
            headers: {
              'User-Agent': 'hexo-bgm/1.0'
            }
          });
          
          if (response.status === 200 && response.data && Array.isArray(response.data.data)) {
            console.log(`成功获取用户${userId}的${t}类型状态${collectionType}收藏数据，共${response.data.data.length}条记录`);
            
            const typeData = response.data.data
              .filter(item => item.subject && item.subject.name && item.subject.images && item.subject.id)
              .map(item => {
                return {
                  title: item.subject.name || '',
                  cover: item.subject.images.medium,
                  date: item.subject.date || '',
                  name_cn: item.subject.name_cn || '',
                  bangumi_id: item.subject.id,
                  summary: item.subject.short_summary || '',
                  tags: item.subject.tags?.map(tag => tag.name) || [],
                  eps: item.subject.eps || 0,
                  volumes: item.subject.volumes || 0,
                  type: t,
                  score: item.subject.score || 0,
                  //progress: progressInfo,
                  collection_total: item.subject.collection_total || 0,
                  // 明确使用当前请求的状态类型
                  status: collectionType,
                  updated_at: item.updated_at || null
                };
              });
            
            // 将当前状态的数据添加到该类型的合集中
            allData[t] = [...allData[t], ...typeData];
          } else {
            console.error(`获取用户${userId}的${t}类型状态${collectionType}收藏数据失败，状态码: ${response.status}`);
          }
        } catch (error) {
          console.error(`获取用户${userId}的${t}类型状态${collectionType}收藏数据时出错:`, error.message);
        }
      }
    }
    
    return allData;
  }

  /**
   * 合并远程和本地数据
   * @param {Array} remoteData - 远程数据
   * @returns {Array} 合并后的数据
   */
  mergeData(remoteData) {
    let localData = [];
    if (existsSync(this.dataFile)) {
      try {
        const localFileData = JSON.parse(readFileSync(this.dataFile, 'utf8'));
        // Handle both old array format and new object format
        if (Array.isArray(localFileData)) {
          localData = localFileData;
        } else if (localFileData && localFileData.all && Array.isArray(localFileData.all.items)) {
          localData = localFileData.all.items;
        }
      } catch (error) {
        console.error('解析本地数据文件失败:', error.message);
        localData = [];
      }
    }
    
    // Filter local data to only include items without bangumi_id (which seems to be the intention)
    // But ensure localData is an array before filtering
    const filteredLocalData = Array.isArray(localData) ? localData.filter(item => !item.bangumi_id) : [];
    
    return [...remoteData, ...filteredLocalData];
  }
}

hexo.extend.filter.register('after_init', async () => {
  hexo.extend.console.register('bgm:update', '更新追番数据', {
    options: [
      { name: 'force', desc: '强制更新本地数据' },
      { name: 'type', desc: '指定数据类型(anime/book/music/game/real)' }
    ]
  }, async (args) => {
    const bangumi = new BangumiModel();
    const remoteData = await bangumi.fetchBangumiData(args.type || 'anime');
    const mergedData = bangumi.mergeData(remoteData);
    
    const dataDir = require('path').dirname(bangumi.dataFile);
    if (!existsSync(dataDir)) {
      require('fs').mkdirSync(dataDir, { recursive: true });
    }
    
    // 定义状态映射
    const statusMap = {
      1: 'wantWatch', // 想看
      2: 'watching',  // 在看
      3: 'watched'    // 看过
    };

    // 所有数据都合并到一个对象中
    const allData = {
      types: {},
      all: {
        items: mergedData
      }
    };
    
    const allTypes = ['anime', 'game', 'real'];
    
    // 按类型分类数据
    allTypes.forEach(type => {
      const typeData = mergedData.filter(item => item.type === type);
      allData.types[type] = {
        all: typeData,
        status: {}
      };
      
      // 初始化所有状态分类
      Object.values(statusMap).forEach(statusName => {
        allData.types[type].status[statusName] = [];
      });
      
      // 按状态进一步分类
      typeData.forEach(item => {
        // 确保从API响应中正确获取状态字段
        const statusCode = parseInt(item.status) || 1;
        
        // 验证状态码有效性
        if (![1, 2, 3].includes(statusCode)) {
          console.error('无效状态码:', statusCode);
          return;
        }
        
        const statusName = statusMap[statusCode] || 'unknown';
        allData.types[type].status[statusName].push(item);
      });
      
      console.log('处理 %s 类型数据，共%d条记录', type, typeData.length);
    });
    
    // 合并所有数据到一个统一的JSON文件中
    const unifiedFile = join(process.cwd(), `source/bilibili/bgm.json`);
    writeFileSync(unifiedFile, JSON.stringify(allData, null, 2));
    console.log('所有数据已统一保存到 bgm.json 文件中');
    
    // 不再保存原始的bgm.json文件，所有数据都合并到统一文件中
    //console.log('已停用原始 bgm.json 文件保存，所有数据合并到统一文件中');
  });
});