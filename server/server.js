const express = require('express');
const path = require('path');
const fs = require('fs');
const serverRender = require('react-dom/server');//服务器渲染
const serveFavicon = require('serve-favicon'); // 网站图标中间件

let app = express();
app.use(serveFavicon(path.join(__dirname, "/favicon.ico")));// 注册网站图标中间价
const isDev = process.env.NODE_ENV === 'development';
if (!isDev) {//非开发环境
    const serverEntry = require('../build/server.entry').default;
    app.use('/public', express.static(path.join(__dirname, '../build')));
    let indexTempateHtml = fs.readFileSync(path.join(__dirname, '../build/index.html'), 'utf-8');
    app.get('*', (req, resp) => {
        let renderHtml = serverRender.renderToString(serverEntry);
        renderHtml = indexTempateHtml.replace('<!--app-->', renderHtml);
        resp.send(renderHtml);
    });

} else {
    const devStatic = require('../utils/devStatic');
    devStatic(app);
}
app.listen(3333, () => {
    console.log('server listening at http://localhost:3333')
});
