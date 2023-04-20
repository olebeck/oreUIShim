let routesLoaded_resolve;
const routesLoaded = new Promise((r) => routesLoaded_resolve = r);

const colorDebug = "#fc03d7";
const colorInfo = "#03fcb1";
const colorWarn = "#fc7703";
const colorError = "#fc0339";

function debugMessage(name, color, ...data) {
  console.log(`[%cEngineFrame%c] %c%s`, "color: #0398fc;", "color: initial;", `color: ${color};`, name, ...data);
}

const _ME_Translations = {};

class Router {
  /** @type {HTMLIFrameElement} */
  iframe;

  routes = [];

  constructor(iframe) {
    this.iframe = iframe;
    this.iframe.contentDocument.write(`
      <style>
      div {
        height: min-content;
      }
      </style>
      <script src="/engine.js"></script>
    `);
    this.iframe.contentWindow._ME_Translations = _ME_Translations;

    window.addEventListener("hashchange", (ev) => {
      const path = new URL(ev.newURL).hash.split("?")[0].slice(1);
      if(path == "") {
        location.hash = "/badger/mainMenu";
        return;
      }
      this.lookupRoute(path);
    });

    window.addEventListener("message", (ev) => {
        console.log(ev.data);
        if(ev.data.RouterEvent) {
            debugMessage("RouterEvent", colorInfo, ev.data.RouterEvent);
            window.location.hash = ev.data.RouterEvent;
        }
    });

    fetch("./hbui/routes.json").then(resp => resp.json()).then(routes_json => {
      this.routes = routes_json.routes;
      routesLoaded_resolve();
    });
  }

  lookupRoute(path) {
    console.log("lookupRoute", path)
    let supportedRoute = null;
    const route = this.routes.find(route => {
      supportedRoute = route.supportedRoutes.find(supportedRoute => {
        const re = new RegExp(supportedRoute.regexp);
        if(re.test(path)) {
          return true;
        }
        return false;
      });
      if(supportedRoute) {
        return true;
      }
      return false;
    });
    if(route) {
      debugMessage("Router", colorInfo, "Navigating to", route.fileName);
      this.loadIframe(route.fileName, path);
      return true;
    }
    return false;
  }

  async loadIframe(filename, path) {
    this.iframe.contentWindow.location.hash = path;
    const oldFilename = this.iframe.getAttribute("filename");
    if(oldFilename != filename) {
      debugMessage("Router", colorDebug, "Loading File", filename);
      let text = await fetch("./"+filename).then(resp => resp.text());
      this.iframe.setAttribute("filename", filename);
      this.iframe.contentWindow.postMessage({
        pathname: path,
        content: text,
      });
    }
    
  }
}



let localizationLoaded_resolve;
const localizationLoaded = new Promise((r) => localizationLoaded_resolve = r);
async function loadLocalization() {
  let version = await fetch("./hbui/VERSION").then(resp => {
      if(resp.status == 200) {
        return resp.text();
      } else {
        return "";
      }
    }).catch(e => {
    debugMessage("Translations", colorError, {
      "error": e,
    });
  });

  if(version) {
    version = version.split("\n")[0]
    debugMessage("Ore UI", colorInfo, {"Version": version});
    version = "."+version;
  }

  debugMessage("Translations", colorInfo, "Loading loc.lang file...");
  const locdat = await fetch(`/loc${version}.lang`).then(resp => resp.text()).catch(e => {
    debugMessage("Translations", colorError, {
      "error": e,
    });
  });
  const lines = locdat.split("\n");
  lines.forEach(function (item, ind) {
    keyval = item.split("=");
    _ME_Translations[keyval[0]] = keyval[1]?.replace("\r", ""); //oh windows you special snowflake
  });

  debugMessage("Translations", colorDebug, "Loaded");
  localizationLoaded_resolve();
  return;
}


loadLocalization();
const loadFinished = Promise.all([localizationLoaded, routesLoaded]);
