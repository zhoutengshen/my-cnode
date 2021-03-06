const reactAsyncBootstrpper = require("react-async-bootstrapper");
const { SheetsRegistry } = require('jss');
const stringify = require("javascript-stringify");
const {
    createMuiTheme
} = require('@material-ui/core/styles');
const green = require('@material-ui/core/colors/green').default;
const red = require('@material-ui/core/colors/red').default;
const indigo = require('@material-ui/core/colors/indigo').default

module.exports = (bundle, template, req, resp, next) => {
    //服务端渲染；
    let ssr = require("react-dom/server");
    const serverEntry = bundle.default;
    const { TopicStore, AppStore } = bundle;
    let routerContext = {};
    let url = req.path;
    let location = {
        pathname: url,
        search: req.originalUrl.substring(req.originalUrl.indexOf("?"), req.originalUrl.length)
    }
    const stores = {
        appStore: new AppStore(),
        topicStore: new TopicStore()
    }
    // Create a sheetsRegistry instance.
    const sheetsRegistry = new SheetsRegistry();

    // Create a theme instance.
    const theme = createMuiTheme({//
        palette: {
            primary: indigo,
            secondary: red
        },
        typography: {
            useNextVariants: true,
        },
    });
    let app = serverEntry({ ...stores }, routerContext, location, sheetsRegistry, theme);
    reactAsyncBootstrpper(app)
        .then(() => {
            const serverRenderHtml = ssr.renderToString(app);
            //服务端渲染不处理Redirect，routerContext为{ action: 'REPLACE',location: { pathname: '', search: '', hash: '', state: any },url: '' }。
            //所以，我么需要手动重定向
            if (routerContext.url && url !== routerContext.url) {
                resp.status(302).setHeader('Location', routerContext.url);
                resp.send();
            };
            const css = sheetsRegistry.toString();
            //插入脚本,解决客户端数据
            let scriptStr = `
                           <script> 
                           window.__INITIAL_STATES__ = ${stringify(stores)}
                           <\/script>
                       `;
            template = template.replace("<!--script-->", scriptStr);
            template = template.replace("<!--style-->", `
                <style id="server-render-css">
                    ${css}
                <\/style>
            `);
            template = template.replace("<!--app-->", serverRenderHtml);
            resp.send(template);
        })
        .catch((error) => {
            next();
        });
}
