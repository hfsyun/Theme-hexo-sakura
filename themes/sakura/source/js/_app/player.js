var NOWPLAYING = null;
const isMobile = /mobile/i.test(window.navigator.userAgent);

// 工具函数
const store = {
  get: function (item) {
    return localStorage.getItem(item);
  },
  set: function (item, str) {
    localStorage.setItem(item, str);
    return str;
  },
  del: function (item) {
    localStorage.removeItem(item);
  }
};

const showtip = function (msg) {
  if (!msg) return;

  var tipbox = document.body.appendChild(document.createElement('div'));
  tipbox.innerHTML = msg;
  tipbox.className = 'tip';

  setTimeout(function () {
    tipbox.classList.add('hide');
    setTimeout(function () {
      document.body.removeChild(tipbox);
    }, 300);
  }, 3000);
};


const tabFormat = function () {
  var tabs = document.querySelectorAll('div.tab');
  var tabGroups = {};

  // 按data-id分组tab元素
  tabs.forEach(function (element, index) {
    if (element.getAttribute('data-ready')) return;

    var id = element.getAttribute('data-id');
    var title = element.getAttribute('data-title');

    if (!tabGroups[id]) {
      tabGroups[id] = [];
    }
    tabGroups[id].push({
      element: element,
      title: title
    });
  });

  // 为每个分组创建导航
  Object.keys(tabGroups).forEach(function (id) {
    var group = tabGroups[id];
    if (group.length <= 1) {
      // 单个tab不需要导航
      group.forEach(function (item) {
        item.element.setAttribute('data-ready', 'true');
      });
      return;
    }

    var box = document.getElementById(id);
    if (!box) {
      box = document.createElement('div');
      box.className = 'music-tabs';
      box.id = id;

      // 创建导航栏
      var nav = document.createElement('ul');
      nav.className = 'music-nav-tabs';

      // 创建内容容器
      var content = document.createElement('div');
      content.className = 'music-tab-content';

      box.appendChild(nav);
      box.appendChild(content);

      // 插入到第一个tab之前
      group[0].element.parentNode.insertBefore(box, group[0].element);
    }

    var nav = box.querySelector('.music-nav-tabs');
    var content = box.querySelector('.music-tab-content');

    // 创建导航标签和内容
    group.forEach(function (item, index) {
      // 创建导航标签
      var navItem = document.createElement('li');
      navItem.className = 'music-tab' + (index === 0 ? ' active' : '');
      navItem.innerHTML = '<a href="#">' + (item.title || '播放列表 ' + (index + 1)) + '</a>';

      // 添加点击事件
      navItem.addEventListener('click', function (e) {
        e.preventDefault();

        // 切换导航状态
        nav.querySelectorAll('.music-tab').forEach(function (tab) {
          tab.classList.remove('active');
        });
        navItem.classList.add('active');

        // 切换内容显示
        content.querySelectorAll('.music-tab-pane').forEach(function (pane) {
          pane.classList.remove('active');
        });
        item.element.classList.add('active');
      });

      nav.appendChild(navItem);

      // 移动tab内容到容器中
      item.element.className = 'music-tab-pane' + (index === 0 ? ' active' : '');
      content.appendChild(item.element);

      item.element.setAttribute('data-ready', 'true');
    });
  });
};

// DOM扩展方法
Element.prototype.createChild = function (tag, obj, positon) {
  var child = document.createElement(tag);
  if (obj) {
    for (var key in obj) {
      if (key === 'innerHTML') {
        child.innerHTML = obj[key];
      } else if (key.startsWith('on')) {
        child.addEventListener(key.substring(2), obj[key]);
      } else {
        child[key] = obj[key];
      }
    }
  }

  if (positon === 'after') {
    this.parentNode.insertBefore(child, this.nextSibling);
  } else if (positon === 'replace') {
    this.innerHTML = '';
    this.appendChild(child);
  } else {
    this.appendChild(child);
  }

  return child;
};

Element.prototype.child = function (selector) {
  return this.querySelector(selector);
};

Element.prototype.find = function (selector) {
  return this.querySelectorAll(selector);
};

Element.prototype.addClass = function (className) {
  this.classList.add(className);
  return this;
};

Element.prototype.removeClass = function (className) {
  this.classList.remove(className);
  return this;
};

Element.prototype.hasClass = function (className) {
  return this.classList.contains(className);
};

Element.prototype.attr = function (name, value) {
  if (value !== undefined) {
    this.setAttribute(name, value);
    return this;
  }
  return this.getAttribute(name);
};

Element.prototype.width = function (value) {
  if (value !== undefined) {
    this.style.width = value;
    return this;
  }
  return this.offsetWidth;
};

Element.prototype.height = function (value) {
  if (value !== undefined) {
    this.style.height = value;
    return this;
  }
  return this.offsetHeight;
};

Element.prototype.left = function () {
  return this.getBoundingClientRect().left;
};

Element.prototype.top = function () {
  return this.getBoundingClientRect().top;
};

Element.prototype.display = function (value) {
  this.style.display = value || 'block';
  return this;
};

// 音乐播放器主函数
const mediaPlayer = function (t, config) {
  var option = {
    type: 'audio',
    mode: 'random',
    controls: ['mode', 'backward', 'play-pause', 'forward', 'volume'],
    events: {
      "play-pause": function (event) {
        if (source.paused) {
          t.player.play();
        } else {
          t.player.pause();
        }
      },
      "music": function (event) {
        if (info.el.hasClass('show')) {
          info.hide();
        } else {
          info.el.addClass('show');
          playlist.scroll().title();
        }
      }
    }
  };


  var utils = {
    random: function (len) {
      return Math.floor((Math.random() * len));
    },
    parse: function (link) {
      var result = [];
      [
        ['music.163.com.*song.*id=(\\d+)', 'netease', 'song'],
        ['music.163.com.*album.*id=(\\d+)', 'netease', 'album'],
        ['music.163.com.*artist.*id=(\\d+)', 'netease', 'artist'],
        ['music.163.com.*playlist.*id=(\\d+)', 'netease', 'playlist'],
        ['music.163.com.*discover/toplist.*id=(\\d+)', 'netease', 'playlist'],
        ['y.qq.com.*song/(\\w+).html', 'tencent', 'song'],
        ['y.qq.com.*album/(\\w+).html', 'tencent', 'album'],
        ['y.qq.com.*singer/(\\w+).html', 'tencent', 'artist'],
        ['y.qq.com.*playsquare/(\\w+).html', 'tencent', 'playlist'],
        ['y.qq.com.*playlist/(\\w+).html', 'tencent', 'playlist']
      ].forEach(function (rule) {
        var patt = new RegExp(rule[0]);
        var res = patt.exec(link);
        if (res !== null) {
          result = [rule[1], rule[2], res[1]];
        }
      });
      return result;
    },
    fetch: function (source) {
      var list = [];
      return new Promise(function (resolve, reject) {
        source.forEach(function (raw) {
          var meta = utils.parse(raw);
          if (meta[0]) {
            var skey = JSON.stringify(meta);
            var playlist = store.get(skey);
            if (playlist) {
              list.push.apply(list, JSON.parse(playlist));
              resolve(list);
            } else {
              fetch('https://api.i-meto.com/meting/api?server=' + meta[0] + '&type=' + meta[1] + '&id=' + meta[2] + '&r=' + Math.random())
                .then(function (response) {
                  return response.json();
                }).then(function (json) {
                  store.set(skey, JSON.stringify(json));
                  list.push.apply(list, json);
                  resolve(list);
                }).catch(function (ex) {});
            }
          } else {
            list.push(raw);
            resolve(list);
          }
        });
      });
    },
    secondToTime: function (second) {
      var add0 = function (num) {
        return isNaN(num) ? '00' : (num < 10 ? '0' + num : '' + num);
      };
      var hour = Math.floor(second / 3600);
      var min = Math.floor((second - hour * 3600) / 60);
      var sec = Math.floor(second - hour * 3600 - min * 60);
      return (hour > 0 ? [hour, min, sec] : [min, sec]).map(add0).join(':');
    },
    nameMap: {
      dragStart: isMobile ? 'touchstart' : 'mousedown',
      dragMove: isMobile ? 'touchmove' : 'mousemove',
      dragEnd: isMobile ? 'touchend' : 'mouseup',
    }
  };

  var source = null;
  var originTitle = document.title;

  // 播放器核心对象
  t.player = {
    _id: utils.random(999999),
    group: true,
    load: function (newList) {
      var d = "";
      if (newList && newList.length > 0) {
        if (this.options.rawList !== newList) {
          this.options.rawList = newList;
          playlist.clear();
        }
      } else {
        d = "none";
        this.pause();
      }
      for (var el in buttons.el) {
        buttons.el[el].display(d);
      }
      return this;
    },

    fetch: function () {
      var that = this;
      return new Promise(function (resolve, reject) {
        if (playlist.data.length > 0) {
          resolve();
        } else {
          if (that.options.rawList) {
            var promises = [];
            that.options.rawList.forEach(function (raw, index) {
              promises.push(new Promise(function (resolve, reject) {
                var group = index;
                var source;
                if (!raw.list) {
                  group = 0;
                  that.group = false;
                  source = [raw];
                } else {
                  that.group = true;
                  source = raw.list;
                }
                utils.fetch(source).then(function (list) {
                  playlist.add(group, list);
                  resolve();
                });
              }));
            });
            Promise.all(promises).then(function () {
              resolve(true);
            });
          }
        }
      }).then(function (c) {
        if (c) {
          playlist.create();
          controller.create();
          that.mode();
        }
      });
    },

    mode: function () {
      var total = playlist.data.length;
      if (!total || playlist.errnum == total) return;

      var step = controller.step == 'next' ? 1 : -1;
      var next = function () {
        var index = playlist.index + step;
        if (index >= total || index < 0) {
          index = controller.step == 'next' ? 0 : total - 1;
        }
        playlist.index = index;
      };

      var random = function () {
        var p = utils.random(total);
        if (playlist.index !== p) {
          playlist.index = p;
        } else {
          next();
        }
      };

      switch (this.options.mode) {
        case 'random':
          random();
          break;
        case 'order':
          next();
          break;
        case 'loop':
          if (playlist.index == -1) {
            playlist.index = 0;
          }
          break;
      }
      this.init();
    },

    switch: function (index) {
      if (typeof index == 'number' && index != playlist.index && playlist.current() && !playlist.current().error) {
        playlist.index = index;
        this.init();
      }
    },

    init: function () {
      var item = playlist.current();
      if (!item || item['error']) {
        this.mode();
        return;
      }

      var playing = false;
      if (!source.paused) {
        playing = true;
        this.stop();
      }

      source.attr('src', item.url);
      source.attr('title', item.name + ' - ' + item.artist);
      this.volume(store.get('_PlayerVolume') || '0.7');
      this.muted(store.get('_PlayerMuted'));

      progress.create();
      if (this.options.type == 'audio') preview.create();
      if (playing == true) this.play();
    },

    play: function () {
      NOWPLAYING && NOWPLAYING.player.pause();
      if (playlist.current().error) {
        this.mode();
        return;
      }
      var that = this;
      source.play().then(function () {
        playlist.scroll();
      }).catch(function (e) {});
    },

    pause: function () {
      source.pause();
      document.title = originTitle;
    },

    stop: function () {
      source.pause();
      source.currentTime = 0;
      document.title = originTitle;
    },

    seek: function (time) {
      time = Math.max(time, 0);
      time = Math.min(time, source.duration);
      source.currentTime = time;
      progress.update(time / source.duration);
    },

    muted: function (status) {
      if (status == 'muted') {
        source.muted = status;
        store.set('_PlayerMuted', status);
        controller.update(0);
      } else {
        store.del('_PlayerMuted');
        source.muted = false;
        controller.update(source.volume);
      }
    },

    volume: function (percentage) {
      if (!isNaN(percentage)) {
        controller.update(percentage);
        store.set('_PlayerVolume', percentage);
        source.volume = percentage;
      }
    },

    mini: function () {
      info.hide();
    }
  };

  // 播放器信息面板
  var info = {
    el: null,
    create: function () {
      if (this.el) return;
      this.el = t.createChild('div', {
        className: 'player-info',
        innerHTML: (t.player.options.type == 'audio' ? '<div class="preview"></div>' : '') + '<div class="controller"></div><div class="playlist"></div>'
      });

      preview.el = this.el.child(".preview");
      playlist.el = this.el.child(".playlist");
      controller.el = this.el.child(".controller");
    },
    hide: function () {
      var el = this.el;
      el.addClass('hide');
      window.setTimeout(function () {
        el.removeClass('show hide');
      }, 300);
    }
  };

  // 播放列表
  var playlist = {
    el: null,
    data: [],
    index: -1,
    errnum: 0,
    add: function (group, list) {
      var that = this;
      list.forEach(function (item, i) {
        item.group = group;
        item.name = item.name || item.title || 'Media name';
        item.artist = item.artist || item.author || 'Anonymous';
        item.cover = item.cover || item.pic;
        item.type = item.type || 'normal';
        that.data.push(item);
      });
    },
    clear: function () {
      this.data = [];
      this.el.innerHTML = "";
      if (this.index !== -1) {
        this.index = -1;
        t.player.fetch();
      }
    },
    create: function () {
      var el = this.el;
      this.data.map(function (item, index) {
        if (item.el) return;

        var id = 'list-' + t.player._id + '-' + item.group;
        var tab = document.getElementById(id);
        if (!tab) {
          tab = el.createChild('div', {
            id: id,
            className: t.player.group ? 'tab' : '',
            innerHTML: '<ol></ol>',
          });
          if (t.player.group) {
            tab.attr('data-title', t.player.options.rawList[item.group]['title'])
              .attr('data-id', t.player._id);
          }
        }

        item.el = tab.child('ol').createChild('li', {
          title: item.name + ' - ' + item.artist,
          innerHTML: '<span class="info"><span>' + item.name + '</span><span>' + item.artist + '</span></span>',
          onclick: function (event) {
            var current = event.currentTarget;
            if (playlist.index === index && progress.el) {
              if (source.paused) {
                t.player.play();
              } else {
                t.player.seek(source.duration * progress.percent(event, current));
              }
              return;
            }
            t.player.switch(index);
            t.player.play();
          }
        });
        return item;
      });
      tabFormat();
    },
    current: function () {
      return this.data[this.index];
    },
    scroll: function () {
      var item = this.current();
      var li = this.el.child('li.active');
      li && li.removeClass('active');

      if (item && item.el) {
        item.el.addClass('active');
        var tab = this.el.child('.music-tab-pane.active');
        tab && tab.removeClass('active');

        // 找到对应的tab和导航
        var targetTab = item.el.closest('.music-tab-pane');
        if (targetTab) {
          // 激活对应的tab
          targetTab.addClass('active');

          // 激活对应的导航
          var tabsContainer = targetTab.closest('.music-tabs');
          if (tabsContainer) {
            var navTabs = tabsContainer.querySelectorAll('.music-tab');
            var tabPanes = tabsContainer.querySelectorAll('.music-tab-pane');
            var targetIndex = Array.from(tabPanes).indexOf(targetTab);

            navTabs.forEach(function (nav, index) {
              if (index === targetIndex) {
                nav.classList.add('active');
              } else {
                nav.classList.remove('active');
              }
            });

            tabPanes.forEach(function (pane, index) {
              if (index === targetIndex) {
                pane.classList.add('active');
              } else {
                pane.classList.remove('active');
              }
            });
          }
        }

        // 在正确的容器内滚动
        var scrollContainer = targetTab || this.el;
        var listContainer = scrollContainer.querySelector('ol');

        if (listContainer && item.el) {
          var containerHeight = listContainer.clientHeight;
          var itemOffsetTop = item.el.offsetTop;
          var itemHeight = item.el.clientHeight;

          // 将当前播放项滚动到容器中央
          var targetScrollTop = itemOffsetTop - (containerHeight / 2) + (itemHeight / 2);
          var maxScrollTop = listContainer.scrollHeight - containerHeight;

          listContainer.scrollTop = Math.max(0, Math.min(targetScrollTop, maxScrollTop));
        }
      }
      return this;
    },
    title: function () {
      if (source.paused) return;
      var current = this.current();
      document.title = 'Now Playing...' + current['name'] + ' - ' + current['artist'] + ' | ' + originTitle;
    },
    error: function () {
      var current = this.current();
      current.el.removeClass('current').addClass('error');
      current.error = true;
      this.errnum++;
    }
  };

  // 歌词处理
  var lyrics = {
    el: null,
    data: null,
    index: 0,
    create: function (box) {
      var current = playlist.index;
      var that = this;
      var raw = playlist.current().lrc;

      var callback = function (body) {
        if (current !== playlist.index) return;
        that.data = that.parse(body);
        var lrc = '';
        that.data.forEach(function (line, index) {
          lrc += '<p' + (index === 0 ? ' class="current"' : '') + '>' + line[1] + '</p>';
        });
        that.el = box.createChild('div', {
          className: 'inner',
          innerHTML: lrc
        }, 'replace');
        that.index = 0;
      };

      if (raw && raw.startsWith('http')) {
        this.fetch(raw, callback);
      } else {
        callback(raw || '');
      }
    },
    update: function (currentTime) {
      if (!this.data) return;
      if (this.index > this.data.length - 1 || currentTime < this.data[this.index][0] || (!this.data[this.index + 1] || currentTime >= this.data[this.index + 1][0])) {
        for (var i = 0; i < this.data.length; i++) {
          if (currentTime >= this.data[i][0] && (!this.data[i + 1] || currentTime < this.data[i + 1][0])) {
            this.index = i;
            // 获取歌词容器和当前歌词行
            var lrcContainer = this.el.parentElement;
            var lrcLines = this.el.getElementsByTagName('p');

            // 移除当前类
            var currentElements = this.el.getElementsByClassName('current');
            for (var j = 0; j < currentElements.length; j++) {
              currentElements[j].removeClass('current');
            }

            // 为当前歌词行添加current类
            if (lrcLines[i]) {
              lrcLines[i].addClass('current');
            }

            // 计算滚动位置，使当前歌词行居中显示
            if (lrcContainer && lrcLines[i]) {
              var containerHeight = lrcContainer.clientHeight;
              var lineHeight = lrcLines[i].clientHeight;
              var lineOffsetTop = lrcLines[i].offsetTop;

              // 计算需要滚动的位置，使当前歌词行居中
              var scrollY = lineOffsetTop - (containerHeight / 2) + (lineHeight / 2);

              // 平滑滚动到指定位置
              this.el.style.transition = 'transform 0.3s ease';
              this.el.style.transform = 'translateY(' + (-scrollY) + 'px)';
              this.el.style.webkitTransform = 'translateY(' + (-scrollY) + 'px)';
            }
          }
        }
      }
    },
    parse: function (lrc_s) {
      if (lrc_s) {
        lrc_s = lrc_s.replace(/([^\]^\n])\[/g, function (match, p1) {
          return p1 + '\n['
        });
        const lyric = lrc_s.split('\n');
        var lrc = [];
        const lyricLen = lyric.length;
        for (var i = 0; i < lyricLen; i++) {
          const lrcTimes = lyric[i].match(/\[(\d{2}):(\d{2})(\.(\d{2,3}))?\]/g);
          const lrcText = lyric[i]
            .replace(/.*\[(\d{2}):(\d{2})(\.(\d{2,3}))?\]/g, '')
            .replace(/<(\d{2}):(\d{2})(\.(\d{2,3}))?>/g, '')
            .replace(/^\s+|\s+$/g, '')
          if (lrcTimes) {
            const timeLen = lrcTimes.length;
            for (var j = 0; j < timeLen; j++) {
              const oneTime = /\[(\d{2}):(\d{2})(\.(\d{2,3}))?\]/.exec(lrcTimes[j]);
              const min2sec = oneTime[1] * 60;
              const sec2sec = parseInt(oneTime[2]);
              const msec2sec = oneTime[4] ? parseInt(oneTime[4]) / ((oneTime[4] + '').length === 2 ? 100 : 1000) : 0;
              const lrcTime = min2sec + sec2sec + msec2sec;
              lrc.push([lrcTime, lrcText]);
            }
          }
        }
        lrc = lrc.filter(function (item) {
          return item[1]
        });
        lrc.sort(function (a, b) {
          return a[0] - b[0]
        });
        return lrc;
      } else {
        return [];
      }
    },
    fetch: function (url, callback) {
      fetch(url)
        .then(function (response) {
          return response.text();
        }).then(function (body) {
          callback(body);
        }).catch(function (ex) {});
    }
  };

  // 预览界面
  var preview = {
    el: null,
    create: function () {
      var current = playlist.current();
      this.el.innerHTML = '<div class="background"><img src="' + (current.cover || '') + '" alt="Background"/></div>' +
        '<div class="cover-container">' +
        '<div class="left-controls">' +
        '<button class="side-control-btn backward-btn" data-action="backward" title="上一首"></button>' +
        '<button class="side-control-btn mode-btn ' + t.player.options.mode + '" data-action="mode" title="播放模式"></button>' +
        '</div>' +
        '<div class="cover">' +
        '<div class="disc"><img src="' + (current.cover || '') + '" alt="Album Cover"/></div>' +
        '<div class="play-overlay" data-action="play-pause"></div>' +
        '</div>' +
        '<div class="right-controls">' +
        '<button class="side-control-btn forward-btn" data-action="forward" title="下一首"></button>' +
        '<div class="side-control-btn volume-btn ' + (source.muted ? 'off' : 'on') + '" data-action="volume" title="音量控制">' +
        '<div class="volume-icon"></div>' +
        '<div class="volume-slider">' +
        '<div class="volume-percent">' + Math.floor((source.volume || 1) * 100) + '%</div>' +
        '<div class="slider-track">' +
        '<div class="slider-progress" style="height: ' + Math.floor((source.volume || 1) * 100) + '%"></div>' +
        '<div class="slider-thumb" style="bottom: ' + Math.floor((source.volume || 1) * 100) + '%"></div>' +
        '</div>' +
        '</div>' +
        '</div>' +
        '</div>' +
        '</div>' +
        '<div class="info"><h4 class="title">' + current.name + '</h4><span>' + current.artist + '</span></div>' +
        '<div class="lrc"></div>';


      // 绑定事件
      var buttons = this.el.querySelectorAll('[data-action]');
      var that = this;
      buttons.forEach(function (btn) {
        var action = btn.getAttribute('data-action');

        if (action === 'volume') {
          // 特殊处理音量按钮
          that.setupVolumeControl(btn);
        } else if (action === 'mode') {
          // 特殊处理模式按钮
          btn.addEventListener('click', function (e) {
            e.preventDefault();
            e.stopPropagation();
            that.handleModeChange(btn);
          });
        } else {
          btn.addEventListener('click', function (e) {
            e.preventDefault();
            e.stopPropagation();
            if (controller.events[action]) {
              controller.events[action](e);
            } else if (t.player.options.events[action]) {
              t.player.options.events[action](e);
            }
          });
        }
      });

      //this.el.child('.cover').addEventListener('click', t.player.options.events['play-pause']);
      lyrics.create(this.el.child('.lrc'));
    },
    // 添加音量控制设置方法
    setupVolumeControl: function (volumeBtn) {
      var slider = volumeBtn.querySelector('.volume-slider');
      var track = volumeBtn.querySelector('.slider-track');
      var progress = volumeBtn.querySelector('.slider-progress');
      var thumb = volumeBtn.querySelector('.slider-thumb');
      var percent = volumeBtn.querySelector('.volume-percent');
      var icon = volumeBtn.querySelector('.volume-icon');
      var that = this;

      if (!slider || !track || !progress || !thumb || !percent) {
        console.error('音量调节器元素未找到');
        return;
      }

      // 音量图标点击切换静音
      icon.addEventListener('click', function (e) {
        e.stopPropagation();
        if (source.muted) {
          t.player.muted();
          t.player.volume(source.volume || 0.5);
        } else {
          t.player.muted('muted');
        }
        that.updateVolumeDisplay(volumeBtn);
      });

      // 点击轨道设置音量
      track.addEventListener('click', function (e) {
        e.stopPropagation();
        var rect = track.getBoundingClientRect();
        var clickY = e.clientY - rect.top;
        var trackHeight = rect.height;
        var volume = 1 - (clickY / trackHeight);
        volume = Math.max(0, Math.min(1, volume));

        if (source.muted) {
          t.player.muted();
        }
        t.player.volume(volume);
        that.updateVolumeDisplay(volumeBtn);
      });

      // 拖动滑块调节音量
      thumb.addEventListener('mousedown', function (e) {
        e.preventDefault();
        e.stopPropagation();

        var rect = track.getBoundingClientRect();
        var trackHeight = rect.height;
        var isDragging = false;

        function onMouseMove(e) {
          isDragging = true;
          var clientY = e.clientY;
          var relativeY = clientY - rect.top;
          var volume = 1 - (relativeY / trackHeight);
          volume = Math.max(0, Math.min(1, volume));

          if (source.muted) {
            t.player.muted();
          }

          // 直接更新音量，避免重复调用
          source.volume = volume;
          that.updateVolumeDisplay(volumeBtn);
        }

        function onMouseUp() {
          document.removeEventListener('mousemove', onMouseMove);
          document.removeEventListener('mouseup', onMouseUp);

          if (isDragging) {
            // 拖动结束后同步存储
            store.set('_PlayerVolume', source.volume);
          }
        }

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
      });

      // 显示/隐藏音量滑块
      volumeBtn.addEventListener('mouseenter', function () {
        slider.style.opacity = '1';
        slider.style.visibility = 'visible';
      });

      volumeBtn.addEventListener('mouseleave', function () {
        slider.style.opacity = '0';
        slider.style.visibility = 'hidden';
      });
    },

    // 更新音量显示
    updateVolumeDisplay: function (volumeBtn) {
      var progress = volumeBtn.querySelector('.slider-progress');
      var thumb = volumeBtn.querySelector('.slider-thumb');
      var percent = volumeBtn.querySelector('.volume-percent');
      var icon = volumeBtn.querySelector('.volume-icon');

      if (!progress || !thumb || !percent) return;

      var volume = source.muted ? 0 : source.volume;
      var percentage = Math.floor(volume * 100);

      // 使用 requestAnimationFrame 确保平滑更新
      requestAnimationFrame(function () {
        progress.style.height = percentage + '%';
        thumb.style.bottom = percentage + '%';
        percent.textContent = percentage + '%';
      });

      // 更新图标状态
      volumeBtn.className = volumeBtn.className.replace(/(on|off)/g, '');
      volumeBtn.className += source.muted || volume === 0 ? ' off' : ' on';
    },
    // 处理模式切换
    handleModeChange: function (modeBtn) {
      var oldMode = t.player.options.mode;

      switch (t.player.options.mode) {
        case 'loop':
          t.player.options.mode = 'random';
          break;
        case 'random':
          t.player.options.mode = 'order';
          break;
        default:
          t.player.options.mode = 'loop';
      }

      // 更新按钮样式
      modeBtn.className = modeBtn.className.replace(oldMode, t.player.options.mode);

      // 保存到本地存储
      store.set('_PlayerMode', t.player.options.mode);

      // 显示提示
      var modeText = {
        'loop': '单曲循环',
        'random': '随机播放',
        'order': '顺序播放'
      };
      showtip('播放模式: ' + modeText[t.player.options.mode]);
    }



  };






  // 全局进度条
  var globalProgress = {
    el: null,
    bar: null,
    create: function () {
      if (this.el) return;

      // 在controller上方创建进度条
      this.el = controller.el.parentNode.insertBefore(
        document.createElement('div'),
        controller.el
      );
      this.el.className = 'player-progress';
      this.el.innerHTML = '<div class="progress-track"><div class="progress-bar"></div></div><div class="time-info"><span class="current-time">0:00</span><span class="total-time">0:00</span></div>';

      this.bar = this.el.querySelector('.progress-bar');
      this.currentTimeEl = this.el.querySelector('.current-time');
      this.totalTimeEl = this.el.querySelector('.total-time');

      // 添加点击和拖拽事件
      var track = this.el.querySelector('.progress-track');
      track.addEventListener('click', this.seek.bind(this));
      track.addEventListener(utils.nameMap.dragStart, this.drag.bind(this));
    },

    update: function (currentTime, duration) {
      if (!this.el || !duration) return;

      var percent = currentTime / duration;
      this.bar.style.width = Math.floor(percent * 100) + '%';
      this.currentTimeEl.textContent = utils.secondToTime(currentTime);
      this.totalTimeEl.textContent = utils.secondToTime(duration);
    },

    seek: function (e) {
      if (!source.duration) return;

      var track = this.el.querySelector('.progress-track');
      var rect = track.getBoundingClientRect();
      var percent = (e.clientX - rect.left) / rect.width;
      percent = Math.max(0, Math.min(1, percent));

      t.player.seek(percent * source.duration);
    },

    drag: function (e) {
      e.preventDefault();
      var track = this.el.querySelector('.progress-track');
      var that = this;

      var thumbMove = function (e) {
        e.preventDefault();
        var rect = track.getBoundingClientRect();
        var percent = ((e.clientX || e.changedTouches[0].clientX) - rect.left) / rect.width;
        percent = Math.max(0, Math.min(1, percent));

        that.bar.style.width = Math.floor(percent * 100) + '%';
        that.currentTimeEl.textContent = utils.secondToTime(percent * source.duration);
      };

      var thumbUp = function (e) {
        e.preventDefault();
        document.removeEventListener(utils.nameMap.dragEnd, thumbUp);
        document.removeEventListener(utils.nameMap.dragMove, thumbMove);

        var rect = track.getBoundingClientRect();
        var percent = ((e.clientX || e.changedTouches[0].clientX) - rect.left) / rect.width;
        percent = Math.max(0, Math.min(1, percent));

        t.player.seek(percent * source.duration);
        source.disableTimeupdate = false;
      };

      source.disableTimeupdate = true;
      document.addEventListener(utils.nameMap.dragMove, thumbMove);
      document.addEventListener(utils.nameMap.dragEnd, thumbUp);
    }
  };









  // 进度条
  var progress = {
    el: null,
    bar: null,
    create: function () {
      var current = playlist.current().el;
      if (current) {
        if (this.el) {
          this.el.parentNode.removeClass('current')
            .removeEventListener(utils.nameMap.dragStart, this.drag);
          this.el.remove();
        }

        this.el = current.createChild('div', {
          className: 'progress'
        });

        this.el.attr('data-dtime', utils.secondToTime(0));
        this.bar = this.el.createChild('div', {
          className: 'bar',
        });

        current.addClass('current');
        current.addEventListener(utils.nameMap.dragStart, this.drag);
        playlist.scroll();
      }
    },
    update: function (percent) {
      this.bar.width(Math.floor(percent * 100) + '%');
      this.el.attr('data-ptime', utils.secondToTime(percent * source.duration));
    },
    seeking: function (type) {
      if (type) {
        this.el.addClass('seeking');
      } else {
        this.el.removeClass('seeking');
      }
    },
    percent: function (e, el) {
      var percentage = ((e.clientX || e.changedTouches[0].clientX) - el.left()) / el.width();
      percentage = Math.max(percentage, 0);
      return Math.min(percentage, 1);
    },
    drag: function (e) {
      e.preventDefault();
      var current = playlist.current().el;

      var thumbMove = function (e) {
        e.preventDefault();
        var percentage = progress.percent(e, current);
        progress.update(percentage);
        lyrics.update(percentage * source.duration);
      };

      var thumbUp = function (e) {
        e.preventDefault();
        current.removeEventListener(utils.nameMap.dragEnd, thumbUp);
        current.removeEventListener(utils.nameMap.dragMove, thumbMove);
        var percentage = progress.percent(e, current);
        progress.update(percentage);
        t.player.seek(percentage * source.duration);
        source.disableTimeupdate = false;
        progress.seeking(false);
      };

      source.disableTimeupdate = true;
      progress.seeking(true);
      current.addEventListener(utils.nameMap.dragMove, thumbMove);
      current.addEventListener(utils.nameMap.dragEnd, thumbUp);
    }
  };

  // 控制器
  var controller = {
    el: null,
    btns: {},
    step: 'next',
    create: function () {
      if (!t.player.options.controls) return;

      // 创建全局进度条
      globalProgress.create();

      var that = this;
      t.player.options.controls.forEach(function (item) {
        if (that.btns[item]) return;


        var opt = {
          onclick: function (event) {
            that.events[item] ? that.events[item](event) : t.player.options.events[item](event);
          }
        };

        opt.className = item + opt.className + ' btn';
        that.btns[item] = that.el.createChild('div', opt);
      });

    },
    events: {
      mode: function (e) {
        switch (t.player.options.mode) {
          case 'loop':
            t.player.options.mode = 'random';
            break;
          case 'random':
            t.player.options.mode = 'order';
            break;
          default:
            t.player.options.mode = 'loop';
        }
        controller.btns['mode'].className = 'mode ' + t.player.options.mode + ' btn';
        store.set('_PlayerMode', t.player.options.mode);
      },
      backward: function (e) {
        controller.step = 'prev';
        t.player.mode();
      },
      forward: function (e) {
        controller.step = 'next';
        t.player.mode();
      },
    },
    update: function (percent) {
      if (controller.btns['volume']) {
        controller.btns['volume'].className = 'volume ' + (!source.muted && percent > 0 ? 'on' : 'off') + ' btn';
        if (controller.btns['volume'].bar) {
          controller.btns['volume'].bar.width(Math.floor(percent * 100) + '%');
        }
        // 只保留一个更新调用
        var volumeBtn = document.querySelector('.volume-btn');
        if (volumeBtn && t.player.updateVolumeDisplay) {
          t.player.updateVolumeDisplay(volumeBtn);
        }
      }
    },
    percent: function (e, el) {
      var rect = el.getBoundingClientRect();
      var clientX = e.clientX || (e.changedTouches && e.changedTouches[0].clientX);
      var percentage = (clientX - rect.left) / rect.width;
      return Math.max(0, Math.min(1, percentage));
    }
  };

  // 事件处理
  var events = {
    onerror: function () {
      playlist.error();
      t.player.mode();
    },
    ondurationchange: function () {
      if (source.duration !== 1) {
        progress.el.attr('data-dtime', utils.secondToTime(source.duration));
      }
    },
    onloadedmetadata: function () {
      t.player.seek(0);
      progress.el.attr('data-dtime', utils.secondToTime(source.duration));
      globalProgress.update(0, source.duration);
    },
    onplay: function () {
      t.parentNode.addClass('playing');
      showtip(this.attr('title'));
      NOWPLAYING = t;
    },
    onpause: function () {
      t.parentNode.removeClass('playing');
      NOWPLAYING = null;
    },
    ontimeupdate: function () {
      if (!this.disableTimeupdate) {
        progress.update(this.currentTime / this.duration);
        globalProgress.update(this.currentTime, this.duration);
        lyrics.update(this.currentTime);
      }
    },
    onended: function (argument) {
      t.player.mode();
      t.player.play();
    }
  };

  // 按钮
  var buttons = {
    el: {},
    create: function () {
      if (!t.player.options.btns) return;

      var that = this;
      t.player.options.btns.forEach(function (item) {
        if (that.el[item]) return;

        that.el[item] = t.createChild('div', {
          className: item + ' btn',
          onclick: function (event) {
            t.player.fetch().then(function () {
              t.player.options.events[item](event);
            });
          }
        });
      });
    }
  };

  // 初始化
  var init = function (config) {
    if (t.player.created) return;

    t.player.options = Object.assign(option, config);
    t.player.options.mode = store.get('_PlayerMode') || t.player.options.mode;

    buttons.create();
    source = t.createChild(t.player.options.type, events);
    info.create();

    t.parentNode.addClass(t.player.options.type);
    t.player.created = true;
  };

  init(config);
  return t;
};
