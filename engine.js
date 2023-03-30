/*
engine.js
--------
pretend to be the bedrock engine for oreUI's sake
(C) Luminoso 2022 / MIT Licensed
*/


const colorDebug = "#fc03d7";
const colorInfo = "#03fcb1";
const colorWarn = "#fc7703";
const colorError = "#fc0339";

function debugMessage(name, color, ...data) {
  console.log(`[%cEngineWrapper%c] %c%s`, "color: #0398fc;", "color: initial;", `color: ${color};`, name, ...data);
}


if (navigator.userAgent.match("/cohtml/i")) {
  debugMessage("Loader", colorWarn, "OreUI Shim Injected, but the UI is being loaded in gameface!");
}

const USE_TRANSLATIONS = true; //requires a loc.lang at base of host dir

let _ME_OnBindings = {};
let _ME_Translations = {};



//#region core

class LocaleFacet {
  locale = "en_US";
  translate(id) {
    if (USE_TRANSLATIONS) {
      return _ME_Translations[id];
    } else {
      debugMessage("LocaleFacet", colorWarn, "USE_TRANSLATIONS not set, skipping translate", {id});
      return id;
    }
  };
  translateWithParameters(id, params) {
    let translation = this.translate(id);
    for (let i = 1; i <= params.length; i++) {
      translation = translation?.replaceAll("%" + i + "$s", params[i - 1])
    };
    return translation;
  };
  formatDate(date) {
    return new Date(date).toLocaleDateString();
  };
};


const _ME_Platforms = {
  IOS: 0,
  GOOGLE: 1,
  AMAZON_HANDHELD: 2,
  UWP: 3,
  XBOX: 4,
  NX_HANDHELD: 5,
  PS4: 6,
  GEARVR: 7,
  WIN32: 8,
  MACOS: 9,
  AMAZON_TV: 10,
  NX_TV: 11,
  PS5: 12,
};

class DeviceInfoFacet {
  #div;
  constructor() {
    let div = document.createElement("div");
    div.style.width = "1cm";
    div.style.height = "1cm";
    div.style.position = "absolute";
    div.style.top = "10000px";
    document.body.appendChild(div);
    this.#div = div;
  }

  get pixelsPerMillimeter() {
      return this.#div.getBoundingClientRect().width / 10;
  }

  inputMethods = [_ME_InputMethods.GAMEPAD_INPUT_METHOD, _ME_InputMethods.TOUCH_INPUT_METHOD, _ME_InputMethods.MOUSE_INPUT_METHOD];
  isLowMemoryDevice = false;
  guiScaleBase = 4;
  platform = _ME_Platforms.WIN32;
  guiScaleModifier = 0;
}


class SafeZoneFacet {
  safeAreaX = 1;
  screenPositionX = 0;
  safeAreaY = 1;
  screenPositionY = 0;
};


class FeatureFlagsFacet {
  flags = [
    "facet",
    "core.deviceInformation",
    "core.input",
    "core.locale",
    "core.router",
    "core.safeZone",
    "core.screenReader",
    "core.splitScreen",
    "vanilla.achievements",
    "vanilla.enableSeedTemplates",
    "vanilla.enableBehaviorPacksTab",
    "vanilla.enableResourcePacksTab",
    "vanilla.enableResourcePacksRealmsPlusFeatureFlag",
  ];
};


class SplitScreenFacet {
  numActivePlayers = 1;
  splitScreenDirection = 0;
  splitScreenPosition = 0;
};


const _ME_InputMethods = {
  GAMEPAD_INPUT_METHOD: 0,
  TOUCH_INPUT_METHOD: 1,
  MOUSE_INPUT_METHOD: 2,
  MOTION_CONTROLLER_INPUT_METHOD: 3,
};

class InputFacet {
  currentInputType = _ME_InputMethods.MOUSE_INPUT_METHOD;
  swapABButtons = false;
  acceptInputFromAllControllers = false;
  gameControllerId = 0;
  swapXYButtons = false;
};


class ScreenReaderFacet {
  isChatTextToSpeechEnabled = false;
  isIdle = false;
  isUITextToSpeechEnabled = false;

  read(text, interuptable, required, play_in_background) {
    window.speechSynthesis.speak(new SpeechSynthesisUtterance(text));
  }
};


class RouterFacetHistory {
  constructor() {
    window.addEventListener("hashchange", (ev) => {
      const path = new URL(ev.newURL).hash.slice(1);
      this.location.pathname = path;
    
      const handler = _ME_OnBindings[`facet:updated:core.router`];
      if(handler) {
        _ME_OnBindings[`facet:updated:core.router`](_ME_Facets["core.router"]);
      }
    });
  }

  location = {
    hash: "",
    search: "",
    state: "",
    pathname: window.pathname ?? "",
  }
  _ME_previousLocations = [];
  length = 5;
  action = "REPLACE";

  replace(path) {
    this._ME_previousLocations.push(this.location.pathname);
    this.action = "REPLACE";
    debugMessage("RouterFacet", colorInfo, "replacing path", path);
    gotoRoute(path);
  };

  goBack() {
    console.warn("goBack currently doesn't seem to work!");
    debugMessage("RouterFacet", colorInfo, "Back");
    const path = this._ME_previousLocations[this._ME_previousLocations.length - 2];
    gotoRoute(path);
    this._ME_previousLocations.pop();
  };

  push(path) {
    this.action = "PUSH";
    this._ME_previousLocations.push(this.location.pathname);
    debugMessage("RouterFacet", colorInfo, "push path", path);
    gotoRoute(path);
  };
}

class RouterFacet {
  #routes = [];
  constructor() {
    fetch("routes.json").then(resp => resp.json()).then(routes_json => {
      this.#routes = routes_json.routes;
    });
  }

  engineUITransitionTime = 800;
  history = new RouterFacetHistory();

  // not gameface
  lookupRoute(path) {
    let supportedRoute = null;
    const route = this.#routes.find(route => {
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
    if(route && route.fileName != location.pathname) {
      debugMessage("Router", colorInfo, "Navigating to", route.fileName);
      location.pathname = route.fileName;
      location.hash = supportedRoute.route;
      return true;
    }
    return false;
  }
}
function gotoRoute(path) {
  const router = _ME_Facets["core.router"];
  if(router.lookupRoute(path)) {
    return;
  }
  location.hash = path;
}


class CustomScalingFacet {
  scalingModeOverride = 0;
  fixedGuiScaleModifier = 0;
};


class AnimationFacet {
  screenAnimationEnabled = true;
};


class SoundFacet {
  #sound_definitions = {};
  constructor() {
    fetch("sound_definitions.json")
      .then((response) => response.json())
      .then((sounddat) => {
        this.#sound_definitions = sounddat;
        debugMessage("Sound Definitions", colorInfo, "Loaded!");
      });
  }

  play(id) {
    debugMessage("SoundFacet", colorInfo, `Sound ${id} requested.`);
    const soundData = this.#sound_definitions[id];
    if(!soundData) {
      debugMessage("SoundFacet", colorError, {id}, "Not Found");
      return;
    }
    if(soundData.sounds.length == 0) {
      debugMessage("SoundFacet", colorError, {id}, "No Sounds");
      return;
    }

    const randomSound = soundData.sounds[Math.floor(Math.random() * soundData.sounds.length)].name;
    const audio = new Audio(randomSound);
    audio.play();
    return audio;
  };

  isPlaying(audio) {
    return !audio.ended;
  };

  fadeOut(audio) {
    audio.pause();
  };
};


class SocialFacet {};


class UserFacet {};


class performanceFacet {
  #last = performance.now();

  get frameTimeMs() {
    const now = performance.now(); 
    const t = now - this.#last;
    this.#last = now;
    return 1000 / t;
  }
  get gamefaceViewAdvanceTimeMs() {
    return this.frameTimeMs;
  }
};

//#endregion core



//#region vanilla

class AchievementsFacet {
  status = 1;
  data = {
    achievementsUnlocked: 1,
    maxGamerScore: 90,
    hoursPlayed: 100,
    achievements: [
      {
        id: "0",
        name: "Placeholder Achievement",
        description: "Placeholderr!",
        gamerScore: 30,
        progress: 0,
        progressTarget: 0,
        isLocked: false,
        isSecret: false,
        dateUnlocked: Date.now(),
        hasReward: true,
        isRewardOwned: false,
        rewardId: "test",
        rewardName: "Test",
        rewardImage: "/hbui/assets/minecraft-texture-pack-31669.png",
      },
      {
        id: "1",
        name: "Placeholder Achievement",
        description: "Placeholderr!",
        gamerScore: 30,
        progress: 0,
        progressTarget: 0,
        isLocked: true,
        isSecret: false,
        dateUnlocked: 0,
        hasReward: true,
        isRewardOwned: false,
        rewardId: "test",
        rewardName: "Test",
        rewardImage: "/hbui/assets/minecraft-texture-pack-31669.png",
      },
      {
        id: "2",
        name: "Placeholder Achievement",
        description: "Placeholderr!",
        gamerScore: 30,
        progress: 0.5,
        progressTarget: 16,
        isLocked: true,
        isSecret: false,
        dateUnlocked: 0,
        hasReward: true,
        isRewardOwned: false,
        rewardId: "test",
        rewardName: "Test",
        rewardImage: "/hbui/assets/minecraft-texture-pack-31669.png",
      },
    ],
    currentGamerScore: 30,
    maxAchievements: 3,
  };
}

class AchievementsRewardFacet {}


class CreateNewWorldBetaFacet {
  isBetaSupported = true;
  openFeedbackPage() {
    debugMessage("CNWBetaFacet", colorInfo, "openFeedbackPage()");
  };
  optOutOfBeta() {
    debugMessage("CNWBetaFacet", colorInfo, "optOutOfBeta()");
  };
};

class CreateNewWorldFacet {
  isEditorWorld = false;
  isUsingTemplate = false;
  isLockedTemplate = false;
  generalWarningState = 0;
  showedAchievementWarning = false;

  applyTemplate(a) {
    debugMessage("CNWFacet", colorInfo, "applyTemplate.bind()");
  };
  createOnRealms = {
    call: function () {
      debugMessage("CNWFacet", colorInfo, "createOnRealms.call()");
    },
    error: null,
  };

  worldCreationData = {
    general: {
      worldName: "Some World",
      difficulty: 0,
      gameMode: 0,
    },
    advanced: {
      useFlatWorld: false,
      simulationDistance: 8,
      startWithMap: false,
      bonusChest: false,
      showCoordinates: false,
      firesSpreads: true,
      tntExplodes: true,
      respawnBlocksExplode: true,
      mobLoot: true,
      naturalRegeneration: true,
      tileDrops: true,
      immediateRespawn: true,
      respawnRadius: "5", // Why would anyone in their right mind make this a STRING?!
      worldSeed: "",
    },
    cheats: {
      cheatsEnabled: false,
      tickSpeed: 20,
    },
    betaFeatures: [
      {
        id: "0",
        title: "Gameplay Experiment",
        description: "Riveting Gameplay Awaits!",
        isEnabled: false,
        category: 0,
      },
      {
        id: "1",
        title: "AddOn Experiment",
        description: "The Holiday Features that never were...",
        isEnabled: false,
        category: 1,
      },
      {
        id: "2",
        title: "Internal Experiment",
        description: "oooOOOoo Seecreet!",
        isEnabled: false,
        category: 2,
      },
    ],
    multiplayer: {
      generalWarningState: 0,
      multiplayerSupported: true,
      playerPermissions: 1,
      multiplayerGame: true,
      playerAccess: 1,
      visibleToLanPlayers: true,
      friendlyFire: true,
      platformPlayerAccess: 1,
      platformPlayerAccessSupported: true,
      platformPlayerAccessEnabled: true,
      platformPlayerInviteAccessSupported: true,
    },
  };
};

class VanillaOptionsFacet {
  renderDistance = 5;
  defaultRenderDistance = 10;
};

class SeedTemplatesFacet {
  templates = [
    {
      seedValue: "0",
      title: "The Nothing Seed",
      image: "/hbui/assets/world-preview-default-d72bc.jpg",
    }
  ];
};

class SimulationDistanceOptionsFacet {
  simulationDistanceOptions = [4, 6, 8, 10];
};

class DebugSettingsFacet {
  isBiomeOverrideActive = false;
  flatNether = false;
  dimension = 0;
  allBiomes = [
    {
      id: "0",
      label: "plains",
      dimension: 0,
    },
    {
      id: "1",
      label: "birch_forest",
      dimension: 0,
    },
    {
      id: "2",
      label: "jungle",
      dimension: 0,
    },
    {
      id: "3",
      label: "hell",
      dimension: 1,
    },
    {
      id: "4",
      label: "basalt_delta",
      dimension: 1,
    },
    {
      id: "5",
      label: "warped_forest",
      dimension: 1,
    },
  ];
  spawnDimensionId = 0;
  spawnBiomeId = 0;
  biomeOverrideId = 0;
  defaultSpawnBiome = 0;
};


class RealmsStoriesFacet {
  data = {
    stories: [
      {
        id: 1,
        isNewStoryPost: true,
        body: "Hello!",
        image: "/hbui/assets/world-preview-default-d72bc.jpg",
        author: {
          gamerTag: "SomeoneRandom",
        },
        timePosted: "Idk maybe 2022-01-01",
        totalComments: 1,
        totalLikes: 1,
        comments: [
          {
            body: "How did you get access to this?",
            author: {
              gamerTag: "Mojang",
            },
          }
        ],
      },
    ],
    members: [
      {
        gamerTag: "Mojang",
        isOnline: true,
        role: 2,
        profileStatus: 1,
        recentSessionsStatus: 1,
        recentSessions: [],
      },
      {
        gamerTag: "SomeoneRandom",
        gamerIcon: "/hbui/assets/minecraft-texture-pack-31669.png",
        isOnline: false,
        role: 1,
        profileStatus: 1,
        recentSessionsStatus: 1,
        recentSessions: [],
      },
    ],
  };
};

class ResourcePacksFacet {
  texturePacks = {
    activeGlobal: [],
    active: [],
    available: [
      {
        image: "/hbui/assets/minecraft-texture-pack-31669.png",
        name: "Minecraft",
        description: "A test resource pack!",
        id: "7f4bt1a2-43dd-45b1-aa3f-0b3ca2ebd5c8",
        contentId: "7f4bt1a2-43dd-45b1-aa3f-0b3ca2ebd5c8",
        isMarketplaceItem: false,
      }
    ],
    realms: [],
    unowned: [],
  };
  behaviorPacks = {
    active: [],
    available: [
      {
        image: "/hbui/assets/minecraft-texture-pack-31669.png",
        name: "Minecraft",
        description: "A test behavior pack!",
        id: "7f4bt1a2-43dd-45b1-aa3f-0b3ca2ebd5c8",
        contentId: "7f4bt1a2-43dd-45b1-aa3f-0b3ca2ebd5c8",
        isMarketplaceItem: false,
      }
    ],
  };
  status = 0;
  marketplacePackId = "1";
  userOwnsAtLeastOnePack = true;
  prompt = {
    actions: [],
    active: !1,
    body: "",
    handleAction: () => {
      debugMessage("RPFacet", colorInfo, "prompt.handleAction()");
    },
    id: "prompt",
    title: "",
  };
  activate() {
    debugMessage("RPFacet", colorInfo, "activate()");
  };
  deactivate() {
    debugMessage("RPFacet", colorInfo, "deactivate()");
  };
};



class UserAccountFacet {
  isTrialAccount = false;
  isLoggedInWithMicrosoftAccount = true;
  hasPremiumNetworkAccess = true;
  showPremiumNetworkUpsellModal() {
    debugMessage("UserAccountFacet", colorInfo, "showPremiumNetworkUpsellModal()");
  };
  showMicrosoftAccountLogInScreen() {
    debugMessage("UserAccountFacet", colorInfo, "showMicrosoftAccountLogInScreen()");
  };
};

class TelemetryFacet {
  fireEventButtonPressed(event) {
    debugMessage("VanillaTelem", colorDebug, "EventButtonPressed", {event: event});
  };
};

class PlayerMessagingServiceFacet {
  data = {
    messages: [
      {
        id: "0",
        template: "ImageText",
        surface: "LoginAnnouncement",
        additionalProperties: [
          {
            key: "header",
            value: "Test",
          },
          {
            key: "body",
            value: "Test",
          },
        ],
        images: [
          {
            id: "Primary",
            isLoaded: true,
            url: "/hbui/assets/world-preview-default-d72bc.jpg",
          },
        ],
        buttons: [
          {
            id: "Dismiss",
            text: "Test",
            reportClick: function () {
              console.log("[EngineWrapper/PlayerMessagingServiceFacet] reportClick()");
            },
          },
        ],
      },
      {
        id: "1",
        template: "ImageThumbnailCTA",
        surface: "LoginAnnouncement",
        additionalProperties: [
          {
            key: "header",
            value: "Hello World!",
          },
          {
            key: "body",
            value: "This is just a test!",
          },
        ],
        images: [
          {
            id: "Primary",
            isLoaded: true,
            url: "/hbui/assets/world-preview-default-d72bc.jpg",
          },
          {
            id: "Secondary",
            isLoaded: true,
            url: "/hbui/assets/world-preview-default-d72bc.jpg",
          },
        ],
        buttons: [
          {
            id: "CallToAction",
            text: "Hello?",
            reportClick: function () {
              console.log("[EngineWrapper/PlayerMessagingServiceFacet] reportClick()");
            },
          },
        ],
      },
      {
        id: "2",
        template: "HeroImageCTA",
        surface: "LoginAnnouncement",
        additionalProperties: [
          {
            key: "header",
            value: "Hello World!",
          },
          {
            key: "body",
            value: "This is just a test!",
          },
        ],
        images: [
          {
            id: "Primary",
            isLoaded: true,
            url: "/hbui/assets/world-preview-default-d72bc.jpg",
          },
        ],
        buttons: [
          {
            id: "CallToAction",
            text: "Hello?",
            reportClick: function () {
              console.log("[EngineWrapper/PlayerMessagingServiceFacet] reportClick()");
            },
          },
        ],
      },
    ],
  };
  reportClick(a) {
    console.log("[EngineWrapper/PlayerMessagingServiceFacet] reportClick.bind()");
  };
  reportDismiss(a) {
    console.log("[EngineWrapper/PlayerMessagingServiceFacet] reportClick.bind()");
  };
};

class PlayerReportFacet {
  reportPlayer(whereReport, reason, message, xuid, uuid) {
    console.log("[EngineWrapper/PlayerReportFacet] reportPlayer()");
  }
};

class PlayerBannedFacet {
  openBannedInfoPage() {
    console.log("[EngineWrapper/PlayerBannedFacet] openBannedInfoPage()");
  };
};

class MarketplaceSuggestionsFacet {
  getMorePacks = {
    title: "test",
    pageId: 0,
  }
};

class BuildSettingsFacet {
  isDevBuild = true;
};







const _ME_EditorFileFlags = {
  None: 0,
  New: 1,
  Export: 2,
  Close: 4,
  Exit: 8,
};
const _ME_EditorEditFlags = {
  None: 0,
  Undo: 1,
  Redo: 2,
  Settings: 4,
};
const _ME_EditorWindowFlags = {
  None: 0,
  Preview: 1,
  Selection: 2,
  Palette: 4,
  ShowUI: 8,
  ResetUI: 16,
};
const _ME_EditorHelpFlags = {
  None: 0,
  Support: 1,
  FAQ: 2,
  Documentation: 4,
};
const _ME_EditorPrototypeFlags = {
  None: 0,
  Restart: 1,
  SelectFlow: 2,
  BrushFlow: 4,
  CopyFlow: 8,
  StampFlow: 16,
  CreativePaletteFlow: 32,
};
const _ME_EditorActionFlags = {
  None: 0,
  Undo: 1,
  Redo: 2,
  Cut: 4,
  Copy: 8,
  Paste: 16,
  Players: 32,
  Sessions: 64,
};
const _ME_EditorThemes = {
  Dark: 0,
  Light: 1,
  Redstone: 2,
  HightContrast: 3,
};


class EditorFacet {
  editorTools = {
    selectedTool: 0,
  };
  fileFlags = _ME_EditorFileFlags.New;
  editFlags = _ME_EditorEditFlags.Settings;
  windowFlags = _ME_EditorWindowFlags.ShowUI;
  helpFlags = _ME_EditorHelpFlags.Documentation;
  prototypeFlags = _ME_EditorPrototypeFlags.Restart;
  actionFlags = _ME_EditorActionFlags.Players;
  editorSettings = {
    theme: _ME_EditorThemes.Dark,
  }
};

class EditorInputFacet {};

//#endregion vanilla

let _ME_Facets = {
  // == Core Facets == //
  "core.locale": new LocaleFacet(),
  "core.deviceInformation": new DeviceInfoFacet(),
  "core.safeZone": new SafeZoneFacet(),
  "core.featureFlags": new FeatureFlagsFacet(),
  "core.splitScreen": new SplitScreenFacet(),
  "core.input": new InputFacet(),
  "core.screenReader": new ScreenReaderFacet(),
  "core.router": new RouterFacet(),
  "core.customScaling": new CustomScalingFacet(),
  "core.animation": new AnimationFacet(),
  "core.sound": new SoundFacet(),
  "core.social": new SocialFacet(),
  "core.user": new UserFacet(),
  "core.performanceFacet": new performanceFacet(),
  // == Vanilla Facets == //
  "vanilla.achievements": new AchievementsFacet(),
  "vanilla.achievementsReward": new AchievementsRewardFacet(),
  "vanilla.createNewWorld": new CreateNewWorldFacet(),
  "vanilla.telemetry": new TelemetryFacet(),
  "vanilla.createNewWorldBeta": new CreateNewWorldBetaFacet(),
  "vanilla.userAccount": new UserAccountFacet(),
  "vanilla.buildSettings": new BuildSettingsFacet(),
  "vanilla.debugSettings": new DebugSettingsFacet(),
  "vanilla.resourcePacks": new ResourcePacksFacet(),
  "vanilla.options": new VanillaOptionsFacet(),
  "vanilla.simulationDistanceOptions": new SimulationDistanceOptionsFacet(),
  "vanilla.seedTemplates": new SeedTemplatesFacet(),
  "vanilla.realmsStories": new RealmsStoriesFacet(),
  "vanilla.playermessagingservice": new PlayerMessagingServiceFacet(),
  "vanilla.playerReport": new PlayerReportFacet(),
  "vanilla.marketplaceSuggestions": new MarketplaceSuggestionsFacet(),
  "vanilla.playerBanned": new PlayerBannedFacet(),
  "vanilla.editor": new EditorFacet(),
  "vanilla.editorInput": new EditorInputFacet(),
};


class TriggerEvent {
  apply(unk, data) {
    const eventType = data[0];
    switch (eventType) {
      case "facet:request":
        const facet = data[1][0];
        if (_ME_Facets.hasOwnProperty(facet)) {
          debugMessage("TriggerEvent", colorInfo, "Sending Dummy Facet", facet);
          const handler = _ME_OnBindings[`facet:updated:${facet}`];
          if(handler) handler(_ME_Facets[facet]);
        } else {
          debugMessage("TriggerEvent", colorError, "MISSING FACET", facet);
          const handler = _ME_OnBindings[`facet:error:${facet}`];
          if(handler) handler(_ME_Facets[facet]);
        }
        break;
    
      case "core:exception":
        const message = data[1];
        debugMessage("TriggerEvent", colorError, "oreUI guest has reported exception", message);
        break;

      default:
        debugMessage("TriggerEvent", colorWarn, `OreUI triggered ${eventType} but we don't handle it!`)
        break;
    }
  };
}

async function loadLocalization() {
  let version = await fetch("VERSION").then(resp => resp.text()).catch(e => {
    debugMessage("Translations", colorError, {
      "error": e,
    });
  });
  

  if(version) {
    version = version.split("\n")[0]
    debugMessage("Ore UI", colorInfo, {"Version": version});
    version = "."+version;
  }

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
  return;
}

class Engine {
  _WindowLoaded = false;

  constructor() {
    this.TriggerEvent = new TriggerEvent();

    debugMessage("Translations", colorInfo, "Loading loc.lang file...");
    
    if (USE_TRANSLATIONS) {
      loadLocalization().then(() => {
        this._WindowLoaded = true;
      })
    } else {
      engine._WindowLoaded = true;
    }
  }

  on(event, callback) {
    debugMessage("engine.on", colorInfo, {event: event});
  }
  off(event, callback) {
    debugMessage("engine.off", colorInfo, {event: event});
  }
  AddOrRemoveOnHandler(id, func, unk) {
    debugMessage("AddOrRemoveOnHandler", colorInfo, {
      ID: id,
      Function: func,
    });
    _ME_OnBindings[id] = func;
  }
  RemoveOnHandler(id, func, unk) {
    debugMessage("RemoveOnHandler", colorInfo, {
      ID: id,
      Function: func,
    });
  }
  AddOrRemoveOffHandler(id) {
    debugMessage("AddOrRemoveOffHandler", colorInfo, {
      ID: id,
    });
    return true;
  }
  BindingsReady() {
    debugMessage("BindingsReady", colorDebug);
  }
}
const engine = new Engine();
window.engine = engine;





document.addEventListener("DOMContentLoaded", () => {
  window.dispatchEvent(new HashChangeEvent("hashchange", {
    newURL: location.href,
  }));
});

const style = document.createElement("style");
style.innerHTML = `
div {
}
`;
document.body.appendChild(style);
