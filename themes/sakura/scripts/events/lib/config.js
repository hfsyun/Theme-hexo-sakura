'use strict';

const merge = require('hexo-util').deepMerge;
const fs = require('hexo-fs');
const path = require('path');
const yaml = require('js-yaml');



module.exports = hexo => {





    const data = hexo.locals.get('data');



    if (data.images && data.images.length > 6) {
        hexo.theme.config.image_list = data.images
    } else {
        hexo.theme.config.image_list = yaml.safeLoad(fs.readFileSync(path.join(__dirname, '../../_images.yml')))
    }
};