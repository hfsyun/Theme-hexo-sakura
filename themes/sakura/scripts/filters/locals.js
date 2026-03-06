/* global hexo */

'use strict';


hexo.extend.filter.register('template_locals', locals => {
    const { config } = hexo;
    const { __, theme, page } = locals;
    const { i18n } = hexo.theme;
    // Hexo & NexT version
    locals.next_version = require('../../package.json').version;
    // Language & Config
    locals.title = __('title') !== 'title' ? __('title') : config.title;
    locals.subtitle = __('subtitle') !== 'subtitle' ? __('subtitle') : config.subtitle;
    locals.author = __('author') !== 'author' ? __('author') : config.author;
    locals.description = __('description') !== 'description' ? __('description') : config.description;
    locals.languages = [...i18n.languages];
    locals.languages.splice(locals.languages.indexOf('default'), 1);
    // See https://github.com/hexojs/hexo/pull/4614
    page.lang = page.lang || page.language;
    // PJAX
    //locals.pjax = theme.pjax ? ' data-pjax' : '';


});