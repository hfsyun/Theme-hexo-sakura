/* global hexo */

'use strict';

const crypto = require('crypto');
const nextUrl = require('./next-url');
hexo.extend.helper.register('next_url', nextUrl);

const { htmlTag, url_for } = require('hexo-util');
const url = require('url');
const fs = require('fs');
const path = require('path');


const randomServer = parseInt(Math.random() * 4, 10) + 1

const randomBG = function(count = 1, image_server = null, image_list = []) {
    if (image_server) {
        if (count && count > 1) {
            var arr = new Array(count);
            for (var i = 0; i < arr.length; i++) {
                arr[i] = image_server + '?' + Math.floor(Math.random() * 999999)
            }

            return arr;
        }

        return image_server + '?' + Math.floor(Math.random() * 999999)
    }

    var parseImage = function(img, size) {
        if (img.startsWith('//') || img.startsWith('http')) {
            return img
        } else {
            return img
        }
    }

    if (count && count > 1) {
        var shuffled = image_list.slice(0),
            i = image_list.length,
            min = i - count,
            temp, index;
        while (i-- > min) {
            index = Math.floor((i + 1) * Math.random());
            temp = shuffled[index];
            shuffled[index] = shuffled[i];
            shuffled[i] = temp;
        }

        return shuffled.slice(min).map(function(img) {
            return parseImage(img, 'large')
        });
    }

    return parseImage(image_list[Math.floor(Math.random() * image_list.length)], 'large')
}


hexo.extend.helper.register('next_data', function(name, ...data) {
    const json = data.length === 1 ? data[0] : Object.assign({}, ...data);
    return `<script class="next-config" data-name="${name}" type="application/json">${
    JSON.stringify(json).replace(/</g, '\\u003c')
  }</script>`;
});


hexo.extend.helper.register('_image_url', function(img, path = '') {
    const { statics } = hexo.theme.config;
    const { post_asset_folder } = hexo.config;

    if (img.startsWith('//') || img.startsWith('http')) {
        return img
    } else {
        return url_for.call(this, statics + (post_asset_folder ? path : '') + img)
    }
})



hexo.extend.helper.register('_cover', function(item, num) {
    const { statics, js, image_server, image_list } = hexo.theme.config;

    if (item.cover) {
        return this._image_url(item.cover, item.path)
    } else {
        return randomBG(num || 1, image_server, image_list);
    }

});

hexo.extend.helper.register('canonical', function() {
    // https://support.google.com/webmasters/answer/139066
    const { permalink } = hexo.config;
    let url = this.url.replace(/index\.html$/, '');
    if (!permalink.endsWith('.html')) {
        url = url.replace(/\.html$/, '');
    }
    return `<link rel="canonical" href="${url}">`;
});

hexo.extend.helper.register('gitalk_md5', function(path) {
    const str = this.url_for(path);
    return crypto.createHash('md5').update(str).digest('hex');
});



hexo.extend.helper.register('_md5', function(path) {
    let str = url_for.call(this, path);
    str.replace('index.html', '');
    return crypto.createHash('md5').update(str).digest('hex');
});




/**
 * Get page path given a certain language tag
 */
hexo.extend.helper.register('i18n_path', function(language) {
    const { path, lang } = this.page;
    const base = path.startsWith(lang) ? path.slice(lang.length + 1) : path;
    return this.url_for(`${this.languages.indexOf(language) === 0 ? '' : '/' + language}/${base}`);
});

/**
 * Get the language name
 */
hexo.extend.helper.register('language_name', function(language) {
    const name = hexo.theme.i18n.__(language)('name');
    return name === 'name' ? language : name;
});