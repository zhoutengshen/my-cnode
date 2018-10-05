const axios = require("axios");
const path = require("path");
const webpack = require("webpack");
const config = require("../webpackConfig/server.config");
const memoryFs = require("memory-fs");
const httpProxy = require("http-proxy-middleware")//代理
const reactAsyncBootstrpper = require("react-async-bootstrapper");
//获取html模板,开发环境中的模板存在于内存中，不在硬盘，可以使用http请求获取，这里使用axios  👇
const getHtmlTemplate = () => {
    return new Promise((resolve, reject) => {
        axios.get("http://localhost:3000/public/index.html")
            .then(resp => {
                resolve(resp.data);
            })
            .catch(erroe => {
                reject(erroe);
            });
    });
    // let htmlTemplate = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><meta http-equiv="X-UA-Compatible" content="ie=edge"><title>Document</title><link rel="shortcut icon" href="/favicon.ico" type="image/x-icon" /></head><body><div id='app'><!--app--></div><!--script--></body></html>`;
    // return new Promise((resolve, react) => {
    //     resolve(htmlTemplate);
    // });
};
const complie = webpack(config);//这里默认编译后的文件将储存到硬盘
const mmfs = new memoryFs();
complie.outputFileSystem = mmfs;//webpakc打包后文件将储存到内存
const moduleWraper = (code) => {//相当于require("module").wrap(code)的作用=====>function(exports,require,module,__filename,__dirname){}
    return `(function(exports,require,module,__filename,__dirname){${code}});`;
};
const vm = require("vm");
const str2JSModule = (code) => {
    //////////// begincode///////////
    ////这样生成的代码如果由外部依赖会异常；
    // let Module = module.constructor;
    // let m = new Module();
    // m._compile(code, "server.entry.js");
    // return m.exports;
    ///////////endcode////////////////
    code = moduleWraper(code);
    let script = new vm.Script(code, { filename: "temp.js", displayErrors: true });
    //wraper ==> function(exports,require,module,__filename,__dirname){}
    const wraper = script.runInThisContext();
    const codeModule = { exports: {} };
    wraper.call(codeModule, codeModule.exports, require, codeModule, __filename, __dirname);
    return codeModule.exports;
}
let serverEntryExports;
complie.watch({}, (err, states) => {//这里监视源文件，一旦发生更改将触发这个函数
    if (err) throw err;
    console.log("=============源文件发生了更改,更新内存里面的文件（模拟热加载）！")
    status = states.toJson();
    console.log(states.toString());
    //文件的路径：即在webpack配置的路劲
    let bundJspath = path.join(
        config.output.path,
        config.output.filename
    );
    //一旦文件发生更改，即生成新的js文件，我们以同步的方式将他读取出来，
    let code = mmfs.readFileSync(bundJspath, "UTF-8");//:string
    //这里返回一个字符串，如何将字符串转化为一个js模块？===》https://stackoverflow.com/questions/17581830/load-node-js-module-from-string-in-memory
    serverEntryExports = str2JSModule(code);//这里相当于 require()
});

module.exports = function (app) {
    app.use("/public", httpProxy({//将所有/pblic请求代理到webpack-dev-server的服务器下
        target: "http://localhost:3000"
    }));
    //被代理的请求不会再被get请求处理
    app.get("*", function (req, resp) {//客户端请求，我们需要返回一个html模板
        getHtmlTemplate().then(template => {


            //服务端渲染；
            let ssr = require("react-dom/server");
            const serverEntry = serverEntryExports.default;
            const { createAppState, AppStateClass } = serverEntryExports;
            let routerContext = {};
            let url = req.path;
            const appState = createAppState();
            let app = serverEntry({ appState }, routerContext, url);

            reactAsyncBootstrpper(app)
                .then(() => {
                    let app = serverEntry({ appState }, routerContext, url);
                    const serverRenderHtml = ssr.renderToString(app);
                    //服务端渲染不处理Redirect，routerContext为{ action: 'REPLACE',location: { pathname: '', search: '', hash: '', state: any },url: '' }。
                    //所以，我么需要手动重定向
                    if (routerContext.url && url !== routerContext.url) {
                        resp.status(302).setHeader('Location', routerContext.url);
                        resp.send();
                    }
                    //插入脚本,解决客户端数据
                    let scriptStr = `
                        <script>
                        window.__INITIAL_STATES__ = ${JSON.stringify(appState)}
                        <\/script>
                    `;
                    template = template.replace("<!--script-->", scriptStr);
                    resp.send(template.replace("<!--app-->", serverRenderHtml));
                })
                .catch(() => {

                });
        }).catch(error => resp.send(error.toString()))
    });

}; 
