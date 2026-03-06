/* global hexo */

'use strict';
const { htmlTag, url_for } = require('hexo-util');
const theme_env = require('../../package.json');

hexo.extend.helper.register('hexo_env', function(type) {
    return this.env[type]
})

hexo.extend.helper.register('theme_env', function(type) {
    return theme_env[type]
})

hexo.extend.helper.register('_css', function(...urls) {
    const { statics, css } = hexo.theme.config;

    return urls.map(url => htmlTag('link', { rel: 'stylesheet', href: url_for.call(this, `${statics}${css}/${url}?v=${theme_env['version']}`) })).join('');
});


hexo.extend.helper.register('_js', function(...urls) {
    const { js } = hexo.theme.config;

    return urls.map(url => htmlTag('script', { src: url_for.call(this, `${js}/${url}?v=${theme_env['version']}`) }, '')).join('');
});